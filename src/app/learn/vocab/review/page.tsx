import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { VocabSessionClient } from "../VocabSessionClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  // Review mode: only cards that have been learned (state >= 1) and are due
  const dueCards = await db.userVocabulary.findMany({
    where: {
      userId: user.id,
      state: { gte: 1 },
      dueDate: { lte: new Date() },
    },
    include: { word: true },
    orderBy: [{ word: { frequencyRank: "asc" } }],
    take: 20,
  });

  return (
    <VocabSessionClient
      mode="review"
      targetLanguage={user.targetLanguage}
      cards={dueCards.map((c) => ({
        id: c.id,
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
      }))}
    />
  );
}
