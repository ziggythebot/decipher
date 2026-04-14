import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { VocabSessionClient } from "./VocabSessionClient";

export const dynamic = "force-dynamic";
const VOICE_ONLY_MODE = process.env.VOICE_ONLY_MODE === "1";

export default async function VocabPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }
  let cards: Array<{
    id: string;
    wordId: string;
    word: {
      word: string;
      translation: string;
      pronunciation: string | null;
      exampleSentence: string | null;
      mnemonicHint: string | null;
      frequencyRank: number;
    };
    state: number;
    reps: number;
  }> = [];

  if (!VOICE_ONLY_MODE) {
    try {
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
      cards = dueCards;
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

        // Create UserVocabulary entries for new words — skipDuplicates handles
        // concurrent requests racing to assign the same words.
        await db.userVocabulary.createMany({
          data: newWords.map((w) => ({ userId: user.id, wordId: w.id })),
          skipDuplicates: true,
        });

        // Fetch back with word data after creation
        cards = await db.userVocabulary.findMany({
          where: { userId: user.id, wordId: { in: newWords.map((w) => w.id) } },
          include: { word: true },
          orderBy: { word: { frequencyRank: "asc" } },
        });
      }
    } catch {
      cards = [];
    }
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
