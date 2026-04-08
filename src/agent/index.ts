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
import { fileURLToPath } from "node:url";

// Decipher voice agent — French conversation practice
// Uses Deepgram STT + Claude (via OpenAI-compat) + ElevenLabs TTS
const noOpTool = llm.tool({
  description: "Internal no-op tool for provider compatibility.",
  execute: async () => "ok",
});

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);

    let participantIdentity: string | undefined;
    if (getRemoteParticipantCount(ctx) === 0) {
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
      grammarProfile: rawGrammarProfile,
      goalType: rawGoalType,
      sessionMode: rawSessionMode,
      scenarioType: rawScenarioType,
      languageName: rawLanguageName,
      targetLanguage: rawTargetLanguage,
    } = metadata;
    const userName = asString(rawUserName, "learner");
    const knownWords = asStringArray(rawKnownWords);
    const grammarProfile = asRecord(rawGrammarProfile);
    const goalType = asString(rawGoalType, "social");
    const sessionMode = asString(rawSessionMode, "guided");
    const scenarioType = asString(rawScenarioType, "ordering_coffee");
    const languageName = asString(rawLanguageName, "French");
    const targetLanguage = asString(rawTargetLanguage, "fr");
    const ttsModel = resolveDeepgramTtsModel(targetLanguage, process.env.DEEPGRAM_TTS_MODEL);

    const systemPrompt = buildSystemPrompt({
      userName,
      knownWords,
      grammarProfile,
      goalType,
      sessionMode,
      scenarioType,
      languageName,
    });

    const session = new voice.AgentSession({
      stt: new deepgram.STT({ apiKey: process.env.DEEPGRAM_API_KEY }),
      llm: new openai.LLM({
        model: "claude-opus-4-1-20250805",
        baseURL: "https://api.anthropic.com/v1/",
        apiKey: process.env.ANTHROPIC_API_KEY,
        toolChoice: "none",
      }),
      tts: new deepgram.TTS({
        apiKey: process.env.DEEPGRAM_API_KEY,
        model: ttsModel,
      }),
    });

    const agent = new voice.Agent({
      instructions: systemPrompt,
      tools: {
        no_op: noOpTool,
      },
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const role = ev.item.role;
      if (role !== "user" && role !== "assistant") return;

      const text = stringifyMessageContent(ev.item.content);
      if (!text) return;

      const payload =
        role === "user"
          ? { type: "user_utterance", text }
          : { type: "agent_utterance", text };

      void ctx.room.localParticipant?.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true }
      );
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
      void ctx.room.localParticipant?.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true }
      );
    });

    await session.start({
      agent,
      room: ctx.room,
      inputOptions: {
        participantIdentity,
        closeOnDisconnect: false,
      },
    });
    session.say(
      "Bonjour! On commence. Tu veux commander un cafe maintenant ?",
      { allowInterruptions: false }
    );

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      ctx.room.once("disconnected", done);
      ctx.addShutdownCallback(async () => {
        done();
      });
    });
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
  grammarProfile: Record<string, unknown>;
  goalType: string;
  sessionMode: string;
  scenarioType: string;
  languageName: string;
}): string {
  const { userName, knownWords, grammarProfile, goalType, sessionMode, scenarioType, languageName } = opts;

  const wordCount = knownWords.length;
  const wordListSample = knownWords.slice(0, 50).join(", ");

  const scenarioInstructions =
    sessionMode === "guided"
      ? SCENARIOS[scenarioType as keyof typeof SCENARIOS] ?? SCENARIOS.ordering_coffee
      : "This is a freeform conversation. Talk naturally about anything. Follow the learner's lead.";

  return `You are a ${languageName} conversation tutor. You are warm, encouraging, and patient — but efficient. No wasted words.

LEARNER PROFILE:
- Name: ${userName}
- Goal: ${goalType} fluency
- Known vocabulary: ${wordCount} words
- Sample known words: ${wordListSample}
- Grammar profile: ${JSON.stringify(grammarProfile)}

YOUR RULES:
1. Speak primarily in ${languageName}. For beginners (< 100 words known), use 60% ${languageName} / 40% English. For intermediate (100–500 words), use 80% ${languageName}. For advanced (500+), stay in ${languageName} unless stuck.
2. Use ONLY words the learner is likely to know, plus a few new ones just above their level (i+1 method). Never use obscure vocabulary.
3. When the learner makes a grammar error, correct it naturally: repeat the correct version in your response without making a big deal of it.
4. After each exchange, if you used a new word the learner may not know, briefly explain it.
5. Be encouraging. Use phrases like "Exactement!", "Très bien!", "Presque!" (almost!), "Bonne tentative!" (good try!).
6. Keep responses SHORT — 1-3 sentences max. This is a conversation, not a lecture.
7. If the learner is stuck, give them a word or phrase to use, then ask them to try again.

SESSION CONTEXT:
${scenarioInstructions}

Start the session with a warm greeting in ${languageName} and immediately set up the scenario.`;
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
};

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.LIVEKIT_AGENT_NAME ?? "decipher-agent",
    initializeProcessTimeout: 120000,
  })
);
