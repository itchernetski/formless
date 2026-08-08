// Detect long free-text inputs (textarea, contenteditable) that are candidates
// for AI generation, and guess which kind of content they want from their label.

import { labelText } from "./signals";
import type { GenType } from "../ai/types";

export type LongFieldKind = GenType | "generic";

export interface LongField {
  el: HTMLTextAreaElement | HTMLElement; // textarea or contenteditable host
  kind: LongFieldKind;
  label: string;
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

function collect(root: Document | ShadowRoot, out: LongField[]): void {
  const nodes = root.querySelectorAll("textarea, [contenteditable]");
  for (const node of nodes) {
    const isTextarea = node instanceof HTMLTextAreaElement;
    if (!isTextarea && !isContentEditable(node)) continue;
    if (isTextarea && (node.disabled || node.readOnly)) continue;
    const label = signalsFor(node);
    out.push({
      el: node as HTMLTextAreaElement | HTMLElement,
      kind: classifyLongField(label),
      label,
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
