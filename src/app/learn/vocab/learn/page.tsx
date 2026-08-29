import { getLearnQueue } from "@/lib/vocab/queries";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { LearnClient } from "./LearnClient";

export const dynamic = "force-dynamic";

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

  const cards = await getLearnQueue(user.id, user.targetLanguage);

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
