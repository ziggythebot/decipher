# Multi-Language Implementation Plan

## Goal
Turn Decipher from "French-first with language flags" into a true multi-language platform with clean per-language progress, content packs, and scalable rollout controls.

## Product Principles
- Keep one account, many languages.
- Keep progress isolated per language.
- Keep UX simple: one active language at a time.
- Ship in phases with no data loss for existing French users.

## Current State (As-Is)
- `User.targetLanguage` exists and vocab queries already use it.
- `LanguageWord` is language-aware (`languageCode`).
- `GrammarProfile` is one-per-user (not per-language) and currently blocks clean switching.
- Deconstruction content is French-hardcoded in code.
- `ConversationSession` lacks `languageCode`, so analytics/history are mixed across languages.

## Target State (To-Be)
- Per-user, per-language learning records.
- Language content served from language packs.
- Language switcher in app shell with explicit active language.
- All learning/speaking/progress endpoints use active language context.
- Feature gating per language (e.g. "Spanish vocab live, speak beta").

---

## Phase 0: Guardrails + Feature Flags
### Deliverables
- Add platform flags:
  - `ENABLED_LANGUAGES=fr,es,pt,de`
  - `SPEAK_ENABLED_LANGUAGES=fr`
  - `DECONSTRUCTION_ENABLED_LANGUAGES=fr`
- Add helper:
  - `src/lib/language/catalog.ts` with names, flags, support matrix.
- Centralize language validation:
  - `assertLanguageEnabled(languageCode, feature)`.

### Exit Criteria
- Unsupported languages never hard-fail; show clear "Coming soon."

---

## Phase 1: Data Model Refactor (No UX change yet)
### Schema changes
1. `GrammarProfile`
- Add `languageCode String @default("fr")`
- Replace unique `userId` with unique `[userId, languageCode]`

2. `ConversationSession`
- Add `languageCode String @default("fr")`
- Add index `[userId, languageCode, createdAt]`

3. `UserLanguage` (required in this phase)
- Add `UserLanguage` table:
  - `id`, `userId`, `languageCode`, `startedAt`, `lastActiveAt`, `isActive`
  - unique `[userId, languageCode]`

### Migration strategy
- Two-step `GrammarProfile` migration (must be split):
  - Migration A: add `languageCode` column with default `fr`; backfill existing rows.
  - Migration B: drop unique on `userId`; add unique on `[userId, languageCode]`.
- Backfill existing French users:
  - Existing `GrammarProfile` rows -> `languageCode = "fr"`.
  - Existing `ConversationSession` rows -> `languageCode = "fr"`.
  - Seed `UserLanguage` with one active `fr` row per user.
- Add compatibility layer during rollout:
  - If no language-specific grammar profile exists, lazily create it.

### Exit Criteria
- DB supports multiple languages per user with no breaking changes in production.

---

## Phase 2: Language Context in Backend
### Deliverables
- Introduce `getActiveLanguage(user)` (no request-level override in this phase):
  - source order: `UserLanguage.isActive` > `User.targetLanguage` > default `fr`.
  - Request/header/body overrides are explicitly deferred to Phase 4.
- Update APIs to always use language context:
  - `/api/grammar/progress`
  - `/api/grammar/complete`
  - `/api/vocab/rate`
  - `/api/speak/session/start`
  - any dashboard/progress query endpoints
- Write/read `ConversationSession.languageCode` on session create/end.
- Ensure known words passed to agent are filtered by active language.

### Exit Criteria
- Switching language changes API behavior consistently in one request cycle.

---

## Phase 3: Content Packs (Replace hardcoded French content)
### Deliverables
- New content structure:
  - `src/data/languages/fr/deconstruction-dozen.ts`
  - `src/data/languages/es/deconstruction-dozen.ts`
  - `src/data/languages/<code>/top100.ts`
- Unified interfaces:
  - `getDeconstructionPack(languageCode)`
  - `getTopWordsPack(languageCode)`
