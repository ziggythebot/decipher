import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage } from "@/lib/language/catalog";
import { PHRASE_PATTERNS } from "@/data/phrase-patterns";

export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  const activeLanguage = getActiveLanguage(user);
  const profile = user.grammarProfiles.find((p) => p.languageCode === activeLanguage) ?? null;
  const patternScores = (profile?.patternScores ?? {}) as Record<string, number>;

  const completedCount = PHRASE_PATTERNS.filter((p) => (patternScores[p.id] ?? 0) >= 70).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-black mt-3 mb-1">Sentence Patterns</h1>
          <p className="text-zinc-400 text-sm">
            15 frames that cover 70% of everyday conversation. Each takes 3–4 minutes.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-2 bg-indigo-500 rounded-full transition-all"
                style={{ width: `${(completedCount / PHRASE_PATTERNS.length) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-zinc-300 whitespace-nowrap">
              {completedCount}/{PHRASE_PATTERNS.length} unlocked
            </span>
          </div>
        </div>

        {/* Pattern list */}
        <div className="space-y-3">
          {PHRASE_PATTERNS.map((pattern, i) => {
            const score = patternScores[pattern.id] ?? 0;
            const done = score >= 70;
            const locked = i > 0 && (patternScores[PHRASE_PATTERNS[i - 1].id] ?? 0) < 70;

            return (
              <Link
                key={pattern.id}
                href={locked ? "#" : `/learn/patterns/${pattern.id}`}
                className={`block rounded-xl border p-4 transition-all ${
                  done
                    ? "border-indigo-700 bg-indigo-950/40 hover:bg-indigo-950/60"
                    : locked
                    ? "border-zinc-800 bg-zinc-900/30 opacity-40 cursor-not-allowed pointer-events-none"
                    : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    done ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-white">{pattern.frame}</div>
                    <div className="text-zinc-400 text-sm mt-0.5 truncate">{pattern.hook}</div>
                  </div>
                  {!done && !locked && (
                    <div className="text-zinc-500 text-sm shrink-0">3 min →</div>
                  )}
                  {done && (
                    <div className="text-indigo-400 text-xs font-medium shrink-0">unlocked</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {completedCount === PHRASE_PATTERNS.length && (
          <div className="mt-8 rounded-xl border border-green-700 bg-green-950/40 p-6 text-center">
            <div className="text-2xl font-black text-green-400 mb-1">All patterns unlocked</div>
            <p className="text-zinc-400 text-sm mb-4">
              Your voice sessions are now fully targeted. Keep speaking to raise mastery.
            </p>
            <Link
              href="/speak"
              className="inline-block px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm transition-colors"
            >
              Start a conversation →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
