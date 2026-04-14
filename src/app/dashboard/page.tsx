import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { DashboardClient } from "./DashboardClient";

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
  const now = new Date();
  const daysToDeadline = user.deadlineDate
    ? Math.max(0, Math.ceil((user.deadlineDate.getTime() - now.getTime()) / 86400000))
    : null;

  // Stats
  let vocabCount = 0;
  let dueToday = 0;
  let sessionCount = 0;

  if (!VOICE_ONLY_MODE) {
    try {
      [vocabCount, dueToday, sessionCount] = await Promise.all([
        db.userVocabulary.count({
          where: { userId: user.id, state: { gt: 0 } },
        }),
        db.userVocabulary.count({
          where: { userId: user.id, dueDate: { lte: new Date() } },
        }),
        db.conversationSession.count({
          where: { userId: user.id },
        }),
      ]);
    } catch {
      vocabCount = 0;
      dueToday = 0;
      sessionCount = 0;
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
        grammarDone: user.grammarProfile?.deconstructionDone ?? false,
      }}
      stats={{ vocabCount, dueToday, sessionCount }}
    />
  );
}
