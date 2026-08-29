import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getDueCards, toCardJson } from "@/lib/vocab/queries";

export const dynamic = "force-dynamic";

/** GET /api/vocab/due — FSRS cards due for review (state >= 1, dueDate <= now). */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const now = new Date();
  const cards = await getDueCards(auth.user.id, now);

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    count: cards.length,
    cards: cards.map(toCardJson),
  });
}
