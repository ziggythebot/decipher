import { db } from "@/lib/db";

const DEV_CLERK_ID = process.env.DEV_CLERK_ID ?? "dev-local-user";
const DEV_EMAIL = process.env.DEV_EMAIL ?? "dev-local-user@local.dev";
const VOICE_ONLY_MODE = process.env.VOICE_ONLY_MODE === "1";

function buildFallbackUser() {
  return {
    id: "voice-only-user",
    clerkId: DEV_CLERK_ID,
    email: DEV_EMAIL,
    createdAt: new Date(),
    xp: 0,
    level: 1,
    streakDays: 0,
    lastActiveAt: null,
    totalXp: 0,
    targetLanguage: "fr",
    goalType: "social",
    deadlineDate: null,
    dailyMinutes: 15,
    grammarProfile: null,
    achievements: [],
  } as const;
}

export function getSessionClerkId(): string {
  return DEV_CLERK_ID;
}

export async function getOrCreateSessionUser() {
  if (VOICE_ONLY_MODE) {
    return buildFallbackUser();
  }

  const clerkId = getSessionClerkId();

  try {
    let user = await db.user.findUnique({
      where: { clerkId },
      include: {
        grammarProfile: true,
        achievements: { include: { achievement: true } },
      },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          clerkId,
          email: DEV_EMAIL,
          targetLanguage: "fr",
        },
        include: {
          grammarProfile: true,
          achievements: { include: { achievement: true } },
        },
      });
    }

    return user;
  } catch {
    return buildFallbackUser();
  }
}
