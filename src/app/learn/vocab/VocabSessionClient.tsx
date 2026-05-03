"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { XpToast, useXpToast } from "@/components/game/XpToast";
import { XP } from "@/lib/xp";
import { getBrowserTtsLocale } from "@/lib/language/catalog";

type Card = {
  id: string;
  wordId: string;
  word: string;
  translation: string;
  pronunciation: string;
  exampleSentence: string;
  mnemonicHint: string | null;
  audioUrl: string | null;
  frequencyRank: number;
  state: number;
  reps: number;
};

// Plays the word using a pre-generated audio file if available, otherwise
// falls back to browser TTS (fr-FR). When upgrading to ElevenLabs pre-gen:
//   1. Run scripts/generate-vocab-audio.ts to produce MP3s for all LanguageWord rows
//   2. Upload to Vercel Blob, save public URLs back to LanguageWord.audioUrl
//   3. Pass audioUrl through VocabPage → VocabSessionClient (field already in schema)
//   — no UI changes needed; the fallback branch simply stops being hit.
function playWord(word: string, audioUrl: string | null, targetLanguage: string) {
  if (audioUrl) {
    new Audio(audioUrl).play().catch(() => undefined);
    return;
  }
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = getBrowserTtsLocale(targetLanguage);
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

type Props = {
  cards: Card[];
  mode?: "review" | "retest"; // default review
  targetLanguage?: string;
};

type Rating = 1 | 2 | 3 | 4; // FSRS ratings: Again | Hard | Good | Easy

export function VocabSessionClient({ cards, mode = "review", targetLanguage = "fr" }: Props) {
  const router = useRouter();
  // Mutable session queue — Again/Hard-learning cards get appended to the end
  const [sessionQueue, setSessionQueue] = useState(cards);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [retestCards, setRetestCards] = useState<Card[] | null>(null);
  const { events, showXp } = useXpToast();
  // Track which card IDs have already been re-queued this session (max once each)
  const requeuedIds = useRef(new Set<string>());
  // Track cards rated Again (1) for Quick Retest at end
  const missedCards = useRef<Card[]>([]);

  const card = sessionQueue[current];
  const progress = Math.floor((current / sessionQueue.length) * 100);

  if (sessionQueue.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-black mb-2">All caught up!</h2>
          <p className="text-zinc-400 text-sm mb-6">
            No cards due right now. Come back later or learn some new words.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push("/learn/vocab/learn")}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Learn New Words →
            </button>
            <button
              onClick={() => router.push("/learn/vocab")}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Back to Vocab Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    const response = await fetch("/api/vocab/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vocabId: card.id, rating, xpGained }),
    });
    if (!response.ok) {
      console.error("Failed to save vocab rating");
    }

    // Track misses for Quick Retest (deduplicated)
    if (rating === 1 && !missedCards.current.find((c) => c.id === card.id)) {
      missedCards.current.push(card);
    }

    // Re-queue logic: Again always re-queues; Hard re-queues if card is still
    // in New/Learning state (state 0-1). Max one re-queue per card per session
    // to prevent infinite loops.
    const isLearning = card.state <= 1;
    const shouldRequeue =
      (rating === 1 || (rating === 2 && isLearning)) &&
      !requeuedIds.current.has(card.id);

    if (shouldRequeue) {
      requeuedIds.current.add(card.id);
      setSessionQueue((q) => [...q, card]);
    }

    // Advance — account for the card we just appended (if any)
    setFlipped(false);
    const nextQueueLength = sessionQueue.length + (shouldRequeue ? 1 : 0);
    if (current + 1 >= nextQueueLength) {
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  // Quick Retest — inline practice pass of missed cards (no FSRS writes)
  if (retestCards) {
    return <PracticeRetest cards={retestCards} onDone={() => router.push("/learn/vocab")} targetLanguage={targetLanguage} />;
  }

  if (done) {
    const accuracy = total > 0 ? Math.floor((correct / total) * 100) : 0;
    const sessionXp = correct * XP.WORD_CORRECT + XP.SESSION_COMPLETE + (accuracy === 100 ? XP.SESSION_PERFECT - XP.SESSION_COMPLETE : 0);
    const misses = missedCards.current;

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <XpToast events={events} />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center"
        >
          <div className="text-5xl mb-4">{accuracy === 100 ? "✨" : accuracy >= 80 ? "🔥" : "📚"}</div>
          <h2 className="text-2xl font-black mb-1">
            {mode === "retest" ? "Retest Done!" : "Review Complete!"}
          </h2>
          <p className="text-zinc-400 text-sm mb-6">{cards.length} cards reviewed</p>

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
            {misses.length > 0 && mode !== "retest" && (
              <button
                onClick={() => setRetestCards(misses)}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Quick Retest {misses.length} missed →
              </button>
            )}
            <button
              onClick={() => router.push("/speak")}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Practice Speaking →
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

  if (!card) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <XpToast events={events} />

      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.push("/learn/vocab")} className="text-zinc-500 hover:text-zinc-300 text-sm">
            ← Vocab
          </button>
          <span className="text-zinc-500 text-sm">{current + 1}/{sessionQueue.length}</span>
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
          {/* Frequency badge + re-queue indicator */}
          <div className="flex justify-center gap-2 mb-4">
            <span className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-full">
              #{card.frequencyRank} most common
            </span>
            {requeuedIds.current.has(card.id) && (
              <span className="text-xs text-orange-400 bg-orange-900/30 border border-orange-800 px-2 py-1 rounded-full">
                reviewing again
              </span>
            )}
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
                    <div className="text-zinc-500 text-sm mb-1">[{card.pronunciation}]</div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); playWord(card.word, card.audioUrl, targetLanguage); }}
                    className="mt-2 text-zinc-600 hover:text-zinc-300 transition-colors text-lg"
                    aria-label="Play pronunciation"
                  >
                    🔊
                  </button>
                  <div className="text-zinc-600 text-sm mt-3">Tap card to reveal →</div>
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
                <RatingButton label="Again" color="bg-red-900/50 border-red-800 hover:bg-red-900 text-red-300" onRate={() => rate(1)} />
                <RatingButton label="Hard" color="bg-orange-900/50 border-orange-800 hover:bg-orange-900 text-orange-300" onRate={() => rate(2)} />
                <RatingButton label="Good" color="bg-green-900/50 border-green-800 hover:bg-green-900 text-green-300" onRate={() => rate(3)} />
                <RatingButton label="Easy" color="bg-indigo-900/50 border-indigo-800 hover:bg-indigo-900 text-indigo-300" onRate={() => rate(4)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function RatingButton({ label, color, onRate }: { label: string; color: string; onRate: () => void }) {
  return (
    <button
      onClick={onRate}
      className={`border rounded-xl py-2.5 text-xs font-bold transition-colors ${color}`}
    >
      {label}
    </button>
  );
}

// Inline no-write practice retest component — shown after review session for missed cards
function PracticeRetest({ cards, onDone, targetLanguage }: { cards: Card[]; onDone: () => void; targetLanguage: string }) {
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const card = cards[current];

  if (done || !card) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-black mb-2">Retest done</h2>
          <button onClick={onDone} className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors">
            Back to Vocab Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onDone} className="text-zinc-500 hover:text-zinc-300 text-sm">← Exit retest</button>
          <span className="text-zinc-500 text-sm">{current + 1}/{cards.length}</span>
          <span className="text-xs text-orange-400 bg-orange-900/30 border border-orange-800 px-2 py-0.5 rounded-full">retest</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${Math.floor((current / cards.length) * 100)}%` }} />
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center cursor-pointer select-none min-h-[200px] flex flex-col items-center justify-center"
            onClick={() => !flipped && setFlipped(true)}
          >
            {!flipped ? (
              <div className="text-center">
                <div className="text-3xl font-black mb-2">{card.word}</div>
                {card.pronunciation && <div className="text-zinc-500 text-sm">[{card.pronunciation}]</div>}
                <button type="button" onClick={(e) => { e.stopPropagation(); playWord(card.word, card.audioUrl, targetLanguage); }} className="mt-3 text-zinc-600 hover:text-zinc-300 text-lg">🔊</button>
                <div className="text-zinc-600 text-sm mt-3">Tap to reveal →</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-2xl font-black text-white mb-2">{card.translation}</div>
                {card.exampleSentence && <div className="bg-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 italic">{card.exampleSentence}</div>}
              </div>
            )}
          </div>
          {flipped && (
            <div className="mt-4">
              <button
                onClick={() => { setFlipped(false); if (current + 1 >= cards.length) setDone(true); else setCurrent((c) => c + 1); }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
