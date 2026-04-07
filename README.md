# Decipher

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![LiveKit](https://img.shields.io/badge/LiveKit_Agents-FF4F00?style=flat-square)](https://livekit.io)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![Status](https://img.shields.io/badge/status-in_development-orange?style=flat-square)]()

**Speed language learning for the ADHD brain.** Decipher is a structured language acquisition app built around Tim Ferriss's DiSSS/CaFE methodology — not thematic vocabulary lists and gamification fluff, but the minimum effective dose of grammar and high-frequency vocabulary that actually gets you to conversational fluency.

> **This is an app concept in active development.** French is the trial language. Not yet in production.

French first. Other languages coming.

---

## Why Decipher, not Duolingo?

Duolingo optimizes for daily streaks. Decipher optimizes for **getting to 1,200 words as fast as possible** — the threshold where French conversation becomes viable.

| | Duolingo | Decipher |
|---|---|---|
| Vocabulary order | Thematic ("travel", "food") | Frequency-ranked (most-used first) |
| Grammar | Implicit, slow emergence | Explicit 20-minute deconstruction up front |
| Speaking practice | Text-to-speech drills | Live AI voice conversation with real-time correction |
| Spaced repetition | Proprietary, opaque | ts-fsrs (open FSRS-5 algorithm) |
| Target user | Anyone who wants to "learn a language" | People with a deadline or a specific fluency goal |

---

## What We're Building

### Deconstruction Dozen
Before touching vocabulary, you complete a 20-minute grammar session using 12 carefully chosen sentences that expose every core structural pattern in French — possessives, object pronouns, question formation, negation, modal verbs, near future, and more. Based directly on the Tim Ferriss DiSSS framework. You come out with a personal grammar cheat sheet, not a textbook.

### Frequency-Ordered Flashcards (FSRS)
Vocabulary is sequenced by real-world frequency — you learn *de*, *être*, *avoir* before *boulangerie*. Each card runs through the open-source FSRS-5 spaced repetition algorithm (via `ts-fsrs`), so reviews are scheduled based on your actual memory model, not a fixed timer.

### AI Voice Conversation Practice
A LiveKit Agents pipeline connects you to a real-time AI French tutor. Deepgram handles speech-to-text, Claude plays the tutor (adapting language level to your vocabulary count, correcting errors naturally, using the i+1 method), ElevenLabs delivers natural French TTS. Multiple guided scenarios — Parisian café, street market, asking directions, restaurant, meeting someone at a conference — plus freeform mode.

### Gamification That Doesn't Suck
Designed for ADHD brains — dopamine loops that reinforce actual learning, not just app opens:
- XP with streak bonuses, first-learn bonuses, and mastery bonuses
- Levels 1–8: Absolute Beginner → Tourist → Phrase Hunter → Sentence Builder → Conversationalist → Fluent → Near-Native → Master
- Achievement system across vocab milestones, streaks, conversation, and grammar
- Fluency progress bar — raw word count to conversational (1,200 words), not abstract crowns or gems
- Deadline mode: enter your trip date and see a countdown on your dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL via Prisma 7 |
| Auth | Clerk |
| Spaced repetition | ts-fsrs (FSRS-5 algorithm) |
| Voice pipeline | LiveKit Agents 1.x |
| Speech-to-text | Deepgram |
| Text-to-speech | ElevenLabs |
| LLM | Claude (Anthropic) |
| Animations | Framer Motion 12 |
| Styling | Tailwind CSS v4 |

---

## Research

Full product research and methodology doc in [`research/ferriss-language-app.md`](research/ferriss-language-app.md) — covers the DiSSS/CaFE framework in detail, gap analysis vs existing apps, full app spec, and the French-specific implementation plan.
