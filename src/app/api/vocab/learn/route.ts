import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { XP, levelFromTotalXp } from "@/lib/xp";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";

type Body = { vocabId?: string; confidence?: number };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.vocabId || typeof body.vocabId !== "string") {
    return NextResponse.json({ error: "Missing vocabId" }, { status: 400 });
  }
  const confidence = body.confidence;
  if (typeof confidence !== "number" || confidence < 1 || confidence > 3) {
    return NextResponse.json({ error: "confidence must be 1–3" }, { status: 400 });
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
    where: { id: body.vocabId, userId: user.id },
  });
  if (!vocab) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newSeenCount = vocab.seenCount + 1;
  // Graduate immediately on "Got it" (3), or after two viewings on "OK" (2)
  const graduated = confidence >= 2 && (confidence === 3 || newSeenCount >= 2) && vocab.state === 0;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // XP: small reward for showing up; bonus on graduation
  const xpGain = XP.WORD_SEEN + (graduated ? XP.WORD_FIRST_LEARN : 0);

  await db.$transaction(async (tx) => {
    await tx.userVocabulary.update({
      where: { id: vocab.id },
      data: {
        seenCount: newSeenCount,
        initialConfidence: confidence,
        ...(graduated && {
          state: 1,
          reps: 1,
          dueDate: tomorrow,
          lastReview: new Date(),
        }),
        // Push tricky cards to tomorrow so they don't recycle into the next batch
        ...(!graduated && confidence === 1 && {
          dueDate: tomorrow,
        }),
        xpEarned: { increment: xpGain },
      },
    });

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

  return NextResponse.json({ ok: true, graduated, xpGain });
}
