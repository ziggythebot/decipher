# Voice Handoff (2026-04-09)

## Status

Root cause of transcription failure identified and fixed. Fix is live on `main` at `649f5c7`.
Untested on live Fly deployment — this is the first session where the fix is in place.

## The Bug (was)

`AutoSubscribe.AUDIO_ONLY` in livekit-agents v1.2.3 connects the SFU room with
`autoSubscribe: false`. It then manually subscribes only to participants already
present at connect time. Since the worker spawns before the client joins, no
participants are present → no tracks are ever subscribed → the STT pipeline
receives zero audio for the entire session.

This is why `trackPublications: []` appeared consistently in logs at session bind
time, and why 6 seconds of PTT produced zero `stt_interim` events. All the PTT
logic, mic_ready gating, mute/unmute experiments were operating correctly on top
of a silent audio pipeline.

## The Fix

`649f5c7` adds a `trackPublished` listener immediately after `ctx.connect()`:

```ts
ctx.room.on("trackPublished", (publication, _participant) => {
  const AUDIO = 1; // TrackKind.KIND_AUDIO
  if (publication.kind === AUDIO) {
    publication.setSubscribed(true);
  }
});
```

When the client later joins and publishes their mic, `trackPublished` fires,
`setSubscribed(true)` is called, the SFU delivers the audio stream, `TrackSubscribed`
fires in `_input.js`, and the STT pipeline binds to it.

## Current State (649f5c7)

- Worker: `trackPublished` fix in place, `session.say()` fires immediately after `session.start()`
- Client: mute/unmute PTT active (`setMicTrackMuted`), mic starts muted on connect
- No `mic_ready` gate (removed — was correct in design but timing was unreliable)
- `pre_session_start` debug event still present — will confirm participant identity on first live test
- `participantIdentity` still passed to `session.start()` — may or may not matter now

## What to Verify on First Live Test

In the Debug Timeline, after fixing, expect to see for the first time:
- `stt_interim` events appearing while PTT is held
- `stt_final` event just before `turn_commit_requested`
- `conversation_user_item_added` confirming the transcript was processed
- `conversation_agent_item_added` with the tutor's response
- `agent_state • speaking` → tutor audio plays

If `turn_no_speech` still fires after the fix is deployed to Fly, check:
- Did the Fly worker redeploy? (`fly deploy` needed if auto-deploy isn't wired)
- Is `pre_session_start` now visible in the debug timeline? If yes, what identity?

## Remaining Unknowns

1. **Output cancellation** — historical logs showed `firstFrameFut cancelled before first frame`.
   This was the TTS playout edge. With the input edge fixed, this may surface again.
   If tutor response text appears (`conversation_agent_item_added`) but no audio plays,
   this is the next thing to investigate.

2. **participantIdentity filtering** — `setParticipant()` in `_input.js` filters by identity.
   If `participantIdentity` resolves to a wrong value, STT will still bind to nobody.
   `pre_session_start` in the debug timeline now shows the resolved value — check it.

3. **Mic mute/unmute reliability** — `setMicTrackMuted` using `publication.audioTrack.mute()`
   may not be reliable across all browsers. If STT works on desktop but not mobile,
   this is suspect.

## Key Files

- `src/agent/index.ts` — Fly worker (deploy separately via `fly deploy`)
- `src/app/speak/SpeakClient.tsx` — browser client

## Commit Reference Window

- `7ef6160` — last observed working transcription (pre-investigation baseline)
- `8e2dd9b` — mic_ready gate added, debug timeline added
- `f9ab282` — mute/unmute PTT restored
- `649f5c7` — **trackPublished fix + mic_ready gate removed (current main)**
