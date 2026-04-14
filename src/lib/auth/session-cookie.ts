import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "decipher_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.PRIVY_APP_SECRET ??
    "dev-insecure-session-secret-change-me"
  );
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
}

export function createSessionCookie(subject: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: subject,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionCookie(token: string): SessionPayload | null {
  const [payloadB64, providedSig] = token.split(".");
  if (!payloadB64 || !providedSig) return null;

  const expectedSig = sign(payloadB64);
  const a = Buffer.from(expectedSig, "utf8");
  const b = Buffer.from(providedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
