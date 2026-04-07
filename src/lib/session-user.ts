import { db } from "@/lib/db";

const DEV_CLERK_ID = process.env.DEV_CLERK_ID ?? "dev-local-user";
const DEV_EMAIL = process.env.DEV_EMAIL ?? "dev-local-user@local.dev";

export function getSessionClerkId(): string {
  return DEV_CLERK_ID;
}

export async function getOrCreateSessionUser() {
  const clerkId = getSessionClerkId();

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
}
