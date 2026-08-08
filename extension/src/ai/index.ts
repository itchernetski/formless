// AI facade. Picks the best available provider and runs generation through it.
// Phase 2 wires only local (free) providers; Phase 4.5 will register the proxy
// provider ahead of these so paid users route to Claude. The provider list is
// injectable so tests can supply fakes.

import { geminiNanoProvider } from "./local/gemini-nano";
import { webllmProvider } from "./local/webllm";
import { buildPrompt } from "./prompts";
import { NoProviderError, type AIProvider, type Availability, type GenRequest } from "./types";

export * from "./types";

// Order = preference. Built-in AI first (fast, no download), WebGPU fallback next.
const DEFAULT_PROVIDERS: AIProvider[] = [geminiNanoProvider, webllmProvider];

export interface ResolvedProvider {
  provider: AIProvider;
  availability: Availability;
}

// First provider that reports "available". If none is ready but one is
// downloadable, return that (caller can trigger the download by generating).
export async function resolveProvider(
  providers: AIProvider[] = DEFAULT_PROVIDERS,
): Promise<ResolvedProvider | null> {
  let downloadable: ResolvedProvider | null = null;
  for (const provider of providers) {
    const availability = await provider.availability();
    if (availability === "available") return { provider, availability };
    if ((availability === "downloadable" || availability === "downloading") && !downloadable) {
      downloadable = { provider, availability };
    }
  }
  return downloadable;
}

// True if any provider can (eventually) serve generation on this device.
export async function isGenerationAvailable(
  providers: AIProvider[] = DEFAULT_PROVIDERS,
): Promise<boolean> {
  return (await resolveProvider(providers)) !== null;
}

// Raw generation: pick a provider and run a system+user prompt. Throws
// NoProviderError when nothing can serve the request (graceful degradation).
export async function runPrompt(
  system: string,
  user: string,
  onChunk?: (delta: string) => void,
  providers: AIProvider[] = DEFAULT_PROVIDERS,
): Promise<string> {
  const resolved = await resolveProvider(providers);
  if (!resolved) throw new NoProviderError();
  return resolved.provider.run(system, user, onChunk);
}

// Cover-letter / bio generation, built on runPrompt via the prompt builder.
export async function generate(
  req: GenRequest,
  onChunk?: (delta: string) => void,
  providers: AIProvider[] = DEFAULT_PROVIDERS,
): Promise<string> {
  const { system, user } = buildPrompt(req);
  return runPrompt(system, user, onChunk, providers);
}
