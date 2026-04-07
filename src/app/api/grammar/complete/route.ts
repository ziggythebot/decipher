import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { XP, levelFromTotalXp } from "@/lib/xp";
import { getOrCreateSessionUser } from "@/lib/session-user";

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayDiffUtc(a: Date, b: Date): number {
  const dayA = startOfUtcDay(a).getTime();
  const dayB = startOfUtcDay(b).getTime();
  return Math.round((dayA - dayB) / 86400000);
}

async function unlockAchievement(
  tx: Prisma.TransactionClient,
  userId: string,
  slug: string
): Promise<number> {
  const achievement = ACHIEVEMENTS.find((a) => a.slug === slug);
  if (!achievement) return 0;

  const dbAchievement = await tx.achievement.findUnique({ where: { slug } });
  if (!dbAchievement) return 0;

  const existing = await tx.userAchievement.findFirst({
    where: { userId, achievementId: dbAchievement.id },
    select: { id: true },
  });
  if (existing) return 0;

  await tx.userAchievement.create({
    data: {
      userId,
      achievementId: dbAchievement.id,
    },
  });

  return dbAchievement.xpReward + XP.ACHIEVEMENT_UNLOCK;
}

export async function POST() {
  const user = await getOrCreateSessionUser();

  const now = new Date();
  const alreadyCompleted = user.grammarProfile?.deconstructionDone ?? false;

  if (alreadyCompleted) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  let streakDays = user.streakDays;
  if (!user.lastActiveAt) {
    streakDays = 1;
  } else {
    const daysSinceLast = dayDiffUtc(now, user.lastActiveAt);
    if (daysSinceLast <= 0) {
      streakDays = user.streakDays;
    } else if (daysSinceLast === 1) {
      streakDays = user.streakDays + 1;
    } else {
      streakDays = 1;
    }
  }

  const result = await db.$transaction(async (tx) => {
    await tx.grammarProfile.upsert({
      where: { userId: user.id },
      update: {
        deconstructionDone: true,
        completedAt: now,
      },
      create: {
        userId: user.id,
        deconstructionDone: true,
        completedAt: now,
      },
    });

    let totalGain = XP.DECONSTRUCTION_COMPLETE;
    totalGain += await unlockAchievement(tx, user.id, "deconstruction_done");

    const latestUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { totalXp: true },
    });
    const totalXp = (latestUser?.totalXp ?? user.totalXp) + totalGain;
    const level = levelFromTotalXp(totalXp);

    await tx.user.update({
      where: { id: user.id },
      data: {
        xp: { increment: totalGain },
        totalXp,
        level,
        streakDays,
        lastActiveAt: now,
      },
    });

    return { totalGain, totalXp, level, streakDays };
  });

  return NextResponse.json({
    ok: true,
    alreadyCompleted: false,
    ...result,
  });
}
