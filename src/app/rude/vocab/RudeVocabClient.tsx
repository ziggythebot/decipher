"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Word = {
  word: string;
  translation: string;
  severity: 1 | 2 | 3;
};

const SEVERITY_LABEL = { 1: "mild", 2: "strong", 3: "nuclear" };
const SEVERITY_COLOR = {
  1: "border-yellow-800 bg-yellow-900/20 text-yellow-300",
  2: "border-orange-700 bg-orange-900/25 text-orange-300",
  3: "border-red-700 bg-red-900/30 text-red-300",
};
const SEVERITY_SELECTED = {
  1: "border-yellow-500 bg-yellow-700/50 text-white scale-[1.04]",
  2: "border-orange-500 bg-orange-700/50 text-white scale-[1.04]",
  3: "border-red-500 bg-red-700/50 text-white scale-[1.04]",
};

export function RudeVocabClient({ words }: { words: Word[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<0 | 1 | 2 | 3>(0);
  const [done, setDone] = useState(false);

  const filtered = filter === 0 ? words : words.filter((w) => w.severity === filter);

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">💀</div>
          <h2 className="text-2xl font-black mb-2">Fluently offensive.</h2>
          <p className="text-zinc-400 text-sm mb-2">
            {selected.size} words locked in your head.
          </p>
          <p className="text-zinc-600 text-xs mb-8">
            Remember: with great power comes great responsibility. Or not.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push("/speak?scenario=road_rage&mode=guided")}
              className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Try Road Rage →
            </button>
            <button
              onClick={() => router.push("/rude")}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Back to Rude Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-28">
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/rude")}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            ← Rude Mode
          </button>
          <span className="text-xs text-red-400 bg-red-900/30 border border-red-800 px-2 py-0.5 rounded-full">
            18+
          </span>
        </div>

        <h1 className="text-2xl font-black mb-1">50 Swear Words</h1>
        <p className="text-zinc-500 text-sm mb-4">
          Tap the ones you want to know. Rated by how much trouble they'll get you in.
        </p>

        {/* Severity filter */}
        <div className="flex gap-2 mb-5">
          {([0, 1, 2, 3] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filter === s
                  ? "bg-zinc-700 border-zinc-500 text-white"
                  : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {s === 0 ? "All" : SEVERITY_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {filtered.map((w, i) => {
            const globalIdx = words.indexOf(w);
            const isSelected = selected.has(globalIdx);
            return (
              <button
                key={globalIdx}
                onClick={() => toggle(globalIdx)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold border transition-all ${
                  isSelected
                    ? SEVERITY_SELECTED[w.severity]
                    : SEVERITY_COLOR[w.severity]
                }`}
              >
                {w.word}
                <span className="ml-1.5 text-xs font-normal opacity-70">
                  {w.translation}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1">
            {selected.size > 0 ? (
              <p className="text-sm font-semibold">
                {selected.size} words selected
              </p>
            ) : (
              <p className="text-zinc-500 text-sm">Tap words to mark as known</p>
            )}
          </div>
          <button
            onClick={() => selected.size > 0 && setDone(true)}
            disabled={selected.size === 0}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm"
          >
            Lock them in →
          </button>
        </div>
      </div>
    </div>
  );
}
