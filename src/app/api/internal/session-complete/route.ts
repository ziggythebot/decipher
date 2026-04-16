import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduleReview } from "@/lib/srs/rating";
import type { SessionObjective } from "@/lib/session-planner";

type ErrorEntry = { error: string; corrected: boolean };

type Body = {
  sessionId?: string;
  wordsEncountered?: string[];   // target language words that appeared in session
  patternUses?: number;          // how many times target pattern was used
  errorsLogged?: ErrorEntry[];   // { error: string, corrected: boolean }[]
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

  const session = await db.conversationSession.findUnique({
    where: { id: body.sessionId },
    select: { id: true, userId: true, languageCode: true, sessionObjective: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const wordsEncountered = Array.isArray(body.wordsEncountered)
    ? body.wordsEncountered.filter((w): w is string => typeof w === "string")
    : [];
  const patternUses = Math.max(0, Math.floor(body.patternUses ?? 0));
  const errorsLogged = Array.isArray(body.errorsLogged) ? body.errorsLogged : [];

  // Determine if objective was reached
  let objectiveReached: boolean | null = null;
  const objective = session.sessionObjective as SessionObjective | null;
  if (objective?.targetPattern) {
    objectiveReached = patternUses >= objective.targetPattern.requiredUses;
  }

  // Update session record
  await db.conversationSession.update({
    where: { id: body.sessionId },
    data: {
      wordsEncountered,
      patternUses,
      errorsLogged,
      objectiveReached: objectiveReached ?? undefined,
    },
  });

  // Update FSRS for each word encountered — Rating.Good (3) for words used, Rating.Again (1) for errors
  if (wordsEncountered.length > 0) {
    const errorWords = new Set(
      errorsLogged.filter((e) => !e.corrected).map((e) => e.error.toLowerCase())
    );

    const vocabCards = await db.userVocabulary.findMany({
      where: {
        userId: session.userId,
        word: {
          languageCode: session.languageCode,
          word: { in: wordsEncountered },
        },
        state: { gte: 1 }, // only update cards that are in the learning system
      },
      include: { word: { select: { word: true } } },
    });

    const now = new Date();
    await Promise.all(
      vocabCards.map((card) => {
        const isError = errorWords.has(card.word.word.toLowerCase());
        const rating = isError ? (1 as const) : (3 as const);
        const next = scheduleReview({
          now,
          state: card.state,
          reps: card.reps,
          lapses: card.lapses,
          stability: card.stability,
          difficulty: card.difficulty,
          rating,
        });
        return db.userVocabulary.update({
          where: { id: card.id },
          data: {
            state: next.state,
            reps: next.reps,
            lapses: next.lapses,
            stability: next.stability,
            difficulty: next.difficulty,
            dueDate: next.dueDate,
            lastReview: now,
          },
        });
      })
    );
  }

  return NextResponse.json({ ok: true, objectiveReached });
}
