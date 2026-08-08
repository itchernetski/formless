import { useEffect, useRef, useState } from "react";
import {
  createProfile,
  enableEncryption,
  getSettings,
  isEncrypted,
  isLocked,
  listProfiles,
  removeProfile,
  saveProfile,
  setActiveProfile,
  unlock,
  updateSettings,
  type Profile,
  type Settings,
} from "../vault";
import { exportProfiles, importProfiles, serializeExport } from "../vault/io";
import { extractPdfText } from "../import/pdf";
import { structureCv } from "../import/cv";
import { parseLinkedInExport } from "../import/linkedin";
import { applyDiff, diffProfile, type DiffEntry } from "../import/merge";
import { PENDING_CAPTURE_KEY, type PendingCapture } from "../shared/messaging";
import { helpUrl } from "../shared/help";
import { ProfileEditor } from "./ProfileEditor";
import { ImportReview } from "./ImportReview";
import { Onboarding } from "./Onboarding";

type Phase = "loading" | "onboarding" | "locked" | "ready";

export function Options() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [encPassword, setEncPassword] = useState("");
  const [whitelistText, setWhitelistText] = useState("");
  const [toast, setToast] = useState("");
  const [encrypted, setEncrypted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);
  const liRef = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<{ title: string; entries: DiffEntry[] } | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Profile | null>(null);

  async function load() {
    const enc = await isEncrypted();
    setEncrypted(enc);
    if (enc && (await isLocked())) {
      setPhase("locked");
      return;
    }
    const list = await listProfiles();
    if (list.length === 0 || location.hash === "#onboarding") {
      setPhase("onboarding");
      return;
    }
    const s = await getSettings();
    setSettings(s);
    setWhitelistText(s.whitelist.join("\n"));
    setProfiles(list);
    const active = list.find((p) => p.id === s.activeProfileId) ?? list[0];
    setDraft(active);
    setPhase("ready");
    if (location.hash === "#capture") await loadPendingCapture(active);
  }

  // Pull a capture handed over from the popup and open its review.
  async function loadPendingCapture(active: Profile) {
    const stored = (await chrome.storage.session.get(PENDING_CAPTURE_KEY)) as {
      [PENDING_CAPTURE_KEY]?: PendingCapture;
    };
    const pending = stored[PENDING_CAPTURE_KEY];
    await chrome.storage.session.remove(PENDING_CAPTURE_KEY);
    location.hash = "";
    if (pending?.fields.length) {
      setReview({
        title: `Save fields from ${pending.host || "this page"}`,
        entries: diffProfile(active, pending.fields),
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function doUnlock() {
    if (await unlock(password)) {
      setPassword("");
      await load();
    } else flash("Wrong password");
  }

  async function save() {
    if (!draft) return;
    const saved = await saveProfile(draft);
    setDraft(saved);
    setProfiles(await listProfiles());
    flash("Saved");
  }

  async function selectProfile(id: string) {
    if (draft) await saveProfile(draft);
    await setActiveProfile(id);
    await load();
  }

  async function addProfile() {
    if (draft) await saveProfile(draft);
    const p = await createProfile("New profile");
    await setActiveProfile(p.id);
    await load();
  }

  async function deleteActive() {
    if (!draft) return;
    if (!confirm(`Delete profile "${draft.label}"?`)) return;
    await removeProfile(draft.id);
    await load();
  }

  async function saveWhitelist() {
    const whitelist = whitelistText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const s = await updateSettings({ whitelist });
    setSettings(s);
    flash("Whitelist saved");
  }

  async function turnOnEncryption() {
    if (encPassword.trim().length < 6) {
      flash("Password must be ≥ 6 characters");
      return;
    }
    if (draft) await saveProfile(draft);
    await enableEncryption(encPassword);
    setEncPassword("");
    setEncrypted(true);
    flash("Encryption enabled");
  }

  async function doExport() {
    if (draft) await saveProfile(draft);
    const data = serializeExport(await exportProfiles());
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "autofill-profiles.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (cvRef.current) cvRef.current.value = "";
    if (!file || !draft) return;
    flash("Reading CV…");
    try {
      const text = await extractPdfText(await file.arrayBuffer());
      flash("Structuring with AI…");
      const fields = await structureCv(text);
      setReview({ title: "Import from CV", entries: diffProfile(draft, fields) });
    } catch (err) {
      flash(`CV import failed: ${String(err)}`);
    }
  }

  async function importLinkedIn(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (liRef.current) liRef.current.value = "";
    if (!files.length || !draft) return;
    try {
      const texts = await Promise.all(files.map((f) => f.text()));
      const fields = parseLinkedInExport(texts);
      setReview({ title: "Import from LinkedIn", entries: diffProfile(draft, fields) });
    } catch (err) {
      flash(`LinkedIn import failed: ${String(err)}`);
    }
  }

  async function applyReview(entries: DiffEntry[]) {
    if (!draft) return;
    const snapshot = draft; // for one-step undo of this capture/import
    const updated = applyDiff(draft, entries);
    await saveProfile(updated);
    setReview(null);
    await load();
    setUndoSnapshot(snapshot);
    flash("Profile updated");
  }

  async function undoLastApply() {
    if (!undoSnapshot) return;
    await saveProfile(undoSnapshot);
    setUndoSnapshot(null);
    await load();
    flash("Reverted");
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProfiles(await file.text());
      await load();
      flash("Profiles imported");
    } catch (err) {
      flash(`Import failed: ${String(err)}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  if (phase === "loading") return <div className="options">Loading…</div>;

  if (phase === "onboarding") {
    return <Onboarding onDone={() => { location.hash = ""; load(); }} />;
  }

  if (phase === "locked") {
    return (
      <div className="onboard">
        <h1>Vault locked</h1>
        <div className="card">
          <label>Master password</label>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doUnlock()}
          />
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="primary" onClick={doUnlock}>
              Unlock
            </button>
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="options">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Formless settings</h1>
        <span className="row">
          {toast && <span className="toast">{toast}</span>}
          <a className="btn-link" href={helpUrl()} target="_blank" rel="noreferrer">
            Help
          </a>
        </span>
      </div>

      {undoSnapshot && (
        <div className="section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Profile updated from the last import/capture.</span>
          <button onClick={undoLastApply}>Undo</button>
        </div>
      )}

      <div className="section">
        <h2>Profiles</h2>
        <div className="toolbar">
          <select
            value={draft?.id ?? ""}
            onChange={(e) => selectProfile(e.target.value)}
            style={{ maxWidth: 260 }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button onClick={addProfile}>+ New</button>
          <button className="danger" onClick={deleteActive} disabled={profiles.length <= 1}>
            Delete
          </button>
        </div>
      </div>

      {draft && <ProfileEditor profile={draft} onChange={setDraft} />}

      <div className="toolbar" style={{ position: "sticky", bottom: 0, padding: "12px 0", background: "var(--bg)" }}>
        <button className="primary" onClick={save}>
          Save profile
        </button>
      </div>

      <div className="section">
        <h2>Import data</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Fill your profile in minutes. Imports go into <strong>{draft?.label}</strong> and you
          review every field before it's saved.
        </p>
        <div className="toolbar">
          <button onClick={() => cvRef.current?.click()}>Import from CV (PDF)</button>
          <input
            ref={cvRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={importCv}
          />
          <button onClick={() => liRef.current?.click()}>Import from LinkedIn (CSV)</button>
          <input
            ref={liRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            style={{ display: "none" }}
            onChange={importLinkedIn}
          />
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          CV is parsed locally and structured by the on-device AI. For LinkedIn, download your data
          export, unzip it, and select <code>Profile.csv</code> / <code>Positions.csv</code> /{" "}
          <code>Email Addresses.csv</code>.
        </p>
      </div>

      <div className="section">
        <h2>Site whitelist</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          One host per line (e.g. <code>linkedin.com</code> or <code>*.greenhouse.io</code>).
          Empty = run everywhere.
        </p>
        <textarea
          rows={4}
          value={whitelistText}
          onChange={(e) => setWhitelistText(e.target.value)}
        />
        <div className="toolbar" style={{ marginTop: 10 }}>
          <button onClick={saveWhitelist}>Save whitelist</button>
        </div>
      </div>

      <div className="section">
        <h2>Encryption</h2>
        {encrypted ? (
          <p className="muted" style={{ margin: 0 }}>
            ✓ Your vault is encrypted at rest with AES-GCM.
          </p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Protect your profile with a master password (AES-GCM, PBKDF2). If you
              forget it, the data can't be recovered.
            </p>
            <div className="toolbar">
              <input
                type="password"
                placeholder="Master password"
                value={encPassword}
                onChange={(e) => setEncPassword(e.target.value)}
                style={{ maxWidth: 260 }}
              />
              <button onClick={turnOnEncryption}>Enable encryption</button>
            </div>
          </>
        )}
      </div>

      <div className="section">
        <h2>Backup</h2>
        <div className="toolbar">
          <button onClick={doExport}>Export profiles (JSON)</button>
          <button onClick={() => fileRef.current?.click()}>Import profiles</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={doImport}
          />
        </div>
        <p className="muted">Export is plain JSON. Keep the file somewhere safe.</p>
      </div>

      {review && (
        <ImportReview
          title={review.title}
          entries={review.entries}
          onCancel={() => setReview(null)}
          onApply={applyReview}
        />
      )}
    </div>
  );
}
