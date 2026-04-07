"use client";

import { motion } from "framer-motion";
import { xpProgressInLevel, levelTitle } from "@/lib/xp";

type Props = {
  totalXp: number;
  level: number;
  streakDays: number;
};

export function XpBar({ totalXp, level, streakDays }: Props) {
  const { current, required, pct } = xpProgressInLevel(totalXp);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
      {/* Level badge */}
      <div className="flex flex-col items-center min-w-[48px]">
        <span className="text-xs text-zinc-400 font-medium">LVL</span>
        <span className="text-2xl font-black text-white leading-none">{level}</span>
      </div>

      {/* XP bar */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold text-zinc-300">{levelTitle(level)}</span>
          <span className="text-xs text-zinc-500">{current}/{required} XP</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Streak */}
      {streakDays > 0 && (
        <div className="flex flex-col items-center min-w-[40px]">
          <span className="text-lg leading-none">🔥</span>
          <span className="text-xs font-bold text-orange-400">{streakDays}</span>
        </div>
      )}
    </div>
  );
}
