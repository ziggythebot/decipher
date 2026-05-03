import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { levelFromTotalXp } from "@/lib/xp";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";

const XP_PER_WORD = 10;

type Body = { wordIds?: string[] };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.wordIds) || body.wordIds.length === 0) {
    return NextResponse.json({ error: "wordIds required" }, { status: 400 });
  }

  const wordIds = body.wordIds.slice(0, 100);

  let user;
  try {
    user = await getOrCreateSessionUser({ request });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  // Verify these words exist and belong to the user's language
  const validWords = await db.languageWord.findMany({
    where: { id: { in: wordIds }, languageCode: user.targetLanguage },
    select: { id: true },
  });
  const validIds = validWords.map((w) => w.id);
  if (validIds.length === 0) {
    return NextResponse.json({ ok: true, count: 0, xpGain: 0 });
  }

  // Find existing UserVocabulary records for these words
  const existing = await db.userVocabulary.findMany({
    where: { userId: user.id, wordId: { in: validIds } },
    select: { id: true, wordId: true, state: true },
  });
  const existingByWordId = new Map(existing.map((v) => [v.wordId, v]));

  // Words not yet in UserVocabulary → create at state=2
  const toCreate = validIds.filter((id) => !existingByWordId.has(id));
  // Words already queued at state=0 → upgrade to state=2
  const toUpgrade = existing.filter((v) => v.state === 0).map((v) => v.id);
  // state >= 1 already: skip (already in the review system)

  const count = toCreate.length + toUpgrade.length;
  if (count === 0) {
    return NextResponse.json({ ok: true, count: 0, xpGain: 0 });
  }

  const xpGain = count * XP_PER_WORD;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  await db.$transaction(async (tx) => {
    if (toCreate.length > 0) {
      await tx.userVocabulary.createMany({
        data: toCreate.map((wordId) => ({
          userId: user.id,
          wordId,
          state: 2,
          reps: 1,
          dueDate,
          lastReview: new Date(),
          xpEarned: XP_PER_WORD,
        })),
        skipDuplicates: true,
      });
    }

    if (toUpgrade.length > 0) {
      await tx.userVocabulary.updateMany({
        where: { id: { in: toUpgrade } },
        data: {
          state: 2,
          reps: 1,
          dueDate,
          lastReview: new Date(),
          xpEarned: { increment: XP_PER_WORD },
        },
      });
    }

    const latest = await tx.user.findUnique({
      where: { id: user.id },
      select: { totalXp: true },
    });
    const totalXp = (latest?.totalXp ?? user.totalXp) + xpGain;
    const level = levelFromTotalXp(totalXp);
    await tx.user.update({
      where: { id: user.id },
      data: { xp: { increment: xpGain }, totalXp, level, lastActiveAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true, count, xpGain });
}
