"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { PhrasePattern } from "@/data/phrase-patterns";

type Stage = "intro" | "drill" | "complete";

type DrillResult = "correct" | "wrong" | null;

function shuffleOptions(options: [string, string, string], correct: string): string[] {
  const shuffled = [...options];
  // Fisher-Yates
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function PatternUnitClient({
  pattern,
  alreadyDone,
}: {
  pattern: PhrasePattern;
  alreadyDone: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  const [drillIndex, setDrillIndex] = useState(0);
  const [result, setResult] = useState<DrillResult>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Pre-shuffle all drill options once on mount
  const shuffledOptions = useMemo(
    () => pattern.drills.map((d) => shuffleOptions(d.options, d.correct)),
    [pattern.drills]
  );

  const currentDrill = pattern.drills[drillIndex];
  const currentOptions = shuffledOptions[drillIndex];
  const totalDrills = pattern.drills.length;
  const progressPct = (drillIndex / totalDrills) * 100;

  function handleOption(option: string) {
    if (result !== null) return; // already answered
    const isCorrect = option === currentDrill.correct;
    setResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrectCount((c) => c + 1);

    setTimeout(() => {
      if (drillIndex + 1 >= totalDrills) {
        void markComplete();
      } else {
        setDrillIndex((i) => i + 1);
        setResult(null);
      }
    }, isCorrect ? 800 : 1400);
  }

  async function markComplete() {
    setSubmitting(true);
    try {
      await fetch("/api/patterns/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId: pattern.id }),
      });
    } catch {
      // non-fatal
    }
    setStage("complete");
    setSubmitting(false);
  }

  function renderFrame(frame: string, isAnswered: boolean, correctAnswer: string) {
    if (isAnswered) {
      return frame.replace("___", `[${correctAnswer}]`);
    }
    return frame;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* INTRO */}
          {stage === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <button
                onClick={() => router.back()}
                className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors mb-6 block"
              >
                ← Back
              </button>

              <div className="mb-6">
                <div className="text-xs font-mono text-indigo-400 uppercase tracking-widest mb-2">
                  Sentence Pattern
                </div>
                <h1 className="text-4xl font-black font-mono mb-3">{pattern.frame}</h1>
                <p className="text-zinc-300 text-lg leading-relaxed">{pattern.hook}</p>
                <p className="text-zinc-500 text-sm mt-2">{pattern.why}</p>
              </div>

              {/* Examples */}
              <div className="space-y-3 mb-8">
                {pattern.examples.map((ex, i) => (
                  <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="font-semibold text-white mb-1">{ex.fr}</div>
                    <div className="text-xs text-zinc-500 font-mono mb-1.5">{ex.pronunciation}</div>
                    <div className="text-zinc-400 text-sm">{ex.en}</div>
                  </div>
                ))}
              </div>

              {alreadyDone ? (
                <div className="space-y-3">
                  <div className="text-center text-sm text-indigo-400 font-medium mb-2">
                    Pattern already unlocked — drill again to reinforce
                  </div>
                  <button
                    onClick={() => setStage("drill")}
                    className="w-full py-3.5 bg-zinc-700 hover:bg-zinc-600 rounded-xl font-semibold transition-colors"
                  >
                    Drill again
                  </button>
                  <button
                    onClick={() => router.back()}
                    className="w-full py-3.5 bg-transparent border border-zinc-700 hover:border-zinc-500 rounded-xl font-semibold transition-colors text-zinc-400"
                  >
                    Back to patterns
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setStage("drill")}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors text-lg"
                >
                  Start drill →
                </button>
              )}
            </motion.div>
          )}

          {/* DRILL */}
          {stage === "drill" && (
            <motion.div
              key={`drill-${drillIndex}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                  <span>{drillIndex + 1} of {totalDrills}</span>
                  <span>{pattern.frame}</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-1.5 bg-indigo-500 rounded-full"
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Context */}
              <div className="text-zinc-400 text-sm mb-3">{currentDrill.context}</div>

              {/* Frame */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 mb-6">
                <div className="text-xl font-semibold leading-relaxed">
                  {result !== null
                    ? renderFrame(currentDrill.frame, true, currentDrill.correct)
                        .split(`[${currentDrill.correct}]`)
                        .map((part, i, arr) =>
                          i < arr.length - 1 ? (
                            <span key={i}>
                              {part}
                              <span className={`px-1 rounded ${result === "correct" ? "text-green-400" : "text-red-400"}`}>
                                {currentDrill.correct}
                              </span>
                            </span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )
                    : currentDrill.frame.split("___").map((part, i, arr) =>
                        i < arr.length - 1 ? (
                          <span key={i}>
                            {part}
                            <span className="inline-block w-24 border-b-2 border-zinc-500 mx-1 align-middle" />
                          </span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {currentOptions.map((option) => {
                  const isCorrect = option === currentDrill.correct;
                  const isSelected = result !== null;
                  let cls = "w-full py-3.5 px-4 rounded-xl border text-left font-medium transition-all ";
                  if (!isSelected) {
                    cls += "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-500 text-white";
                  } else if (isCorrect) {
                    cls += "border-green-600 bg-green-950/60 text-green-300";
                  } else {
                    cls += "border-zinc-800 bg-zinc-900/40 text-zinc-600";
                  }
                  return (
                    <button key={option} className={cls} onClick={() => handleOption(option)}>
                      {option}
                    </button>
                  );
                })}
              </div>

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 text-center text-sm font-semibold ${result === "correct" ? "text-green-400" : "text-red-400"}`}
                >
                  {result === "correct" ? "Correct!" : `Correct answer: ${currentDrill.correct}`}
                </motion.div>
              )}

              {submitting && (
                <div className="mt-4 text-center text-zinc-500 text-sm">Saving…</div>
              )}
            </motion.div>
          )}

          {/* COMPLETE */}
          {stage === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center py-8"
            >
              <div className="text-6xl mb-4">✓</div>
              <h2 className="text-3xl font-black mb-2">Pattern Unlocked</h2>
              <div className="font-mono text-indigo-400 text-xl mb-4">{pattern.frame}</div>
              <p className="text-zinc-400 text-sm mb-2">
                {correctCount}/{totalDrills} correct on first try
              </p>
              <p className="text-zinc-500 text-sm mb-8">
                Your next voice session will practise this pattern.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => router.push("/learn/patterns")}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors"
                >
                  Next pattern →
                </button>
                <button
                  onClick={() => router.push("/speak")}
                  className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold transition-colors text-zinc-300"
                >
                  Use it in a conversation →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
