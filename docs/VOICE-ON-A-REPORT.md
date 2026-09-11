# Voice on a report

A note for Esko. If you want people to talk to an IC research report by voice, this repo already has the shape. Point your agent at the files below.

The report format does not matter. The report goes in as context. The person talks. The agent answers from the report and only the report.

## The shape

Three parts. Each one deploys on its own.

1. **App** (Next.js on Vercel). Creates a LiveKit room, mints a token for the person, and dispatches an agent job with the context attached as metadata.
2. **LiveKit Cloud**. The media server. Carries audio both ways. Nothing of ours runs here.
3. **Worker** (Node on Fly.io). Joins the room as the agent. Runs speech-to-text, the LLM, and text-to-speech. Reads its context from the job metadata.

```
person's browser  <-- audio -->  LiveKit Cloud  <-- audio -->  worker on Fly
       |                                                          |
       +---- POST /api/speak/session/start (mint token, dispatch) |
       |                                                          |
       +---- app <----- usage + transcript write-back ------------+
```

## Files to read, in order

| File | What it shows |
|---|---|
| `src/app/api/speak/session/start/route.ts` | Room name, token, participant metadata, explicit agent dispatch. Lines 147 to 195 are the whole thing. |
| `src/lib/livekit/token.ts` | Token minting. Twenty lines. |
| `src/agent/index.ts` | The worker. Job entry point, metadata parse, `buildSystemPrompt`, the STT/LLM/TTS session, push-to-talk handling, end-of-session flush. |
| `src/app/speak/SpeakClient.tsx` | Browser client. Connect, publish mic, push-to-talk data messages. |
| `Dockerfile.worker` | How the worker ships separately from the app. |
| `VOICE_RUNTIME_ARCHITECTURE.md` | Sequence diagram, env vars, failure modes, debug runbook. TTS is now Deepgram Aura-2, not ElevenLabs. Voice-only mode is gone. |

## The one seam that matters

In `start/route.ts` the app builds `participantMetadata`: a JSON string with the learner's known words, weak words, and a session objective. It goes into the token and into the dispatch. In `src/agent/index.ts` the worker parses that JSON and hands it to `buildSystemPrompt`, which writes it into the system prompt as a hard block.

For a report, replace the learner fields with the report. Two ways:

- **Small report**: put the text in the metadata. Metadata has a size cap, so this works for a memo, not a dossier.
- **Large report**: put a report id in the metadata. The worker fetches the report from the app over an internal endpoint with a shared secret. This repo already does that in reverse for usage and session-complete write-backs, so the auth pattern is there.

Then add one line to the system prompt: answer only from the report, say so when the report does not cover the question.

## Stack as pinned here

| Piece | Choice |
|---|---|
| Media | LiveKit Cloud |
| Agent framework | `@livekit/agents` 1.2.4 (Node) |
| STT | Deepgram nova-3 |
| LLM | Claude via the OpenAI-compatible plugin |
| TTS | Deepgram Aura-2 |
| Turn taking | Push-to-talk. The browser sends `ptt_press` and `ptt_release` as data messages. The worker gates STT on them. |
| Worker hosting | Fly.io, `lhr`, one Docker image |

Push-to-talk was a choice, not a limit. LiveKit's VAD turn detection works. We used PTT because language learners pause a lot mid-sentence. A report reader does not, so VAD is likely the better default for you.

## Things that will bite

- `@livekit/agents` 1.2.4 had three bugs we patched in the `DecipherAgent` subclass and in `scripts/patch-livekit-agents.mjs`. See the comments at `src/agent/index.ts` lines 146 to 230. A newer release may not need them. Check before you copy.
- The worker must be dispatched explicitly. Automatic dispatch by agent name did not fire reliably for us. See `createDispatch` in the start route.
- Fly machines with autostop go to sleep. The first session after sleep waits for a cold start. Keep one machine warm or accept the delay.
- Cost per minute is dominated by TTS characters, then LLM tokens, then STT seconds. The worker counts all three and posts them to `/api/internal/usage`. Keep that from day one.

## What is not here

No retrieval. No report chunking. No multi-user rooms. No recording. Each of those is a normal addition. None of them changes the shape above.

Andy, September 2026.
