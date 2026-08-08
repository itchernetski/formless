// Prompt construction. Pure functions (no I/O) so they're cheap to unit-test and
// shared verbatim by the local model and the future proxy.

import { getPath, type Profile } from "../vault/schema";
import type { GenRequest, GenType, Length, Tone } from "./types";

const TYPE_LABEL: Record<GenType, string> = {
  coverLetter: "a cover letter",
  bio: "a short professional bio / 'about yourself' statement",
  whyCompany: "a 'why do you want to work here' answer",
};

const LENGTH_GUIDE: Record<Length, string> = {
  short: "About 60-90 words. Two or three sentences.",
  medium: "About 150-200 words. One or two short paragraphs.",
  long: "About 300-350 words. Three short paragraphs.",
};

const TONE_GUIDE: Record<Tone, string> = {
  formal: "Professional and polished. No slang, no emoji.",
  casual: "Warm and conversational, but still professional. No emoji.",
};

// Pull the handful of profile fields worth giving the model, skipping blanks so
// we never leak empty noise (and, in the proxy tier, never send more than needed).
const RELEVANT_PATHS: Array<[string, string]> = [
  ["Name", "identity.fullName"],
  ["Current role", "work.jobTitle"],
  ["Current company", "work.company"],
  ["Years of experience", "work.yearsExperience"],
  ["Education", "education.degree"],
  ["Field of study", "education.fieldOfStudy"],
  ["School", "education.school"],
];

export function profileSummary(profile: Profile): string {
  const lines: string[] = [];
  for (const [label, path] of RELEVANT_PATHS) {
    const v = getPath(profile, path);
    if (v && v.trim()) lines.push(`${label}: ${v.trim()}`);
  }
  // Surface free-form custom fields (skills, summary, etc.) — high signal for letters.
  for (const [k, v] of Object.entries(profile.custom)) {
    if (v && v.trim()) lines.push(`${k}: ${v.trim()}`);
  }
  return lines.join("\n");
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

export function buildPrompt(req: GenRequest): BuiltPrompt {
  const { context, profile, options } = req;
  const system = [
    `You write ${TYPE_LABEL[options.type]} for a job application.`,
    TONE_GUIDE[options.tone],
    LENGTH_GUIDE[options.length],
    "Write in the first person as the applicant.",
    "Use only facts provided about the applicant — never invent employers, dates, or achievements.",
    "Return only the text itself, with no preamble, headers, or sign-off placeholders like [Your Name].",
  ].join(" ");

  const parts: string[] = [];
  if (context.jobTitle) parts.push(`Role: ${context.jobTitle}`);
  if (context.company) parts.push(`Company: ${context.company}`);
  if (context.description) {
    parts.push(`Job description:\n${context.description.slice(0, 2000)}`);
  }
  const summary = profileSummary(profile);
  if (summary) parts.push(`About the applicant:\n${summary}`);

  const user =
    parts.join("\n\n") ||
    "Write a general application statement; no specific role context is available.";

  return { system, user };
}

// Single string for engines (like Gemini Nano's Prompt API) that take one prompt.
export function flattenPrompt(p: BuiltPrompt): string {
  return `${p.system}\n\n---\n\n${p.user}`;
}
