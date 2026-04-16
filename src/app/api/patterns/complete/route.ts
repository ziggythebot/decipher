import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage } from "@/lib/language/catalog";
import { PHRASE_PATTERN_IDS } from "@/data/phrase-patterns";
import { XP } from "@/lib/xp";

type Body = { patternId?: string };

export async function POST(request: Request) {
  let user;
  try {
    user = await getOrCreateSessionUser({ request });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.patternId || !PHRASE_PATTERN_IDS.includes(body.patternId)) {
    return NextResponse.json({ error: "Invalid patternId" }, { status: 400 });
  }

  const activeLanguage = getActiveLanguage(user);
  const existing = await db.grammarProfile.findUnique({
    where: { userId_languageCode: { userId: user.id, languageCode: activeLanguage } },
    select: { patternScores: true },
  });

  const currentScores = (existing?.patternScores ?? {}) as Record<string, number>;

  // Only set if not already at this level or higher
  const currentScore = currentScores[body.patternId] ?? 0;
  const newScore = Math.max(currentScore, 70); // 70 = introduced, not yet mastered via voice

  const updatedScores = { ...currentScores, [body.patternId]: newScore };

  await db.grammarProfile.upsert({
    where: { userId_languageCode: { userId: user.id, languageCode: activeLanguage } },
    update: { patternScores: updatedScores },
    create: {
      userId: user.id,
      languageCode: activeLanguage,
      patternScores: updatedScores,
    },
  });

  // Award XP for first-time completion
  const isFirstTime = currentScore === 0;
  if (isFirstTime) {
    await db.user.update({
      where: { id: user.id },
      data: {
        xp: { increment: XP.DECONSTRUCTION_CARD },
        totalXp: { increment: XP.DECONSTRUCTION_CARD },
        lastActiveAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true, isFirstTime, newScore });
}