- Fallback contract:
  - loaders return `null` when a pack does not exist (do not throw).
  - page layer handles `null` by routing to a "Language not available yet" view.
- Deconstruction UI reads from pack, not French constant.
- Seed script supports multiple packs and idempotent upserts per language.

### Exit Criteria
- Adding a new language is data + seed + catalog entry, not code rewrites.

---

## Phase 4: UX Language Switching
### Deliverables
- Add language switcher in top nav/dashboard.
- Persist active language:
  - canonical source: `UserLanguage.isActive`
  - keep `User.targetLanguage` mirrored for backward compatibility during migration cycle
- On switch:
  - refresh learning pages to new language context.
  - keep progress separated.
- Add first-time language onboarding:
  - "Start from top 100" or "I know some words already" quick scan.

### Exit Criteria
- User can switch between French/Spanish without overwriting progress.

---

## Phase 5: Speak + Voice Per-Language Hardening
### Deliverables
- Map STT/TTS defaults per language in one config file.
- Per-language tutor prompts and scenario openers.
- Per-language profanity/slang controls (if premium modules enabled).
- Add "feature availability by language" in Speak UI:
  - e.g., "French live", "Spanish beta".

### Exit Criteria
- Voice behavior is deterministic by selected language.

---

## Phase 6: Analytics + Monetization Readiness
### Deliverables
- Language-segmented metrics:
  - DAU/WAU by language
  - review completion
  - conversation completion
  - retention by language cohort
- Premium flags by language/module:
  - `street_mode_enabled_languages`
  - `premium_ai_chat_enabled_languages`

### Exit Criteria
- You can measure which language expansions actually retain and monetize.

---

## API + Contract Checklist
- Every response that represents learner state should include `languageCode`.
- Every mutable endpoint should derive `languageCode` from active profile in Phases 1-3.
- Request-level override is not allowed until Phase 4.
- No endpoint should default silently to French once active-language rollout is complete.

## Backward Compatibility Rules
- Existing French users keep all progress.
- If language context missing, fallback is `fr` for this migration cycle only.
- Fallback path should be logged so we can remove it after rollout.

## Risks and Mitigations
- Risk: mixed-language writes during partial rollout.
  - Mitigation: reject unsupported `languageCode` centrally.
- Risk: hardcoded French strings remain in UI.
  - Mitigation: grep gate in CI for known French literals in shared components.
- Risk: voice regressions per new language.
  - Mitigation: per-language smoke checklist and staged enablement flags.
- Risk: hidden FR hardcodes in client audio UX.
  - Mitigation: remove hardcoded `fr-FR` in vocab TTS playback and map by active language.

## Testing Plan
### Unit
- language catalog validation
- pack loader fallback behavior
- active language resolver precedence

### Integration
- create/update grammar progress for FR and ES same user
- vocab review writes isolated by language
- speak session creates correct `languageCode` session row

### E2E
- switch FR -> ES -> FR preserves separate progress
- deconstruction loads correct language pack
- dashboard counters reflect active language only

## Rollout Plan
1. Deploy schema + compatibility code (no UI switch yet).
2. Enable Spanish vocab only behind flags.
3. Enable Spanish deconstruction.
4. Enable Spanish speak beta.
5. Remove migration fallbacks once logs are clean.

## Scope for Immediate Sprint
- Phase 0 + Phase 1 + Phase 2 only.
- Defer full multilingual content authoring until data model is stable.
- Include `fr-FR` hardcode cleanup in this sprint (`VocabSessionClient` TTS language mapping).

## Dirty Mode Note (Future)
- Dirty/slang modules must use the same language-pack architecture (`src/data/languages/<code>/...`).
- Do not introduce new French-only data structures in dirty mode that bypass the shared language context.

## Definition of Done (Core Multilingual Foundation)
- Per-language grammar progress works.
- Per-language conversation sessions tracked.
- Language context consistently applied in all core APIs.
- User can switch active language without data collisions.
