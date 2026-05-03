import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { XP, levelFromTotalXp } from "@/lib/xp";
import { scheduleReview, type Rating } from "@/lib/srs/rating";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage } from "@/lib/language/catalog";

type Body = {
  vocabId?: string;
  rating?: number;
};

function isValidRating(value: number): value is Rating {
  return value >= 1 && value <= 4;
}

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
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.vocabId || typeof body.vocabId !== "string") {
    return NextResponse.json({ error: "Missing vocabId" }, { status: 400 });
  }

  if (typeof body.rating !== "number" || !isValidRating(body.rating)) {
    return NextResponse.json({ error: "Rating must be 1-4" }, { status: 400 });
  }

  let user;
  try {
    user = await getOrCreateSessionUser({ request });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const vocab = await db.userVocabulary.findFirst({
    where: {
      id: body.vocabId,
      userId: user.id,
    },
  });

  if (!vocab) {
    return NextResponse.json({ error: "Vocab item not found" }, { status: 404 });
  }

  const now = new Date();
  const schedule = scheduleReview({
    now,
    state: vocab.state,
    reps: vocab.reps,
    lapses: vocab.lapses,
    stability: vocab.stability,
    difficulty: vocab.difficulty,
    rating: body.rating,
  });

  const isGoodOrEasy = body.rating >= 3;
  let xpGained = isGoodOrEasy ? XP.WORD_CORRECT : 0;
  if (vocab.reps === 0 && isGoodOrEasy) xpGained += XP.WORD_FIRST_LEARN;
  if (schedule.becameReview) xpGained += XP.WORD_MASTERED;

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

  if (streakDays === 3) xpGained += XP.STREAK_3_DAYS;
  if (streakDays === 7) xpGained += XP.STREAK_7_DAYS;
  if (streakDays === 30) xpGained += XP.STREAK_30_DAYS;

  const result = await db.$transaction(async (tx) => {
    const updatedVocab = await tx.userVocabulary.update({
      where: { id: vocab.id },
      data: {
        state: schedule.state,
        reps: schedule.reps,
        lapses: schedule.lapses,
        stability: schedule.stability,
        difficulty: schedule.difficulty,
        dueDate: schedule.dueDate,
        lastReview: now,
        timesCorrect: isGoodOrEasy ? { increment: 1 } : undefined,
        timesFailed: !isGoodOrEasy ? { increment: 1 } : undefined,
        xpEarned: { increment: xpGained },
      },
    });

    const unlockedBonusXp: number[] = [];
    const activeLanguage = getActiveLanguage(user);
    const learnedWords = await tx.userVocabulary.count({
      where: { userId: user.id, state: { gt: 0 }, word: { languageCode: activeLanguage } },
    });

    if (learnedWords >= 1) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "first_word"));
    if (learnedWords >= 10) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "words_10"));
    if (learnedWords >= 50) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "words_50"));
    if (learnedWords >= 100) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "words_100"));
    if (learnedWords >= 500) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "words_500"));
    if (learnedWords >= 1200) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "words_1200"));

    if (streakDays >= 3) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "streak_3"));
    if (streakDays >= 7) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "streak_7"));
    if (streakDays >= 30) unlockedBonusXp.push(await unlockAchievement(tx, user.id, "streak_30"));

    const achievementXp = unlockedBonusXp.reduce((sum, n) => sum + n, 0);
    const totalGain = xpGained + achievementXp;
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
      vocabId: updatedVocab.id,
      dueDate: updatedVocab.dueDate,
      state: updatedVocab.state,
      totalGain,
      streakDays,
      level,
    };
  });

  return NextResponse.json({
    ok: true,
    rating: body.rating,
    ...result,
  });
}
