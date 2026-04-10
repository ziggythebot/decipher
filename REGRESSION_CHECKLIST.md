# Voice Pipeline Regression Checklist

Run this before merging any change that touches `src/agent/`, `src/app/speak/`, or voice-related API routes.

## Setup

- Docker running, `npm run db:up`, `npm run dev`
- Fly worker deployed: `fly deploy -a decipher-voice-worker`
- Open `/speak`, select **Ordering Coffee**

## Checklist

**1. Intro speaks**
- [ ] Agent says the opening line immediately (no delay > 3s)
- [ ] Audio is clear French, no markdown artefacts (no "asterisk", no "emoji")
- [ ] `conversation_agent_item_added` appears in debug timeline

**2. STT picks up**
- [ ] Press PTT, say "Bonjour"
- [ ] `stt_interim` appears during speech
- [ ] `stt_final` appears after release
- [ ] `conversation_user_item_added` shows the correct transcript

**3. Agent replies (turn 1)**
- [ ] `agent_state • thinking` → `agent_state • speaking` sequence
- [ ] Audio plays back — audible French response
- [ ] `conversation_agent_item_added` shows the response text
- [ ] Response is plain French — no English, no markdown

**4. Second turn works**
- [ ] Press PTT again, say something
- [ ] Full cycle repeats: `stt_interim` → `stt_final` → agent speaks
- [ ] `tts_node chars > 0` visible in Fly logs (`fly logs -a decipher-voice-worker`)

**5. Session end saves**
- [ ] Click End Session
- [ ] XP toast appears with a non-zero gain
- [ ] Session appears in Recent Sessions list with a duration

## Known baselines

| Tag | Date | Status |
|-----|------|--------|
| `voice-baseline-v1` | 2026-04-10 | First stable multi-turn French session. All 5 scenarios wired. |

## What the three agent overrides do (do not remove without re-testing)

- **`llmNode`** — passes `null` toolCtx so Anthropic compat layer doesn't receive `tools:[]` (rejected with 400)
- **`ttsNode`** — collects full LLM text then calls `synthesize()` directly, bypassing `DeferredReadableStream.pump()` which has a silent bug where `WritableStream.close()` is called instead of `writer.close()`, causing the stream to never close and producing 0 audio frames
- **`trackPublished`** handler — manually calls `setSubscribed(true)` because `AutoSubscribe.AUDIO_ONLY` does not subscribe late-joining participant tracks
