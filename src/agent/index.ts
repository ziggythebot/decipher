import {
  AutoSubscribe,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import { type AudioFrame } from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import { ReadableStream as NodeReadableStream } from "node:stream/web";

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);

    // AutoSubscribe.AUDIO_ONLY connects with autoSubscribe:false on the SFU and only
    // manually subscribes to tracks from participants already present at connect time.
    // Participants who join later have their tracks published but never subscribed, so
    // the STT pipeline receives no audio. This handler fixes that by subscribing to
    // every audio track published after connect.
    ctx.room.on("trackPublished", (publication: { kind: number | undefined; setSubscribed: (v: boolean) => void }, _participant: unknown) => {
      const AUDIO = 1; // TrackKind.KIND_AUDIO from @livekit/rtc-node
      if (publication.kind === AUDIO) {
        publication.setSubscribed(true);
      }
    });

    let participantIdentity: string | undefined;
    const participantIdentityResolvedVia = getRemoteParticipantCount(ctx) > 0 ? "immediate" : "wait";
    if (participantIdentityResolvedVia === "wait") {
      try {
        const participant = await Promise.race([
          ctx.waitForParticipant(),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
        participantIdentity =
          participant && typeof participant === "object" && "identity" in participant
            ? String((participant as { identity?: unknown }).identity ?? "")
            : undefined;
      } catch {
        // Continue even if participant wait fails; room metadata may still be usable.
      }
    } else {
      const firstParticipant = (ctx.room.remoteParticipants as Map<string, { identity?: string }> | undefined)
        ?.values()
        .next().value;
      participantIdentity = firstParticipant?.identity;
    }

    const metadata = getLearnerMetadata(ctx);
    const {
      userName: rawUserName,
      knownWords: rawKnownWords,
      weakWords: rawWeakWords,
      grammarProfile: rawGrammarProfile,
      goalType: rawGoalType,
      sessionMode: rawSessionMode,
      scenarioType: rawScenarioType,
      languageName: rawLanguageName,
      targetLanguage: rawTargetLanguage,
      sessionObjective: rawSessionObjective,
    } = metadata;
    const userName = asString(rawUserName, "learner");
    const knownWords = asStringArray(rawKnownWords);
    const weakWords = asStringArray(rawWeakWords);
    const grammarProfile = asRecord(rawGrammarProfile);
    const goalType = asString(rawGoalType, "social");
    const sessionMode = asString(rawSessionMode, "guided");
    const scenarioType = asString(rawScenarioType, "ordering_coffee");
    const languageName = asString(rawLanguageName, "French");
    const targetLanguage = asString(rawTargetLanguage, "fr");
    const sessionObjective = asSessionObjective(rawSessionObjective);
    const ttsModel = resolveDeepgramTtsModel(targetLanguage, process.env.DEEPGRAM_TTS_MODEL);
    const sttLanguage = resolveDeepgramSttLanguage(targetLanguage, process.env.DEEPGRAM_STT_LANGUAGE);

    const systemPrompt = buildSystemPrompt({
      userName,
      knownWords,
      weakWords,
      grammarProfile,
      goalType,
      sessionMode,
      scenarioType,
      languageName,
      sessionObjective,
    });

    const sessionId = asString(metadata.sessionId, "");
    const internalUrl = process.env.NEXTJS_INTERNAL_URL ?? "";
    const internalSecret = process.env.INTERNAL_API_SECRET ?? "";

    async function flushUsage(patch: {
      inputTokensDelta?: number;
      outputTokensDelta?: number;
      ttsCharsDelta?: number;
      sttSeconds?: number;
    }) {
      if (!sessionId || !internalUrl || !internalSecret) return;
      try {
        await fetch(`${internalUrl}/api/internal/usage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": internalSecret,
          },
          body: JSON.stringify({ sessionId, ...patch }),
        });
      } catch {
        // Non-fatal — best effort tracking
      }
    }

    let accumulatedTtsChars = 0;
    let sttActiveStart: number | null = null;
    let totalSttSeconds = 0;

    const ttsInstance = new deepgram.TTS({
      apiKey: process.env.DEEPGRAM_API_KEY,
      model: ttsModel,
    });

    const session = new voice.AgentSession({
      stt: new deepgram.STT({
        apiKey: process.env.DEEPGRAM_API_KEY,
        model: "nova-3",
        language: sttLanguage,
        detectLanguage: false,
        interimResults: true,
        punctuate: true,
        smartFormat: true,
      }),
      llm: new openai.LLM({
        model: "claude-sonnet-4-6",
        baseURL: "https://api.anthropic.com/v1/",
        apiKey: process.env.ANTHROPIC_API_KEY,
      }),
      tts: ttsInstance,
      turnDetection: "manual",
      preemptiveGeneration: false,
      userAwayTimeout: null,
    });

    // Override ttsNode to bypass StreamAdapterWrapper/DeferredReadableStream pipeline.
    // The default pipeline's DeferredReadableStream.pump() has a silent bug: it calls
    // WritableStream.close() (which doesn't exist — only WritableStreamDefaultWriter.close()
    // exists), so the transform stream never closes, pumpInput() blocks forever, and
    // the output produces 0 audio frames. By overriding ttsNode we collect all LLM text
    // then call synthesize() directly (HTTP POST to Deepgram), bypassing all that.
    class DecipherAgent extends voice.Agent {
      // Override llmNode to pass null toolCtx. The framework always passes toolCtx={}
      // when no tools are defined, which serialises to tools:[] in the API request.
      // Anthropic's compat layer rejects tools:[] ("List should have at least 1 item").
      // Passing null causes inference/llm.js to set tools=undefined, which is omitted
      // from the JSON body entirely, and also removes tool_choice from the request.
      override async llmNode(
        chatCtx: llm.ChatContext,
        _toolCtx: llm.ToolContext,
        modelSettings: voice.ModelSettings
      ): Promise<NodeReadableStream<llm.ChatChunk | string> | null> {
        // Estimate input tokens from chatCtx items text (4 chars ≈ 1 token)
        const inputChars = chatCtx.items.reduce((sum, item) => {
          const c = (item as unknown as { content?: unknown }).content;
          if (typeof c === "string") return sum + c.length;
          if (Array.isArray(c)) return sum + (c as Array<unknown>).map((p) => (typeof p === "string" ? p : ((p as { text?: string }).text ?? ""))).join("").length;
          return sum;
        }, 0);
        const inputTokensEst = Math.ceil(inputChars / 4);

        const upstream = await super.llmNode(chatCtx, null as unknown as llm.ToolContext, modelSettings);
        if (!upstream) return upstream;

        // Wrap the upstream stream to count output chars and flush after the turn
        let outputChars = 0;
        let usageFromChunk: { inputTokens: number; outputTokens: number } | null = null;
        const reader = upstream.getReader();
        return new NodeReadableStream<llm.ChatChunk | string>({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              // Prefer SDK-reported usage if present, else use character estimates
              const finalInput = usageFromChunk?.inputTokens ?? inputTokensEst;
              const finalOutput = usageFromChunk?.outputTokens ?? Math.ceil(outputChars / 4);
              void flushUsage({ inputTokensDelta: finalInput, outputTokensDelta: finalOutput });
              return;
            }
            if (value) {
              if (typeof value === "object" && value !== null) {
                const chunk = value as llm.ChatChunk;
                if (chunk.usage) {
                  usageFromChunk = {
                    inputTokens: chunk.usage.promptTokens,
                    outputTokens: chunk.usage.completionTokens,
                  };
                }
                const text = chunk.delta?.content ?? "";
                if (text) outputChars += text.length;
              } else if (typeof value === "string") {
                outputChars += value.length;
              }
              controller.enqueue(value);
            }
          },
          cancel() { reader.cancel(); },
        });
      }

      override async ttsNode(
        text: NodeReadableStream<string>,
        _modelSettings: voice.ModelSettings
      ): Promise<NodeReadableStream<AudioFrame> | null> {
        const reader = text.getReader();
        const chunks: string[] = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const fullText = chunks.join("").trim();
        console.info(JSON.stringify({ event: "tts_node", chars: fullText.length, preview: fullText.slice(0, 80) }));
        if (!fullText) return null;
        if (fullText.length > 0) {
          accumulatedTtsChars += fullText.length;
          void flushUsage({ ttsCharsDelta: fullText.length });
        }
        const chunkStream = ttsInstance.synthesize(fullText);
        return new NodeReadableStream<AudioFrame>({
          async start(controller) {
            for await (const audio of chunkStream) {
              controller.enqueue((audio as { frame: AudioFrame }).frame);
            }
            controller.close();
          },
          cancel() { chunkStream.close(); },
        });
      }
    }

    const agent = new DecipherAgent({
      instructions: systemPrompt,
      allowInterruptions: false,
    });
    let pendingCommitTimer: NodeJS.Timeout | null = null;
    let awaitingManualCommit = false;
    let sawTranscriptThisTurn = false;
    let sawFinalTranscriptThisTurn = false;
    let turnCounter = 0;
    let currentTurnId = 0;

    function publishData(payload: Record<string, unknown>) {
      void ctx.room.localParticipant?.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true }
      );
    }

    function publishDebugStage(stage: string, extra?: Record<string, unknown>) {
      publishData({
        type: "debug_stage",
        stage,
        turnId: currentTurnId || null,
        ts: Date.now(),
        ...(extra ?? {}),
      });
    }

    function commitUserTurnWithDebug(reason: string) {
      publishDebugStage("turn_commit_requested", { reason });
      session.commitUserTurn();
      publishDebugStage("turn_commit_sent", { reason });
    }

    function publishNoAudioCaptured() {
      const payload = {
        type: "agent_error",
        message: "No speech detected. Hold to Talk, speak, then release.",
      };
      publishData(payload);
      publishDebugStage("turn_no_speech");
    }

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const role = ev.item.role;
      if (role !== "user" && role !== "assistant") return;

      const text = stringifyMessageContent(ev.item.content);
      if (!text) return;

      const payload =
        role === "user"
          ? { type: "user_utterance", text }
          : { type: "agent_utterance", text };

      publishData(payload);
      publishDebugStage(role === "user" ? "conversation_user_item_added" : "conversation_agent_item_added", {
        textPreview: text.slice(0, 80),
      });
    });

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      if (!ev.transcript) return;
      const trimmed = ev.transcript.trim();
      if (!trimmed) return;
      sawTranscriptThisTurn = true;
      const payload = {
        type: "user_transcribed",
        text: trimmed,
        language: ev.language,
        isFinal: ev.isFinal,
      };
      publishData(payload);
      publishDebugStage(ev.isFinal ? "stt_final" : "stt_interim", {
        textPreview: trimmed.slice(0, 80),
      });

      if (ev.isFinal && awaitingManualCommit) {
        sawFinalTranscriptThisTurn = true;
        if (pendingCommitTimer) {
          clearTimeout(pendingCommitTimer);
          pendingCommitTimer = null;
        }
        commitUserTurnWithDebug("stt_final");
        awaitingManualCommit = false;
      }
    });

    session.on(voice.AgentSessionEventTypes.Error, (ev) => {
      const errorMessage =
        ev.error instanceof Error && typeof ev.error.message === "string"
          ? ev.error.message
          : "Unknown voice agent error";
      const payload = {
        type: "agent_error",
        message: errorMessage,
      };
      publishData(payload);
      publishDebugStage("agent_error", { message: errorMessage.slice(0, 140) });
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      const payload = {
        type: "agent_state",
        state: ev.newState,
      };
      publishData(payload);
      publishDebugStage("agent_state", { state: ev.newState });
    });

    session.on(voice.AgentSessionEventTypes.SpeechCreated, (ev) => {
      publishDebugStage("speech_created", {
        source: ev.source,
        userInitiated: ev.userInitiated,
      });
    });

    ctx.room.on("dataReceived", (payload) => {
      try {
        const text = new TextDecoder().decode(payload);
        const parsed = JSON.parse(text) as {
          type?: string;
          holdMs?: number | null;
          hasMicPublication?: boolean;
          micMutedBeforeRelease?: boolean | null;
        };
        if (parsed.type === "ptt_press") {
          currentTurnId = ++turnCounter;
          sttActiveStart = Date.now();
          console.info(
            JSON.stringify({
              event: "ptt_press",
              turnId: currentTurnId,
              hasMicPublication: parsed.hasMicPublication ?? null,
            })
          );
          publishDebugStage("ptt_press_received", {
            hasMicPublication: parsed.hasMicPublication ?? null,
          });
          if (pendingCommitTimer) {
            clearTimeout(pendingCommitTimer);
            pendingCommitTimer = null;
          }
          awaitingManualCommit = false;
          sawTranscriptThisTurn = false;
          sawFinalTranscriptThisTurn = false;
          session.clearUserTurn();
        }
        if (parsed.type === "ptt_release") {
          const holdMs = typeof parsed.holdMs === "number" ? parsed.holdMs : null;
          console.info(
            JSON.stringify({
              event: "ptt_release",
              turnId: currentTurnId,
              holdMs,
              hasMicPublication: parsed.hasMicPublication ?? null,
              micMutedBeforeRelease: parsed.micMutedBeforeRelease ?? null,
            })
          );
          publishDebugStage("ptt_release_received", {
            holdMs,
            hasMicPublication: parsed.hasMicPublication ?? null,
            micMutedBeforeRelease: parsed.micMutedBeforeRelease ?? null,
          });
          if (sttActiveStart !== null) {
            const elapsed = (Date.now() - sttActiveStart) / 1000;
            totalSttSeconds += elapsed;
            sttActiveStart = null;
          }
          if (holdMs !== null && holdMs < 300) {
            publishData({
              type: "agent_error",
              message: "Hold to Talk slightly longer, then release.",
            });
            publishDebugStage("ptt_too_short", { holdMs });
            awaitingManualCommit = false;
            sawTranscriptThisTurn = false;
            sawFinalTranscriptThisTurn = false;
            if (pendingCommitTimer) {
              clearTimeout(pendingCommitTimer);
              pendingCommitTimer = null;
            }
            return;
          }
          if (pendingCommitTimer) {
            clearTimeout(pendingCommitTimer);
          }
          awaitingManualCommit = true;
          pendingCommitTimer = setTimeout(() => {
            if (awaitingManualCommit) {
              if (sawFinalTranscriptThisTurn || sawTranscriptThisTurn) {
                commitUserTurnWithDebug("release_timer");
              } else {
                publishNoAudioCaptured();
              }
              awaitingManualCommit = false;
            }
            pendingCommitTimer = null;
          }, sawTranscriptThisTurn ? 700 : 2500);
        }
      } catch {
        // Ignore non-JSON data messages.
      }
    });

    const participantTrackPublications = participantIdentity
      ? Array.from(
          (
            ctx.room.remoteParticipants as Map<
              string,
              { trackPublications?: Map<string, unknown> }
            >
          )
            ?.get(participantIdentity)
            ?.trackPublications?.keys() ?? []
        )
      : [];
    publishDebugStage("pre_session_start", {
      participantIdentity: participantIdentity ?? null,
      resolvedVia: participantIdentityResolvedVia,
      trackPublications: participantTrackPublications,
    });

    await session.start({
      agent,
      room: ctx.room,
      inputOptions: {
        participantIdentity,
        closeOnDisconnect: true,
      },
    });
    publishDebugStage("session_started", {
      participantIdentity: participantIdentity ?? null,
    });
    session.say(buildGreeting(languageName, scenarioType), { allowInterruptions: false });

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      ctx.room.once("disconnected", done);
      ctx.addShutdownCallback(async () => {
        done();
      });
    });

    // Final flush: send accumulated STT seconds on session end
    if (totalSttSeconds > 0) {
      await flushUsage({ sttSeconds: totalSttSeconds });
    }

    // Session complete: flush learning data back to the Next.js app
    if (sessionId && internalUrl && internalSecret) {
      // Collect all words that appeared in conversation turns
      const wordsEncountered: string[] = [];
      for (const item of session.chatCtx.items) {
        const content = (item as unknown as { content?: unknown }).content;
        const text = typeof content === "string" ? content : Array.isArray(content)
          ? (content as Array<unknown>).map((p) => typeof p === "string" ? p : ((p as { text?: string }).text ?? "")).join(" ")
          : "";
        if (text && sessionObjective?.targetVocab) {
          for (const v of sessionObjective.targetVocab) {
            if (text.toLowerCase().includes(v.word.toLowerCase()) && !wordsEncountered.includes(v.word)) {
              wordsEncountered.push(v.word);
            }
          }
        }
      }

      try {
        await fetch(`${internalUrl}/api/internal/session-complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": internalSecret,
          },
          body: JSON.stringify({
            sessionId,
            wordsEncountered,
            patternUses: 0, // turn-level counting added in Phase 4
            errorsLogged: [],
          }),
        });
      } catch {
        // Non-fatal
      }
    }
  },
});

