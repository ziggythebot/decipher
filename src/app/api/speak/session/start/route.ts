import { NextResponse } from "next/server";
import { AgentDispatchClient } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { SPEAK_SCENARIO_SLUGS } from "@/lib/speak/scenarios";
import { createLiveKitToken } from "@/lib/livekit/token";
import { getOrCreateSessionUser } from "@/lib/session-user";

type Body = {
  scenarioType?: string;
  mode?: "guided" | "freeform";
};
const VOICE_ONLY_MODE = process.env.VOICE_ONLY_MODE === "1";

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const mode = body.mode === "freeform" ? "freeform" : "guided";
  const scenarioType = typeof body.scenarioType === "string" ? body.scenarioType : "ordering_coffee";

  if (mode === "guided" && !SPEAK_SCENARIO_SLUGS.has(scenarioType)) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }

  const user = await getOrCreateSessionUser();

  let knownVocab: Array<{ word: { word: string } }> = [];
  let session: {
    id: string;
    createdAt: Date;
    mode: string;
    scenarioType: string | null;
  };

  if (VOICE_ONLY_MODE) {
    session = {
      id: `voice-only-${Date.now()}`,
      createdAt: new Date(),
      mode,
      scenarioType: mode === "guided" ? scenarioType : null,
    };
  } else {
    try {
      knownVocab = await db.userVocabulary.findMany({
        where: { userId: user.id, state: { gt: 0 } },
        include: { word: { select: { word: true } } },
        orderBy: { word: { frequencyRank: "asc" } },
        take: 200,
      });

      session = await db.conversationSession.create({
        data: {
          userId: user.id,
          mode,
          scenarioType: mode === "guided" ? scenarioType : null,
          wordsEncountered: [],
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

  const livekitUrl = process.env.LIVEKIT_URL ?? null;
  const livekitApiKey = process.env.LIVEKIT_API_KEY ?? null;
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET ?? null;
  const livekitAgentName = process.env.LIVEKIT_AGENT_NAME ?? "decipher-agent";

  let livekit: { url: string; token: string; roomName: string; dispatchCreated: boolean } | null = null;
  if (livekitUrl && livekitApiKey && livekitApiSecret) {
    const roomName = `decipher-${user.id}-${session.id}`;
    const identity = `learner-${user.id}`;
    const languageName =
      user.targetLanguage === "fr"
        ? "French"
        : user.targetLanguage === "es"
          ? "Spanish"
          : user.targetLanguage === "pt"
            ? "Portuguese"
            : user.targetLanguage === "de"
              ? "German"
              : user.targetLanguage;
    const participantMetadata = JSON.stringify({
      userName: user.email ? user.email.split("@")[0] : identity,
      knownWords: knownVocab.map((entry) => entry.word.word),
      grammarProfile: user.grammarProfile?.patternScores ?? {},
      goalType: user.goalType,
      sessionMode: mode,
      scenarioType: mode === "guided" ? scenarioType : "freeform",
      languageName,
      targetLanguage: user.targetLanguage,
      sessionId: session.id,
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
