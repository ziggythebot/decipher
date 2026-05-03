import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { XP, levelFromTotalXp } from "@/lib/xp";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage } from "@/lib/language/catalog";

const TOTAL_CARDS = 12;

type CardState = Record<string, { completed: boolean; skipped: boolean; xpAwarded: boolean }>;

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

  const body = (await request.json()) as { cardIndex: number; event: "card_completed" | "card_skipped" };
  const { cardIndex, event } = body;

  if (typeof cardIndex !== "number" || cardIndex < 0 || cardIndex >= TOTAL_CARDS) {
    return NextResponse.json({ error: "Invalid cardIndex" }, { status: 400 });
  }
  if (event !== "card_completed" && event !== "card_skipped") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const activeLanguage = getActiveLanguage(user);
  const grammarProfile = user.grammarProfiles.find((p) => p.languageCode === activeLanguage) ?? null;

  const existingState = (grammarProfile?.deconstructionCardState ?? {}) as CardState;
  const cardKey = String(cardIndex);
  const alreadySeen = existingState[cardKey];

  // Only award XP once per card, only for "Got it" (not skip)
  const shouldAwardXp = event === "card_completed" && !alreadySeen?.xpAwarded;
  const xpGain = shouldAwardXp ? XP.DECONSTRUCTION_CARD : 0;

  const newCardState: CardState = {
    ...existingState,
    [cardKey]: {
      completed: event === "card_completed",
      skipped: event === "card_skipped",
      xpAwarded: alreadySeen?.xpAwarded || shouldAwardXp,
    },
  };

  const seenCount = Object.keys(newCardState).length;
  const newProgress = Math.max(grammarProfile?.deconstructionProgress ?? 0, seenCount);

  await db.$transaction(async (tx) => {
    await tx.grammarProfile.upsert({
      where: { userId_languageCode: { userId: user.id, languageCode: activeLanguage } },
      update: { deconstructionProgress: newProgress, deconstructionCardState: newCardState },
      create: { userId: user.id, languageCode: activeLanguage, deconstructionProgress: newProgress, deconstructionCardState: newCardState },
    });

    if (xpGain > 0) {
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
    }
  });

  return NextResponse.json({ ok: true, xpGain, progress: newProgress });
}
