"use client";

import { motion, AnimatePresence } from "framer-motion";

type Props = {
  achievement: {
    name: string;
    description: string;
    icon: string;
    xpReward: number;
  } | null;
  onDismiss: () => void;
};

export function AchievementUnlock({ achievement, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <div className="bg-zinc-900 border border-yellow-500/50 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
              className="text-6xl mb-4"
            >
              {achievement.icon}
            </motion.div>
            <div className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">
              Achievement Unlocked!
            </div>
            <div className="text-white text-xl font-black mb-1">{achievement.name}</div>
            <div className="text-zinc-400 text-sm mb-4">{achievement.description}</div>
            <div className="inline-flex items-center gap-1 bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-bold">
              +{achievement.xpReward} XP
            </div>
            <div className="mt-4 text-zinc-600 text-xs">Tap to continue</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
