import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SPEAK_SCENARIO_SLUGS } from "@/lib/speak/scenarios";
import { createLiveKitToken } from "@/lib/livekit/token";
import { getOrCreateSessionUser } from "@/lib/session-user";

type Body = {
  scenarioType?: string;
  mode?: "guided" | "freeform";
};

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

  const knownVocab = await db.userVocabulary.findMany({
    where: { userId: user.id, state: { gt: 0 } },
    include: { word: { select: { word: true } } },
    orderBy: { word: { frequencyRank: "asc" } },
    take: 200,
  });

  const session = await db.conversationSession.create({
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

  const livekitUrl = process.env.LIVEKIT_URL ?? null;
  const livekitApiKey = process.env.LIVEKIT_API_KEY ?? null;
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET ?? null;

  let livekit: { url: string; token: string; roomName: string } | null = null;
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

    livekit = {
      url: livekitUrl,
      token,
      roomName,
    };
  }

  return NextResponse.json({
    ok: true,
    session,
    livekit,
  });
}
