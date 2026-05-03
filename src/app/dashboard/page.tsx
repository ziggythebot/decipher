import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage } from "@/lib/language/catalog";
import { DashboardClient } from "./DashboardClient";
import { PHRASE_PATTERNS } from "@/data/phrase-patterns";

export const dynamic = "force-dynamic";
const VOICE_ONLY_MODE = process.env.VOICE_ONLY_MODE === "1";

export default async function DashboardPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  if (!user.onboardedAt) {
    redirect("/onboarding");
  }

  const activeLanguage = getActiveLanguage(user);
  const grammarProfile = user.grammarProfiles.find((p) => p.languageCode === activeLanguage) ?? null;

  const now = new Date();
  const daysToDeadline = user.deadlineDate
    ? Math.max(0, Math.ceil((user.deadlineDate.getTime() - now.getTime()) / 86400000))
    : null;

  const patternScores = (grammarProfile?.patternScores ?? {}) as Record<string, number>;
  const patternsCompleted = PHRASE_PATTERNS.filter((p) => (patternScores[p.id] ?? 0) >= 70).length;
  const totalPatterns = PHRASE_PATTERNS.length;
  // Find the first incomplete pattern for direct linking
  const nextPattern = PHRASE_PATTERNS.find((p) => (patternScores[p.id] ?? 0) < 70);

  // Stats
  let vocabCount = 0;
  let dueToday = 0;
  let newWordsQueued = 0;
  let sessionCount = 0;

  if (!VOICE_ONLY_MODE) {
    try {
      [vocabCount, dueToday, newWordsQueued, sessionCount] = await Promise.all([
        // Words learned (state >= 1)
        db.userVocabulary.count({
          where: { userId: user.id, state: { gte: 1 } },
        }),
        // Due for review (state >= 1 AND dueDate <= now — excludes new/unseen)
        db.userVocabulary.count({
          where: { userId: user.id, state: { gte: 1 }, dueDate: { lte: new Date() } },
        }),
        // New words queued for learn mode (state = 0)
        db.userVocabulary.count({
          where: { userId: user.id, state: 0 },
        }),
        db.conversationSession.count({
          where: { userId: user.id, mode: { not: "rude" } },
        }),
      ]);
    } catch {
      vocabCount = 0; dueToday = 0; newWordsQueued = 0; sessionCount = 0;
    }
  }

  return (
    <DashboardClient
      user={{
        id: user.id,
        xp: user.xp,
        level: user.level,
        streakDays: user.streakDays,
        totalXp: user.totalXp,
        targetLanguage: user.targetLanguage,
        goalType: user.goalType,
        daysToDeadline,
        grammarDone: grammarProfile?.deconstructionDone ?? false,
        patternsCompleted,
        totalPatterns,
        nextPatternId: nextPattern?.id ?? null,
      }}
      stats={{ vocabCount, dueToday, newWordsQueued, sessionCount }}
    />
  );
}
