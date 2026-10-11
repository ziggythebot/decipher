# Voice Handoff (2026-04-10 — fully working, tagged voice-baseline-v1)

## Current State

- Branch: `main`
- Fly worker: @livekit/agents v1.2.4, deployed 2026-04-09
- Vercel: `https://decipher-two.vercel.app`

## Upgrade to @livekit/agents 1.9.2 (2026-10-11, branch `chore/livekit-agents-1.9`)

All `@livekit/agents*` packages are 1.9.2. `@livekit/rtc-node` is 1.1.0 and is
now a direct dependency (the worker imports it). `livekit-client` is 2.22.4.

Workaround status:

| 1.2.4 workaround | 1.9.2 status |
|---|---|
| `trackPublished` handler that subscribes late audio tracks | Removed. `JobContext.connect(AUDIO_ONLY)` now subscribes tracks published after connect. |
| `ttsNode` override that buffered all text and called `synthesize()` | Removed. The default streaming TTS path works. `ttsNode` now only counts characters and calls `super.ttsNode`. |
| `llmNode` passed `null` tool context to avoid `tools: []` | Still needed. Anthropic still returns 400 for `tools: []`. Fixed in `src/agent/anthropic-compat-llm.ts` instead of a cast in `llmNode`. |
| `scripts/patch-livekit-agents.mjs` (idle timeouts 10s to 30s, writer-close guard) | Removed. Timeouts are now `AgentSession` options (`ttsReadIdleTimeout`, `forwardAudioIdleTimeout`). The writer-close guard only applied when `ttsNode` returned `null`, which the new `ttsNode` never does. |

Session options moved from deprecated flat fields to `turnHandling`
(`turnDetection: "manual"`, interruptions off, preemptive generation off).
The PTT data contract (`ptt_press`, `ptt_release`, `mic_ready`, `debug_stage`)
did not change.

## What Is Fixed

### Input edge (fixed 7bf8887)
`trackPublished` listener calls `setSubscribed(true)` on audio tracks.
Fixed root cause: `AutoSubscribe.AUDIO_ONLY` was connecting with `autoSubscribe:false`
and never subscribing late-joining client tracks.

### Output edge (fixed 2026-04-09 — upgrade to v1.2.4)

**Root cause: `AudioSource` ring buffer overflow.**

When Deepgram TTS generates audio significantly faster than real-time (2–10×
burst), the `AudioSource` ring buffer (default `queueSizeMs = 1000` = 1 second)
overflows. The native layer silently discards the **oldest frames** — which are
the beginning of the agent's speech.

In v1.2.3, `ParticipantAudioOutput` was NOT passing `options.queueSizeMs` to the
`AudioSource` constructor — the ring buffer always used the 1-second default
regardless of any configuration. livekit/agents-js PR #1207 (v1.2.4) fixed this.

The `firstFrameFut cancelled before first frame` log means:
1. TTS generates all frames in a burst
2. Ring buffer fills and starts dropping oldest frames
3. Audio forwarding loop exits (ring buffer closed/errored) before the first
   frame event fires
4. `firstFrameFut` is rejected in the `finally` block

**Fix**: Upgraded `@livekit/agents` and all plugins from 1.2.3 → 1.2.4.
Also bumped `@livekit/agents-plugin-elevenlabs` to 1.2.4 (peer dep conflict).

Two TypeScript type changes required for the upgrade:
- `src/agent/index.ts`: `trackPublished` callback `publication` param — removed
  explicit type annotation (let TS infer `RemoteTrackPublication`), since
  `TrackKind` is now `TrackKind | undefined` not `number`.
- `src/app/speak/SpeakClient.tsx`: `getMuteCapableMicTrack()` — cast through
  `unknown` for mute/unmute runtime check since `Track<Kind>` no longer exposes
  those methods in its TypeScript type.

## Expected Debug Timeline (full successful turn)

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

## Key Files

- `src/agent/index.ts` — Fly worker
- `src/app/speak/SpeakClient.tsx` — browser client

## Commit Reference

- `7ef6160` — last pre-investigation baseline
- `7bf8887` — trackPublished subscription fix (input edge fixed)
- `1ca6d7c` — stable point before output investigation
- post-1ca6d7c — v1.2.4 upgrade (output edge fixed)
