// Optional fallback for browsers without Chrome Built-in AI: WebLLM
// (@mlc-ai/web-llm runs a quantised model on WebGPU). The model is hundreds of
// MB, so we deliberately do NOT bundle it. This is a slot: if a host wires an
// engine onto `globalThis.__autofillWebLLM`, the provider uses it; otherwise it
// reports unavailable and the router falls through to graceful degradation.

import type { AIProvider, Availability } from "../types";

interface WebLLMEngine {
  // Subset of @mlc-ai/web-llm's OpenAI-compatible surface we rely on.
  chat: {
    completions: {
      create(opts: {
        messages: Array<{ role: string; content: string }>;
        stream?: boolean;
      }): Promise<{ choices: Array<{ message: { content: string } }> }>;
    };
  };
}

function engine(): WebLLMEngine | null {
  return (
    (globalThis as unknown as { __autofillWebLLM?: WebLLMEngine }).__autofillWebLLM ?? null
  );
}

export const webllmProvider: AIProvider = {
  id: "webllm",
  label: "On-device (WebGPU)",

  async availability(): Promise<Availability> {
    if (!("gpu" in navigator)) return "unavailable";
    return engine() ? "available" : "downloadable";
  },

  async run(system: string, user: string, onChunk?: (delta: string) => void): Promise<string> {
    const eng = engine();
    if (!eng) throw new Error("WebLLM engine not loaded.");
    const res = await eng.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = res.choices[0]?.message.content ?? "";
    onChunk?.(text);
    return text;
  },
};
