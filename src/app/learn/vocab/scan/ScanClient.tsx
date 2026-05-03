"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { XpToast, useXpToast } from "@/components/game/XpToast";

const XP_PER_WORD = 10;

type Word = {
  id: string;
  word: string;
  translation: string;
};

type Props = {
  words: Word[];
  page: number;
  rangeStart: number;
  rangeEnd: number;
  hasNextPage: boolean;
};

export function ScanClient({ words, page, rangeStart, rangeEnd, hasNextPage }: Props) {
  const router = useRouter();
  const { events, showXp } = useXpToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [markedCount, setMarkedCount] = useState(0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/vocab/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordIds: Array.from(selected) }),
    });
    if (res.ok) {
      const data = (await res.json()) as { xpGain: number; count: number };
      setTotalXp(data.xpGain);
      setMarkedCount(data.count);
      showXp(data.xpGain, "words scanned!");
      setDone(true);
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <XpToast events={events} />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center"
        >
          <div className="text-5xl mb-4">⚡</div>
          <h2 className="text-2xl font-black mb-1">Locked in</h2>
          <p className="text-zinc-400 text-sm mb-6">
            {markedCount} word{markedCount !== 1 ? "s" : ""} added to your review queue
          </p>
          <div className="bg-indigo-900/30 border border-indigo-800 rounded-xl p-4 mb-6">
            <div className="text-3xl font-black text-indigo-400">+{totalXp} XP</div>
            <div className="text-xs text-zinc-500 mt-1">earned</div>
          </div>
          <div className="flex flex-col gap-2">
            {hasNextPage && (
              <button
                onClick={() => router.push(`/learn/vocab/scan?page=${page + 1}`)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Scan words {rangeEnd + 1}–{rangeEnd + 100} →
              </button>
            )}
            <button
              onClick={() => router.push("/learn/vocab/review")}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Review them now →
            </button>
            <button
              onClick={() => router.push("/learn/vocab")}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Back to Vocab Hub
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-28">
      <XpToast events={events} />

      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/learn/vocab")}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            ← Vocab
          </button>
          <span className="text-xs text-blue-400 bg-blue-900/30 border border-blue-800 px-2 py-0.5 rounded-full">
            quick scan
          </span>
        </div>

        <h1 className="text-2xl font-black mb-1">Quick Scan</h1>
        <p className="text-zinc-500 text-sm mb-1">
          Tap every word you already know. They skip Learn and go straight to your review queue.
        </p>

        {/* Range indicator + page nav */}
        <div className="flex items-center justify-between mt-3 mb-5">
          <button
            onClick={() => router.push(`/learn/vocab/scan?page=${page - 1}`)}
            disabled={page <= 1}
            className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
          >
            ← Prev 100
          </button>
          <span className="text-sm font-semibold text-zinc-300">
            Words {rangeStart}–{rangeEnd}
          </span>
          <button
            onClick={() => router.push(`/learn/vocab/scan?page=${page + 1}`)}
            disabled={!hasNextPage}
            className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
          >
            Next 100 →
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {words.map((w) => {
            const isSelected = selected.has(w.id);
            return (
              <button
                key={w.id}
                onClick={() => toggle(w.id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold border transition-all ${
                  isSelected
                    ? "bg-green-600 border-green-500 text-white scale-[1.04]"
                    : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {w.word}
                <span
                  className={`ml-1.5 text-xs font-normal ${
                    isSelected ? "text-green-200" : "text-zinc-500"
                  }`}
                >
                  {w.translation}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1">
            {selected.size > 0 ? (
              <p className="text-sm font-semibold">
                {selected.size} selected
                <span className="text-indigo-400 ml-2">+{selected.size * XP_PER_WORD} XP</span>
              </p>
            ) : (
              <p className="text-zinc-500 text-sm">Tap words you already know</p>
            )}
          </div>
          <button
            onClick={() => void handleSubmit()}
            disabled={selected.size === 0 || submitting}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm"
          >
            {submitting ? "Saving..." : "Mark as known →"}
          </button>
        </div>
      </div>
    </div>
  );
}
