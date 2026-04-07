"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  completed: boolean;
};

export function CompleteButton({ completed }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(completed);
  const [message, setMessage] = useState<string | null>(null);

  async function markComplete() {
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/grammar/complete", {
      method: "POST",
    });

    if (!response.ok) {
      setLoading(false);
      setMessage("Could not save completion yet. Please try again.");
      return;
    }

    const data = (await response.json()) as { alreadyCompleted?: boolean; totalGain?: number };
    setDone(true);
    setLoading(false);

    if (data.alreadyCompleted) {
      setMessage("Already completed.");
    } else {
      setMessage(`Saved. +${data.totalGain ?? 0} XP`);
    }

    router.refresh();
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Lesson completion</p>
          <p className="text-xs text-zinc-400">Mark this session complete to save grammar progress.</p>
        </div>
        <button
          type="button"
          onClick={markComplete}
          disabled={loading || done}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {done ? "Completed" : loading ? "Saving..." : "Mark Complete"}
        </button>
      </div>
      {message && <p className="mt-3 text-xs text-zinc-300">{message}</p>}
    </div>
  );
}
