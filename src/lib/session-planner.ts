import { db } from "@/lib/db";
import { PHRASE_PATTERNS, getPhrasePattern, type PhrasePattern } from "@/data/phrase-patterns";

const REQUIRED_USES = 6;

function resolveTargetPattern(pattern: PhrasePattern): SessionObjective["targetPattern"] {
  return {
    id: pattern.id,
    description: pattern.hook,
    exampleFr: pattern.examples[0]?.fr ?? pattern.frame,
    requiredUses: REQUIRED_USES,
    frameStem: extractFrameStem(pattern.frame),
  };
}

// Take the literal part of a frame before the first ___ placeholder. This is
// what the learner must actually say for us to count a pattern use. e.g.
// "Je voudrais ___" → "je voudrais", "C'est ___" → "c'est".
function extractFrameStem(frame: string): string {
  const cut = frame.split("___")[0] ?? frame;
  return cut.trim().toLowerCase();
}

export type SessionObjective = {
  targetPattern: {
    id: string;
    description: string;
    exampleFr: string;
    requiredUses: number;
    frameStem: string;
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

  // Pick weakest phrase pattern the learner has started. Ids come from PHRASE_PATTERNS
  // (written by /api/patterns/complete), so we resolve via getPhrasePattern.
  let targetPattern: SessionObjective["targetPattern"] = null;
  const patternScores = (grammarProfile?.patternScores ?? {}) as Record<string, number>;
  const scoredKeys = Object.keys(patternScores).filter((k) => getPhrasePattern(k));

  if (scoredKeys.length > 0) {
    const weakestKey = scoredKeys.reduce((a, b) => (patternScores[a] < patternScores[b] ? a : b));
    const pattern = getPhrasePattern(weakestKey);
    if (pattern) targetPattern = resolveTargetPattern(pattern);
  } else if (grammarProfile?.deconstructionDone && PHRASE_PATTERNS.length > 0) {
    // Deconstruction done but no phrase patterns started yet — seed with the first one
    // (frequency-ordered: je voudrais is the most useful phrase in French).
    targetPattern = resolveTargetPattern(PHRASE_PATTERNS[0]);
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