function getRemoteParticipantCount(ctx: { room: { remoteParticipants?: unknown } }): number {
  const map = ctx.room.remoteParticipants as Map<string, unknown> | undefined;
  return map ? map.size : 0;
}

function resolveDeepgramTtsModel(targetLanguage: string, explicitModel?: string): string {
  if (explicitModel && explicitModel.trim().length > 0) {
    return explicitModel.trim();
  }

  switch (targetLanguage.toLowerCase()) {
    case "fr":
      return "aura-2-agathe-fr";
    case "es":
      return "aura-2-celeste-es";
    case "de":
      return "aura-2-julius-de";
    case "it":
      return "aura-2-livia-it";
    case "nl":
      return "aura-2-rhea-nl";
    case "ja":
      return "aura-2-fujin-ja";
    default:
      return "aura-2-thalia-en";
  }
}

function resolveDeepgramSttLanguage(targetLanguage: string, explicitLanguage?: string): string {
  if (explicitLanguage && explicitLanguage.trim().length > 0) {
    return explicitLanguage.trim();
  }

  switch (targetLanguage.toLowerCase()) {
    case "fr":
      return "fr";
    case "es":
      return "es";
    case "de":
      return "de";
    case "it":
      return "it";
    case "pt":
      return "pt";
    case "nl":
      return "nl";
    case "ja":
      return "ja";
    default:
      return "en";
  }
}

