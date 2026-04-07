import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { levelTitle } from "@/lib/xp";

export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      achievements: {
        include: { achievement: true },
        orderBy: { unlockedAt: "desc" },
      },
    },
  });

  if (!user) redirect("/dashboard");

  const [wordsLearned, sessions] = await Promise.all([
    db.userVocabulary.count({ where: { userId: user.id, state: { gt: 0 } } }),
    db.conversationSession.count({ where: { userId: user.id } }),
  ]);

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
