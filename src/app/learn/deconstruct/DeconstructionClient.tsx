"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { XpToast, useXpToast } from "@/components/game/XpToast";
import { XP } from "@/lib/xp";
import { FRENCH_DECONSTRUCTION_DOZEN, type GrammarToken, type TokenRole } from "@/data/deconstruction-dozen";

type Stage = "sentence" | "translation" | "insight";

type Props = {
  initialProgress: number;
  alreadyCompleted: boolean;
};

// Role display labels and colours
const ROLE_META: Record<TokenRole, { label: string; className: string }> = {
  subject:         { label: "Subject",         className: "text-blue-300 bg-blue-900/40 border-blue-700 hover:bg-blue-900/70" },
  verb:            { label: "Verb",             className: "text-green-300 bg-green-900/40 border-green-700 hover:bg-green-900/70" },
  object:          { label: "Direct object",    className: "text-amber-300 bg-amber-900/40 border-amber-700 hover:bg-amber-900/70" },
  adjective:       { label: "Adjective",        className: "text-purple-300 bg-purple-900/40 border-purple-700 hover:bg-purple-900/70" },
  pronoun:         { label: "Pronoun",          className: "text-cyan-300 bg-cyan-900/40 border-cyan-700 hover:bg-cyan-900/70" },
  negation:        { label: "Negation",         className: "text-red-300 bg-red-900/40 border-red-700 hover:bg-red-900/70" },
  modal:           { label: "Modal verb",       className: "text-indigo-300 bg-indigo-900/40 border-indigo-700 hover:bg-indigo-900/70" },
  article:         { label: "Article",          className: "text-zinc-300 bg-zinc-800 border-zinc-600 hover:bg-zinc-700" },
  "question-form": { label: "Question form",    className: "text-orange-300 bg-orange-900/40 border-orange-700 hover:bg-orange-900/70" },
  "near-future":   { label: "Near future",      className: "text-emerald-300 bg-emerald-900/40 border-emerald-700 hover:bg-emerald-900/70" },
  possessive:      { label: "Possession",       className: "text-pink-300 bg-pink-900/40 border-pink-700 hover:bg-pink-900/70" },
  "indirect-object":{ label: "Indirect object", className: "text-yellow-300 bg-yellow-900/40 border-yellow-700 hover:bg-yellow-900/70" },
};

// Split a sentence string into plain-text and token segments
type Segment = { text: string; token?: GrammarToken };

function segmentSentence(sentence: string, tokens: GrammarToken[]): Segment[] {
  let segments: Segment[] = [{ text: sentence }];
  for (const token of tokens) {
    const next: Segment[] = [];
    for (const seg of segments) {
      if (seg.token) { next.push(seg); continue; }
      const idx = seg.text.indexOf(token.text);
      if (idx === -1) { next.push(seg); continue; }
      if (idx > 0) next.push({ text: seg.text.slice(0, idx) });
      next.push({ text: token.text, token });
      const rest = seg.text.slice(idx + token.text.length);
      if (rest) next.push({ text: rest });
    }
    segments = next;
  }
  return segments;
}

