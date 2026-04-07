import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SPEAK_SCENARIOS } from "@/lib/speak/scenarios";
import { SpeakClient } from "./SpeakClient";

export default async function SpeakPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) redirect("/dashboard");

  const [vocabCount, sessionCount, recentSessions] = await Promise.all([
    db.userVocabulary.count({ where: { userId: user.id, state: { gt: 0 } } }),
    db.conversationSession.count({ where: { userId: user.id, duration: { not: null } } }),
    db.conversationSession.findMany({
      where: { userId: user.id, duration: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        scenarioType: true,
        duration: true,
        xpEarned: true,
      },
    }),
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
          Use guided scenarios to run tracked speaking sessions now. Real-time room/audio
          launch is the next milestone.
        </p>

        <SpeakClient
          scenarios={SPEAK_SCENARIOS.map((scenario) => ({ ...scenario }))}
          recentSessions={recentSessions.map((session) => ({
            ...session,
            createdAt: session.createdAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
