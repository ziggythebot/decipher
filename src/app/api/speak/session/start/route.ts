import { NextResponse } from "next/server";
import { AgentDispatchClient } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { SPEAK_SCENARIO_SLUGS } from "@/lib/speak/scenarios";
import { createLiveKitToken } from "@/lib/livekit/token";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage, getLanguageMeta } from "@/lib/language/catalog";
import { buildSessionObjective } from "@/lib/session-planner";

type Body = {
  scenarioType?: string;
  mode?: "guided" | "freeform" | "rude";
};
const VOICE_ONLY_MODE = process.env.VOICE_ONLY_MODE === "1";

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const mode = body.mode === "freeform" ? "freeform" : body.mode === "rude" ? "rude" : "guided";
  const scenarioType = typeof body.scenarioType === "string" ? body.scenarioType : "ordering_coffee";

  if (mode === "guided" && !SPEAK_SCENARIO_SLUGS.has(scenarioType)) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }

  let user;
  try {
    user = await getOrCreateSessionUser({ request });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  // Block check
  if (user.isBlocked) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  // Monthly token budget gate (concurrency-safe)
  if (user.monthlyTokenBudget !== null) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const agg = await db.conversationSession.aggregate({
      where: { userId: user.id, createdAt: { gte: monthStart } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    const usedTokens = (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);
    if (usedTokens >= user.monthlyTokenBudget) {
      return NextResponse.json({ error: "Monthly token budget exceeded" }, { status: 429 });
    }
  }

  let knownVocab: Array<{ word: { word: string } }> = [];
  let weakWords: string[] = [];
  let session: {
    id: string;
    createdAt: Date;
    mode: string;
    scenarioType: string | null;
  };

  // Build session objective from FSRS state + grammar profile (skip for rude mode)
  const activeLanguageEarly = getActiveLanguage(user);
  const sessionObjective =
    mode !== "rude"
      ? await buildSessionObjective(user.id, activeLanguageEarly).catch(() => null)
      : null;

  if (VOICE_ONLY_MODE) {
    session = {
      id: `voice-only-${Date.now()}`,
      createdAt: new Date(),
      mode,
      scenarioType: mode === "guided" ? scenarioType : null,
    };
  } else {
    try {
      const queries: [
        Promise<Array<{ word: { word: string } }>>,
        Promise<Array<{ word: { word: string; translation: string } }>> | Promise<never[]>,
      ] = [
        db.userVocabulary.findMany({
          where: { userId: user.id, state: { gt: 0 } },
          include: { word: { select: { word: true } } },
          orderBy: { word: { frequencyRank: "asc" } },
          take: 200,
        }),
        scenarioType === "struggle_bus"
          ? db.userVocabulary.findMany({
              where: { userId: user.id, state: { gte: 1 }, lapses: { gt: 0 } },
              include: { word: { select: { word: true, translation: true } } },
              orderBy: { lapses: "desc" },
              take: 10,
            })
          : Promise.resolve([]),
      ];

      const [knownVocabResult, weakVocabResult] = await Promise.all(queries);
      knownVocab = knownVocabResult;
      weakWords = (weakVocabResult as Array<{ word: { word: string; translation: string } }>).map(
        (v) => `${v.word.word} (${v.word.translation})`
      );

      session = await db.conversationSession.create({
        data: {
          userId: user.id,
          mode,
          languageCode: user.targetLanguage || "fr",
          scenarioType: mode === "guided" ? scenarioType : null,
          wordsEncountered: [],
          sessionObjective: sessionObjective ?? undefined,
        },
        select: {
          id: true,
          createdAt: true,
          mode: true,
          scenarioType: true,
        },
      });
    } catch {
      session = {
        id: `voice-only-${Date.now()}`,
        createdAt: new Date(),
        mode,
        scenarioType: mode === "guided" ? scenarioType : null,
      };
      knownVocab = [];
    }
  }

  const activeLanguage = getActiveLanguage(user);
  const langMeta = getLanguageMeta(activeLanguage);
  const activeGrammarProfile = user.grammarProfiles.find((p) => p.languageCode === activeLanguage) ?? null;

  const livekitUrl = process.env.LIVEKIT_URL ?? null;
  const livekitApiKey = process.env.LIVEKIT_API_KEY ?? null;
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET ?? null;
  const livekitAgentName = process.env.LIVEKIT_AGENT_NAME ?? "decipher-agent";

  let livekit: { url: string; token: string; roomName: string; dispatchCreated: boolean } | null = null;
  if (livekitUrl && livekitApiKey && livekitApiSecret) {
    const roomName = `decipher-${user.id}-${session.id}`;
    const identity = `learner-${user.id}-${session.id}`;
    const participantMetadata = JSON.stringify({
      userName: user.email ? user.email.split("@")[0] : identity,
      knownWords: knownVocab.map((entry) => entry.word.word),
      weakWords,
      grammarProfile: activeGrammarProfile?.patternScores ?? {},
      goalType: user.goalType,
      sessionMode: mode,
      scenarioType: mode === "guided" || mode === "rude" ? scenarioType : "freeform",
      languageName: langMeta.name,
      targetLanguage: activeLanguage,
      sessionId: session.id,
      sessionObjective: sessionObjective ?? null,
    });

    const token = createLiveKitToken({
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
      identity,
      room: roomName,
      name: identity,
      metadata: participantMetadata,
      ttlSeconds: 60 * 30,
    });

    let dispatchCreated = false;
    try {
      const httpHost = livekitUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
      const dispatchClient = new AgentDispatchClient(httpHost, livekitApiKey, livekitApiSecret);
      await dispatchClient.createDispatch(roomName, livekitAgentName, {
        metadata: participantMetadata,
      });
      dispatchCreated = true;
    } catch {
      dispatchCreated = false;
    }

    livekit = {
      url: livekitUrl,
      token,
      roomName,
      dispatchCreated,
    };
  }

  return NextResponse.json({
    ok: true,
    session,
    livekit,
  });
}
