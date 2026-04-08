# Decipher Voice KISS Review

## Headline
Build a reliable language tutor loop:
1. Tutor speaks.
2. Learner holds to talk.
3. Learner releases.
4. Agent commits turn and replies.

If this loop is stable, everything else is optional.

## Current KISS Architecture
- One LiveKit room per session.
- One learner identity per session (`learner-{userId}-{sessionId}`).
- One worker dispatch per room (`decipher-agent`).
- One STT provider (Deepgram, language-locked to target language).
- One TTS provider (Deepgram, language-specific voice model).
- One LLM provider (Claude via OpenAI-compatible client).
- One explicit turn boundary (`ptt_release` -> `commitUserTurn()`).

## What We Removed / Simplified
- Removed auto-reconnect behavior in the web client.
- Removed mixed turn-finalization dependency on VAD only.
- Removed sticky session identity collisions across restarts.
- Kept session disconnect behavior strict to avoid zombie worker jobs.

## Event Contract (Single Path)
- Client -> Worker:
  - `ptt_release`
- Worker -> Client:
  - `user_transcribed`
  - `user_utterance`
  - `agent_utterance`
  - `agent_error`

## Rules Going Forward
- Do not add new providers until loop reliability is proven.
- Do not add auth complexity into voice path.
- Do not add reconnect logic before core loop is stable in production.
- Every new feature must preserve: hold-to-talk release always produces a tutor turn.

## Next Checks (KISS)
1. Confirm tutor always starts on new session.
2. Confirm `Heard:` appears after learner turn.
3. Confirm tutor replies within one turn cycle after release.
4. Confirm refresh creates a clean new session without stale room state.
