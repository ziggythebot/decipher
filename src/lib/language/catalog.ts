// Language catalog — single source of truth for supported languages,
// feature flags, and per-language locale mappings.
// Phase 0 of the multi-language rollout.

const ENABLED_LANGUAGES_RAW = process.env.ENABLED_LANGUAGES ?? "fr";
const SPEAK_ENABLED_LANGUAGES_RAW = process.env.SPEAK_ENABLED_LANGUAGES ?? "fr";
const DECONSTRUCTION_ENABLED_LANGUAGES_RAW = process.env.DECONSTRUCTION_ENABLED_LANGUAGES ?? "fr";

export const ENABLED_LANGUAGES = new Set(
  ENABLED_LANGUAGES_RAW.split(",").map((s) => s.trim()).filter(Boolean)
);
export const SPEAK_ENABLED_LANGUAGES = new Set(
  SPEAK_ENABLED_LANGUAGES_RAW.split(",").map((s) => s.trim()).filter(Boolean)
);
export const DECONSTRUCTION_ENABLED_LANGUAGES = new Set(
  DECONSTRUCTION_ENABLED_LANGUAGES_RAW.split(",").map((s) => s.trim()).filter(Boolean)
);

export type LangFeature = "vocab" | "speak" | "deconstruction";

export type LanguageMeta = {
  code: string;
  name: string;
  flag: string;
  /** Browser SpeechSynthesis locale (replaces hardcoded "fr-FR"). */
  ttsBrowserLocale: string;
  /** Deepgram STT language code. */
  sttDeepgramLocale: string;
  /** Deepgram TTS model name. */
  ttsDeepgramModel: string;
};

export const LANGUAGE_CATALOG: Record<string, LanguageMeta> = {
  fr: {
    code: "fr",
    name: "French",
    flag: "🇫🇷",
    ttsBrowserLocale: "fr-FR",
    sttDeepgramLocale: "fr",
    ttsDeepgramModel: "aura-2-agathe-fr",
  },
  es: {
    code: "es",
    name: "Spanish",
    flag: "🇪🇸",
    ttsBrowserLocale: "es-ES",
    sttDeepgramLocale: "es",
    ttsDeepgramModel: "aura-2-celeste-es",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    flag: "🇧🇷",
    ttsBrowserLocale: "pt-BR",
    sttDeepgramLocale: "pt",
    ttsDeepgramModel: "aura-2-thalia-en",
  },
  de: {
    code: "de",
    name: "German",
    flag: "🇩🇪",
    ttsBrowserLocale: "de-DE",
    sttDeepgramLocale: "de",
    ttsDeepgramModel: "aura-2-julius-de",
  },
  zh: {
    code: "zh",
    name: "Mandarin",
    flag: "🇨🇳",
    ttsBrowserLocale: "zh-CN",
    sttDeepgramLocale: "zh-CN",
    ttsDeepgramModel: "aura-2-thalia-en",
  },
};

export class LanguageNotEnabledError extends Error {
  constructor(
    public readonly languageCode: string,
    public readonly feature: LangFeature
  ) {
    super(`Language "${languageCode}" is not enabled for feature: ${feature}`);
    this.name = "LanguageNotEnabledError";
  }
}

export function assertLanguageEnabled(languageCode: string, feature: LangFeature): void {
  const enabledSet =
    feature === "speak"
      ? SPEAK_ENABLED_LANGUAGES
      : feature === "deconstruction"
        ? DECONSTRUCTION_ENABLED_LANGUAGES
        : ENABLED_LANGUAGES;

  if (!enabledSet.has(languageCode)) {
    throw new LanguageNotEnabledError(languageCode, feature);
  }
}

export function isLanguageEnabled(languageCode: string, feature: LangFeature): boolean {
  try {
    assertLanguageEnabled(languageCode, feature);
    return true;
  } catch {
    return false;
  }
}

export function getLanguageMeta(languageCode: string): LanguageMeta {
  return LANGUAGE_CATALOG[languageCode] ?? LANGUAGE_CATALOG["fr"]!;
}

/** Browser TTS locale for a given language code (e.g. "fr" → "fr-FR"). */
export function getBrowserTtsLocale(languageCode: string): string {
  return getLanguageMeta(languageCode).ttsBrowserLocale;
}

/**
 * Resolve the active language from user context.
 * Source order: UserLanguage.isActive → User.targetLanguage → "fr"
 * Request/header/body overrides are deferred to Phase 4.
 */
export function getActiveLanguage(user: {
  userLanguages: { languageCode: string; isActive: boolean }[];
  targetLanguage: string;
}): string {
  const active = user.userLanguages.find((ul) => ul.isActive);
  if (active) return active.languageCode;
  if (user.targetLanguage) {
    console.warn(
      `[lang] No active UserLanguage found, falling back to targetLanguage=${user.targetLanguage}`
    );
    return user.targetLanguage;
  }
  console.warn("[lang] No language context found, falling back to fr");
  return "fr";
}
