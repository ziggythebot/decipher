import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { FRENCH_DECONSTRUCTION_DOZEN } from "@/data/deconstruction-dozen";

export default async function DeconstructPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { grammarProfile: true },
  });

  if (!user) redirect("/dashboard");

  const completed = user.grammarProfile?.deconstructionDone ?? false;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Dashboard
          </Link>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
            {completed ? "Completed" : "In progress"}
          </span>
        </div>

        <h1 className="text-3xl font-black">Deconstruction Dozen</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          12 high-leverage sentences that expose French sentence structure quickly.
          This page currently presents the full lesson content while persistence actions
          are being implemented.
        </p>

        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Lesson save/checkoff controls are coming next. You can review the content now,
          then continue to vocab from the dashboard.
        </div>

        <div className="mt-8 space-y-4">
          {FRENCH_DECONSTRUCTION_DOZEN.map((item) => (
            <article key={item.rank} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Sentence {item.rank}
              </p>
              <p className="mt-2 text-lg font-bold">{item.french}</p>
              <p className="mt-1 text-sm text-zinc-400">{item.english}</p>
              <p className="mt-2 text-sm text-zinc-500">[{item.pronunciation}]</p>
              <p className="mt-3 text-sm text-zinc-300">
                <span className="font-semibold text-zinc-200">Pattern:</span> {item.patternRevealed}
              </p>
              <p className="mt-2 text-sm text-zinc-400">{item.englishNotes}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
