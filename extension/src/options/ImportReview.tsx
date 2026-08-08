// Review screen for any incoming data (CV / LinkedIn import, or captured form
// values). Shows new/updated/same per field with checkboxes and editable values
// before anything touches the vault.

import { useState } from "react";
import type { DiffEntry } from "../import/merge";

const STATUS_LABEL: Record<DiffEntry["status"], string> = {
  new: "New",
  update: "Update",
  same: "Unchanged",
};
const STATUS_COLOR: Record<DiffEntry["status"], string> = {
  new: "#16a34a",
  update: "#d97706",
  same: "#6b7280",
};

export function ImportReview({
  title,
  entries: initial,
  onCancel,
  onApply,
}: {
  title: string;
  entries: DiffEntry[];
  onCancel: () => void;
  onApply: (entries: DiffEntry[]) => void;
}) {
  const [entries, setEntries] = useState<DiffEntry[]>(initial);

  const update = (i: number, patch: Partial<DiffEntry>) =>
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const selectedCount = entries.filter((e) => e.apply).length;

  if (entries.length === 0) {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>{title}</h2>
          <p className="muted">No new fields were found to import.</p>
          <div className="toolbar">
            <button onClick={onCancel}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Review what will be written to your profile. Untick anything you don't want.
        </p>
        <div className="review-list">
          {entries.map((e, i) => (
            <div className="review-row" key={e.path}>
              <input
                type="checkbox"
                checked={e.apply}
                onChange={(ev) => update(i, { apply: ev.target.checked })}
              />
              <div style={{ flex: 1 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{e.label}</strong>
                  <span style={{ color: STATUS_COLOR[e.status], fontSize: 12 }}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </div>
                {e.status === "update" && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    was: {e.current}
                  </div>
                )}
                <input
                  type="text"
                  value={e.incoming}
                  onChange={(ev) => update(i, { incoming: ev.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="primary" disabled={selectedCount === 0} onClick={() => onApply(entries)}>
            Apply {selectedCount} field{selectedCount === 1 ? "" : "s"}
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
