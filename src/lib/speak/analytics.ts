export type ErrorCategory = "grammar" | "vocab" | "pronunciation" | "hesitation" | "other";

export type CategoryCounts = Record<ErrorCategory, number>;

const EMPTY_COUNTS: CategoryCounts = {
  grammar: 0,
  vocab: 0,
  pronunciation: 0,
  hesitation: 0,
  other: 0,
};

function cloneCounts(): CategoryCounts {
  return { ...EMPTY_COUNTS };
}

function normalize(text: string): string {
  return text.toLowerCase();
}

export function countUserTurns(transcript: string | null): number {
  return (transcript ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("User:")).length;
}

export function categorizeText(text: string): ErrorCategory {
  const t = normalize(text);

  if (/\b(um|uh|erm|euh|uhm)\b/.test(t)) return "hesitation";
  if (/\b(pronunciation|pronounce|accent|phonetic|prononce|accentuation)\b/.test(t)) return "pronunciation";
  if (/\b(vocab|vocabulary|word choice|mot|vocabulaire|unknown word)\b/.test(t)) return "vocab";
  if (/\b(grammar|grammaire|conjugat|tense|accord|article|gender|genre)\b/.test(t)) return "grammar";
  return "other";
}

export function extractCorrectedForms(transcript: string | null): string[] {
  const lines = (transcript ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("Agent:"));

  const corrections = new Set<string>();

  for (const line of lines) {
    const arrow = line.match(/->\s*([^.!?\n]{3,80})/i);
    if (arrow?.[1]) corrections.add(arrow[1].trim());

    const cue = line.match(
      /(?:on dit|tu peux dire|tu devrais dire|correct(?: form)?|better)\s*[:\-]?\s*["'“”]?([^"'.!\n]{3,80})/i
    );
    if (cue?.[1]) corrections.add(cue[1].trim());
  }

  return [...corrections].slice(0, 20);
}

export function summarizeErrorCategories(params: {
  transcript: string | null;
  errorsLogged: unknown;
  inferredUnknownWordCount?: number;
}): CategoryCounts {
  const counts = cloneCounts();
  const lines = (params.transcript ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!line.includes("Agent:") && !line.includes("User:")) continue;
    const text = line.split(":").slice(1).join(":").trim();
    const category = categorizeText(text);
    if (category !== "other") counts[category] += 1;
  }

  if (Array.isArray(params.errorsLogged)) {
    for (const item of params.errorsLogged) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.category === "string" && rec.category in counts) {
        counts[rec.category as ErrorCategory] += 1;
        continue;
      }
      if (typeof rec.text === "string") {
        counts[categorizeText(rec.text)] += 1;
      }
    }
  }

  if ((params.inferredUnknownWordCount ?? 0) > 0) {
    counts.vocab += params.inferredUnknownWordCount ?? 0;
  }

  return counts;
}
