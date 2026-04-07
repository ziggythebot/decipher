# Decipher — Speed Language Learning

Tim Ferriss DiSSS method + AI voice tutor. French first.

## Stack

- **Next.js 15** — frontend
- **Postgres + Prisma** — user data, vocab progress, sessions
- **ts-fsrs** — spaced repetition (FSRS algorithm)
- **Clerk** — auth
- **LiveKit Agents** — real-time voice pipeline
- **Deepgram** — speech-to-text
- **ElevenLabs** — text-to-speech (French voice)
- **Claude** — conversation AI (via Anthropic API)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Fill in `.env`:

```
DATABASE_URL        — Postgres connection string
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY — https://clerk.com
LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL  — https://livekit.io
DEEPGRAM_API_KEY    — https://deepgram.com
ELEVENLABS_API_KEY  — https://elevenlabs.io
ANTHROPIC_API_KEY   — https://console.anthropic.com
```

### 3. Set up database

```bash
npm run db:migrate   # Run migrations
npm run db:seed      # Seeds French top-100 words + achievements
```

### 4. Run

```bash
npm run dev          # Next.js on :3000
npm run agent:dev    # LiveKit agent worker (separate terminal)
```

## Architecture

### Voice pipeline

```
User speaks → LiveKit room → Deepgram STT → Claude (with user vocab profile) → ElevenLabs TTS → audio back
```

The agent runs as a separate worker (`src/agent/index.ts`). Each session gets the user's vocabulary and grammar profile injected as system context so the AI only uses words you know.

### Gamification (ADHD-first)

- XP for every correct answer, streak bonuses at 3× and 5×
- Level system (1–8, "Tourist" → "Master")
- Achievement badges with unlock animations
- Streak tracker with fire emoji
- Fluency progress bar (0 → 1,200 words = conversational)

### Ferriss Method

1. **Deconstruction Dozen** — 12 sentences reveal the full French grammar framework in one session
2. **Frequency-ordered vocab** — words by how common they are, not by theme
3. **Stakes system** — deadline countdown, vocabulary target bar
4. **AI conversation** — context-aware agent that only uses words you know (+i+1)

## Project structure

```
src/
  app/
    dashboard/           Main hub (XP, stats, quick actions)
    learn/vocab/         Daily flashcard sessions (FSRS)
    learn/deconstruct/   Deconstruction Dozen session
    speak/               LiveKit voice conversation
  agent/index.ts         LiveKit Agents worker
  components/game/       XpBar, XpToast, AchievementUnlock
  data/                  French word list, Deconstruction Dozen
  lib/                   xp.ts, achievements.ts, db.ts
prisma/
  schema.prisma
  seed.ts
```
