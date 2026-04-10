import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { XP, levelFromTotalXp } from "@/lib/xp";
import {
  countUserTurns,
  extractCorrectedForms,
  summarizeErrorCategories,
} from "@/lib/speak/analytics";
import { getOrCreateSessionUser } from "@/lib/session-user";
const VOICE_ONLY_MODE = process.env.VOICE_ONLY_MODE === "1";

type Body = {
  sessionId?: string;
  durationSec?: number;
  newWordsCount?: number;
  accuracyPct?: number;
};

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z\u00C0-\u017F]+/g)
    .filter((w) => w.length >= 2);
}

function transcriptWords(transcript: string | null): Set<string> {
  const lines = (transcript ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const words = new Set<string>();

  for (const line of lines) {
    for (const word of extractWords(line)) words.add(word);
  }

  return words;
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

  if (VOICE_ONLY_MODE) {
    return NextResponse.json({
      ok: true,
      alreadyEnded: false,
      sessionId: body.sessionId,
      totalGain: XP.CONVO_SESSION,
      level: 1,
      streakDays: 0,
      durationSec,
      sessionCount: 0,
      inferredNewWordsCount: newWordsCount,
      inferredAccuracy: accuracyPct,
      errorCount: 0,
      categoryCounts: {
        grammar: 0,
        vocab: 0,
        pronunciation: 0,
        hesitation: 0,
        other: 0,
      },
      correctedForms: [],
      skippedPersistence: true,
    });
  }

  const user = await getOrCreateSessionUser();

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

  const knownVocab = await db.userVocabulary.findMany({
    where: { userId: user.id, state: { gt: 0 } },
    include: { word: { select: { word: true } } },
    take: 2000,
  });
  const knownWordSet = new Set(knownVocab.map((entry) => entry.word.word.toLowerCase()));
  const transcript = session.transcript ?? "";
  const userTurns = countUserTurns(transcript);
  const uniqueWords = transcriptWords(transcript);
  const inferredUnknownWords = [...uniqueWords].filter((word) => !knownWordSet.has(word) && word.length >= 3);
  const inferredNewWordsCount = inferredUnknownWords.length;
  const effectiveNewWordsCount = Math.max(newWordsCount, inferredNewWordsCount);

  const existingErrors = Array.isArray(session.errorsLogged) ? session.errorsLogged : [];
  const errorCount = existingErrors.length;
  const categoryCounts = summarizeErrorCategories({
    transcript,
    errorsLogged: existingErrors,
    inferredUnknownWordCount: inferredNewWordsCount,
  });
  const correctedForms = extractCorrectedForms(transcript);
  const inferredAccuracy =
    accuracyPct ??
    (userTurns > 0
      ? Math.max(0, Math.min(100, Math.round(((userTurns - Math.min(errorCount, userTurns)) / userTurns) * 100)))
      : null);
  const analysisSummary = {
    type: "analysis_summary",
    ts: new Date().toISOString(),
    categories: categoryCounts,
    correctedForms,
    inferredUnknownWords: inferredUnknownWords.slice(0, 30),
    userTurns,
  };
  const nextErrorsForSave = [...existingErrors, analysisSummary];

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
  let xpGain = XP.CONVO_SESSION + minutes * XP.CONVO_MINUTE + effectiveNewWordsCount * XP.CONVO_NEW_WORD_USED;

  if (streakDays === 3) xpGain += XP.STREAK_3_DAYS;
  if (streakDays === 7) xpGain += XP.STREAK_7_DAYS;
  if (streakDays === 30) xpGain += XP.STREAK_30_DAYS;

  const result = await db.$transaction(async (tx) => {
    await tx.conversationSession.update({
      where: { id: session.id },
      data: {
        duration: durationSec,
        xpEarned: xpGain,
        newWordsCount: effectiveNewWordsCount,
        accuracyPct: inferredAccuracy,
        errorsLogged: nextErrorsForSave,
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
      inferredNewWordsCount: effectiveNewWordsCount,
      inferredAccuracy,
      errorCount,
      categoryCounts,
      correctedForms,
    };
  });

  return NextResponse.json({
    ok: true,
    alreadyEnded: false,
    ...result,
  });
}
