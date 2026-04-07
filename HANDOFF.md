# Decipher Handoff

## Repo State
- Branch: `main`
- Latest commit at handoff: `adf4744`
- Status: pushed to `origin/main`
- Working tree: clean

## Source of Truth Plan
- Implementation plan: `IMPLEMENTATION_PLAN.md`

## Completed So Far
### Phase 0 (stabilize routes/docs)
- Replaced default landing page.
- Added missing pages linked by dashboard:
  - `src/app/learn/deconstruct/page.tsx`
  - `src/app/speak/page.tsx`
  - `src/app/progress/page.tsx`
- Updated metadata and README status alignment.

### Vocab loop (Phase 1 core)
- Added vocab rating API with auth + ownership checks:
  - `src/app/api/vocab/rate/route.ts`
- Added lightweight FSRS-style scheduler helper:
  - `src/lib/srs/rating.ts`
- Persisted review state, due dates, reps/lapses, XP/level/streak updates, and achievement unlocks.

### Grammar completion persistence
- Added grammar completion API:
  - `src/app/api/grammar/complete/route.ts`
- Added deconstruction completion UI button:
  - `src/app/learn/deconstruct/CompleteButton.tsx`
- Completion updates grammar profile, XP/level/streak, and grammar achievement.

### Speaking session lifecycle
- Added speaking session start/end APIs:
  - `src/app/api/speak/session/start/route.ts`
  - `src/app/api/speak/session/end/route.ts`
- Added interactive speaking client:
  - `src/app/speak/SpeakClient.tsx`
- Added shared scenario definitions:
  - `src/lib/speak/scenarios.ts`
- Session end awards XP, conversation achievements, and updates user progression.

### LiveKit integration + agent context
- Added LiveKit JWT helper:
  - `src/lib/livekit/token.ts`
- Start API now mints room token and includes participant metadata.
- Metadata payload includes learner context:
  - known words
  - grammar profile
  - goal type
  - scenario + mode
  - language info
  - session id
- Agent metadata resolution now reads:
  1. room metadata
  2. fallback: participant metadata
  - `src/agent/index.ts`

### Transcript/event persistence
- Added event ingestion endpoint:
  - `src/app/api/speak/session/event/route.ts`
- `SpeakClient` listens to LiveKit `DataReceived` and persists `user_utterance` / `agent_utterance` events.
- Event API appends transcript, updates `wordsEncountered`, and stores error events.

### Speaking analytics + progress insights
- Enhanced session end analytics in:
  - `src/app/api/speak/session/end/route.ts`
- Added inferred metrics:
  - inferred unknown-word count (vs known vocab)
  - inferred accuracy (from transcript user turns + logged errors, when explicit accuracy missing)
- Progress page now includes speaking insights in:
  - `src/app/progress/page.tsx`
  - recent sessions
  - user turns
  - logged errors
  - average accuracy
  - potential unknown-word sample

### Auth mothballed + local DB workflow
- Replaced Clerk runtime auth usage in app routes and APIs with local session user helper:
  - `src/lib/session-user.ts`
  - `src/app/dashboard/page.tsx`
  - `src/app/learn/vocab/page.tsx`
  - `src/app/learn/deconstruct/page.tsx`
  - `src/app/speak/page.tsx`
  - `src/app/progress/page.tsx`
  - `src/app/api/vocab/rate/route.ts`
  - `src/app/api/grammar/complete/route.ts`
  - `src/app/api/speak/session/start/route.ts`
  - `src/app/api/speak/session/event/route.ts`
  - `src/app/api/speak/session/end/route.ts`
- Added local Postgres compose config:
  - `docker-compose.dev.yml`
- Added Prisma 7 config entrypoint and updated schema datasource block:
  - `prisma.config.ts`
  - `prisma/schema.prisma`
- Updated docs/scripts for local dev session mode and Docker DB workflow:
  - `README.md`
  - `package.json`

## Important Merged PRs
- PR #1: web MVP loops + scaffolding merged to `main`
- PR #2: learner metadata wiring to agent merged to `main`

## Current Gaps / Next Work (Priority)
1. Enable Docker daemon locally and run DB bootstrapping:
   - `npm run db:up`
   - `npm run db:migrate`
   - `npm run db:seed`
2. Replace lightweight scheduler with full `ts-fsrs` integration.
3. Harden live room orchestration (reconnects, edge cases, session cleanup guarantees).
4. Improve transcript analytics:
   - error taxonomy (grammar/vocab/pronunciation/hesitation)
   - corrected-form extraction
   - trend views on `/progress`
5. Add automated coverage for critical loops:
   - vocab rating -> review scheduling -> XP/achievements
   - speak start/end/event -> transcript + analytics + XP
6. Add production readiness checks (rate limits, payload limits, audit logging, retries).

## Notes for Next Agent
- No secrets are committed; `.env` remains local-only.
- If picking up `ts-fsrs`, start by isolating scheduler logic currently in `src/lib/srs/rating.ts`.
- If picking up analytics, extend `errorsLogged` schema shape consistently and keep backward compatibility with existing array payloads.
- `@clerk/nextjs` still exists in `package.json` but is currently unused at runtime.
