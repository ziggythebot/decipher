import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { VocabSessionClient } from "./VocabSessionClient";

export default async function VocabPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) redirect("/dashboard");

  // Get due cards (FSRS: dueDate <= now), prioritised by frequency rank
  const dueCards = await db.userVocabulary.findMany({
    where: {
      userId: user.id,
      dueDate: { lte: new Date() },
    },
    include: { word: true },
    orderBy: [{ word: { frequencyRank: "asc" } }],
    take: 20, // max 20 per session — ADHD-friendly session cap
  });

  // If no due cards, introduce new ones (next unlearned by frequency rank)
  let cards = dueCards;
  if (cards.length === 0) {
    const knownWordIds = await db.userVocabulary.findMany({
      where: { userId: user.id },
      select: { wordId: true },
    });
    const knownIds = knownWordIds.map((k) => k.wordId);

    const newWords = await db.languageWord.findMany({
      where: {
        languageCode: user.targetLanguage,
        id: { notIn: knownIds.length > 0 ? knownIds : ["none"] },
      },
      orderBy: { frequencyRank: "asc" },
      take: 10,
    });

    // Create UserVocabulary entries for new words
    const newVocab = await Promise.all(
      newWords.map((w) =>
        db.userVocabulary.create({
          data: { userId: user.id, wordId: w.id },
          include: { word: true },
        })
      )
    );
    cards = newVocab;
  }

  return (
    <VocabSessionClient
      cards={cards.map((c) => ({
        id: c.id,
        wordId: c.wordId,
        word: c.word.word,
        translation: c.word.translation,
        pronunciation: c.word.pronunciation ?? "",
        exampleSentence: c.word.exampleSentence ?? "",
        mnemonicHint: c.word.mnemonicHint ?? null,
        frequencyRank: c.word.frequencyRank,
        state: c.state,
        reps: c.reps,
      }))}
    />
  );
}
