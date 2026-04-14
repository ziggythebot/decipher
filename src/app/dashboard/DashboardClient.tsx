"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { XpBar } from "@/components/game/XpBar";
import { UserNav } from "@/components/auth/UserNav";

type Props = {
  user: {
    id: string;
    xp: number;
    level: number;
    streakDays: number;
    totalXp: number;
    targetLanguage: string;
    goalType: string;
    daysToDeadline: number | null;
    grammarDone: boolean;
  };
  stats: {
    vocabCount: number;
    dueToday: number;
    sessionCount: number;
  };
};

const LANGUAGE_FLAGS: Record<string, string> = {
  fr: "🇫🇷",
  es: "🇪🇸",
  pt: "🇧🇷",
  de: "🇩🇪",
  zh: "🇨🇳",
};

const LANGUAGE_NAMES: Record<string, string> = {
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  de: "German",
  zh: "Mandarin",
};

export function DashboardClient({ user, stats }: Props) {
  const flag = LANGUAGE_FLAGS[user.targetLanguage] ?? "🌍";
  const langName = LANGUAGE_NAMES[user.targetLanguage] ?? user.targetLanguage;
  const daysToDeadline = user.daysToDeadline;

  const fluencyPct = Math.min(100, Math.floor((stats.vocabCount / 1200) * 100));

  // Determine what the user should do next
  const primaryAction = !user.grammarDone
    ? { href: "/learn/deconstruct", label: "Start Deconstruction →", color: "bg-indigo-600 hover:bg-indigo-500", desc: "Unlock the grammar framework first — takes 20 min" }
    : stats.dueToday > 0
    ? { href: "/learn/vocab", label: `Review ${stats.dueToday} cards due →`, color: "bg-green-600 hover:bg-green-500", desc: "Your daily vocab review is ready" }
    : { href: "/speak", label: "Start Conversation →", color: "bg-purple-600 hover:bg-purple-500", desc: "Practice speaking with your AI tutor" };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">{flag} Learning {langName}</h1>
            <p className="text-zinc-400 text-sm mt-0.5">{user.goalType} fluency</p>
          </div>
          <div className="flex items-center gap-4">
            {daysToDeadline !== null && (
              <div className="text-right">
                <div className="text-2xl font-black text-orange-400">{daysToDeadline}</div>
                <div className="text-xs text-zinc-500">days left</div>
              </div>
            )}
            <UserNav />
          </div>
        </div>

        {/* XP bar */}
        <XpBar totalXp={user.totalXp} level={user.level} streakDays={user.streakDays} />

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
        >
          <Link
            href={primaryAction.href}
            className={`block w-full text-center py-4 px-6 rounded-xl font-bold text-lg transition-colors ${primaryAction.color}`}
          >
            {primaryAction.label}
          </Link>
          <p className="text-center text-zinc-500 text-sm mt-2">{primaryAction.desc}</p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <StatCard
            value={stats.vocabCount}
            label="Words learned"
            icon="📚"
            subtext={`/ 1,200 target`}
          />
          <StatCard
            value={`${fluencyPct}%`}
            label="Fluency"
            icon="🎯"
            subtext="to conversational"
          />
          <StatCard
            value={stats.sessionCount}
            label="Conversations"
            icon="🎙️"
            subtext="completed"
          />
        </div>

        {/* Fluency progress bar */}
        <div className="mt-6 bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-zinc-300">Path to conversational fluency</span>
            <span className="text-sm text-zinc-500">{stats.vocabCount}/1,200 words</span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${fluencyPct}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-600">
            <span>Start</span>
            <span>Tourist (100)</span>
            <span>Conversational (1,200)</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Link href="/learn/vocab" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors">
            <div className="text-2xl mb-2">📖</div>
            <div className="font-semibold text-sm">Vocab Session</div>
            <div className="text-zinc-500 text-xs mt-1">
              {stats.dueToday > 0 ? `${stats.dueToday} cards due` : "All caught up"}
            </div>
          </Link>
          <Link href="/speak" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors">
            <div className="text-2xl mb-2">🎙️</div>
            <div className="font-semibold text-sm">Speak Now</div>
            <div className="text-zinc-500 text-xs mt-1">AI conversation practice</div>
          </Link>
          <Link href="/learn/deconstruct" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors">
            <div className="text-2xl mb-2">🔓</div>
            <div className="font-semibold text-sm">Grammar</div>
            <div className="text-zinc-500 text-xs mt-1">
              {user.grammarDone ? "Cheat sheet ready ✓" : "Deconstruction pending"}
            </div>
          </Link>
          <Link href="/progress" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold text-sm">Progress</div>
            <div className="text-zinc-500 text-xs mt-1">Stats & achievements</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, icon, subtext }: { value: string | number; label: string; icon: string; subtext: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center"
    >
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xl font-black">{value}</div>
      <div className="text-xs font-semibold text-zinc-300">{label}</div>
      <div className="text-xs text-zinc-600 mt-0.5">{subtext}</div>
    </motion.div>
  );
}
