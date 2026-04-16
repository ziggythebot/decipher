import { notFound, redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage } from "@/lib/language/catalog";
import { getPhrasePattern } from "@/data/phrase-patterns";
import { PatternUnitClient } from "./PatternUnitClient";

export const dynamic = "force-dynamic";

export default async function PatternUnitPage({
  params,
}: {
  params: Promise<{ patternId: string }>;
}) {
  const { patternId } = await params;
  const pattern = getPhrasePattern(patternId);
  if (!pattern) notFound();

  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  const activeLanguage = getActiveLanguage(user);
  const profile = user.grammarProfiles.find((p) => p.languageCode === activeLanguage) ?? null;
  const patternScores = (profile?.patternScores ?? {}) as Record<string, number>;
  const alreadyDone = (patternScores[pattern.id] ?? 0) >= 70;

  return <PatternUnitClient pattern={pattern} alreadyDone={alreadyDone} />;
}
