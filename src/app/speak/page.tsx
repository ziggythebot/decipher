import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const SCENARIOS = [
  { slug: "ordering_coffee", title: "Ordering Coffee", desc: "Cafe ordering basics and polite requests." },
  { slug: "meeting_someone", title: "Meeting Someone", desc: "Introductions and short networking exchanges." },
  { slug: "shopping", title: "Market Shopping", desc: "Asking prices, quantities, and payment." },
  { slug: "asking_directions", title: "Asking Directions", desc: "Navigation language in city contexts." },
  { slug: "restaurant", title: "Restaurant", desc: "Menu, preferences, and ordering dinner." },
];

export default async function SpeakPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) redirect("/dashboard");

  const [vocabCount, sessionCount] = await Promise.all([
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
          <div className="text-right text-sm text-zinc-400">
            <p>{vocabCount} words learned</p>
            <p>{sessionCount} conversations logged</p>
          </div>
        </div>

        <h1 className="text-3xl font-black">Speak</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Guided voice sessions are wired at the agent level and this page now maps
          available scenarios. Session start controls and room orchestration are the
          next implementation step.
        </p>

        <div className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-200">
          Voice room launch UI is in progress. Continue practicing with vocab reviews
          while conversation session start is completed.
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((scenario) => (
            <article key={scenario.slug} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{scenario.slug}</p>
              <h2 className="mt-1 font-bold">{scenario.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{scenario.desc}</p>
              <button
                type="button"
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-400"
              >
                Start Session (coming soon)
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
