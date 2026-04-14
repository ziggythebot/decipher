import { cookies, headers } from "next/headers";
import { PrivyClient, type VerifyAccessTokenResponse } from "@privy-io/node";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session-cookie";

const DEV_CLERK_ID = process.env.DEV_CLERK_ID ?? "dev-local-user";
const DEV_EMAIL = process.env.DEV_EMAIL ?? "dev-local-user@local.dev";
const VOICE_ONLY_MODE = process.env.VOICE_ONLY_MODE === "1";
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

export const PRIVY_ENABLED = PRIVY_APP_ID.length > 0 && PRIVY_APP_SECRET.length > 0;

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

const privyClient = PRIVY_ENABLED
  ? new PrivyClient({
      appId: PRIVY_APP_ID,
      appSecret: PRIVY_APP_SECRET,
    })
  : null;

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

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  return scheme.toLowerCase() === "bearer" ? token.trim() : null;
}

function parseCookieValue(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) return null;
  const encoded = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`))
    ?.slice(key.length + 1);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

async function getAccessTokenFromRequest(request?: Request): Promise<string | null> {
  if (request) {
    const bearer = extractBearerToken(request.headers.get("authorization"));
    if (bearer) return bearer;
    return parseCookieValue(request.headers.get("cookie"), "privy-token");
  }

  const requestHeaders = await headers();
  const bearer = extractBearerToken(requestHeaders.get("authorization"));
  if (bearer) return bearer;

  const requestCookies = await cookies();
  return requestCookies.get("privy-token")?.value ?? null;
}

async function verifyAccessToken(token: string): Promise<VerifyAccessTokenResponse | null> {
  if (!privyClient) return null;
  try {
    return await privyClient.utils().auth().verifyAccessToken(token);
  } catch {
    return null;
  }
}

function syntheticEmailForPrivyUser(userId: string): string {
  const localPart = userId
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(0, 48);
  return `${localPart || "user"}@privy.local`;
}

export async function verifyPrivyAccessToken(accessToken: string): Promise<string | null> {
  const claims = await verifyAccessToken(accessToken);
  return claims?.user_id ?? null;
}

export async function getOrCreateUserForSubject(subject: string) {
  let user = await db.user.findUnique({
    where: { clerkId: subject },
    include: {
      grammarProfile: true,
      achievements: { include: { achievement: true } },
    },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        clerkId: subject,
        email: syntheticEmailForPrivyUser(subject),
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

function getSessionSubjectFromCookieHeader(cookieHeader: string | null): string | null {
  const token = parseCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) return null;
  const payload = verifySessionCookie(token);
  return payload?.sub ?? null;
}

async function getSessionSubject(request?: Request): Promise<string | null> {
  if (request) {
    return getSessionSubjectFromCookieHeader(request.headers.get("cookie"));
  }

  const requestCookies = await cookies();
  const token = requestCookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySessionCookie(token);
  return payload?.sub ?? null;
}

export async function getOrCreateSessionUser(options: { request?: Request; requireAuth?: boolean } = {}) {
  if (VOICE_ONLY_MODE) {
    return buildFallbackUser();
  }

  if (!PRIVY_ENABLED) {
    let user = await db.user.findUnique({
      where: { clerkId: DEV_CLERK_ID },
      include: {
        grammarProfile: true,
        achievements: { include: { achievement: true } },
      },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          clerkId: DEV_CLERK_ID,
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

  const requireAuth = Boolean(options.requireAuth ?? options.request);
  const subjectFromSession = await getSessionSubject(options.request);
  if (subjectFromSession) {
    return getOrCreateUserForSubject(subjectFromSession);
  }

  // Legacy/backstop path: allow Bearer Privy token if present (e.g. during session bootstrap).
  const accessToken = await getAccessTokenFromRequest(options.request);
  const subjectFromPrivy = accessToken ? await verifyPrivyAccessToken(accessToken) : null;
  if (!subjectFromPrivy) {
    if (requireAuth) {
      throw new AuthRequiredError();
    }
    return buildFallbackUser();
  }
  return getOrCreateUserForSubject(subjectFromPrivy);
}
