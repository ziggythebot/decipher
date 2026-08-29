import { NextResponse } from "next/server";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";

type SessionUser = Awaited<ReturnType<typeof getOrCreateSessionUser>>;

/**
 * Bearer/cookie auth for JSON read endpoints. Returns the user, or the
 * NextResponse to send straight back (401 unauthorized, 403 blocked).
 */
export async function requireApiUser(
  request: Request
): Promise<{ user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }> {
  try {
    const user = await getOrCreateSessionUser({ request, requireAuth: true });
    if ("isBlocked" in user && user.isBlocked) {
      return { response: NextResponse.json({ error: "Account blocked" }, { status: 403 }) };
    }
    return { user };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    throw error;
  }
}
