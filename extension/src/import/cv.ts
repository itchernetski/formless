// Turn raw CV text into structured profile fields via the AI layer. The model
// is asked for strict JSON keyed by profile paths; parsing is defensive (strips
// code fences, ignores unknown keys, coerces to strings).

import { runPrompt } from "../ai";
import type { ExtractedField } from "./types";

// Paths we ask the model to extract, with hints. Kept in sync with the schema.
const CV_PATHS: Array<[string, string]> = [
  ["identity.firstName", "given name"],
  ["identity.lastName", "family name"],
  ["identity.fullName", "full name"],
  ["contact.email", "email address"],
  ["contact.phone", "phone number"],
  ["contact.linkedin", "LinkedIn URL"],
  ["contact.website", "personal website or portfolio URL"],
  ["address.city", "city"],
  ["address.state", "state or province"],
  ["address.country", "country"],
  ["work.company", "most recent employer"],
  ["work.jobTitle", "most recent job title"],
  ["work.yearsExperience", "total years of professional experience (number only)"],
  ["education.school", "most recent school / university"],
  ["education.degree", "highest degree"],
  ["education.fieldOfStudy", "field of study / major"],
  ["education.graduationYear", "graduation year"],
];

const ALLOWED = new Set(CV_PATHS.map(([p]) => p));

export const CV_SYSTEM =
  "You extract structured data from a CV/resume. Return ONLY a JSON object — no prose, no code fences. " +
  "Use exactly these keys when the information is present, omit keys you cannot find, and never invent values.";

export function buildCvUserPrompt(text: string): string {
  const keyList = CV_PATHS.map(([p, hint]) => `  "${p}": ${hint}`).join("\n");
  return (
    `Extract these fields:\n{\n${keyList}\n}\n\n` +
    `Also add a "custom.summary" key with a one-sentence professional summary, and ` +
    `"custom.skills" with a comma-separated skills list if present.\n\n` +
    `CV text:\n"""\n${text.slice(0, 12000)}\n"""`
  );
}

// Defensively parse the model's reply into ExtractedField[].
export function parseCvJson(modelOutput: string): ExtractedField[] {
  const fenced = modelOutput.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return [];
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return [];
  }
  const out: ExtractedField[] = [];
  for (const [key, raw] of Object.entries(obj)) {
    if (raw == null) continue;
    const value = String(raw).trim();
    if (!value) continue;
    if (ALLOWED.has(key) || key.startsWith("custom.")) {
      out.push({ path: key, value, source: "cv" });
    }
  }
  return out;
}

// End-to-end: CV text → extracted fields (runs the local/paid model).
export async function structureCv(text: string): Promise<ExtractedField[]> {
  const output = await runPrompt(CV_SYSTEM, buildCvUserPrompt(text));
  return parseCvJson(output);
}
