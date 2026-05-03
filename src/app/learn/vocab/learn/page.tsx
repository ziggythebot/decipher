import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { LearnClient } from "./LearnClient";

export const dynamic = "force-dynamic";
const BATCH_SIZE = 8;

export default async function LearnPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  const now = new Date();

  // 1. Get state=0 words already in the user's queue (exclude tricky cards on cooldown)
  const queued = await db.userVocabulary.findMany({
    where: {
      userId: user.id,
      state: 0,
      dueDate: { lte: now },
    },
    include: { word: true },
    orderBy: { word: { frequencyRank: "asc" } },
    take: BATCH_SIZE,
  });

  // 2. If we have fewer than BATCH_SIZE, assign more from the word bank
  if (queued.length < BATCH_SIZE) {
    const needed = BATCH_SIZE - queued.length;
    const knownIds = await db.userVocabulary.findMany({
      where: { userId: user.id },
      select: { wordId: true },
    });
    const excludeIds = knownIds.map((k) => k.wordId);

    const newWords = await db.languageWord.findMany({
      where: {
        languageCode: user.targetLanguage,
        id: { notIn: excludeIds.length > 0 ? excludeIds : ["none"] },
      },
      orderBy: { frequencyRank: "asc" },
      take: needed,
    });

    if (newWords.length > 0) {
      await db.userVocabulary.createMany({
        data: newWords.map((w) => ({ userId: user.id, wordId: w.id })),
        skipDuplicates: true,
      });
    }
  }

  // 3. Fetch the full batch (including any just-assigned, excluding cooldown tricky cards)
  const cards = await db.userVocabulary.findMany({
    where: {
      userId: user.id,
      state: 0,
      dueDate: { lte: now },
    },
    include: { word: true },
    orderBy: { word: { frequencyRank: "asc" } },
    take: BATCH_SIZE,
  });

  return (
    <LearnClient
      targetLanguage={user.targetLanguage}
      cards={cards.map((c) => ({
        id: c.id,
        word: c.word.word,
        translation: c.word.translation,
        pronunciation: c.word.pronunciation ?? "",
        exampleSentence: c.word.exampleSentence ?? "",
        mnemonicHint: c.word.mnemonicHint ?? null,
        audioUrl: c.word.audioUrl ?? null,
        frequencyRank: c.word.frequencyRank,
      }))}
    />
  );
}
