// AI layer contracts. A single `AIProvider` interface backs both the free local
// model (Phase 2) and the future paid proxy (Phase 4.5), so the rest of the app
// never branches on which engine is running.

import type { Profile } from "../vault/schema";

// What kind of long-form text the user wants generated.
export type GenType = "coverLetter" | "bio" | "whyCompany";

export type Tone = "formal" | "casual";
export type Length = "short" | "medium" | "long";

// Context scraped from the page the user is applying on.
export interface PageContext {
  jobTitle: string;
  company: string;
  description: string;
  pageTitle: string;
  url: string;
}

export function emptyContext(): PageContext {
  return { jobTitle: "", company: "", description: "", pageTitle: "", url: "" };
}

export interface GenOptions {
  type: GenType;
  tone: Tone;
  length: Length;
}

export interface GenRequest {
  context: PageContext;
  profile: Profile;
  options: GenOptions;
}

// Mirrors the Chrome Built-in AI availability states.
export type Availability = "available" | "downloadable" | "downloading" | "unavailable";

// Thrown when no provider can serve a request — UI turns this into a
// "try the paid tier" hint (graceful degradation).
export class NoProviderError extends Error {
  constructor(message = "No AI model available on this device.") {
    super(message);
    this.name = "NoProviderError";
  }
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  availability(): Promise<Availability>;
  // The single generation primitive: a system instruction + a user prompt.
  // Resolves with the full text; if `onChunk` is given it's called with
  // incremental deltas as they stream in. Both cover-letter generation and
  // structured extraction (CV import) are built on this in the facade.
  run(system: string, user: string, onChunk?: (delta: string) => void): Promise<string>;
}
