import { NextResponse } from "next/server";
import { createSessionCookie, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session-cookie";
import {
  PRIVY_ENABLED,
  getOrCreateUserForSubject,
  verifyPrivyAccessToken,
} from "@/lib/session-user";

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  return scheme.toLowerCase() === "bearer" ? token.trim() : null;
}

export async function POST(request: Request) {
  if (!PRIVY_ENABLED) {
    return NextResponse.json({ error: "Privy is not configured" }, { status: 503 });
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const subject = await verifyPrivyAccessToken(accessToken);
  if (!subject) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const user = await getOrCreateUserForSubject(subject);
  const sessionToken = createSessionCookie(subject);

  const response = NextResponse.json({ ok: true, userId: user.id });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  return response;
}
