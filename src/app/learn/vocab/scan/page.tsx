import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { ScanClient } from "./ScanClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  // Words for this page range
  const pageWords = await db.languageWord.findMany({
    where: { languageCode: user.targetLanguage },
    orderBy: { frequencyRank: "asc" },
    skip,
    take: PAGE_SIZE,
  });

  // Check if there's a next page
  const hasNextPage = pageWords.length === PAGE_SIZE;

  // Exclude words the user has already progressed past state=0
  const alreadyAdvanced = await db.userVocabulary.findMany({
    where: {
      userId: user.id,
      wordId: { in: pageWords.map((w) => w.id) },
      state: { gte: 1 },
    },
    select: { wordId: true },
  });
  const advancedIds = new Set(alreadyAdvanced.map((v) => v.wordId));

  const scanWords = pageWords
    .filter((w) => !advancedIds.has(w.id))
    .map((w) => ({
      id: w.id,
      word: w.word,
      translation: w.translation,
      frequencyRank: w.frequencyRank,
    }));

  const rangeStart = skip + 1;
  const rangeEnd = skip + pageWords.length;

  if (pageWords.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-black mb-2">That&apos;s all of them</h2>
          <p className="text-zinc-400 text-sm mb-6">No more words in this range.</p>
          <Link href="/learn/vocab" className="block w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors">
            Back to Vocab Hub
          </Link>
        </div>
      </div>
    );
  }

  if (scanWords.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-black mb-2">All done here</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Words {rangeStart}–{rangeEnd} are already in your review queue.
          </p>
          <div className="flex flex-col gap-2">
            {hasNextPage && (
              <Link
                href={`/learn/vocab/scan?page=${page + 1}`}
                className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Scan words {rangeEnd + 1}–{rangeEnd + PAGE_SIZE} →
              </Link>
            )}
            <Link href="/learn/vocab" className="block w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors">
              Back to Vocab Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScanClient
      words={scanWords}
      page={page}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      hasNextPage={hasNextPage}
    />
  );
}
