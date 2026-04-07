# Decipher

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![LiveKit](https://img.shields.io/badge/LiveKit_Agents-FF4F00?style=flat-square)](https://livekit.io)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma)](https://prisma.io)

**Speed language learning for the ADHD brain.** Decipher is a structured language acquisition app built around Tim Ferriss's DiSSS/CaFE methodology — not thematic vocabulary lists and gamification fluff, but the minimum effective dose of grammar and high-frequency vocabulary that actually gets you to conversational fluency.

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

## Features

### Deconstruction Dozen
Before touching vocabulary, you complete a 20-minute grammar session using 12 carefully chosen sentences that expose every core structural pattern in French — possessives, object pronouns, question formation, negation, modal verbs, near future, and more. Based directly on the Tim Ferriss DiSSS framework. You come out with a personal grammar cheat sheet, not a textbook.

### Frequency-Ordered Flashcards (FSRS)
Vocabulary is sequenced by real-world frequency — you learn *de*, *être*, *avoir* before *boulangerie*. Each card runs through the open-source FSRS-5 spaced repetition algorithm (via `ts-fsrs`), so reviews are scheduled based on your actual memory model, not a fixed timer. Cards show pronunciation, example sentences, and mnemonic hints.

### AI Voice Conversation Practice
A LiveKit Agents pipeline connects you to a real-time AI French tutor:
- **Deepgram** handles speech-to-text
- **Claude** (Anthropic) plays the tutor — adapts language level to your vocabulary count, corrects errors naturally without killing momentum, uses the i+1 method
- **ElevenLabs** delivers natural French TTS
- Multiple guided scenarios: Parisian café, street market, asking directions, restaurant, meeting someone at a conference
- Freeform mode once you're past the basics
- Transcripts and per-session XP saved automatically

### Gamification That Doesn't Suck
Designed for ADHD brains — dopamine loops that reinforce *actual learning*, not just app opens:
- **XP system** with streak bonuses (3-in-a-row, 5-in-a-row), first-learn bonuses, and mastery bonuses
- **Levels 1–8** with titles: Absolute Beginner → Tourist → Phrase Hunter → Sentence Builder → Conversationalist → Fluent → Near-Native → Master
- **Achievement system** across four categories: vocab milestones, streak milestones, conversation, and grammar
- **Fluency progress bar** — raw word count to conversational (1,200 words), not abstract "crowns" or "gems"
- Deadline mode: enter your trip or exam date and see a countdown on your dashboard
- Perfect session detection with animated XP toast

### Current implementation status (April 2026)
- Implemented: landing page, dashboard, vocab queue/session UI, deconstruction lesson page, progress page, speaking scenarios page, Prisma schema, seed data, LiveKit agent worker scaffold.
- In progress: vocab rating API and FSRS writeback, deconstruction completion persistence, speaking room/session start flow, transcript/session persistence.
- Planned: full onboarding, production voice orchestration, richer progress analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Prisma 7 |
| Auth | Clerk |
| Spaced repetition | ts-fsrs (FSRS-5 algorithm) |
| Voice pipeline | LiveKit Agents 1.x |
| Speech-to-text | Deepgram |
| Text-to-speech | ElevenLabs |
| LLM | Claude (Anthropic) via OpenAI-compat layer |
| Animations | Framer Motion 12 |
| Styling | Tailwind CSS v4 |

---

## Prerequisites

- Node.js 20+
- PostgreSQL database
- API keys for: Clerk, Anthropic, LiveKit, Deepgram, ElevenLabs

---

## Installation

```bash
git clone https://github.com/yourusername/decipher.git
cd decipher
npm install
```

### Environment variables

Create a `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/decipher"

# Auth (https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# LiveKit (https://livekit.io)
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://your-project.livekit.cloud

# AI services
ANTHROPIC_API_KEY=sk-ant-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID_FR=pNInz6obpgDQGcFmaJgB   # optional — defaults to Adam
```

### Database setup

```bash
# Run migrations
npm run db:migrate

# Seed French vocabulary (top 100 frequency words) + achievement definitions
npm run db:seed
```

---

## Running Locally

The Next.js app and the voice agent worker run as **two separate processes**.

```bash
# Terminal 1 — Next.js app
npm run dev

# Terminal 2 — LiveKit voice agent worker
npm run agent:dev
```

The Next.js app runs on `http://localhost:3000`. The `/speak` page currently shows scenarios and readiness state while room launch/session orchestration is being finalized.

In production:

```bash
npm run build && npm start
npm run agent:start
```

---

## Learning Flow

```
Sign up → Set goal + deadline → Deconstruction Dozen (20 min)
  → Vocab flashcards (daily, FSRS-scheduled)
  → AI voice conversation practice
  → Track progress to 1,200-word milestone
```

1. **Grammar first** — the Deconstruction Dozen reveals the grammar framework before you memorize a single word. 20 minutes now saves hours of confusion later.
2. **Vocab daily** — the dashboard surfaces your cards due today. FSRS handles the scheduling; you just rate each card (Again / Hard / Good / Easy).
3. **Speak early** — guided scenarios are designed for beginners. The agent uses only words you're likely to know, plus a few above your current level.

---

## Architecture

```
decipher/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing page
│   │   ├── dashboard/          # Main hub — XP bar, stats, next action CTA
│   │   ├── learn/
│   │   │   ├── vocab/          # FSRS flashcard session
│   │   │   └── deconstruct/    # Deconstruction Dozen lesson content
│   │   ├── speak/              # Speaking scenarios + session readiness UI
│   │   └── progress/           # Stats + unlocked achievements
│   ├── agent/
│   │   └── index.ts            # LiveKit Agents worker — runs as separate process
│   ├── lib/
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── xp.ts               # XP constants, level curve, level titles
│   │   └── achievements.ts     # Achievement slug definitions
│   ├── data/
│   │   ├── french-top100.ts    # Frequency-ordered seed vocabulary (100 words)
│   │   └── deconstruction-dozen.ts  # 12 grammar-revealing sentences with notes
│   └── components/
│       └── game/               # XpBar, XpToast, AchievementUnlock
└── prisma/
    ├── schema.prisma           # DB schema
    └── seed.ts                 # Seeds vocabulary + achievement definitions
```

Planned additions:
- `src/app/api/...` route handlers for vocab rating, session orchestration, and progress writes
- `src/app/speak` room launch/session lifecycle UX
- Persisted deconstruction completion actions

### Voice agent architecture

The agent worker (`src/agent/index.ts`) is a standalone LiveKit Agents process. When a user starts a conversation session, the Next.js API creates a LiveKit room and passes user context — known vocabulary, grammar profile, goal type, scenario — via room metadata. The agent picks this up on join and constructs a personalized system prompt that:

- Adjusts the French/English ratio based on vocabulary count (60/40 for beginners, 80/20 intermediate, near-100% advanced)
- Uses only words the learner is likely to know, plus a few at the i+1 level
- Corrects errors naturally by repeating the correct form in context, without pausing to lecture
- Publishes utterances via LiveKit data messages for session logging and error tracking

**Voice pipeline:**
```
Deepgram STT → Claude (OpenAI-compat layer) → ElevenLabs TTS
```

**Available conversation scenarios:** ordering coffee, meeting someone, shopping at a market, asking for directions, dinner at a restaurant, freeform.

---

## Database Schema

Key models:

- **User** — auth (Clerk ID), XP, level, streak, language config, goal type, deadline
- **GrammarProfile** — Deconstruction Dozen completion status, pattern scores, generated cheat sheet (Markdown)
- **LanguageWord** — frequency-ranked vocabulary with pronunciation, example sentences, mnemonic hints
- **UserVocabulary** — per-user FSRS state: stability, difficulty, due date, reps, lapses, state (New/Learning/Review/Relearning)
- **ConversationSession** — full transcripts, XP earned, accuracy percentage, words encountered, error log
- **Achievement** / **UserAchievement** — achievement catalog and per-user unlock records
- **StreakEntry** — daily streak history for calendar visualization

---

## XP & Level System

XP is earned for everything that represents actual learning:

| Action | XP |
|---|---|
| Correct flashcard | 10 |
| First time seeing a word | +20 bonus |
| Word mastered (enters Review state) | 50 |
| 3-in-a-row streak | +15 bonus |
| 5-in-a-row streak | +25 bonus |
| Complete a vocab session | 30 |
| Perfect session (100% accuracy) | 75 |
| Each minute in conversation | 5 |
| Using a word you just learned in conversation | 15 |
| Complete Deconstruction Dozen | 100 |
| 7-day streak | 150 |
| 30-day streak | 500 |

Level thresholds follow an exponential curve: `100 × 1.5^(level-1)` XP per level.

---

## Adding Languages

French is the trial language. The architecture supports any language:

1. Add frequency-ordered vocabulary to `src/data/` following the `WordSeed` type in `french-top100.ts`
2. Create Deconstruction Dozen sentences for the target language
3. Add the language code, flag, and name to `DashboardClient.tsx`
4. Seed the data via `npm run db:seed`
5. Set a voice ID for ElevenLabs in `.env` (e.g. `ELEVENLABS_VOICE_ID_ES`)
6. Add conversation scenarios to the agent's `SCENARIOS` object in `src/agent/index.ts`

---

## Contributing

This is an early-stage personal project. PRs welcome, especially for:

- Additional language data (vocabulary seeds + Deconstruction Dozen sentences)
- New conversation scenarios in the voice agent
- Progress page and achievement display UI
- Mobile responsiveness improvements
- Onboarding flow (goal setting, deadline entry)

---

## License

MIT
