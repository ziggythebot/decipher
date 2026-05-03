import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VocabHubPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  const now = new Date();
  const [dueToday, newWordsQueued, learnedCount, weakCount, scannableCount] = await Promise.all([
    db.userVocabulary.count({
      where: { userId: user.id, state: { gte: 1 }, dueDate: { lte: now } },
    }),
    db.userVocabulary.count({
      where: { userId: user.id, state: 0 },
    }),
    db.userVocabulary.count({
      where: { userId: user.id, state: { gte: 1 } },
    }),
    db.userVocabulary.count({
      where: { userId: user.id, state: { gte: 1 }, lapses: { gt: 0 } },
    }),
    // Words in top 100 not yet advanced past state=0 (scan available)
    db.languageWord.count({
      where: {
        languageCode: user.targetLanguage,
        frequencyRank: { lte: 100 },
        NOT: {
          userVocabulary: {
            some: { userId: user.id, state: { gte: 1 } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-sm mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm">← Dashboard</Link>
        </div>

        <h1 className="text-2xl font-black mb-1">Vocabulary</h1>
        <p className="text-zinc-500 text-sm mb-6">{learnedCount} words in your review queue</p>

        <div className="space-y-3">
          {/* Learn */}
          <Link
            href="/learn/vocab/learn"
            className="block bg-zinc-900 border border-green-800/50 hover:border-green-700 rounded-xl p-5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🌱</span>
                  <span className="font-bold">Learn</span>
                </div>
                <div className="text-zinc-400 text-xs">
                  {newWordsQueued > 0
                    ? `${newWordsQueued} new words queued`
                    : "New words ready to assign"}
                </div>
              </div>
              <span className="text-green-400 text-lg">→</span>
            </div>
          </Link>

          {/* Review */}
          <Link
            href="/learn/vocab/review"
            className={`block bg-zinc-900 rounded-xl p-5 transition-colors border ${
              dueToday > 0
                ? "border-indigo-700 hover:border-indigo-500"
                : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔁</span>
                  <span className="font-bold">Review</span>
                  {dueToday > 0 && (
                    <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                      {dueToday} due
                    </span>
                  )}
                </div>
                <div className="text-zinc-400 text-xs">
                  {dueToday > 0 ? "FSRS spaced repetition" : "All caught up — check back later"}
                </div>
              </div>
              <span className={dueToday > 0 ? "text-indigo-400 text-lg" : "text-zinc-600 text-lg"}>→</span>
            </div>
          </Link>

          {/* Practice */}
          <Link
            href="/learn/vocab/practice"
            className="block bg-zinc-900 border border-zinc-800 hover:border-purple-700 rounded-xl p-5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎯</span>
                  <span className="font-bold">Practice</span>
                  {weakCount > 0 && (
                    <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded-full font-semibold">
                      {weakCount} weak
                    </span>
                  )}
                </div>
                <div className="text-zinc-400 text-xs">Free quiz by range — no schedule writes</div>
              </div>
              <span className="text-purple-400 text-lg">→</span>
            </div>
          </Link>

          {/* Quick Scan */}
          <Link
            href="/learn/vocab/scan"
            className="block bg-zinc-900 border border-blue-900/50 hover:border-blue-700 rounded-xl p-5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">⚡</span>
                  <span className="font-bold">Quick Scan</span>
                  {scannableCount > 0 && (
                    <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded-full font-semibold">
                      {scannableCount} words
                    </span>
                  )}
                </div>
                <div className="text-zinc-400 text-xs">Already know some? Tap them — skip Learn, bank XP</div>
              </div>
              <span className="text-blue-400 text-lg">→</span>
            </div>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
