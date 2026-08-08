import { describe, expect, it } from "vitest";
import { generate, isGenerationAvailable, resolveProvider } from "../src/ai";
import { NoProviderError, type AIProvider, type Availability, type GenRequest } from "../src/ai/types";
import { emptyContext } from "../src/ai/types";
import { emptyProfile } from "../src/vault/schema";

function fake(id: string, availability: Availability, text = `out:${id}`): AIProvider {
  return {
    id,
    label: id,
    availability: async () => availability,
    run: async (_system: string, _user: string, onChunk?: (d: string) => void) => {
      onChunk?.(text);
      return text;
    },
  };
}

const req: GenRequest = {
  context: emptyContext(),
  profile: emptyProfile("p"),
  options: { type: "coverLetter", tone: "formal", length: "medium" },
};

describe("provider routing", () => {
  it("picks the first available provider in preference order", async () => {
    const resolved = await resolveProvider([
      fake("a", "unavailable"),
      fake("b", "available"),
      fake("c", "available"),
    ]);
    expect(resolved?.provider.id).toBe("b");
  });

  it("falls back to a downloadable provider when none are ready", async () => {
    const resolved = await resolveProvider([
      fake("a", "unavailable"),
      fake("b", "downloadable"),
    ]);
    expect(resolved?.provider.id).toBe("b");
    expect(resolved?.availability).toBe("downloadable");
  });

  it("reports no availability when every provider is unavailable", async () => {
    expect(await resolveProvider([fake("a", "unavailable")])).toBeNull();
    expect(await isGenerationAvailable([fake("a", "unavailable")])).toBe(false);
  });

  it("generate() streams from the chosen provider", async () => {
    const chunks: string[] = [];
    const text = await generate(req, (d) => chunks.push(d), [fake("local", "available", "hello")]);
    expect(text).toBe("hello");
    expect(chunks).toEqual(["hello"]);
  });

  it("generate() throws NoProviderError for graceful degradation", async () => {
    await expect(generate(req, undefined, [fake("a", "unavailable")])).rejects.toBeInstanceOf(
      NoProviderError,
    );
  });
});
