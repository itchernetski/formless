// Capture-from-form: scan the page for fields the user filled by hand and turn
// them into ExtractedFields for the import/merge review. Reuses the same field
// mapper as autofill (reverse direction), skips sensitive fields and anything we
// autofilled ourselves (provenance), and proposes unmapped fields as custom.

import { collectFields } from "./index";
import { isFillable, type Fillable } from "./fill";
import { mapField } from "./mapping";
import { isSensitive } from "./sensitive";
import { labelText } from "./signals";
import type { ExtractedField } from "../import/types";

// Readable value for a field. Skips empties; for select uses the option text;
// for radio uses the checked option's label/value. Returns "" to skip.
function fieldValue(el: Fillable): string {
  if (el instanceof HTMLSelectElement) {
    const opt = el.selectedOptions[0];
    if (!opt || opt.value === "") return "";
    return (opt.textContent || opt.value).trim();
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox") return ""; // booleans aren't useful profile data
    if (type === "radio") {
      if (!el.checked) return "";
      return (el.labels?.[0]?.textContent || el.value || "").trim();
    }
  }
  return el.value.trim();
}

// Turn a field label into a custom.<key> path for unmapped-but-filled fields.
function customPath(el: Element): string | null {
  const raw = (labelText(el) || el.getAttribute("aria-label") || el.getAttribute("name") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return raw ? `custom.${raw.slice(0, 40)}` : null;
}

export interface CaptureOptions {
  host: string;
  // Values we autofilled, by element — used to skip fields the user didn't touch.
  autofilled?: Map<Element, string>;
}

export function captureForm(
  root: Document = document,
  opts: CaptureOptions = { host: "" },
): ExtractedField[] {
  const source = `form:${opts.host}`;
  const out: ExtractedField[] = [];
  const seen = new Set<string>();

  for (const el of collectFields(root) as Fillable[]) {
    if (!isFillable(el) || isSensitive(el)) continue;
    const value = fieldValue(el);
    if (!value) continue;
    // Provenance: skip fields we filled that the user left unchanged.
    const filled = opts.autofilled?.get(el);
    if (filled != null && filled.trim() === value) continue;

    const mapping = mapField(el);
    const path = mapping ? mapping.path : customPath(el);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, value, source });
  }
  return out;
}
