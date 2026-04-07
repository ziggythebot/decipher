import { db } from "@/lib/db";
import { getOrCreateSessionUser } from "@/lib/session-user";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getOrCreateSessionUser();
  const now = new Date();
  const daysToDeadline = user.deadlineDate
    ? Math.max(0, Math.ceil((user.deadlineDate.getTime() - now.getTime()) / 86400000))
    : null;

  // Stats
  const vocabCount = await db.userVocabulary.count({
    where: { userId: user.id, state: { gt: 0 } },
  });

  const dueToday = await db.userVocabulary.count({
    where: { userId: user.id, dueDate: { lte: new Date() } },
  });

  const sessionCount = await db.conversationSession.count({
    where: { userId: user.id },
  });

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
