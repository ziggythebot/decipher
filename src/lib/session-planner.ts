import { db } from "@/lib/db";

// Grammar patterns derived from the Deconstruction Dozen.
// Used when patternScores is empty (user hasn't completed deconstruction yet).
const FALLBACK_PATTERNS: PatternDef[] = [
  { id: "svo", description: "Basic sentence structure (SVO)", exampleFr: "La pomme est rouge." },
  { id: "possessives", description: "Possessives — de + owner", exampleFr: "C'est la pomme de Jean." },
  { id: "indirect-object", description: "Indirect objects — give to someone", exampleFr: "Je donne la pomme à Jean." },
  { id: "pronoun", description: "Object pronouns — lui/leur", exampleFr: "Nous lui donnons la pomme." },
  { id: "question", description: "Question formation", exampleFr: "Est-ce que la pomme est rouge?" },
  { id: "plural", description: "Plural agreement", exampleFr: "Les pommes sont rouges." },
  { id: "modal", description: "Modal verbs — devoir/vouloir", exampleFr: "Je dois lui donner la pomme." },
  { id: "near-future", description: "Near future — aller + infinitive", exampleFr: "Je vais savoir demain." },
  { id: "negation", description: "Negation — ne…pas", exampleFr: "Je ne peux pas manger la pomme." },
  { id: "present-perfect", description: "Present perfect — avoir + past participle", exampleFr: "J'ai mangé la pomme." },
];

type PatternDef = {
  id: string;
  description: string;
  exampleFr: string;
};

export type SessionObjective = {
  targetPattern: {
    id: string;
    description: string;
    exampleFr: string;
    requiredUses: number;
  } | null;
  targetVocab: {
    word: string;
    translation: string;
    frequencyRank: number;
    isWeak: boolean;
  }[];
  errorFocus: string[];
};

export async function buildSessionObjective(
  userId: string,
  languageCode: string
): Promise<SessionObjective> {
  const now = new Date();

  // Fetch due cards and weak cards in parallel
  const [dueCards, weakCards, recentSessions, grammarProfile] = await Promise.all([
    // Due for review: state >= 1, dueDate past, ordered by most overdue first
    db.userVocabulary.findMany({
      where: {
        userId,
        word: { languageCode },
        state: { gte: 1 },
        dueDate: { lte: now },
      },
      include: { word: { select: { word: true, translation: true, frequencyRank: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    // Weak cards: lapsed at least once, ordered by most lapses
    db.userVocabulary.findMany({
      where: {
        userId,
        word: { languageCode },
        state: { gte: 1 },
        lapses: { gt: 0 },
      },
      include: { word: { select: { word: true, translation: true, frequencyRank: true } } },
      orderBy: { lapses: "desc" },
      take: 4,
    }),
    // Recent sessions for error extraction
    db.conversationSession.findMany({
      where: { userId, languageCode },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { errorsLogged: true },
    }),
    db.grammarProfile.findUnique({
      where: { userId_languageCode: { userId, languageCode } },
      select: { deconstructionDone: true, patternScores: true },
    }),
  ]);

  // Build target vocab: merge due + weak, deduplicate by word, cap at 8
  const seen = new Set<string>();
  const targetVocab: SessionObjective["targetVocab"] = [];

  for (const card of weakCards) {
    if (seen.has(card.word.word)) continue;
    seen.add(card.word.word);
    targetVocab.push({
      word: card.word.word,
      translation: card.word.translation,
      frequencyRank: card.word.frequencyRank,
      isWeak: true,
    });
  }

  for (const card of dueCards) {
    if (seen.has(card.word.word)) continue;
    seen.add(card.word.word);
    targetVocab.push({
      word: card.word.word,
      translation: card.word.translation,
      frequencyRank: card.word.frequencyRank,
      isWeak: false,
    });
    if (targetVocab.length >= 8) break;
  }

  // Pick weakest grammar pattern
  let targetPattern: SessionObjective["targetPattern"] = null;
  const patternScores = (grammarProfile?.patternScores ?? {}) as Record<string, number>;
  const patternKeys = Object.keys(patternScores);

  if (patternKeys.length > 0) {
    // Pick the pattern with the lowest mastery score
    const weakestKey = patternKeys.reduce((a, b) => (patternScores[a] < patternScores[b] ? a : b));
    const def = FALLBACK_PATTERNS.find((p) => p.id === weakestKey);
    if (def) {
      targetPattern = { ...def, requiredUses: 6 };
    }
  } else if (grammarProfile?.deconstructionDone) {
    // Deconstruction done but no scores tracked yet — pick a random pattern
    const def = FALLBACK_PATTERNS[Math.floor(Math.random() * FALLBACK_PATTERNS.length)];
    targetPattern = { ...def, requiredUses: 6 };
  }
  // If deconstruction not done, no pattern targeting — keep targetPattern null

  // Extract recent errors from last 3 sessions
  const errorFocus: string[] = [];
  for (const session of recentSessions) {
    const errors = session.errorsLogged;
    if (Array.isArray(errors)) {
      for (const e of errors as Array<{ error?: string }>) {
        if (typeof e.error === "string" && e.error && !errorFocus.includes(e.error)) {
          errorFocus.push(e.error);
          if (errorFocus.length >= 3) break;
        }
      }
    }
    if (errorFocus.length >= 3) break;
  }

  return { targetPattern, targetVocab, errorFocus };
}