function parseMetadata(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join(" ")
      .trim();
    return joined;
  }
  return "";
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

type SessionObjective = {
  targetPattern: {
    id: string;
    description: string;
    exampleFr: string;
    requiredUses: number;
  } | null;
  targetVocab: {
    word: string;
    translation: string;
    frequencyRank: number;
    isWeak: boolean;
  }[];
  errorFocus: string[];
} | null;

function asSessionObjective(value: unknown): SessionObjective {
  if (!value || typeof value !== "object") return null;
  return value as SessionObjective;
}

function getLearnerMetadata(ctx: { room: { metadata?: string; remoteParticipants?: unknown } }): Record<string, unknown> {
  const roomMetadata = parseMetadata(ctx.room.metadata);
  if (Object.keys(roomMetadata).length > 0) return roomMetadata;

  const remoteParticipants = Array.from(
    ((ctx.room.remoteParticipants as Map<string, { metadata?: string }> | undefined)?.values() ?? [])
  );
  for (const participant of remoteParticipants) {
    const participantMetadata = parseMetadata(participant.metadata);
    if (Object.keys(participantMetadata).length > 0) return participantMetadata;
  }

  return {};
}

function buildSystemPrompt(opts: {
  userName: string;
  knownWords: string[];
  weakWords: string[];
  grammarProfile: Record<string, unknown>;
  goalType: string;
  sessionMode: string;
  scenarioType: string;
  languageName: string;
  sessionObjective: SessionObjective;
}): string {
  const { userName, knownWords, weakWords, grammarProfile, goalType, sessionMode, scenarioType, languageName, sessionObjective } = opts;

  const wordCount = knownWords.length;
  const wordListSample = knownWords.slice(0, 50).join(", ");

  let scenarioInstructions: string;
  if (sessionMode !== "guided") {
    scenarioInstructions = "This is a freeform conversation. Talk naturally about anything. Follow the learner's lead.";
  } else if (scenarioType === "struggle_bus" && weakWords.length > 0) {
    scenarioInstructions = `SCENARIO: Struggle Bus — targeted vocabulary drilling.
The learner has identified these words as tricky for them: ${weakWords.join(", ")}.
Your goal: weave these specific words naturally into the conversation over the next few minutes.
Don't quiz them directly — instead, use each word in a natural sentence and pause for them to respond using it.
If they get a word right, praise them and move on. If they stumble, use the word again later.
Keep the conversation flowing naturally — pick a relaxed setting (a walk, a café, chatting about their day).`;
  } else if (scenarioType === "struggle_bus") {
    scenarioInstructions = `SCENARIO: Struggle Bus — conversational vocabulary practice.
The learner wants to drill their weakest words through natural conversation.
Have a relaxed chat about their day or interests, and gently introduce vocabulary that challenges them just above their current level.
Revisit any word they seem uncertain about.`;
  } else {
    scenarioInstructions = SCENARIOS[scenarioType as keyof typeof SCENARIOS] ?? SCENARIOS.ordering_coffee;
  }

  // Build session objective block
  let objectiveBlock = "";
  if (sessionObjective?.targetPattern || (sessionObjective?.targetVocab?.length ?? 0) > 0) {
    const parts: string[] = [];

    if (sessionObjective?.targetPattern) {
      const p = sessionObjective.targetPattern;
      parts.push(`TARGET PATTERN: "${p.description}"
Example: ${p.exampleFr}
REQUIRED: steer the conversation so the learner uses this pattern at least ${p.requiredUses} times.
If the learner avoids it for 2+ turns, ask a question that requires them to use it.`);
    }

    if (sessionObjective?.targetVocab?.length) {
      const vocabList = sessionObjective.targetVocab
        .map((v) => `${v.word} (${v.translation})${v.isWeak ? " [weak — reinforce]" : ""}`)
        .join(", ");
      parts.push(`TARGET VOCABULARY: ${vocabList}
Weave these words naturally into the conversation. Introduce no more than 1 new word per turn.
Prioritise [weak] words — use them multiple times.`);
    }

    if (sessionObjective?.errorFocus?.length) {
      parts.push(`KNOWN ERRORS TO ADDRESS: ${sessionObjective.errorFocus.join("; ")}
If any of these come up, correct them clearly and have the learner repeat the correct form.`);
    }

    objectiveBlock = `\nSESSION OBJECTIVE — FOLLOW THIS:
${parts.join("\n\n")}\n`;
  }

  return `You are a ${languageName} conversation tutor. You are warm, encouraging, and patient — but efficient. No wasted words.

LEARNER PROFILE:
- Name: ${userName}
- Goal: ${goalType} fluency
- Known vocabulary: ${wordCount} words
- Sample known words: ${wordListSample}
- Grammar profile: ${JSON.stringify(grammarProfile)}

YOUR RULES:
1. Speak ONLY in ${languageName}. No English at all. No translations. No parenthetical explanations.
2. Use ONLY words the learner is likely to know, plus a few new ones just above their level. Never use obscure vocabulary.
3. When the learner makes a grammar error, correct it naturally by repeating the correct version in your response.
4. Be encouraging. Use short phrases like "Exactement!", "Très bien!", "Presque!", "Bonne tentative!".
5. Keep responses SHORT — 1-2 sentences max. This is a spoken conversation.
6. If the learner is stuck, give them a single word or phrase to try.
7. CRITICAL: Plain text only. No asterisks, no bold, no markdown, no emoji, no special characters. Your output goes directly to text-to-speech.
${objectiveBlock}
SESSION CONTEXT:
${scenarioInstructions}

Start the session with a warm greeting in ${languageName} and immediately set up the scenario.`;
}

