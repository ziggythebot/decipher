import { db } from "@/lib/db";

export const LEARN_BATCH_SIZE = 8;
export const REVIEW_BATCH_SIZE = 20;

/** Cards the learner has already met (state >= 1) whose FSRS due date has passed. */
export async function getDueCards(userId: string, now = new Date(), take = REVIEW_BATCH_SIZE) {
  return db.userVocabulary.findMany({
    where: { userId, state: { gte: 1 }, dueDate: { lte: now } },
    include: { word: true },
    orderBy: [{ word: { frequencyRank: "asc" } }],
    take,
  });
}

/**
 * Next unlearned frequency words. Tops the user's state=0 queue up from the
 * word bank so every returned card has a UserVocabulary row (and therefore a
 * vocabId that POST /api/vocab/learn accepts).
 */
export async function getLearnQueue(
  userId: string,
  languageCode: string,
  now = new Date(),
  batchSize = LEARN_BATCH_SIZE
) {
  const queued = await db.userVocabulary.count({
    where: { userId, state: 0, dueDate: { lte: now } },
  });

  if (queued < batchSize) {
    const known = await db.userVocabulary.findMany({
      where: { userId },
      select: { wordId: true },
    });
    const excludeIds = known.map((k) => k.wordId);

    const newWords = await db.languageWord.findMany({
      where: {
        languageCode,
        id: { notIn: excludeIds.length > 0 ? excludeIds : ["none"] },
      },
      orderBy: { frequencyRank: "asc" },
      take: batchSize - queued,
    });

    if (newWords.length > 0) {
      await db.userVocabulary.createMany({
        data: newWords.map((w) => ({ userId, wordId: w.id })),
        skipDuplicates: true,
      });
    }
  }

  return db.userVocabulary.findMany({
    where: { userId, state: 0, dueDate: { lte: now } },
    include: { word: true },
    orderBy: { word: { frequencyRank: "asc" } },
    take: batchSize,
  });
}

type CardRow = Awaited<ReturnType<typeof getDueCards>>[number];

/** JSON shape shared by the web clients and the iOS app. */
export function toCardJson(c: CardRow) {
  return {
    vocabId: c.id,
    wordId: c.wordId,
    word: c.word.word,
    translation: c.word.translation,
    pronunciation: c.word.pronunciation ?? "",
    exampleSentence: c.word.exampleSentence ?? "",
    mnemonicHint: c.word.mnemonicHint ?? null,
    audioUrl: c.word.audioUrl ?? null,
    frequencyRank: c.word.frequencyRank,
    state: c.state,
    reps: c.reps,
    dueDate: c.dueDate.toISOString(),
  };
}
