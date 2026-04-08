# Voice Handoff (2026-04-08)

## Current Goal
Stabilize `/speak` so the loop is reliable:
1) tutor intro audio plays,
2) learner audio is captured/transcribed,
3) tutor processes reply,
4) tutor reply plays back as audio.

## Current Branch / Deploy State
- Branch: `main`
- Latest commit: `eedaf88` (reverted worker participant-binding experiment)
- Vercel alias: `https://decipher-two.vercel.app`
- Fly worker app: `decipher-voice-worker` (version 23 at handoff time)

## Known Good / Bad Timeline (recent)
- `7ef6160`: last period where transcription was observed working in live tests.
- `356d34f`: worker change removing pinned `participantIdentity`; user reported tutor startup regressed.
- `eedaf88`: revert of `356d34f`.

## Proven Facts From Logs
- Some successful historical turns showed:
  - `user_transcript` present,
  - `audioTranscript` non-empty,
  - `User turn committed`,
  - `performLLMInference done`,
  - `performTTSInference done`.
- Multiple failing runs show:
  - `ptt_press` and `ptt_release` received,
  - no `user_transcript` events between them,
  - worker often logs `trackPublications: []` at participant bind time.
- Playback instability has also occurred:
  - historical logs include `firstFrameFut cancelled before first frame`.

## What Is In Place Now
- Manual turn mode (`turnDetection: "manual"`).
- Guard against empty turn commit (publishes `No speech detected...` instead of sending empty user message).
- Client debug panel (`Debug Timeline`) and worker `debug_stage` events were added to reduce guessing.
- Client has explicit mic publish fallback path (create/publish local audio track if no mic publication after connect).

## Current User-Visible Symptoms
- Intermittent/failed transcription despite mic appearing enabled.
- In latest user report before handoff:
  - tutor intro failed to connect/play in one run (now reverted to prior worker behavior).
- General instability across sessions, sometimes works partially.

## High-Confidence Diagnosis
This is not one single bug. It is two unstable edges:
1. **Input edge**: browser mic track publication/subscription to worker STT pipeline is inconsistent.
2. **Output edge**: tutor TTS playout occasionally fails before audible first frame.

## Suggested Stabilization Plan (strict)
1. **Freeze baseline** on a single commit and stop multi-variable patches.
2. Verify in order with isolated checks:
   - A: intro tutor audio only
   - B: user speech -> transcript only
   - C: transcript -> LLM reply text
   - D: LLM reply text -> tutor audio
3. Only modify one subsystem per iteration:
   - client capture/publish OR worker input binding OR turn commit timing OR playout.
4. Keep deploy gating:
   - no production deploy unless current step passes manually.

## Immediate Next Experiments (recommended)
1. Add explicit worker log for actual audio-track subscription callback in failing runs (not only participant bind snapshot).
2. During a single controlled run, collect:
   - client Debug Timeline lines,
   - worker lines for same room/time,
   - whether remote tutor audio track subscribed on client.
3. If subscription is missing:
   - focus on participant identity / track publication timing only.
4. If transcript appears but no tutor voice:
   - focus on speech handle lifecycle + audio forwarding cancellation only.

## Files Most Relevant
- `src/app/speak/SpeakClient.tsx`
- `src/agent/index.ts`

