// Detect long free-text inputs (textarea, contenteditable) that are candidates
// for AI generation, and guess which kind of content they want from their label.

import { labelText } from "./signals";
import type { GenType } from "../ai/types";

export type LongFieldKind = GenType | "generic";

export interface LongField {
  el: HTMLTextAreaElement | HTMLElement; // textarea or contenteditable host
  kind: LongFieldKind;
  label: string; // human-readable, for the panel's field picker
}

// Ordered most-specific first so "why this company" beats a generic "cover letter".
const KIND_TOKENS: Array<[GenType, RegExp]> = [
  ["whyCompany", /\bwhy\b.*\b(company|us|join|work|role|position|interest)\b|motivation|why do you/i],
  ["coverLetter", /cover\s*letter|covering letter|letter of (interest|motivation)/i],
  ["bio", /\b(bio|about (your\s*self|you|me)|summary|introduce yourself|tell us about)\b/i],
];

export function classifyLongField(label: string): LongFieldKind {
  for (const [kind, re] of KIND_TOKENS) if (re.test(label)) return kind;
  return "generic";
}

function isContentEditable(el: Element): el is HTMLElement {
  const h = el as HTMLElement;
  return h.isContentEditable === true || h.getAttribute?.("contenteditable") === "true";
}

// Everything that hints at what the field wants, concatenated for matching.
// Deliberately noisy — good for classification, unreadable as a caption.
function signalsFor(el: Element): string {
  return [
    el.getAttribute("name") ?? "",
    el.getAttribute("id") ?? "",
    el.getAttribute("placeholder") ?? "",
    el.getAttribute("aria-label") ?? "",
    labelText(el),
  ]
    .join(" ")
    .trim();
}

// The one signal a human would call the field's name, cleaned up for display in
// the panel's field picker. Falls back down the list when the page is sparse.
function displayLabel(el: Element): string {
  const candidate =
    labelText(el) ||
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    el.getAttribute("name") ||
    "";
  // Collapse whitespace and drop the required-marker punctuation labels carry.
  return candidate.replace(/\s+/g, " ").replace(/[\s*:]+$/, "").trim();
}

// True when a field is a target for AI generation rather than a profile value.
// Autofill consults this so a textarea whose id merely contains "company" isn't
// stuffed with the user's employer name.
export function isLongFormTarget(el: Element): boolean {
  if (!(el instanceof HTMLTextAreaElement) && !isContentEditable(el)) return false;
  return classifyLongField(signalsFor(el)) !== "generic";
}

function collect(root: Document | ShadowRoot, out: LongField[]): void {
  const nodes = root.querySelectorAll("textarea, [contenteditable]");
  for (const node of nodes) {
    const isTextarea = node instanceof HTMLTextAreaElement;
    if (!isTextarea && !isContentEditable(node)) continue;
    if (isTextarea && (node.disabled || node.readOnly)) continue;
    out.push({
      el: node as HTMLTextAreaElement | HTMLElement,
      kind: classifyLongField(signalsFor(node)),
      label: displayLabel(node),
    });
  }
  // Descend into open shadow roots, matching the detection engine's traversal.
  root.querySelectorAll("*").forEach((n) => {
    const sr = (n as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) collect(sr, out);
  });
}

export function collectLongFields(root: Document | ShadowRoot = document): LongField[] {
  const out: LongField[] = [];
  collect(root, out);
  return out;
}
