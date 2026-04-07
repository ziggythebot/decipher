import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSessionUser } from "@/lib/session-user";

type Body = {
  sessionId?: string;
  type?: "user_utterance" | "agent_utterance" | "error";
  text?: string;
};

function extractWords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-zA-Z\u00C0-\u017F]+/g)
    .filter((w) => w.length >= 2);
  return [...new Set(tokens)];
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  if (!body.type || !["user_utterance", "agent_utterance", "error"].includes(body.type)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const user = await getOrCreateSessionUser();

  const session = await db.conversationSession.findFirst({
    where: {
      id: body.sessionId,
      userId: user.id,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const speaker = body.type === "agent_utterance" ? "Agent" : body.type === "user_utterance" ? "User" : "System";
  const transcriptLine = `[${new Date().toISOString()}] ${speaker}: ${body.text.trim()}`;
  const transcript = session.transcript ? `${session.transcript}\n${transcriptLine}` : transcriptLine;

  const existingWords = new Set(session.wordsEncountered);
  extractWords(body.text).forEach((w) => existingWords.add(w));

  const existingErrors = Array.isArray(session.errorsLogged) ? session.errorsLogged : [];
  const nextErrors =
    body.type === "error"
      ? [...existingErrors, { ts: new Date().toISOString(), text: body.text }]
      : existingErrors;

  await db.conversationSession.update({
    where: { id: session.id },
    data: {
      transcript,
      wordsEncountered: [...existingWords].slice(0, 500),
      errorsLogged: nextErrors,
    },
  });

  return NextResponse.json({ ok: true });
}
