# Controlled Session Loop — Implementation Plan

**Written:** April 16, 2026  
**Context:** Bridging the gap between Decipher's disconnected components (FSRS, voice, grammar) into a coherent learning engine.

---

## The Problem

Right now Decipher has three isolated systems:

- **FSRS** — knows what vocab is due for review
- **Voice agent** — has 6 fixed scenarios, no awareness of user state
- **Grammar deconstruction** — standalone 12-card sequence

They don't talk to each other. Voice sessions are generic AI chat regardless of where the user is in their learning. This means no compounding, no systematic repetition, no measurable progress from speaking practice.

## The Fix

Three layers, in priority order:

```
FSRS (what's due)
  → Session Objective (what to train this session)
    → System Prompt (enforced context + rules)
      → Voice Loop (execution)
        → End-of-session write-back (close the loop)
```

Build them in that order. Don't skip to turn-level enforcement before the basic loop is validated.

---

## Phase 1 — Session Objective Planner (build first)

### What it does

Before a voice session starts, compute a session objective from the user's current learning state.

### Inputs

- User's FSRS queue: words due for review (weak cards)
- User's grammar profile: patterns with lowest mastery %
- Recent session errors (from `ConversationSession.errors`)
- User's goal type (travel / social / business)

### Output (Session Objective schema)

```typescript
interface SessionObjective {
  targetPattern: {
    id: string           // e.g. "i-want-to"
    template: string     // e.g. "Je voudrais ___"
    requiredUses: number // e.g. 6
  }
  targetVocab: {
    word: string
    translation: string
    fsrsCard: Card
  }[]                    // 5–8 words max — mix of due + weak
  errorFocus: string[]   // top 2–3 recurring errors to resurface
  sessionDuration: number // minutes (15 / 30)
}
```

### Where to build it

New file: `src/lib/session-planner.ts`

```typescript
export async function buildSessionObjective(
  userId: string,
  languageCode: string
): Promise<SessionObjective>
```

Logic:
1. Pull user's due FSRS cards (limit 8, sorted by overdue)
2. Pull grammar patterns sorted by mastery % ascending, pick lowest
3. Pull last 3 session errors from `ConversationSession`
4. Return structured objective

Call this in `POST /api/sessions/start` before creating the LiveKit room.

---

## Phase 2 — System Prompt Enhancement

### Current state

Voice agent system prompt is static — scenario description + general French tutor instructions.

### New system prompt structure

```
[Base persona]
You are a French language tutor running a structured practice session.

[User state]
The user currently knows: {knownVocabList}
The user struggles with: {weakVocabList}
Grammar patterns mastered: {grammarProfile}
Recent errors to address: {errorFocus}

[Session objective — this is enforced]
This session MUST achieve:
- Target pattern: "{targetPattern.template}" — aim for {requiredUses} uses
- Vocabulary focus: only introduce words from this list: {targetVocab}
- Do not introduce more than 1 new word per turn
- If the user avoids the target pattern for 2+ turns, steer back with a direct prompt
- Reintroduce at least one error from the error list within the first 5 turns

[Scenario]
{scenarioDescription}

[Rules]
- Stay in French except to give corrections
- Keep sentences at or just above the user's current level
- Correct errors in-context, not as interruptions
```

### Where to build it

Modify `src/agent/index.ts` — the `DecipherAgent` system prompt construction.

Pass the `SessionObjective` from Phase 1 into the Fly worker via the session metadata (already available in LiveKit room metadata).

---

## Phase 3 — End-of-Session Write-back (closes the loop)

### What it does

After a voice session ends, parse what happened and update FSRS + error log.

### Current state

`ConversationSession` stores `inputTokens`, `outputTokens`, `ttsChars`, `sttSeconds` — cost tracking only. No learning data written back.

### New fields needed (Prisma migration)

```prisma
model ConversationSession {
  // existing fields...
  wordsEncountered  String[]   // vocab words that appeared in session
  patternUses       Int        // how many times target pattern was used
  errorsLogged      Json       // { error: string, corrected: boolean }[]
  objectiveReached  Boolean    // did they hit requiredUses?
}
```

### Write-back flow

At session end (agent `on_session_end` hook):

1. Agent sends session summary to `/api/internal/session-complete`
2. Route parses `wordsEncountered` → updates FSRS ratings for those cards
3. Route logs new errors to user's error profile
4. Route updates grammar pattern mastery % based on `patternUses` vs `requiredUses`

### FSRS rating logic

Words the user used correctly → `rating: Rating.Good`  
Words the user avoided → no update (don't penalise absence)  
Words the user got wrong (in error log) → `rating: Rating.Again`  

---

## Phase 4 — Turn-level Enforcement (build last)

**Only build this after Phase 1–3 are live and you can measure whether the basic loop is working.**

The risk of building this early: significant complexity for uncertain gain. The system prompt + session objective (Phase 1–2) may already produce sufficient steering without needing a state machine.

### What it adds

A lightweight counter running in `DecipherAgent` alongside the conversation:

```typescript
interface SessionState {
  patternUses: number
  vocabUsed: Set<string>
  lastErrorSurfacedTurn: number
  turnCount: number
}
```

On each agent turn:
- Parse user message for target pattern usage → increment counter
- Check if vocab words appeared → update set
- If `turnCount - lastErrorSurfacedTurn > 3` → inject error reintroduction steer
- If `patternUses >= requiredUses` → signal session complete

**Trigger condition to build Phase 4:** If after 2 weeks of Phase 1–3, session transcripts show the agent consistently drifting from the target pattern despite system prompt instructions.

---

## Implementation Order

| Phase | What | Effort | Value |
|-------|------|--------|-------|
| 1 | Session Objective Planner | ~1 day | High — feeds everything else |
| 2 | System Prompt Enhancement | ~half day | High — immediate behaviour change |
| 3 | End-of-session Write-back | ~1 day | High — closes the loop |
| 4 | Turn-level Enforcement | ~2 days | Medium — only if Phase 1–3 insufficient |

Total to functional learning loop: ~2.5 days of focused work.

---

## What This Unlocks

Once all three phases are live:

- **FSRS decides** what's due
- **Session planner picks** pattern + vocab subset
- **System prompt enforces** it during the call
- **Write-back updates** FSRS + error log
- **Next session** starts from updated state

That's a learning engine. Not chat.

The ADHD benefits follow naturally: bounded sessions, clear objective, visible mastery ticks. No extra gimmicks needed.

---

## What to Ignore (for now)

- Mid-session difficulty adjustment (nice to have, not critical)
- Financial stakes / Beeminder integration
- Grammar cheat sheet generator
- Multi-language expansion

None of these matter until the core loop is proven. Stay focused on Phase 1–3.
