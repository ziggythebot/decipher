import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Auth is handled entirely by Basic Auth in proxy.ts — no Privy/session here.
export async function PATCH(request: Request) {

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const body = (await request.json()) as {
    isBlocked?: boolean;
    monthlyTokenBudget?: number | null;
  };

  await db.user.update({
    where: { id: userId },
    data: {
      ...(body.isBlocked !== undefined && { isBlocked: body.isBlocked }),
      ...(body.monthlyTokenBudget !== undefined && { monthlyTokenBudget: body.monthlyTokenBudget }),
    },
  });

  return NextResponse.json({ ok: true });
}
