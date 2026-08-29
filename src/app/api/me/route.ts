import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/api-auth";
import { getActiveLanguage } from "@/lib/language/catalog";
import { levelTitle, xpProgressInLevel } from "@/lib/xp";

export const dynamic = "force-dynamic";

/** GET /api/me — profile: level, XP, streak, vocab counts, active language. */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const now = new Date();
  const activeLanguage = getActiveLanguage(user);
  const langWhere = { userId: user.id, word: { languageCode: activeLanguage } };

  const [learned, mastered, inQueue, due, sessions] = await Promise.all([
    db.userVocabulary.count({ where: { ...langWhere, state: { gt: 0 } } }),
    db.userVocabulary.count({ where: { ...langWhere, state: 2 } }),
    db.userVocabulary.count({ where: { ...langWhere, state: 0 } }),
    db.userVocabulary.count({ where: { ...langWhere, state: { gte: 1 }, dueDate: { lte: now } } }),
    db.conversationSession.count({ where: { userId: user.id, mode: { not: "rude" } } }),
  ]);

  const progress = xpProgressInLevel(user.totalXp);

  return NextResponse.json({
    ok: true,
    id: user.id,
    email: user.email,
    activeLanguage,
    targetLanguage: user.targetLanguage,
    goalType: user.goalType,
    deadlineDate: user.deadlineDate ? user.deadlineDate.toISOString() : null,
    dailyMinutes: user.dailyMinutes,
    onboarded: user.onboardedAt !== null,
    level: user.level,
    levelTitle: levelTitle(user.level),
    xp: user.xp,
    totalXp: user.totalXp,
    xpInLevel: progress,
    streakDays: user.streakDays,
    lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
    vocab: { learned, mastered, inQueue, due },
    sessions,
  });
}
