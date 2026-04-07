import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { XP, levelFromTotalXp } from "@/lib/xp";

type Body = {
  sessionId?: string;
  durationSec?: number;
  newWordsCount?: number;
  accuracyPct?: number;
};

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

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  if (typeof body.durationSec !== "number" || Number.isNaN(body.durationSec)) {
    return NextResponse.json({ error: "Missing durationSec" }, { status: 400 });
  }

  const durationSec = Math.max(0, Math.floor(body.durationSec));
  const newWordsCount = Math.max(0, Math.floor(body.newWordsCount ?? 0));
  const accuracyPctRaw = body.accuracyPct;
  const accuracyPct =
    typeof accuracyPctRaw === "number" && !Number.isNaN(accuracyPctRaw)
      ? Math.max(0, Math.min(100, Math.floor(accuracyPctRaw)))
      : null;

  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const session = await db.conversationSession.findFirst({
    where: {
      id: body.sessionId,
      userId: user.id,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.duration !== null) {
    return NextResponse.json({ ok: true, alreadyEnded: true, sessionId: session.id });
  }

  let streakDays = user.streakDays;
  const now = new Date();
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

  const minutes = Math.floor(durationSec / 60);
  let xpGain = XP.CONVO_SESSION + minutes * XP.CONVO_MINUTE + newWordsCount * XP.CONVO_NEW_WORD_USED;

  if (streakDays === 3) xpGain += XP.STREAK_3_DAYS;
  if (streakDays === 7) xpGain += XP.STREAK_7_DAYS;
  if (streakDays === 30) xpGain += XP.STREAK_30_DAYS;

  const result = await db.$transaction(async (tx) => {
    await tx.conversationSession.update({
      where: { id: session.id },
      data: {
        duration: durationSec,
        xpEarned: xpGain,
        newWordsCount,
        accuracyPct,
      },
    });

    const sessionCount = await tx.conversationSession.count({
      where: { userId: user.id, duration: { not: null } },
    });

    let achievementXp = 0;
    if (sessionCount >= 1) achievementXp += await unlockAchievement(tx, user.id, "first_convo");
    if (sessionCount >= 10) achievementXp += await unlockAchievement(tx, user.id, "convo_sessions_10");
    if (durationSec >= 600) achievementXp += await unlockAchievement(tx, user.id, "convo_10min");

    const totalGain = xpGain + achievementXp;

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

    return {
      sessionId: session.id,
      totalGain,
      level,
      streakDays,
      durationSec,
      sessionCount,
    };
  });

  return NextResponse.json({
    ok: true,
    alreadyEnded: false,
    ...result,
  });
}