export function DeconstructionClient({ initialProgress, alreadyCompleted }: Props) {
  const router = useRouter();
  const { events, showXp } = useXpToast();

  const LS_KEY = "deconstruct_progress";
  const startIndex = Math.min(
    Math.max(
      initialProgress,
      typeof window !== "undefined" ? parseInt(localStorage.getItem(LS_KEY) ?? "0", 10) : 0
    ),
    11
  );
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [stage, setStage] = useState<Stage>("sentence");
  const [tappedRoles, setTappedRoles] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [isDone, setIsDone] = useState(initialProgress >= FRENCH_DECONSTRUCTION_DOZEN.length);
  const [sessionXp, setSessionXp] = useState(0);
  const [completionXp, setCompletionXp] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const hasClaimed = useRef(false);

  // Persist position to localStorage so progress survives if the user exits
  // before clicking "Got it" or "Skip" (API save only fires on those clicks)
  useEffect(() => {
    if (!isDone) localStorage.setItem(LS_KEY, String(currentIndex));
    else localStorage.removeItem(LS_KEY);
  }, [currentIndex, isDone]);

  const card = FRENCH_DECONSTRUCTION_DOZEN[currentIndex];
  const segments = card ? segmentSentence(card.french, card.tokens) : [];
  const progressPct = Math.round((currentIndex / FRENCH_DECONSTRUCTION_DOZEN.length) * 100);

  async function submitCard(event: "card_completed" | "card_skipped") {
    const res = await fetch("/api/grammar/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIndex: currentIndex, event }),
    });
    if (res.ok) {
      const data = (await res.json()) as { xpGain: number };
      if (data.xpGain > 0) {
        showXp(data.xpGain, "card unlocked");
        setSessionXp((x) => x + data.xpGain);
      }
    }
    advance();
  }

  function advance() {
    if (currentIndex + 1 >= FRENCH_DECONSTRUCTION_DOZEN.length) {
      setIsDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setStage("sentence");
      setTappedRoles(new Set());
      setExpandedNotes(false);
    }
  }

  function goBack() {
    if (currentIndex === 0) return;
    setCurrentIndex((i) => i - 1);
    setStage("sentence");
    setTappedRoles(new Set());
    setExpandedNotes(false);
  }

  async function claimCompletion() {
    if (hasClaimed.current || claiming) return;
    hasClaimed.current = true;
    setClaiming(true);
    const res = await fetch("/api/grammar/complete", { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { totalGain?: number; alreadyCompleted?: boolean };
      setCompletionXp(data.alreadyCompleted ? 0 : (data.totalGain ?? 0));
    }
    setClaiming(false);
  }

  // Already done in a previous session
  if (alreadyCompleted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🔓</div>
          <h2 className="text-2xl font-black mb-2">Grammar Unlocked</h2>
          <p className="text-zinc-400 text-sm mb-6">
            You&apos;ve completed all 12 sentences. The framework is yours.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // End screen — all 12 cards seen this session or from DB
  if (isDone) {
    const totalXp = sessionXp + (completionXp ?? 0);
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <XpToast events={events} />
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center"
        >
          <div className="text-6xl mb-4">🔓</div>
          <h2 className="text-2xl font-black mb-1">Framework Unlocked</h2>
          <p className="text-zinc-400 text-sm mb-6">
            12 patterns decoded. You now understand how French works.
          </p>

          {completionXp === null ? (
            <button
              onClick={claimCompletion}
              disabled={claiming}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors mb-4"
            >
              {claiming ? "Saving..." : `Claim reward +${XP.DECONSTRUCTION_COMPLETE} XP`}
            </button>
          ) : (
            <div className="bg-indigo-900/30 border border-indigo-700 rounded-xl p-4 mb-6">
              <div className="text-3xl font-black text-indigo-300">+{totalXp} XP</div>
              <div className="text-xs text-zinc-400 mt-1">earned this session</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push("/learn/vocab")}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Start Vocab Review →
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
          <button
            onClick={() => router.push("/dashboard")}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            ← Dashboard
          </button>
          <span className="text-zinc-500 text-sm">
            {currentIndex + 1} / {FRENCH_DECONSTRUCTION_DOZEN.length}
          </span>
          <div className="w-16" />
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm"
          >
            {/* Sentence rank badge */}
            <div className="flex justify-center mb-4">
              <span className="text-xs text-indigo-400 bg-indigo-900/30 border border-indigo-800 px-3 py-1 rounded-full font-semibold">
                Sentence {card.rank} of 12
              </span>
            </div>

            {/* Main card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">

              {/* Stage 1: French sentence with tappable tokens */}
              <div className="mb-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Tap words to see their role</p>
                <p className="text-2xl font-bold leading-relaxed flex flex-wrap gap-x-1 gap-y-2">
                  {segments.map((seg, i) => {
                    if (!seg.token) {
                      return <span key={i}>{seg.text}</span>;
                    }
                    const meta = ROLE_META[seg.token.role];
                    const tapped = tappedRoles.has(seg.token.text);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setTappedRoles((prev) => {
                            const next = new Set(prev);
                            if (next.has(seg.token!.text)) {
                              next.delete(seg.token!.text);
                            } else {
                              next.add(seg.token!.text);
                            }
                            return next;
                          })
                        }
                        className={`border rounded-lg px-1.5 py-0.5 text-2xl font-bold transition-all ${meta.className} ${tapped ? "ring-2 ring-offset-1 ring-offset-zinc-900 ring-current" : ""}`}
                      >
                        {seg.text}
                      </button>
                    );
                  })}
                </p>

                {/* Tapped token labels */}
                {tappedRoles.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    {card.tokens
                      .filter((t) => tappedRoles.has(t.text))
                      .map((t) => (
                        <span
                          key={t.text}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_META[t.role].className}`}
                        >
                          {t.text} = {ROLE_META[t.role].label}
                        </span>
                      ))}
                  </motion.div>
                )}

                <p className="text-zinc-500 text-sm mt-3">[{card.pronunciation}]</p>
              </div>

              {/* Stage 2: Translation */}
              <AnimatePresence>
                {stage === "translation" || stage === "insight" ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-zinc-800 pt-4 mb-4"
                  >
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Translation</p>
                    <p className="text-lg font-semibold text-white">{card.english}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Stage 3: Grammar insight */}
              <AnimatePresence>
                {stage === "insight" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-zinc-800 pt-4"
                  >
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Grammar rule</p>
                    <p className="text-sm font-bold text-indigo-300 mb-3">{card.patternRevealed}</p>

                    <button
                      type="button"
                      onClick={() => setExpandedNotes((v) => !v)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                    >
                      <span>{expandedNotes ? "▾" : "▸"}</span>
                      <span>{expandedNotes ? "Less detail" : "Explain more"}</span>
                    </button>

                    <AnimatePresence>
                      {expandedNotes && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-sm text-zinc-400 mt-2 leading-relaxed"
                        >
                          {card.englishNotes}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stage progression buttons */}
            <div className="mt-4 space-y-2">
              {stage === "sentence" && (
                <button
                  type="button"
                  onClick={() => setStage("translation")}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Reveal translation →
                </button>
              )}

              {stage === "translation" && (
                <button
                  type="button"
                  onClick={() => setStage("insight")}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Show grammar rule →
                </button>
              )}

              {stage === "insight" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void submitCard("card_skipped")}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitCard("card_completed")}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                  >
                    Got it +{XP.DECONSTRUCTION_CARD} XP
                  </button>
                </div>
              )}

              {/* Back button — always available except on first card */}
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="w-full text-zinc-600 hover:text-zinc-400 text-xs py-2 transition-colors"
                >
                  ← Back to previous
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
