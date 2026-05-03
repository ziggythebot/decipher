import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Basic Auth gate for all /admin routes — completely separate from Privy/learner auth
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const adminUser = process.env.ADMIN_USER ?? "admin";
    const adminPass = process.env.ADMIN_PASSWORD ?? "";

    if (!adminPass) {
      return new NextResponse("Admin not configured", { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      const [scheme, encoded] = authHeader.split(" ");
      if (scheme?.toLowerCase() === "basic" && encoded) {
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        const colon = decoded.indexOf(":");
        const user = decoded.slice(0, colon);
        const pass = decoded.slice(colon + 1);
        if (user === adminUser && pass === adminPass) {
          return NextResponse.next();
        }
      }
    }

    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Decipher Admin"',
      },
    });
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
