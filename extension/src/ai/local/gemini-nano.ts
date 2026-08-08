// Free-tier provider: Chrome Built-in AI (Gemini Nano) via the Prompt API.
// The API has shipped under two shapes; we feature-detect both:
//   - new:  globalThis.LanguageModel.{availability,create}
//   - older: globalThis.ai.languageModel.{capabilities,create}
// Everything stays on-device — nothing leaves the browser.

import type { AIProvider, Availability } from "../types";

// Minimal structural types for the experimental API (not in @types/chrome).
interface LMSession {
  prompt(input: string): Promise<string>;
  promptStreaming?(input: string): AsyncIterable<string> | ReadableStream<string>;
  destroy?(): void;
}
interface NewLM {
  availability(): Promise<Availability>;
  create(opts?: { initialPrompts?: Array<{ role: string; content: string }> }): Promise<LMSession>;
}
interface OldLM {
  capabilities(): Promise<{ available: "readily" | "after-download" | "no" }>;
  create(opts?: { systemPrompt?: string }): Promise<LMSession>;
}

function newApi(): NewLM | null {
  const lm = (globalThis as unknown as { LanguageModel?: NewLM }).LanguageModel;
  return lm && typeof lm.availability === "function" ? lm : null;
}
function oldApi(): OldLM | null {
  const ai = (globalThis as unknown as { ai?: { languageModel?: OldLM } }).ai;
  const lm = ai?.languageModel;
  return lm && typeof lm.capabilities === "function" ? lm : null;
}

async function iterate(
  result: AsyncIterable<string> | ReadableStream<string>,
  onChunk: (delta: string) => void,
): Promise<string> {
  // The streaming API has emitted either deltas or growing snapshots across
  // versions; track the longest-prefix to normalise both into deltas.
  let acc = "";
  const handle = (piece: string) => {
    if (piece.startsWith(acc)) {
      onChunk(piece.slice(acc.length));
      acc = piece;
    } else {
      onChunk(piece);
      acc += piece;
    }
  };
  const asyncIt = (result as AsyncIterable<string>)[Symbol.asyncIterator];
  if (typeof asyncIt === "function") {
    for await (const piece of result as AsyncIterable<string>) handle(piece);
  } else {
    const reader = (result as ReadableStream<string>).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) handle(value);
    }
  }
  return acc;
}

export const geminiNanoProvider: AIProvider = {
  id: "gemini-nano",
  label: "On-device (Gemini Nano)",

  async availability(): Promise<Availability> {
    const nu = newApi();
    if (nu) {
      try {
        return await nu.availability();
      } catch {
        return "unavailable";
      }
    }
    const old = oldApi();
    if (old) {
      try {
        const cap = await old.capabilities();
        if (cap.available === "readily") return "available";
        if (cap.available === "after-download") return "downloadable";
        return "unavailable";
      } catch {
        return "unavailable";
      }
    }
    return "unavailable";
  },

  async run(system: string, user: string, onChunk?: (delta: string) => void): Promise<string> {
    const nu = newApi();
    if (nu) {
      const session = await nu.create({
        initialPrompts: [{ role: "system", content: system }],
      });
      try {
        if (onChunk && session.promptStreaming) {
          return await iterate(session.promptStreaming(user), onChunk);
        }
        return await session.prompt(user);
      } finally {
        session.destroy?.();
      }
    }
    const old = oldApi();
    if (old) {
      const session = await old.create({ systemPrompt: system });
      try {
        const combined = `${system}\n\n---\n\n${user}`;
        if (onChunk && session.promptStreaming) {
          return await iterate(session.promptStreaming(combined), onChunk);
        }
        return await session.prompt(combined);
      } finally {
        session.destroy?.();
      }
    }
    throw new Error("Built-in AI Prompt API is not present.");
  },
};
