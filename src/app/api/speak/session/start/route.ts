import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { SPEAK_SCENARIO_SLUGS } from "@/lib/speak/scenarios";
import { createLiveKitToken } from "@/lib/livekit/token";

type Body = {
  scenarioType?: string;
  mode?: "guided" | "freeform";
};

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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
    const token = createLiveKitToken({
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
      identity,
      room: roomName,
      name: identity,
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
