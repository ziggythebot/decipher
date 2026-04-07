import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Get or create user
  let user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      grammarProfile: true,
      achievements: { include: { achievement: true } },
    },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        clerkId: userId,
        email: "", // filled from Clerk webhook
        targetLanguage: "fr",
      },
      include: {
        grammarProfile: true,
        achievements: { include: { achievement: true } },
      },
    });
  }

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
        deadlineDate: user.deadlineDate?.toISOString() ?? null,
        grammarDone: user.grammarProfile?.deconstructionDone ?? false,
      }}
      stats={{ vocabCount, dueToday, sessionCount }}
    />
  );
}
