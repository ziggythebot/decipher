"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Phrase = {
  phrase: string;
  translation: string;
  notes: string;
};

export function DirtyDozenClient({ phrases }: { phrases: Phrase[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const current = phrases[index];
  const progress = ((index + (flipped ? 0.5 : 0)) / phrases.length) * 100;

  function next() {
    if (index < phrases.length - 1) {
      setFlipped(false);
      setIndex((i) => i + 1);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">💢</div>
          <h2 className="text-2xl font-black mb-2">Weaponised.</h2>
          <p className="text-zinc-400 text-sm mb-8">
            You now know all 12. Use responsibly. Or don't.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push("/rude/vocab")}
              className="w-full bg-orange-800 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              50 Swear Words →
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
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-sm mx-auto w-full">
        <button
          onClick={() => router.push("/rude")}
          className="text-zinc-500 hover:text-zinc-300 text-sm"
        >
          ← Rude Mode
        </button>
        <span className="text-zinc-500 text-sm">{index + 1} / {phrases.length}</span>
      </div>

      {/* Progress bar */}
      <div className="max-w-sm mx-auto w-full mb-8">
        <div className="h-1.5 bg-zinc-800 rounded-full">
          <div
            className="h-1.5 bg-red-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-sm w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${index}-${flipped}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              onClick={() => !flipped && setFlipped(true)}
              className={`rounded-3xl border p-8 text-center cursor-pointer select-none transition-colors ${
                flipped
                  ? "bg-red-950/40 border-red-800"
                  : "bg-zinc-900 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {!flipped ? (
                <>
                  <p className="text-3xl font-black mb-4">{current.phrase}</p>
                  <p className="text-zinc-500 text-sm">Tap to reveal</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-black text-red-400 mb-3">{current.translation}</p>
                  <p className="text-zinc-300 text-sm leading-relaxed mb-6">{current.notes}</p>
                  <p className="text-zinc-600 text-xs italic">{current.phrase}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {flipped && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={next}
              className="w-full mt-4 bg-red-800 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition-colors"
            >
              {index < phrases.length - 1 ? "Next →" : "Done ✓"}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
