// Diff/merge extracted fields against an existing profile, producing a review
// list the UI renders with checkboxes. Shared by CV/LinkedIn import (Phase 3)
// and capture-from-form (Phase 3.5).

import { getPath, setPath, type Profile } from "../vault/schema";
import { pathLabel } from "../shared/labels";
import type { ExtractedField } from "./types";

export type DiffStatus = "new" | "update" | "same";

export interface DiffEntry {
  path: string;
  label: string;
  current: string; // value already in the profile ("" if none)
  incoming: string; // value from the source (editable in the UI)
  status: DiffStatus;
  apply: boolean; // default selection: on for new/update, off for same
  source: string;
}

const clean = (s: string): string => s.replace(/\s+/g, " ").trim();

// Build the review list. Blank incoming values are dropped; identical values are
// marked "same" and unchecked by default. Last write wins per path within input.
export function diffProfile(profile: Profile, fields: ExtractedField[]): DiffEntry[] {
  const byPath = new Map<string, ExtractedField>();
  for (const f of fields) {
    const value = clean(f.value);
    if (!value) continue;
    byPath.set(f.path, { ...f, value });
  }

  const entries: DiffEntry[] = [];
  for (const [path, f] of byPath) {
    const current = clean(getPath(profile, path) ?? "");
    const incoming = f.value;
    let status: DiffStatus;
    if (current === "") status = "new";
    else if (current.toLowerCase() === incoming.toLowerCase()) status = "same";
    else status = "update";
    entries.push({
      path,
      label: pathLabel(path),
      current,
      incoming,
      status,
      apply: status !== "same",
      source: f.source,
    });
  }

  // Stable, human order: new first, then updates, then same.
  const rank: Record<DiffStatus, number> = { new: 0, update: 1, same: 2 };
  entries.sort((a, b) => rank[a.status] - rank[b.status] || a.label.localeCompare(b.label));
  return entries;
}

// Apply the checked entries (using their possibly-edited `incoming` value).
export function applyDiff(profile: Profile, entries: DiffEntry[]): Profile {
  let next = profile;
  for (const e of entries) {
    if (e.apply && clean(e.incoming)) next = setPath(next, e.path, clean(e.incoming));
  }
  return next;
}
