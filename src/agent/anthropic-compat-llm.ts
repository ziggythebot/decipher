import { llm } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";

/**
 * OpenAI-compatible LLM pointed at Anthropic's /v1/chat/completions.
 *
 * The framework always passes a ToolContext, and with no tools it serialises
 * as `tools: []`. Anthropic's compat endpoint rejects that with 400 "List
 * should have at least 1 item" (re-checked against @livekit/agents 1.9.2 on
 * 2026-10-11). Dropping an empty ToolContext here omits `tools` and
 * `tool_choice` from the request. Real tools still pass through unchanged.
 */
export class AnthropicCompatLLM extends openai.LLM {
  override chat(opts: Parameters<openai.LLM["chat"]>[0]): ReturnType<openai.LLM["chat"]> {
    const toolCtx = llm.toToolContext(opts.toolCtx);
    const hasTools = toolCtx !== undefined && Object.keys(toolCtx.functionTools).length > 0;
    return super.chat({ ...opts, toolCtx: hasTools ? toolCtx : undefined });
  }
}
