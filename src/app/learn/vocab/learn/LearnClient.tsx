"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { XpToast, useXpToast } from "@/components/game/XpToast";
import { XP } from "@/lib/xp";
import { getBrowserTtsLocale } from "@/lib/language/catalog";

type Card = {
  id: string;
  word: string;
  translation: string;
  pronunciation: string;
  exampleSentence: string;
  mnemonicHint: string | null;
  audioUrl: string | null;
  frequencyRank: number;
};

function playWord(word: string, audioUrl: string | null, targetLanguage: string) {
  if (audioUrl) { new Audio(audioUrl).play().catch(() => undefined); return; }
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = getBrowserTtsLocale(targetLanguage); u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

type Props = { cards: Card[]; targetLanguage: string };

export function LearnClient({ cards, targetLanguage }: Props) {
  const router = useRouter();
  const { events, showXp } = useXpToast();
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [graduated, setGraduated] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [done, setDone] = useState(false);
  const trickyCards = useRef<Card[]>([]);
  const [retesting, setRetesting] = useState(false);
  const [retestIndex, setRetestIndex] = useState(0);
  const [retestRevealed, setRetestRevealed] = useState(false);

  const card = cards[current];
  const progress = Math.floor((current / cards.length) * 100);

  async function submitConfidence(confidence: 1 | 2 | 3) {
    if (!card) return;

    if (confidence === 1 && !trickyCards.current.find((c) => c.id === card.id)) {
      trickyCards.current.push(card);
    }

    const res = await fetch("/api/vocab/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vocabId: card.id, confidence }),
    });

    let xpGain: number = XP.WORD_SEEN;
    if (res.ok) {
      const data = (await res.json()) as { graduated?: boolean; xpGain?: number };
      if (data.graduated) {
        setGraduated((g) => g + 1);
        xpGain = data.xpGain ?? xpGain;
        showXp(xpGain, "graduated!");
      } else {
        showXp(xpGain, "seen");
      }
    }
    setSessionXp((x) => x + xpGain);

    setRevealed(false);
    if (current + 1 >= cards.length) {
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  // Quick retest of tricky cards (reveal-only, no writes)
  if (retesting) {
    const rc = trickyCards.current[retestIndex];
    if (!rc) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-black mb-2">Retest done</h2>
            <button onClick={() => router.push("/learn/vocab")} className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl">Back to Vocab Hub</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <XpToast events={events} />
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => router.push("/learn/vocab")} className="text-zinc-500 hover:text-zinc-300 text-sm">← Exit</button>
            <span className="text-zinc-500 text-sm">{retestIndex + 1}/{trickyCards.current.length}</span>
            <span className="text-xs text-orange-400 bg-orange-900/30 border border-orange-800 px-2 py-0.5 rounded-full">retest</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.floor((retestIndex / trickyCards.current.length) * 100)}%` }} />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center cursor-pointer min-h-[200px] flex flex-col items-center justify-center" onClick={() => !retestRevealed && setRetestRevealed(true)}>
              {!retestRevealed ? (
                <div>
                  <div className="text-3xl font-black mb-2">{rc.word}</div>
                  {rc.pronunciation && <div className="text-zinc-500 text-sm">[{rc.pronunciation}]</div>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); playWord(rc.word, rc.audioUrl, targetLanguage); }} className="mt-3 text-zinc-600 hover:text-zinc-300 text-lg">🔊</button>
                  <div className="text-zinc-600 text-sm mt-3">Tap to reveal →</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-black text-white mb-2">{rc.translation}</div>
                  {rc.exampleSentence && <div className="bg-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 italic">{rc.exampleSentence}</div>}
                </div>
              )}
            </div>
            {retestRevealed && (
              <button onClick={() => { setRetestRevealed(false); if (retestIndex + 1 >= trickyCards.current.length) setRetesting(false); else setRetestIndex((i) => i + 1); }} className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors">Next →</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const tricky = trickyCards.current;
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <XpToast events={events} />
        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="text-2xl font-black mb-1">Batch done!</h2>
          <p className="text-zinc-400 text-sm mb-6">{cards.length} words seen</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-2xl font-black text-green-400">{graduated}</div>
              <div className="text-xs text-zinc-400">Graduated to Review</div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-2xl font-black text-indigo-400">+{sessionXp}</div>
              <div className="text-xs text-zinc-400">XP earned</div>
            </div>
          </div>

          {graduated > 0 && (
            <div className="bg-green-900/20 border border-green-800 rounded-xl p-3 mb-4">
              <p className="text-green-400 text-sm font-semibold">{graduated} word{graduated > 1 ? "s" : ""} moved to your Review queue</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {tricky.length > 0 && (
              <button onClick={() => { setRetestIndex(0); setRetestRevealed(false); setRetesting(true); }} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors">
                Quick Retest {tricky.length} tricky →
              </button>
            )}
            <button onClick={() => router.push("/learn/vocab/learn")} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors">
              Keep Learning →
            </button>
            <button onClick={() => router.push("/learn/vocab")} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
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

      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.push("/learn/vocab")} className="text-zinc-500 hover:text-zinc-300 text-sm">← Vocab</button>
          <span className="text-zinc-500 text-sm">{current + 1}/{cards.length}</span>
          <span className="text-xs text-green-400 bg-green-900/30 border border-green-800 px-2 py-0.5 rounded-full">learn</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div className="h-full bg-green-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <AnimatePresence mode="wait">
          <motion.div key={card.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="w-full max-w-sm">
            <div className="flex justify-center mb-4">
              <span className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-full">
                #{card.frequencyRank} most common
              </span>
            </div>

            <div
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center cursor-pointer select-none min-h-[220px] flex flex-col items-center justify-center"
              onClick={() => !revealed && setRevealed(true)}
            >
              <AnimatePresence mode="wait">
                {!revealed ? (
                  <motion.div key="front" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                    <div className="text-3xl font-black mb-2">{card.word}</div>
                    {card.pronunciation && <div className="text-zinc-500 text-sm mb-1">[{card.pronunciation}]</div>}
                    <button type="button" onClick={(e) => { e.stopPropagation(); playWord(card.word, card.audioUrl, targetLanguage); }} className="mt-2 text-zinc-600 hover:text-zinc-300 transition-colors text-lg" aria-label="Play pronunciation">🔊</button>
                    <div className="text-zinc-600 text-sm mt-3">Tap to reveal →</div>
                  </motion.div>
                ) : (
                  <motion.div key="back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Translation</div>
                    <div className="text-2xl font-black text-white mb-3">{card.translation}</div>
                    {card.exampleSentence && (
                      <div className="bg-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 italic mb-2">{card.exampleSentence}</div>
                    )}
                    {card.mnemonicHint && (
                      <div className="text-xs text-indigo-400">💡 {card.mnemonicHint}</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {revealed && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                  <p className="text-xs text-zinc-500 text-center mb-2">How did that feel?</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => void submitConfidence(1)} className="border border-red-800 bg-red-900/40 hover:bg-red-900/70 text-red-300 font-semibold py-3 rounded-xl text-sm transition-colors">Tricky</button>
                    <button onClick={() => void submitConfidence(2)} className="border border-amber-800 bg-amber-900/40 hover:bg-amber-900/70 text-amber-300 font-semibold py-3 rounded-xl text-sm transition-colors">OK</button>
                    <button onClick={() => void submitConfidence(3)} className="border border-green-800 bg-green-900/40 hover:bg-green-900/70 text-green-300 font-semibold py-3 rounded-xl text-sm transition-colors">Got it</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
