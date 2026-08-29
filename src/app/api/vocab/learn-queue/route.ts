import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getActiveLanguage } from "@/lib/language/catalog";
import { getLearnQueue, toCardJson } from "@/lib/vocab/queries";

export const dynamic = "force-dynamic";

/** GET /api/vocab/learn-queue — next unlearned frequency words (each has a vocabId for POST /api/vocab/learn). */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const languageCode = getActiveLanguage(auth.user);
  const cards = await getLearnQueue(auth.user.id, languageCode);

  return NextResponse.json({
    ok: true,
    languageCode,
    count: cards.length,
    cards: cards.map(toCardJson),
  });
}
