import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Body = {
  sessionId?: string;
  inputTokensDelta?: number;
  outputTokensDelta?: number;
  ttsCharsDelta?: number;
  sttSeconds?: number;
};

export async function POST(request: Request) {
  const secret = request.headers.get("X-Internal-Secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const inputDelta  = Math.max(0, Math.floor(body.inputTokensDelta  ?? 0));
  const outputDelta = Math.max(0, Math.floor(body.outputTokensDelta ?? 0));
  const charsDelta  = Math.max(0, Math.floor(body.ttsCharsDelta     ?? 0));

  const updateData: Record<string, unknown> = {
    inputTokens:  { increment: inputDelta },
    outputTokens: { increment: outputDelta },
    ttsChars:     { increment: charsDelta },
  };

  // sttSeconds is a final value (total session seconds), not a delta
  if (typeof body.sttSeconds === "number" && body.sttSeconds > 0) {
    updateData.sttSeconds = body.sttSeconds;
  }

  await db.conversationSession.update({
    where: { id: body.sessionId },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}
