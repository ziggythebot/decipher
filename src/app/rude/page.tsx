"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const UNLOCK_KEY = "rude_mode_unlocked";

export default function RudeHubPage() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(UNLOCK_KEY) !== "1") {
      router.replace("/dashboard");
    } else {
      setUnlocked(true);
    }
  }, [router]);

  if (!unlocked) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-4">🤬</div>
        <h1 className="text-3xl font-black mb-1">Rude Mode</h1>
        <p className="text-zinc-500 text-sm mb-10">
          The French they don't teach in school.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/rude/dirty-dozen"
            className="bg-red-900/40 border border-red-800 hover:bg-red-900/60 rounded-2xl p-5 text-left transition-colors"
          >
            <div className="text-2xl mb-2">💢</div>
            <div className="font-black text-lg">The Dirty Dozen</div>
            <div className="text-zinc-400 text-sm mt-1">
              12 phrases that will end friendships. Learn them all.
            </div>
          </Link>

          <Link
            href="/rude/vocab"
            className="bg-orange-900/30 border border-orange-800 hover:bg-orange-900/50 rounded-2xl p-5 text-left transition-colors"
          >
            <div className="text-2xl mb-2">💀</div>
            <div className="font-black text-lg">50 Swear Words</div>
            <div className="text-zinc-400 text-sm mt-1">
              From mild eye-roll to full nuclear. Rated by severity.
            </div>
          </Link>

          <Link
            href="/rude/road-rage"
            className="bg-yellow-900/30 border border-yellow-700 hover:bg-yellow-900/50 rounded-2xl p-5 text-left transition-colors"
          >
            <div className="text-2xl mb-2">🚕</div>
            <div className="font-black text-lg">Road Rage</div>
            <div className="text-zinc-400 text-sm mt-1">
              Paris cab driver. Rush hour. He's already furious.
              Calm him down or escalate — your call.
            </div>
          </Link>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-8 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
        >
          Back to being polite
        </button>
      </div>
    </div>
  );
}
