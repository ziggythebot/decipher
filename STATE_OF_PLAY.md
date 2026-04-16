# Decipher — State of Play

**Date:** April 16, 2026  
**For:** External review  
**Author:** Andy Bird / b1rdmania

---

## What This Is

A speed language learning app built on Tim Ferriss's DiSSS/CaFE methodology. The premise: material selection matters more than learning method. The right 20% of vocabulary and grammar structures yield 80% of practical communication. No major app is built on this premise — they're all built on engagement mechanics instead.

**Personal motivation:** Andy's Portuguese CIPLE A2 exam prep. French is the trial language — everything is French until the core loop is proven solid, then we build Portuguese.

**Target user:** Adults with a real deadline. People who've tried Duolingo and quit. People who need conversational competency in 4–12 weeks, not 2 years.

**Live:** [decipher-two.vercel.app](https://decipher-two.vercel.app)  
**Repo:** [github.com/ziggythebot/decipher](https://github.com/ziggythebot/decipher) (private)

---

## The Learning Model

Based on Ferriss DiSSS:

1. **Deconstruction** — 12 sentences that reveal the entire grammatical framework in 1–2 hours (The Deconstruction Dozen)
2. **Selection (80/20)** — Top 1,200 words = conversational fluency threshold. Frequency-ordered, never thematic.
3. **Sequencing** — Grammar framework → sentence patterns → frequency vocab → conversation practice
4. **Stakes** — Deadline tracking, visible progress toward real milestones

The full research doc is at `research/ferriss-language-app.md`.

---

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind |
| Database | PostgreSQL via Neon, Prisma 7 |
| Auth | Privy (social + wallet login) |
| Voice STT | Deepgram nova-3 |
| Voice LLM | Claude Sonnet 4.6 via Anthropic API (OpenAI-compat layer) |
| Voice TTS | Deepgram Aura-2 |
| Voice infra | LiveKit Cloud (SFU) + LiveKit Agents v1.2.4 on Fly.io |
| SRS | Custom FSRS-5 implementation (ts-fsrs-style) |
| Hosting | Vercel (Next.js) + Fly.io (voice worker) |

### Deployment

- **Next.js app:** `vercel --prod` from `/Users/andy/Documents/New project/decipher`
- **Voice worker:** `fly deploy -a decipher-voice-worker` after any changes to `src/agent/index.ts`
- These deploy independently. The voice worker runs on Fly.io (lhr region, 2 machines). It communicates back to Next.js via internal API routes protected by `X-Internal-Secret`.

### Key architectural decisions

**Proxy not middleware:** `src/proxy.ts` not `middleware.ts` — Next.js 16 breaking change.

**Prisma on Neon:** `prisma migrate dev` times out due to advisory locks. Workaround: `npx prisma db execute --file ./migration.sql` then `npx prisma generate`.

**LiveKit agent bugs patched:** Three framework bugs work-arounded in `DecipherAgent` subclass:
1. `trackPublished` subscription — manual subscribe to late-joining audio tracks
2. `DeferredReadableStream.pump()` silent bug — `ttsNode` override to collect all text then call `synthesize()` directly
3. Anthropic rejects `tools:[]` — `llmNode` override passes `null` toolCtx so tools are omitted from API request

---

## What's Built (as of April 16, 2026)

### Core learning loop

| Feature | Status | Notes |
|---------|--------|-------|
| Grammar Deconstruction | ✅ Complete | 12-card flip sequence, localStorage progress, XP/achievement on completion |
| Frequency Vocab Scan | ✅ Complete | Browse 1,200 French words by frequency rank |
| Vocab Learn Mode | ✅ Complete | FSRS-0 graduation flow, confidence-based |
| Vocab Review (FSRS) | ✅ Complete | Full FSRS-5 SRS, due-date scheduling |
| Vocab Practice | ✅ Complete | Quick practice mode |
| **Phrase Engine** | ✅ Complete (Apr 16) | 15 sentence patterns, 5-tap drill each, feeds session planner |
| XP / levelling | ✅ Complete | XP for all actions, level milestones |
| Streaks | ✅ Complete | Daily streak tracking |
| Achievements | ✅ Complete | Unlockable achievements with XP rewards |
| Progress page | ✅ Complete | Stats, streak history |

### Voice

| Feature | Status | Notes |
|---------|--------|-------|
| Voice conversation | ✅ Complete | Push-to-talk, real-time STT→LLM→TTS pipeline |
| 6 guided scenarios | ✅ Complete | Café, shopping, directions, restaurant, meeting, struggle bus |
| Freeform mode | ✅ Complete | Open conversation |
| Rude Mode (easter egg) | ✅ Complete | Jean-Pierre road rage, Dirty Dozen, 50 swear words |
| Multi-language routing | ✅ Complete | TTS/STT model routing per language (fr/es/de/it/nl/ja/pt) |
| **Session Objective Planner** | ✅ Complete (Apr 16) | Pre-session: picks target pattern + vocab from FSRS state |
| **Enforced system prompt** | ✅ Complete (Apr 16) | Session objective injected as hard rules into agent |
| **End-of-session write-back** | ✅ Partial (Apr 16) | Route exists, word detection needs testing |

### Admin / infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Token monitoring | ✅ Complete | Per-user cost breakdown, LLM + TTS + STT |
| User blocking | ✅ Complete | Admin can block/unblock users |
| Monthly token budgets | ✅ Complete | 429 when exceeded |
| Privy auth | ✅ Complete | Real user accounts in production |

---

## What's Untested / Known Risks

### 1. `chatCtx.items` access at session end ⚠️

In `src/agent/index.ts`, at session end we try:

```typescript
for (const item of session.chatCtx.items) { ... }
```

This accesses `chatCtx` on the `AgentSession` object after the session completes. We haven't verified that `chatCtx` is a public property on LiveKit Agents `AgentSession` in v1.2.4, or that `.items` is populated by the time the disconnected event fires. If this silently fails, the write-back route still runs but with `wordsEncountered: []`.

**Risk:** Low impact (write-back is best-effort), but word-level FSRS updates won't happen.
**Fix:** Add explicit logging at session end to verify chatCtx access before next deploy.

### 2. Word detection is substring-based ⚠️

Even if chatCtx access works, we're matching target vocab words by `text.toLowerCase().includes(v.word.toLowerCase())`. French morphology means:
- Target word: `voudrais` — might appear as `voudriez`, `voudrait` in conversation
- Target word: `aimer` — might appear as `aime`, `aimez`, `aimé`

So word detection will miss conjugated forms.

**Risk:** Medium — FSRS updates for words used in voice will be incomplete.
**Fix:** Lemmatiser lookup, or expand detection to check word stems. Deferred to Phase 4.

### 3. `patternUses` is always 0 ⚠️

The session planner sets a `targetPattern` with `requiredUses: 6`. The system prompt tells the agent to use it 6+ times. But we have no way to count actual pattern usage — `patternUses` is written as `0` to `session-complete`.

**Risk:** Medium — `objectiveReached` will always be `false`. Pattern mastery scores never update beyond the initial 70 set by the Phrase Engine.
**Fix:** Phase 4 — turn-level state machine in `DecipherAgent`. Deferred deliberately (validate Phase 1–3 first).

### 4. Pattern unlock is sequential ⚠️

In `/learn/patterns`, pattern N+1 is locked until N is completed. This might be too restrictive — users may want to learn patterns out of order based on what they need right now (e.g., jump to `pouvez-vous` before `cest`).

**Risk:** Low — not a bug, but a UX decision that might frustrate users.
**Fix:** Remove the sequential lock, allow any order. The `patternScores` system doesn't require sequencing.

### 5. No onboarding for new users ⚠️

New users land on the dashboard with no language configured. The `targetLanguage` defaults to `"fr"` in the schema, so they'll get French content, but there's no guided setup flow.

**Risk:** High for real user growth — confusing first impression.
**Fix:** Gate dashboard behind `/onboarding` if `user.userLanguages.length === 0`.

### 6. `VOICE_ONLY_MODE` env var ⚠️

There may be a `VOICE_ONLY_MODE=1` env var set in Vercel production from early development. If set, vocab learning routes return empty data. Check with `vercel env ls`.

---

## The Learning Loop (Current State)

```
User registers (Privy auth)
  ↓
Deconstruction — 12 grammar sentences, one-time
  ↓
Phrase Engine — 15 patterns, 3-4 min each, sequential
  ↓  writes patternScores[id] = 70
Session Planner — picks lowest-scoring pattern + due FSRS vocab
  ↓  produces SessionObjective
Voice Session — agent receives objective in system prompt, steers conversation
  ↓  (session end write-back — partially working, see risks above)
FSRS update — words encountered rated Good/Again
  ↓
Review queue — due cards surface for next session
```

The loop is architecturally complete. The weak points are the session-end data collection (chatCtx access, substring matching) and the absence of turn-level enforcement (Phase 4).

---

## What "Good" Looks Like (Target State)

A user says after 7 days:

> "I can actually form sentences now — I couldn't do that with Duolingo."

Not:

> "I recognise a lot of words."

The difference: **usage-based learning** vs. passive recognition. The voice loop exists to force production, not just comprehension. The Phrase Engine teaches the frames. The session planner ensures the frames get repeated in voice.

---

## Priorities for Next Session

**P0 — Test and fix session write-back**
- Add console logging at session end in agent to verify `chatCtx` access
- Run a voice session, check Fly logs, verify `/api/internal/session-complete` is being called with real data
- If chatCtx fails, find correct LiveKit Agents API for conversation history

**P1 — Remove sequential pattern lock**
- 2-line change in `/learn/patterns/page.tsx`
- Let users do patterns in any order

**P2 — Onboarding flow**
- 3-step wizard: pick language → set goal → set deadline
- Gate dashboard on `userLanguages.length === 0`

**P3 — Portuguese seeding**
- Seed top-500 PT words into `LanguageWord` (languageCode: "pt")
- PT phrase patterns (same 15 frames, Portuguese translations)
- Andy's personal use case — validates multi-language architecture

**P4 (deferred) — Turn-level enforcement**
- Only build after verifying Phase 1–3 data
- `DecipherAgent` state machine: count pattern uses per turn, inject steering prompts

---

## What's Not Built Yet

- **Monetisation** — no paywall, no Stripe, free for all current users
- **Sharing / stakes** — no public commitment, no Beeminder integration
- **Grammar cheat sheet export** — designed in research doc, not built
- **Desktop/Tauri wrapper** — Phase 5 in original plan
- **Portuguese patterns** — only French patterns built
- **Email / push notifications** — no reminder system for streaks

---

## Questions for Review

1. **Session write-back:** Is `session.chatCtx` the correct API for accessing conversation history at end of session in LiveKit Agents v1.2.4?

2. **Pattern ordering:** Should pattern unlock be sequential (current) or free-choice? What does the learning science say?

3. **Voice loop enforcement:** Is the system prompt approach sufficient to enforce pattern targeting, or do we need the turn-level state machine sooner than expected?

4. **Onboarding priority:** How much does the missing onboarding flow hurt real-user retention vs. other missing pieces?

5. **Portuguese timeline:** Is the multi-language architecture clean enough to seed PT in one session, or are there blockers?

---

## File Map

```
src/
  agent/index.ts              — Fly.io voice worker (DecipherAgent, system prompt, session management)
  app/
    api/
      speak/session/start/    — Session start: calls planner, creates LiveKit room, passes objective
      internal/usage/         — Incremental token/cost tracking (agent → Next.js)
      internal/session-complete/ — End-of-session write-back (words, pattern uses, FSRS updates)
      patterns/complete/      — Mark phrase pattern done, update patternScores
      grammar/complete/       — Deconstruction completion
      vocab/                  — scan / learn / review / rate routes
      admin/                  — User management, cost dashboard
    dashboard/                — Main dashboard (primary CTA, quick actions, stats)
    learn/
      deconstruct/            — Grammar deconstruction (12-card flip)
      vocab/                  — Vocab hub, learn, review, practice, scan
      patterns/               — Phrase Engine (list + [patternId] unit pages)
    speak/                    — Voice session UI (SpeakClient, PTT)
    progress/                 — Stats and streak history
    rude/                     — Easter egg (dirty dozen, vocab, road rage)
  data/
    deconstruction-dozen.ts   — 12 grammar sentences with token annotations
    phrase-patterns.ts        — 15 sentence patterns with drills
  lib/
    session-planner.ts        — Session objective planner (FSRS + grammar → SessionObjective)
    srs/rating.ts             — FSRS-5 scheduler
    speak/scenarios.ts        — Voice scenario definitions
    language/catalog.ts       — Language metadata, TTS/STT routing
research/
  ferriss-language-app.md     — Full Ferriss methodology + product design doc
  controlled-session-loop.md  — Architecture plan for binding FSRS + voice + grammar
  phrase-engine-spec.md       — Phrase Engine design rationale
```
