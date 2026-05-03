"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { LanguageMeta } from "@/lib/language/catalog";

type Step = 1 | 2 | 3;

type Goal = "travel" | "social" | "business";

const GOALS: Array<{ id: Goal; title: string; blurb: string; icon: string }> = [
  { id: "travel", title: "Travel", blurb: "Ordering, asking directions, surviving 2 weeks abroad.", icon: "✈️" },
  { id: "social", title: "Social", blurb: "Casual conversation with friends, partners, in-laws.", icon: "💬" },
  { id: "business", title: "Business", blurb: "Meetings, email, working in the language daily.", icon: "💼" },
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function OnboardingClient({ languages }: { languages: LanguageMeta[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [languageCode, setLanguageCode] = useState<string>(languages[0]?.code ?? "fr");
  const [goal, setGoal] = useState<Goal>("social");
  const [deadline, setDeadline] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLanguage = languages.find((l) => l.code === languageCode) ?? languages[0];

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languageCode,
          goalType: goal,
          deadlineDate: deadline || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(json.error ?? "Something went wrong");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-xl mx-auto px-4 pt-12 pb-16">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? "bg-indigo-500" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-3xl font-black mb-2">Pick your language</h1>
              <p className="text-zinc-400 text-sm mb-8">
                We'll build your 1,200-word frequency path and 15-pattern scaffold in this language.
              </p>
              <div className="space-y-3">
                {languages.map((lang) => {
                  const selected = lang.code === languageCode;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguageCode(lang.code)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        selected
                          ? "border-indigo-500 bg-indigo-950/40"
                          : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{lang.flag}</span>
                        <span className="font-semibold">{lang.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedLanguage}
                className="mt-8 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                Continue →
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-3xl font-black mb-2">What's this for?</h1>
              <p className="text-zinc-400 text-sm mb-8">
                This tunes vocabulary selection and scenario mix. You can change it later.
              </p>
              <div className="space-y-3">
                {GOALS.map((g) => {
                  const selected = g.id === goal;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        selected
                          ? "border-indigo-500 bg-indigo-950/40"
                          : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{g.icon}</span>
                        <div>
                          <div className="font-semibold">{g.title}</div>
                          <div className="text-zinc-400 text-sm mt-0.5">{g.blurb}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-semibold transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
                >
                  Continue →
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-3xl font-black mb-2">Got a deadline?</h1>
              <p className="text-zinc-400 text-sm mb-8">
                Optional — but a real date (a trip, an exam, a call) is the single biggest predictor of follow-through.
              </p>
              <label className="block mb-2 text-sm font-medium text-zinc-300">
                Target date
              </label>
              <input
                type="date"
                min={todayIso()}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-white"
              />
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline("")}
                  className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Clear
                </button>
              )}

              {error && (
                <div className="mt-6 p-3 rounded-lg border border-red-800 bg-red-950/40 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                  className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-semibold transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Setting up…" : deadline ? "Start" : "Skip and start"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
