# Phrase Engine — Spec

**Written:** April 16, 2026

## The Gap

Decipher currently has two modes that don't connect:

1. **Vocab (FSRS)** — word-level memorisation
2. **Voice** — open conversation with no structural anchor

The missing layer: **sentence patterns**. Real fluency isn't built from isolated words — it's built from reusable frames. "Je voudrais ___" unlocks ordering in every context. "Est-ce que vous ___?" turns any phrase into a question. These 15 frames cover 70% of what you need to say in daily conversation.

## What It Is

A new section: `/learn/patterns` — sits between Deconstruct and Speak in the learning journey.

15 high-frequency sentence frames. Each is a 3–4 minute self-contained unit:

1. **Hook** — one sentence on why this pattern matters and where it works
2. **3 examples** — French with pronunciation hint
3. **5-tap drill** — fill-in-the-blank MCQ, immediate feedback
4. **Completion** — pattern unlocked → feeds directly into session planner

## Learning Flow After This

```
Deconstruction (grammar framework)
  → Phrase Engine (sentence frames + pattern scores)
    → Vocab FSRS (word-level SRS)
      → Voice Sessions (targeted by session planner using pattern scores)
```

## Why It Solves the ADHD Problem

- Each unit has a clear start and end (not an infinite scroll of words)
- 5 taps = done = completion signal = dopamine tick
- Progress is visible (X/15 patterns unlocked)
- Voice session becomes a reward: "now use the pattern you just learned"

## Connection to Session Planner

When a user completes a pattern unit, `GrammarProfile.patternScores[patternId]` is set to `70`.

The session planner already reads `patternScores` and picks the lowest-scoring pattern as `targetPattern`. This means:
- Patterns not yet introduced = not in scores = not targeted (correct — don't target what they haven't learned)
- Patterns introduced via Phrase Engine = score 70 = will be targeted in voice for reinforcement
- Patterns well-reinforced in voice = score rises over time

## The 15 Patterns

| ID | Pattern | Use Case |
|----|---------|----------|
| je-voudrais | Je voudrais ___ | Ordering, wanting anything |
| cest | C'est ___ | Describing, reacting |
| jai-besoin | J'ai besoin de ___ | Expressing need |
| ou-est | Où est ___ ? | Navigation, finding things |
| est-ce-que | Est-ce que vous ___ ? | Polite yes/no questions |
| je-cherche | Je cherche ___ | Shopping, searching |
| pouvez-vous | Pouvez-vous ___ ? | Polite requests |
| il-y-a | Il y a ___ | Describing what exists |
| je-naime-pas | Je n'aime pas ___ | Preferences, negation |
| je-vais | Je vais ___ | Near future (replaces future tense) |
| cest-combien | C'est combien ___ ? | Prices, quantities |
| je-peux | Je peux ___ ? | Permission, offering |
| on-peut | On peut ___ ? | Suggestions |
| quest-ce-que | Qu'est-ce que ___ ? | Open questions |
| comment-dit-on | Comment dit-on ___ ? | Meta-language survival |
