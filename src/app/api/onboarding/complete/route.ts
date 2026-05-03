import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { ENABLED_LANGUAGES } from "@/lib/language/catalog";

const VALID_GOALS = new Set(["travel", "social", "business"]);

type Body = {
  languageCode?: string;
  goalType?: string;
  deadlineDate?: string | null;
  dailyMinutes?: number;
};

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

  const languageCode = typeof body.languageCode === "string" ? body.languageCode : "";
  if (!ENABLED_LANGUAGES.has(languageCode)) {
    return NextResponse.json({ error: "Language not enabled" }, { status: 400 });
  }

  const goalType = typeof body.goalType === "string" ? body.goalType : "";
  if (!VALID_GOALS.has(goalType)) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  let deadlineDate: Date | null = null;
  if (body.deadlineDate) {
    const parsed = new Date(body.deadlineDate);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
    }
    deadlineDate = parsed;
  }

  const dailyMinutes =
    typeof body.dailyMinutes === "number" && body.dailyMinutes > 0
      ? Math.min(120, Math.floor(body.dailyMinutes))
      : 15;

  await db.$transaction(async (tx) => {
    // Deactivate any existing active language, then upsert the chosen one as active.
    await tx.userLanguage.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });
    await tx.userLanguage.upsert({
      where: { userId_languageCode: { userId: user.id, languageCode } },
      update: { isActive: true, lastActiveAt: new Date() },
      create: { userId: user.id, languageCode, isActive: true, lastActiveAt: new Date() },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        targetLanguage: languageCode,
        goalType,
        deadlineDate,
        dailyMinutes,
        onboardedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
