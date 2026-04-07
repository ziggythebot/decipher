export const ACHIEVEMENTS = [
  // Vocab milestones
  { slug: "first_word", name: "First Word", description: "Learn your first word", icon: "🌱", xpReward: 25, category: "vocab" },
  { slug: "words_10", name: "10 Words", description: "Learn 10 words", icon: "📚", xpReward: 50, category: "vocab" },
  { slug: "words_50", name: "50 Words", description: "Learn 50 words", icon: "🔥", xpReward: 100, category: "vocab" },
  { slug: "words_100", name: "Century", description: "Learn 100 words", icon: "💯", xpReward: 200, category: "vocab" },
  { slug: "words_500", name: "Word Hoarder", description: "Learn 500 words", icon: "🧠", xpReward: 500, category: "vocab" },
  { slug: "words_1200", name: "Conversational", description: "Reach the 1,200-word fluency threshold", icon: "🗣️", xpReward: 1000, category: "vocab" },

  // Streak milestones
  { slug: "streak_3", name: "On a Roll", description: "3-day streak", icon: "⚡", xpReward: 50, category: "streak" },
  { slug: "streak_7", name: "Week Warrior", description: "7-day streak", icon: "🏆", xpReward: 150, category: "streak" },
  { slug: "streak_30", name: "Unstoppable", description: "30-day streak", icon: "🚀", xpReward: 500, category: "streak" },

  // Conversation
  { slug: "first_convo", name: "Brave Talker", description: "Complete your first conversation session", icon: "🎙️", xpReward: 75, category: "conversation" },
  { slug: "convo_10min", name: "10-Minute Club", description: "Talk for 10 minutes straight", icon: "⏱️", xpReward: 100, category: "conversation" },
  { slug: "convo_sessions_10", name: "Regular", description: "Complete 10 conversation sessions", icon: "🎯", xpReward: 200, category: "conversation" },

  // Grammar
  { slug: "deconstruction_done", name: "Decoder", description: "Complete the Deconstruction Dozen", icon: "🔓", xpReward: 100, category: "grammar" },
  { slug: "cheat_sheet_done", name: "Cheat Code", description: "Generate your Grammar Cheat Sheet", icon: "📋", xpReward: 50, category: "grammar" },

  // Perfect scores
  { slug: "perfect_session", name: "Flawless", description: "Complete a vocab session with 100% accuracy", icon: "✨", xpReward: 75, category: "vocab" },
  { slug: "perfect_sessions_5", name: "Perfection Machine", description: "5 perfect sessions in a row", icon: "💎", xpReward: 300, category: "vocab" },
] as const;

export type AchievementSlug = typeof ACHIEVEMENTS[number]["slug"];
