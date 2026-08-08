import { useEffect, useState } from "react";
import {
  getActiveProfile,
  getSettings,
  isLocked,
  listProfiles,
  setActiveProfile,
  unlock,
  updateSettings,
  type Profile,
} from "../vault";
import {
  hostAllowed,
  hostOf,
  PENDING_CAPTURE_KEY,
  type FillResponse,
  type PendingCapture,
} from "../shared/messaging";
import { openHelp } from "../shared/help";

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function send(tabId: number, msg: object): Promise<FillResponse> {
  return new Promise((res) => {
    chrome.tabs.sendMessage(tabId, msg, (r: FillResponse) => {
      if (chrome.runtime.lastError) {
        res({ forms: 0, candidates: 0, filled: 0, error: chrome.runtime.lastError.message });
      } else res(r);
    });
  });
}

export function Popup() {
  const [enabled, setEnabled] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [host, setHost] = useState("");
  const [allowed, setAllowed] = useState(true);

  async function refresh() {
    const settings = await getSettings();
    setEnabled(settings.enabled);
    const lck = await isLocked();
    setLocked(lck);
    if (!lck) {
      setProfile(await getActiveProfile());
      setProfiles(await listProfiles());
    }
    const tab = await activeTab();
    const h = hostOf(tab?.url);
    setHost(h);
    setAllowed(hostAllowed(h, settings.whitelist));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    await updateSettings({ enabled: next });
  }

  // Switch which profile fill/generate/capture use, without opening Options.
  async function switchProfile(id: string) {
    if (id === profile?.id) return;
    await setActiveProfile(id);
    const next = profiles.find((p) => p.id === id) ?? null;
    setProfile(next);
    setStatus(next ? `Switched to ${next.label}` : "");
  }

  async function doUnlock() {
    if (await unlock(password)) {
      setPassword("");
      await refresh();
    } else {
      setStatus("Wrong password");
    }
  }

  async function fill() {
    setStatus("");
    const tab = await activeTab();
    if (!tab?.id) return;
    if (!profile) {
      setStatus("No profile — open Settings");
      return;
    }
    const r = await send(tab.id, { type: "AUTOFILL_FILL", profile });
    if (r.error) setStatus("Can't run here (try a normal web page)");
    else setStatus(`Filled ${r.filled} of ${r.candidates} fields`);
  }

  async function undo() {
    const tab = await activeTab();
    if (tab?.id) await send(tab.id, { type: "AUTOFILL_UNDO" });
    setStatus("Reverted");
  }

  async function generate() {
    setStatus("");
    const tab = await activeTab();
    if (!tab?.id || !profile) return;
    const r = await send(tab.id, { type: "AUTOFILL_GENERATE", profile });
    if (r.error) setStatus("Can't run here (try a normal web page)");
    else if (!r.longFields) setStatus("No long-text fields found on this page");
    else {
      setStatus("Opened the AI panel on the page");
      window.close();
    }
  }

  async function capture() {
    setStatus("");
    const tab = await activeTab();
    if (!tab?.id || !profile) return;
    const r = await send(tab.id, { type: "AUTOFILL_CAPTURE" });
    if (r.error) {
      setStatus("Can't run here (try a normal web page)");
      return;
    }
    if (!r.captured?.length) {
      setStatus("No new field values to save");
      return;
    }
    const pending: PendingCapture = { host: r.host ?? "", fields: r.captured };
    await chrome.storage.session.set({ [PENDING_CAPTURE_KEY]: pending });
    await chrome.tabs.create({ url: chrome.runtime.getURL("options.html#capture") });
    window.close();
  }

  const openOptions = () => chrome.runtime.openOptionsPage();
  const help = async () => {
    await openHelp();
    window.close();
  };

  return (
    <div className="popup">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Formless</h1>
        <button onClick={toggleEnabled}>{enabled ? "On" : "Off"}</button>
      </div>
      <div className="status muted">{host || "this page"}</div>

      {locked ? (
        <div style={{ marginTop: 12 }}>
          <label>Unlock with master password</label>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doUnlock()}
          />
          <div className="actions">
            <button className="primary" onClick={doUnlock}>
              Unlock
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 10 }}>
            {profiles.length > 1 ? (
              <>
                <label htmlFor="profile-select">Profile</label>
                <select
                  id="profile-select"
                  aria-label="Active profile"
                  value={profile?.id ?? ""}
                  onChange={(e) => switchProfile(e.target.value)}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </>
            ) : profile ? (
              <span className="pill">{profile.label}</span>
            ) : (
              <span className="muted">No profile yet</span>
            )}
          </div>
          <div className="actions">
            <button
              className="primary"
              disabled={!enabled || !profile || !allowed}
              onClick={fill}
            >
              Fill this form
            </button>
            <button onClick={undo}>Undo</button>
          </div>
          <div className="actions">
            <button
              disabled={!enabled || !profile || !allowed}
              onClick={generate}
              style={{ width: "100%" }}
            >
              ✨ Generate with AI
            </button>
          </div>
          <div className="actions">
            <button disabled={!profile} onClick={capture} style={{ width: "100%" }}>
              ＋ Save filled fields to profile
            </button>
          </div>
          {!allowed && (
            <div className="status muted">This site isn't in your whitelist.</div>
          )}
        </>
      )}

      {status && <div className="status">{status}</div>}
      <div className="footer">
        <button className="linkish" onClick={openOptions}>
          Settings &amp; profile →
        </button>
        <button className="linkish" onClick={help} title="Open the Formless help page">
          Help ?
        </button>
      </div>
    </div>
  );
}
