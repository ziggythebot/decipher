# Voice Handoff (2026-04-09 — post-fix verification)

## Current State

- Branch: `main` at `1ca6d7c`
- Fly worker: version 26, image `deployment-01KNS28NPHM7F318B4TBXADXTY`
- Vercel: `https://decipher-two.vercel.app`

## What Is Fixed

**Input edge: fully working.**

`7bf8887` added a `trackPublished` listener that calls `setSubscribed(true)` on audio tracks.
This fixed the root cause: `AutoSubscribe.AUDIO_ONLY` was connecting with `autoSubscribe:false`
on the SFU and never subscribing late-joining client tracks. STT now receives audio correctly.

Verified in live session:
- `stt_interim` events with French words appear in Debug Timeline during PTT
- `turn_commit_requested` / `turn_commit_sent` fire correctly on release
- `performLLMInference done` confirmed in worker logs
- `performTTSInference started/done` confirmed in worker logs

## Remaining Bug

**Output edge: intermittent playback cancellation.**

Worker logs for verified failing session:
```
performTTSInference started
performTTSInference done
performAudioForwarding started
firstFrameFut cancelled before first frame
```

TTS generates successfully. Audio forwarding starts. But the first frame future is
cancelled before any audio reaches the client. Tutor reply never plays.

This is intermittent — not every turn fails. The LLM and TTS pipelines are fine.
The failure is in the playout/forwarding stage after TTS completes.

## What Was Tried (and reverted)

Two experimental tweaks were applied after the input fix and then reverted (back to `1ca6d7c`):
- Details not recorded here — see git log between `7bf8887` and `1ca6d7c`
- Reverted because they didn't help and introduced risk

The effective baseline is: `7bf8887` subscription fix, without the intermediate experiments.

## Diagnosis Starting Point

`firstFrameFut cancelled before first frame` is a livekit-agents internal signal.
It means the `SpeechHandle` that was queued to play got cancelled/interrupted before
the audio stream produced its first frame.

Likely causes to investigate:
1. **`clearUserTurn()` cancelling inflight speech** — PTT press calls `session.clearUserTurn()`
   which may be cancelling the tutor's queued reply if PTT is pressed again before playout starts.
2. **Agent state race** — agent transitions to `listening` and starts a new recognition cycle
   before the TTS output is forwarded, causing the speech handle to be pre-empted.
3. **`allowInterruptions: false` not preventing internal cancellation** — this only blocks
   user-initiated interruptions, not internal state transitions.
4. **Speech handle lifecycle** — `session.say()` creates one speech handle for the intro;
   subsequent LLM replies use a different path. Check if handles are being discarded.

## Recommended Investigation Steps

1. Add `debug_stage` events around the livekit-agents speech playout path:
   - Listen for `SpeechCreated` event (already in code) — log `source` field
   - Listen for any `SpeechInterrupted` or equivalent event if the SDK exposes one
   - Correlate with agent state transitions in the Debug Timeline

2. Check timing between `performAudioForwarding started` and any `agent_state • listening`
   events — if the agent transitions back to listening before the first frame is sent,
   that may be pre-empting the speech handle.

3. Try adding a short delay between `commitUserTurn` and the next PTT-ready state
   to prevent rapid press-release cycles from racing with outbound speech.

4. Check livekit-agents `AgentSession` for `SpeechInterrupted` or `SpeechFinished` event
   types — the SDK may expose the cancellation reason.

## Key Files

- `src/agent/index.ts` — Fly worker
- `src/app/speak/SpeakClient.tsx` — browser client

## Debug Timeline Events (reference)

For a successful full turn, expect this sequence:
```
ptt_press_received
stt_interim (one or more)
stt_final
turn_commit_requested
turn_commit_sent
conversation_user_item_added
speech_created
agent_state • speaking
conversation_agent_item_added
agent_state • listening
```

Current failure: everything through `speech_created` fires, then audio never plays
(`firstFrameFut cancelled` in worker logs, no `agent_state • speaking` in timeline).

## Commit Reference

- `7ef6160` — last pre-investigation baseline
- `7bf8887` — trackPublished subscription fix (input edge fixed)
- `1ca6d7c` — current main (reverts of experimental tweaks post-fix)