// Per-language, per-scenario opening line spoken immediately via TTS (no LLM latency).
// The LLM picks up the scenario from the system prompt for all subsequent turns.
const SCENARIO_GREETINGS: Record<string, Record<string, string>> = {
  French: {
    struggle_bus: "Bonjour! On va pratiquer ensemble. Parlons un peu.",
    ordering_coffee: "Bonjour! Bienvenue au café. Qu'est-ce que vous désirez?",
    meeting_someone: "Bonjour! C'est une belle conférence, non?",
    shopping: "Bonjour! Je peux vous aider?",
    asking_directions: "Bonjour! Vous avez l'air perdu. Je peux vous aider?",
    restaurant: "Bonsoir! Bienvenue. Voici notre menu.",
    road_rage: "Putain! Encore les embouteillages! Montez, montez, on n'a pas toute la journée!",
  },
  Portuguese: {
    ordering_coffee: "Olá! Bem-vindo ao café. O que vai querer?",
    meeting_someone: "Olá! É uma ótima conferência, não é?",
    shopping: "Olá! Posso ajudar?",
    asking_directions: "Olá! Parece perdido. Posso ajudar?",
    restaurant: "Boa noite! Bem-vindo. Aqui está o nosso menu.",
  },
};

function buildGreeting(languageName: string, scenarioType: string): string {
  return (
    SCENARIO_GREETINGS[languageName]?.[scenarioType] ??
    SCENARIO_GREETINGS["French"]?.[scenarioType] ??
    "Bonjour! On commence."
  );
}

