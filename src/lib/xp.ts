// XP system — ADHD-friendly dopamine loop

export const XP = {
  // Vocab
  WORD_SEEN: 3,                // per learn-mode exposure (just showing up)
  WORD_CORRECT: 10,
  WORD_CORRECT_STREAK_3: 15,   // bonus for 3-in-a-row
  WORD_CORRECT_STREAK_5: 25,   // bonus for 5-in-a-row
  WORD_FIRST_LEARN: 20,        // first time seeing a word
  WORD_MASTERED: 50,           // word enters "mastered" state

  // Sessions
  SESSION_COMPLETE: 30,
  SESSION_PERFECT: 75,         // 100% accuracy
  SESSION_STREAK_BONUS: 20,    // completing session during streak

  // Conversation
  CONVO_SESSION: 40,
  CONVO_MINUTE: 5,             // per minute in conversation
  CONVO_NEW_WORD_USED: 15,    // using a word you just learned

  // Grammar
  DECONSTRUCTION_CARD: 8,        // per card completed (8 × 12 = 96)
  DECONSTRUCTION_COMPLETE: 100,
  CHEAT_SHEET_DONE: 50,

  // Streaks
  STREAK_3_DAYS: 50,
  STREAK_7_DAYS: 150,
  STREAK_30_DAYS: 500,

  // Achievements
  ACHIEVEMENT_UNLOCK: 25,
} as const;

// XP thresholds per level (exponential curve)
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function levelFromTotalXp(totalXp: number): number {
  let level = 1;
  let cumulative = 0;
  while (cumulative + xpForLevel(level) <= totalXp) {
    cumulative += xpForLevel(level);
    level++;
  }
  return level;
}

export function xpProgressInLevel(totalXp: number): { current: number; required: number; pct: number } {
  let level = 1;
  let cumulative = 0;
  while (cumulative + xpForLevel(level) <= totalXp) {
    cumulative += xpForLevel(level);
    level++;
  }
  const current = totalXp - cumulative;
  const required = xpForLevel(level);
  return { current, required, pct: Math.floor((current / required) * 100) };
}

export const LEVEL_TITLES: Record<number, string> = {
  1: "Absolute Beginner",
  2: "Tourist",
  3: "Phrase Hunter",
  4: "Sentence Builder",
  5: "Conversationalist",
  6: "Fluent",
  7: "Near-Native",
  8: "Master",
};

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, 8)] ?? "Master";
}
