// Typed message contracts between extension contexts.

import type { Profile } from "../vault/schema";
import type { ExtractedField } from "../import/types";

// popup → content script (active tab)
export interface FillRequest {
  type: "AUTOFILL_FILL";
  profile: Profile;
}
export interface UndoRequest {
  type: "AUTOFILL_UNDO";
}
export interface DetectRequest {
  type: "AUTOFILL_DETECT";
}
// popup → content: open the AI generation panel for long-text fields on the page.
export interface GenerateRequest {
  type: "AUTOFILL_GENERATE";
  profile: Profile;
}
// popup → content: scan the page for user-entered values to save into the profile.
export interface CaptureRequest {
  type: "AUTOFILL_CAPTURE";
}

export type ContentMessage =
  | FillRequest
  | UndoRequest
  | DetectRequest
  | GenerateRequest
  | CaptureRequest;

export interface FillResponse {
  forms: number;
  candidates: number;
  filled: number;
  longFields?: number; // count of generation-eligible fields (for AUTOFILL_GENERATE/DETECT)
  captured?: ExtractedField[]; // user-entered fields (for AUTOFILL_CAPTURE)
  host?: string;
  error?: string;
}

// Stashed in chrome.storage.session to hand a capture from popup → options review.
export const PENDING_CAPTURE_KEY = "pending_capture";
export interface PendingCapture {
  host: string;
  fields: ExtractedField[];
}

export function isContentMessage(m: unknown): m is ContentMessage {
  return (
    !!m &&
    typeof m === "object" &&
    typeof (m as { type?: unknown }).type === "string" &&
    (m as { type: string }).type.startsWith("AUTOFILL_")
  );
}

// Host of a tab URL, for whitelist checks. Returns "" for non-http(s) pages.
export function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.protocol.startsWith("http") ? u.hostname : "";
  } catch {
    return "";
  }
}

// True if `host` matches any pattern in the whitelist. Empty list = allow all.
// Patterns are bare hosts; a leading "*." matches subdomains.
export function hostAllowed(host: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true;
  return whitelist.some((p) => {
    const pat = p.trim().toLowerCase();
    if (!pat) return false;
    if (pat.startsWith("*.")) {
      const base = pat.slice(2);
      return host === base || host.endsWith("." + base);
    }
    return host === pat;
  });
}