const SCENARIOS = {
  ordering_coffee: `SCENARIO: Ordering coffee at a Parisian café.
Setting: You are a friendly waiter at a café. The learner is the customer.
Flow: Greet them → Take their order → Discuss sizes/options → Give the price → Small talk.
Key vocabulary to introduce naturally: café, thé, lait, sucre, s'il vous plaît, merci, combien, l'addition.`,

  meeting_someone: `SCENARIO: Meeting someone at a tech conference.
Setting: You are another attendee at a startup event. The learner just introduced themselves.
Flow: Introductions → What do you do? → Where are you from? → What brings you here? → Exchange contacts.
Key vocabulary to introduce naturally: travailler, entreprise, projet, intéressant, enchanté, à bientôt.`,

  shopping: `SCENARIO: Shopping at a market.
Setting: You are a market vendor. The learner wants to buy some fruit.
Flow: What are you looking for? → Prices → Quantities → Payment.
Key vocabulary: combien, chercher, acheter, euro, kilo, c'est tout.`,

  asking_directions: `SCENARIO: Asking for directions in Paris.
Setting: You are a helpful Parisian. The learner is lost.
Flow: The learner asks where something is → You give directions → Confirm they understood.
Key vocabulary: à gauche, à droite, tout droit, près de, loin, rue, métro.`,

  restaurant: `SCENARIO: Ordering dinner at a French restaurant.
Setting: You are a waiter at a brasserie.
Flow: Welcome → Menu options → Order → Dietary needs → Enjoyment check.
Key vocabulary: menu, plat, entrée, dessert, recommander, végétarien, délicieux.`,

  road_rage: `SCENARIO: Rude Mode — Paris Road Rage.
You are JEAN-PIERRE, a Parisian taxi driver. Rush hour. You've been cut off three times. A tourist (the learner) has just flagged you down and is now in your cab. You are ALREADY furious.

CRITICAL RULES:
1. You speak French — but as your anger escalates you start mixing in broken, mangled English ("What ze fuck?!", "You are ze idiot!", "I cannot believe zis!"). More anger = more broken English creeping in.
2. Track your own anger level from 1 to 5 internally:
   - Level 1: Grumpy, muttering, but professional ("Bah, encore les embouteillages...")
   - Level 2: Visibly annoyed, complaining loudly ("C'est n'importe quoi ce pays!")
   - Level 3: Ranting, gesturing wildly ("Putain! Vous voyez ça?! PUTAIN!")
   - Level 4: Losing it, broken English emerging ("ZIS city is MERDE! What ze hell is zis?!")
   - Level 5: Full meltdown, mostly broken English, honking imaginary horn ("CASSE-TOI! GET OUT OF ZE WAY! MON DIEU!")
3. If the learner is CALM, apologetic, or uses polite French → de-escalate by 1 level per turn.
4. If the learner is RUDE, swears back, or argues → escalate by 1-2 levels.
5. If the learner swears at YOU directly → jump to level 5 immediately and threaten to kick them out.
6. Stay in character. Jean-Pierre has opinions about everything: other drivers, the government, tourists, the weather, his ex-wife.
7. Keep responses SHORT and punchy — this is road rage, not a lecture.
8. CRITICAL: No markdown, no asterisks. Plain text only — this goes to text-to-speech.

Start at anger level 2. You're stuck in traffic on Boulevard Haussmann and someone just cut you off.`,
};

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.LIVEKIT_AGENT_NAME ?? "decipher-agent",
    initializeProcessTimeout: 120000,
    // Keep only one idle process on Fly 512MB instances to avoid worker thrash.
    numIdleProcesses: 1,
  })
);
