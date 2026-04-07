# Decipher Implementation Plan

## Objective
Build a production-ready web MVP of Decipher first, while keeping architecture portable to a macOS desktop app (Tauri wrapper) with minimal rework.

## Product Scope
### Primary user outcome
A learner can complete a full loop in one session:
1. Review due vocabulary
2. Complete ratings with FSRS scheduling persisted
3. Start a guided speaking session
4. See XP/progress updates and achievements

### Non-goals for v1
- Multi-language expansion beyond French
- Offline-first support
- Advanced social/community features
- Highly customized gamification variants

## Technical Direction
### App model
- Web app first: Next.js + React + Prisma/Postgres
- Shared core logic extracted into reusable packages
- Desktop app later: Tauri shell reusing frontend + shared logic

### Codebase structure target
- `apps/web`: Next.js application
- `apps/desktop`: Tauri shell (future)
- `packages/core`: FSRS scheduling, XP, achievements, scenario rules
- `packages/ui`: shared React components and tokens
- `packages/contracts`: shared schemas/types for API boundaries

### Portability rule
Keep framework-specific code at the edges.
- Next.js-only code: routing, auth integration, server handlers
- Shared code: all domain logic, validation, view components, client state

## Delivery Plan
### Phase 0 - Stabilize Current Repo (Week 1)
### Goals
- Align codebase with README claims
- Remove broken UX paths and dead links

### Tasks
1. Replace default home page with Decipher landing/onboarding entry.
2. Add missing routes linked by dashboard (`/learn/deconstruct`, `/speak`, `/progress`).
3. Add placeholder-safe states where features are incomplete.
4. Update README to reflect implemented vs planned modules.

### Exit criteria
- No dead links from dashboard/navigation
- Home page reflects product and onboarding flow
- README accurately maps to current code

### Phase 1 - Learning Loop MVP (Weeks 2-3)
### Goals
- Make vocab sessions fully functional and persistent
- Deliver end-to-end daily study flow

### Tasks
1. Implement `/api/vocab/rate` route.
2. Integrate real FSRS transitions and next due-date scheduling.
3. Persist XP, streaks, and level updates atomically.
4. Add achievement unlock checks on vocab milestones.
5. Add session summary persistence and dashboard refresh consistency.

### Exit criteria
- Card rating updates DB state correctly
- Due queue changes according to FSRS
- XP/level/streak values are deterministic and test-covered

### Phase 2 - Guided Speaking MVP (Weeks 4-5)
### Goals
- Deliver reliable voice practice session with transcript capture

### Tasks
1. Implement `/speak` UI with room join/start flow.
2. Add token/room session APIs for LiveKit.
3. Wire agent metadata from user state (known words, mode, scenario).
4. Persist utterance logs and conversation summaries to DB.
5. Award conversation XP and relevant achievements.

### Exit criteria
- User can start/finish guided speaking session from app
- Transcript and XP appear in progress/dashboard
- Session failures are surfaced with retry-safe UX

### Phase 3 - Progress, Achievements, and Quality (Week 6)
### Goals
- Make retention loop legible and trustworthy

### Tasks
1. Implement `/progress` page with streak history, achievements, totals.
2. Add deconstruction flow persistence (`GrammarProfile`).
3. Add key telemetry/logging for funnel analysis.
4. Add E2E smoke tests for critical loop.

### Exit criteria
- Progress page reflects DB truth
- Achievements unlock once and display correctly
- Core user loop has passing smoke test coverage

### Phase 4 - Desktop Readiness Refactor (Week 7)
### Goals
- Prepare code for web + macOS reuse

### Tasks
1. Extract pure domain logic to `packages/core`.
2. Extract shared schema/contracts with validation.
3. Move reusable components into `packages/ui`.
4. Audit and isolate Next.js-specific dependencies.

### Exit criteria
- Shared logic imported from packages, not app-local ad hoc modules
- Domain tests run without Next.js runtime

### Phase 5 - macOS Wrapper (Weeks 8-9)
### Goals
- Ship internal macOS alpha using existing backend

### Tasks
1. Scaffold Tauri desktop shell.
2. Reuse web frontend routes/components where possible.
3. Implement desktop auth token handling and secure storage.
4. Configure microphone permissions and audio device QA.
5. Setup signing/notarization pipeline for non-App-Store distribution.

### Exit criteria
- Installable signed macOS app for testers
- Guided speaking and vocab loops work on desktop
- No client-side API secrets embedded in app bundle

## High-Risk Items and Mitigations
1. Voice reliability across devices
- Mitigation: early beta matrix for mics/headsets; fallback reconnection and error states.

2. Auth/session differences between web and desktop
- Mitigation: keep backend token minting centralized; desktop stores only user/session token safely.

3. Scope creep from gamification/features
- Mitigation: strict v1 checklist; defer non-core enhancements to post-MVP backlog.

4. Data model drift while moving to shared packages
- Mitigation: shared `contracts` package and schema tests before desktop build.

## V1 Success Metrics
- 7-day retention proxy: users complete >=3 vocab sessions in first week
- Median time from signup to first speaking session < 2 days
- >=80% speaking sessions complete without fatal error
- Learner can always identify next action from dashboard

## Immediate Next Actions (This Repo)
1. Implement `/api/vocab/rate` and FSRS update pipeline.
2. Build `/speak` and `/progress` minimal pages with real data wiring.
3. Replace default landing page and add onboarding path.
4. Add integration tests for rating -> due date -> XP updates.
5. Create issue tracker labels by phase (`phase-0` ... `phase-5`) and file tasks.
