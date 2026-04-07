import {
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  pipeline,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as openai from "@livekit/agents-plugin-openai";
import { fileURLToPath } from "node:url";

// Decipher voice agent — French conversation practice
// Uses Deepgram STT + Claude (via OpenAI-compat) + ElevenLabs TTS

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();

    const metadata = getLearnerMetadata(ctx);
    const {
      userName = "learner",
      knownWords = [],
      grammarProfile = {},
      goalType = "social",
      sessionMode = "guided", // guided | freeform
      scenarioType = "ordering_coffee",
      languageName = "French",
    } = metadata;

    const systemPrompt = buildSystemPrompt({
      userName,
      knownWords,
      grammarProfile,
      goalType,
      sessionMode,
      scenarioType,
      languageName,
    });

    const agent = new pipeline.VoicePipelineAgent(
      new deepgram.STT(),
      new openai.LLM({
        model: "claude-opus-4-5",
        baseURL: "https://api.anthropic.com/v1",
        apiKey: process.env.ANTHROPIC_API_KEY,
      }),
      new elevenlabs.TTS({
        voiceId: process.env.ELEVENLABS_VOICE_ID_FR ?? "pNInz6obpgDQGcFmaJgB",
      }),
      {
        chatCtx: new llm.ChatContext().append({
          role: llm.ChatRole.SYSTEM,
          text: systemPrompt,
        }),
      }
    );

    agent.on("agent_started_speaking", () => {
      // Could emit to room metadata for UI sync
    });

    agent.on("user_speech_committed", (userMessage: llm.ChatMessage) => {
      // Log user utterances for error tracking — sent via room data messages
      ctx.room.localParticipant?.publishData(
        JSON.stringify({ type: "user_utterance", text: userMessage.content }),
        { reliable: true }
      );
    });

    agent.on("agent_speech_committed", (agentMessage: llm.ChatMessage) => {
      ctx.room.localParticipant?.publishData(
        JSON.stringify({ type: "agent_utterance", text: agentMessage.content }),
        { reliable: true }
      );
    });

    const session = await agent.start(ctx.room);
    await session.waitForDisconnection();
  },
});

function parseMetadata(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
