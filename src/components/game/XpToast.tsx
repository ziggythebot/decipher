"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

type XpEvent = {
  id: string;
  amount: number;
  label: string;
};

type Props = {
  events: XpEvent[];
};

export function XpToast({ events }: Props) {
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {events.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg font-bold text-sm"
          >
            <span>+{e.amount} XP</span>
            <span className="text-indigo-200 font-normal">{e.label}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook for managing XP toast events
export function useXpToast() {
  const [events, setEvents] = useState<XpEvent[]>([]);

  const showXp = (amount: number, label: string) => {
    const id = Math.random().toString(36).slice(2);
    setEvents((prev) => [...prev, { id, amount, label }]);
    setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }, 2500);
  };

  return { events, showXp };
}
