// Orchestrates detection → mapping → fill against a Profile, recording enough
// to highlight and undo. DOM-only; the profile is passed in (content scripts
// can't read the extension-origin vault directly).

import { getPath, type Profile } from "../vault/schema";
import { fillField, isFillable, type Fillable } from "./fill";
import { isLongFormTarget } from "./longfields";
import { mapField } from "./mapping";

export interface FilledEntry {
  el: Fillable;
  path: string;
  previous: string;
  value: string;
  wasChecked?: boolean;
}

export interface FillReport {
  forms: number;
  candidates: number;
  filled: number;
  entries: FilledEntry[];
}

// Walk the document plus any open shadow roots, gathering fillable fields.
export function collectFields(root: Document | ShadowRoot, out: Element[] = []): Element[] {
  const fields = root.querySelectorAll("input, textarea, select");
  for (const f of fields) if (isFillable(f)) out.push(f);
  root.querySelectorAll("*").forEach((node) => {
    const sr = (node as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) collectFields(sr, out);
  });
  return out;
}

function currentValue(el: Fillable): { value: string; checked?: boolean } {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    return { value: el.value, checked: el.checked };
  }
  return { value: el.value };
}

// Detect + fill in one pass. Skips fields that already hold a value (so we don't
// stomp user input), unless they're empty.
export function autofill(profile: Profile, doc: Document = document): FillReport {
  const candidates = collectFields(doc);
  const entries: FilledEntry[] = [];

  for (const el of candidates as Fillable[]) {
    // Cover letters, bios and "why this company" belong to the AI panel. Without
    // this, a textarea named `why_company` scores as work.company and gets the
    // employer name pasted into it.
    if (isLongFormTarget(el)) continue;
    const mapping = mapField(el);
    if (!mapping) continue;
    const value = getPath(profile, mapping.path);
    if (value == null || value === "") continue;

    const before = currentValue(el);
    // Don't overwrite a field the user already filled (checkboxes excepted).
    const isCheckable =
      el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
    if (!isCheckable && before.value.trim() !== "") continue;

    if (fillField(el, value)) {
      entries.push({
        el,
        path: mapping.path,
        previous: before.value,
        value,
        wasChecked: before.checked,
      });
    }
  }

  return {
    forms: doc.querySelectorAll("form").length,
    candidates: candidates.length,
    filled: entries.length,
    entries,
  };
}

// Revert a previously applied fill.
export function undoFill(entries: FilledEntry[]): void {
  for (const e of entries) {
    if (
      e.el instanceof HTMLInputElement &&
      (e.el.type === "checkbox" || e.el.type === "radio")
    ) {
      e.el.checked = e.wasChecked ?? false;
    } else {
      fillField(e.el, e.previous);
      if (e.previous === "") {
        // fillField no-ops on empty; clear explicitly via native setter.
        const proto =
          e.el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : e.el instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(e.el, "");
      }
    }
    e.el.dispatchEvent(new Event("input", { bubbles: true }));
    e.el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
