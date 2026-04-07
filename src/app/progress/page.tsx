import Link from "next/link";
import { db } from "@/lib/db";
import { levelTitle } from "@/lib/xp";
import type { CategoryCounts, ErrorCategory } from "@/lib/speak/analytics";
import { getOrCreateSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await getOrCreateSessionUser();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [wordsLearned, sessions, knownVocab, recentSessions, streakEntries] = await Promise.all([
    db.userVocabulary.count({ where: { userId: user.id, state: { gt: 0 } } }),
    db.conversationSession.count({ where: { userId: user.id } }),
    db.userVocabulary.findMany({
      where: { userId: user.id, state: { gt: 0 } },
      include: { word: { select: { word: true } } },
      take: 2000,
    }),
    db.conversationSession.findMany({
      where: { userId: user.id, duration: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        scenarioType: true,
        duration: true,
        accuracyPct: true,
        xpEarned: true,
        wordsEncountered: true,
        errorsLogged: true,
        transcript: true,
      },
    }),
    db.streakEntry.findMany({
      where: { userId: user.id, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "asc" },
    }),
  ]);

  const knownWordSet = new Set(knownVocab.map((entry) => entry.word.word.toLowerCase()));
  const totalErrors = recentSessions.reduce(
    (sum, session) => sum + (Array.isArray(session.errorsLogged) ? session.errorsLogged.length : 0),
    0
  );
  const accuracies = recentSessions
    .map((session) => session.accuracyPct)
    .filter((v): v is number => typeof v === "number");
  const avgAccuracy =
    accuracies.length > 0
      ? Math.round(accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length)
      : null;
  const totalUserTurns = recentSessions.reduce((sum, session) => {
    const lines = (session.transcript ?? "")
      .split("\n")
      .filter((line) => line.includes("User:"));
    return sum + lines.length;
  }, 0);
  const unknownWordSet = new Set<string>();
  for (const session of recentSessions) {
    for (const word of session.wordsEncountered) {
      const normalized = word.toLowerCase();
      if (!knownWordSet.has(normalized) && normalized.length >= 3) {
        unknownWordSet.add(normalized);
      }
    }
  }
  const unknownWordSample = [...unknownWordSet].sort().slice(0, 16);
  const issueMix: CategoryCounts = {
    grammar: 0,
    vocab: 0,
    pronunciation: 0,
    hesitation: 0,
    other: 0,
  };
  const correctedFormSet = new Set<string>();

  for (const session of recentSessions) {
    if (!Array.isArray(session.errorsLogged)) continue;
    for (const entry of session.errorsLogged) {
      if (!entry || typeof entry !== "object") continue;
      const rec = entry as Record<string, unknown>;

      if (rec.type === "analysis_summary" && rec.categories && typeof rec.categories === "object") {
        const categories = rec.categories as Record<string, unknown>;
        for (const key of Object.keys(issueMix) as ErrorCategory[]) {
          const value = categories[key];
          if (typeof value === "number" && Number.isFinite(value)) {
            issueMix[key] += value;
          }
        }
        if (Array.isArray(rec.correctedForms)) {
          for (const form of rec.correctedForms) {
            if (typeof form === "string" && form.trim().length > 0) {
              correctedFormSet.add(form.trim());
            }
          }
        }
        continue;
      }

      if (typeof rec.category === "string" && rec.category in issueMix) {
        issueMix[rec.category as ErrorCategory] += 1;
      }
    }
  }

  const correctedForms = [...correctedFormSet].slice(0, 12);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Dashboard
          </Link>
          <span className="text-sm text-zinc-400">Level {user.level}</span>
        </div>

        <h1 className="text-3xl font-black">Progress</h1>
        <p className="mt-2 text-zinc-400">Your current learning stats and unlocked achievements.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <Stat value={String(user.totalXp)} label="Total XP" />
          <Stat value={levelTitle(user.level)} label="Current title" />
          <Stat value={String(wordsLearned)} label="Words learned" />
          <Stat value={String(sessions)} label="Conversations" />
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-bold">Streak</h2>
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-black">{user.streakDays}</span>
              <span className="text-sm text-zinc-400">{user.streakDays === 1 ? "day" : "days"} current streak</span>
            </div>
            <StreakGrid entries={streakEntries.map((e) => e.date)} referenceDate={now} />
            <p className="mt-2 text-xs text-zinc-600">Last 30 days</p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold">Achievements</h2>
          {user.achievements.length === 0 ? (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
              No achievements unlocked yet. Complete a vocab session to start earning unlocks.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {user.achievements.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="text-2xl">{entry.achievement.icon}</p>
                  <h3 className="mt-1 font-bold">{entry.achievement.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{entry.achievement.description}</p>
                  <p className="mt-3 text-xs text-zinc-500">
                    {entry.unlockedAt.toLocaleDateString()} • +{entry.achievement.xpReward} XP
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">Speaking Insights</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Stat value={String(recentSessions.length)} label="Recent sessions" />
            <Stat value={String(totalUserTurns)} label="User turns" />
            <Stat value={String(totalErrors)} label="Logged errors" />
            <Stat value={avgAccuracy !== null ? `${avgAccuracy}%` : "n/a"} label="Avg accuracy" />
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-semibold text-zinc-100">Potential unknown words (recent)</p>
            {unknownWordSample.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-400">No unknown-word candidates detected yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {unknownWordSample.map((word) => (
                  <span
                    key={word}
                    className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200"
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {recentSessions.slice(0, 5).map((session) => (
              <article key={session.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {(session.scenarioType ?? "freeform").replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-zinc-500">{session.createdAt.toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {session.duration ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s` : "n/a"} •
                  {" "}+{session.xpEarned} XP •{" "}
                  {Array.isArray(session.errorsLogged) ? session.errorsLogged.length : 0} errors •{" "}
                  {session.accuracyPct ?? "n/a"}% accuracy
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-semibold text-zinc-100">Issue Mix (recent)</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              <TrendChip label="Grammar" value={issueMix.grammar} />
              <TrendChip label="Vocab" value={issueMix.vocab} />
              <TrendChip label="Pronunciation" value={issueMix.pronunciation} />
              <TrendChip label="Hesitation" value={issueMix.hesitation} />
              <TrendChip label="Other" value={issueMix.other} />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-semibold text-zinc-100">Suggested Corrections (recent)</p>
            {correctedForms.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-400">No correction snippets captured yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {correctedForms.map((form) => (
                  <span
                    key={form}
                    className="rounded-full border border-emerald-700/60 bg-emerald-900/20 px-2.5 py-1 text-xs text-emerald-200"
                  >
                    {form}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-lg font-black">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function TrendChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-center">
      <p className="text-sm font-bold text-zinc-200">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

function StreakGrid({ entries, referenceDate }: { entries: Date[]; referenceDate: Date }) {
  // Build a set of date strings (YYYY-MM-DD) that have activity
  const activeDays = new Set(
    entries.map((d) => {
      const date = new Date(d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    })
  );

  // Build the last 30 days starting from 29 days ago to today
  const days: { key: string; active: boolean }[] = [];
  const referenceMs = referenceDate.getTime();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(referenceMs - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ key, active: activeDays.has(key) });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {days.map(({ key, active }) => (
        <div
          key={key}
          title={key}
          className={`h-4 w-4 rounded-sm ${active ? "bg-emerald-500" : "bg-zinc-700"}`}
        />
      ))}
    </div>
  );
}
