import { describe, expect, it, vi } from "vitest";
import { llm } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import { AnthropicCompatLLM } from "@/agent/anthropic-compat-llm";

// Anthropic's OpenAI-compatible endpoint rejects `tools: []`. The adapter must
// drop an empty tool context and keep a real one.
describe("AnthropicCompatLLM", () => {
  const make = () =>
    new AnthropicCompatLLM({ model: "claude-sonnet-4-6", baseURL: "http://localhost:0/v1/", apiKey: "test" });
  const chatCtx = llm.ChatContext.empty();

  it("omits an empty tool context", () => {
    const spy = vi.spyOn(openai.LLM.prototype, "chat").mockReturnValue({} as never);
    make().chat({ chatCtx, toolCtx: llm.ToolContext.empty() });
    expect(spy.mock.calls[0][0].toolCtx).toBeUndefined();
    spy.mockRestore();
  });

  it("passes a non-empty tool context through", () => {
    const spy = vi.spyOn(openai.LLM.prototype, "chat").mockReturnValue({} as never);
    const tools = {
      lookup: llm.tool({
        description: "Look up a word",
        parameters: { type: "object", properties: { word: { type: "string" } }, required: ["word"] },
        execute: async () => "ok",
      }),
    };
    make().chat({ chatCtx, toolCtx: tools });
    const passed = spy.mock.calls[0][0].toolCtx as llm.ToolContext;
    expect(Object.keys(passed.functionTools)).toEqual(["lookup"]);
    spy.mockRestore();
  });
});
