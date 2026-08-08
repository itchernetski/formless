// Extract identifying signals from a form field, kept separate by source so the
// mapper can weight them (autocomplete is far more reliable than a placeholder).

export interface FieldSignals {
  autocomplete: string;
  name: string;
  id: string;
  placeholder: string;
  aria: string;
  label: string;
}

// Text of a <label> associated with the element, via for=, wrapping, or
// aria-labelledby. Works across shadow roots since we query the element's root.
export function labelText(el: Element): string {
  const id = el.getAttribute("id");
  const root = el.getRootNode() as Document | ShadowRoot;
  if (id && "querySelector" in root) {
    const esc =
      typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
    const lbl = root.querySelector(`label[for="${esc}"]`);
    if (lbl?.textContent) return lbl.textContent;
  }
  const wrap = (el as HTMLElement).closest?.("label");
  if (wrap?.textContent) return wrap.textContent;
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby && "getElementById" in root) {
    const parts = labelledby
      .split(/\s+/)
      .map((ref) => (root as Document).getElementById(ref)?.textContent ?? "")
      .join(" ");
    if (parts.trim()) return parts;
  }
  return "";
}

const norm = (s: string | null): string => (s ?? "").trim().toLowerCase();

export function extractSignals(el: Element): FieldSignals {
  return {
    autocomplete: norm(el.getAttribute("autocomplete")),
    name: norm(el.getAttribute("name")),
    id: norm(el.getAttribute("id")),
    placeholder: norm(el.getAttribute("placeholder")),
    aria: norm(el.getAttribute("aria-label")),
    label: norm(labelText(el)),
  };
}

// Match a token against a haystack at a word-ish boundary so "name" does not
// match "username" and "zip" does not match "zipline".
export function tokenHit(haystack: string, token: string): boolean {
  if (!haystack || !token) return false;
  const t = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(haystack);
}
