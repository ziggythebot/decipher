"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { XpToast, useXpToast } from "@/components/game/XpToast";
import { XP } from "@/lib/xp";

type Card = {
  id: string;
  wordId: string;
  word: string;
  translation: string;
  pronunciation: string;
  exampleSentence: string;
  mnemonicHint: string | null;
  frequencyRank: number;
  state: number;
  reps: number;
};

type Props = {
  cards: Card[];
  userId: string;
};

type Rating = 1 | 2 | 3 | 4; // FSRS ratings: Again | Hard | Good | Easy

export function VocabSessionClient({ cards, userId }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const { events, showXp } = useXpToast();

  const card = queue[current];
  const progress = Math.floor((current / queue.length) * 100);

  async function rate(rating: Rating) {
    if (!card) return;

    const isGoodOrEasy = rating >= 3;
    const newStreak = isGoodOrEasy ? streak + 1 : 0;
    setStreak(newStreak);
    setTotal((t) => t + 1);
    if (isGoodOrEasy) setCorrect((c) => c + 1);

    // XP calculation
    let xpGained = isGoodOrEasy ? XP.WORD_CORRECT : 0;
    if (card.reps === 0 && isGoodOrEasy) xpGained += XP.WORD_FIRST_LEARN;
    if (newStreak === 3) xpGained += XP.WORD_CORRECT_STREAK_3;
    if (newStreak === 5) xpGained += XP.WORD_CORRECT_STREAK_5;

    if (xpGained > 0) {
      showXp(
        xpGained,
        newStreak >= 3 ? `${newStreak}x streak!` : card.state === 0 ? "new word!" : "correct"
      );
    }

    // Save rating to server
    await fetch("/api/vocab/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vocabId: card.id, rating, xpGained }),
    });

    // Advance
    setFlipped(false);
    if (current + 1 >= queue.length) {
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  if (done) {
    const accuracy = total > 0 ? Math.floor((correct / total) * 100) : 0;
    const sessionXp = correct * XP.WORD_CORRECT + XP.SESSION_COMPLETE + (accuracy === 100 ? XP.SESSION_PERFECT - XP.SESSION_COMPLETE : 0);

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center"
        >
          <div className="text-5xl mb-4">{accuracy === 100 ? "✨" : accuracy >= 80 ? "🔥" : "📚"}</div>
          <h2 className="text-2xl font-black mb-1">Session Complete!</h2>
          <p className="text-zinc-400 text-sm mb-6">{queue.length} cards reviewed</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-2xl font-black text-green-400">{accuracy}%</div>
              <div className="text-xs text-zinc-400">Accuracy</div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-2xl font-black text-indigo-400">+{sessionXp}</div>
              <div className="text-xs text-zinc-400">XP earned</div>
            </div>
          </div>

          {accuracy === 100 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
              <span className="text-yellow-400 font-bold text-sm">✨ Perfect session!</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push("/speak")}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Practice Speaking →
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <XpToast events={events} />

      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.push("/dashboard")} className="text-zinc-500 hover:text-zinc-300 text-sm">
            ← Dashboard
          </button>
          <span className="text-zinc-500 text-sm">{current + 1}/{queue.length}</span>
          <span className="text-sm font-semibold text-orange-400">{streak > 0 ? `🔥 ${streak}` : ""}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          className="w-full max-w-sm"
        >
          {/* Frequency badge */}
          <div className="flex justify-center mb-4">
            <span className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-full">
              #{card.frequencyRank} most common
            </span>
          </div>

          {/* Card face */}
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center cursor-pointer select-none min-h-[200px] flex flex-col items-center justify-center"
            onClick={() => !flipped && setFlipped(true)}
          >
            <AnimatePresence mode="wait">
              {!flipped ? (
                <motion.div
                  key="front"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="text-3xl font-black mb-2">{card.word}</div>
                  {card.pronunciation && (
                    <div className="text-zinc-500 text-sm mb-4">[{card.pronunciation}]</div>
                  )}
                  <div className="text-zinc-600 text-sm mt-4">Tap to reveal →</div>
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Translation</div>
                  <div className="text-2xl font-black text-white mb-4">{card.translation}</div>

                  {card.exampleSentence && (
                    <div className="bg-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-300 italic mb-3">
                      {card.exampleSentence}
                    </div>
                  )}

                  {card.mnemonicHint && (
                    <div className="text-xs text-indigo-400 mt-2">
                      💡 {card.mnemonicHint}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Rating buttons — only show when flipped */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 grid grid-cols-4 gap-2"
              >
                <RatingButton rating={1} label="Again" color="bg-red-900/50 border-red-800 hover:bg-red-900 text-red-300" onRate={() => rate(1)} />
                <RatingButton rating={2} label="Hard" color="bg-orange-900/50 border-orange-800 hover:bg-orange-900 text-orange-300" onRate={() => rate(2)} />
                <RatingButton rating={3} label="Good" color="bg-green-900/50 border-green-800 hover:bg-green-900 text-green-300" onRate={() => rate(3)} />
                <RatingButton rating={4} label="Easy" color="bg-indigo-900/50 border-indigo-800 hover:bg-indigo-900 text-indigo-300" onRate={() => rate(4)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function RatingButton({ label, color, onRate }: { rating: number; label: string; color: string; onRate: () => void }) {
  return (
    <button
      onClick={onRate}
      className={`border rounded-xl py-2.5 text-xs font-bold transition-colors ${color}`}
    >
      {label}
    </button>
  );
}
