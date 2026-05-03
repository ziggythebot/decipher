import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { PracticeClient } from "./PracticeClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { label: string; min: number; max: number }> = {
  "top50":   { label: "Top 50 words",   min: 1,   max: 50  },
  "51to150": { label: "Words 51–150",   min: 51,  max: 150 },
  "151to500":{ label: "Words 151–500",  min: 151, max: 500 },
  "500plus": { label: "Words 500+",     min: 501, max: 9999 },
};

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
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

  const { range } = await searchParams;

  // No range selected — show picker
  if (!range || (range !== "weak" && !RANGES[range])) {
    const weakCount = await db.userVocabulary.count({
      where: { userId: user.id, state: { gte: 1 }, lapses: { gt: 0 } },
    });

    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-sm mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <Link href="/learn/vocab" className="text-zinc-500 hover:text-zinc-300 text-sm">← Vocab</Link>
            <span className="text-xs text-purple-400 bg-purple-900/30 border border-purple-800 px-2 py-0.5 rounded-full">practice</span>
          </div>
          <h1 className="text-2xl font-black mb-2">Practice</h1>
          <p className="text-zinc-400 text-sm mb-6">No-pressure quiz. Nothing gets written to your schedule.</p>

          <div className="space-y-3">
            {Object.entries(RANGES).map(([key, { label }]) => (
              <Link
                key={key}
                href={`/learn/vocab/practice?range=${key}`}
                className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors"
              >
                <div className="font-semibold text-sm">{label}</div>
              </Link>
            ))}
            {weakCount > 0 && (
              <Link
                href="/learn/vocab/practice?range=weak"
                className="block bg-red-900/20 border border-red-800 hover:border-red-600 rounded-xl p-4 transition-colors"
              >
                <div className="font-semibold text-sm text-red-300">Weak spots</div>
                <div className="text-xs text-zinc-500 mt-0.5">{weakCount} words with lapses</div>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fetch words for the selected range
  let cards;
  let rangeLabel: string;

  if (range === "weak") {
    rangeLabel = "Weak spots";
    cards = await db.userVocabulary.findMany({
      where: { userId: user.id, state: { gte: 1 }, lapses: { gt: 0 } },
      include: { word: true },
      orderBy: { lapses: "desc" },
      take: 30,
    });
  } else {
    const r = RANGES[range]!;
    rangeLabel = r.label;
    cards = await db.userVocabulary.findMany({
      where: {
        userId: user.id,
        state: { gte: 1 },
        word: { frequencyRank: { gte: r.min, lte: r.max } },
      },
      include: { word: true },
      orderBy: { word: { frequencyRank: "asc" } },
      take: 30,
    });
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-2xl font-black mb-2">No words here yet</h2>
          <p className="text-zinc-400 text-sm mb-6">Learn some words first to unlock this range.</p>
          <Link href="/learn/vocab/learn" className="block w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors">
            Start Learning →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PracticeClient
      rangeLabel={rangeLabel}
      cards={cards.map((c) => ({
        id: c.id,
        word: c.word.word,
        translation: c.word.translation,
        pronunciation: c.word.pronunciation ?? "",
        exampleSentence: c.word.exampleSentence ?? "",
        audioUrl: c.word.audioUrl ?? null,
        frequencyRank: c.word.frequencyRank,
      }))}
    />
  );
}
