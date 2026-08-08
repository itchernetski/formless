import { useState } from "react";
import { createProfile, enableEncryption, saveProfile } from "../vault";
import type { Profile } from "../vault/schema";
import { helpUrl } from "../shared/help";
import { ProfileEditor } from "./ProfileEditor";

// First-run flow: create a profile, optionally protect it with a master password.
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setProfile(await createProfile("Personal"));
    setBusy(false);
  }

  async function finish() {
    if (!profile) return;
    setBusy(true);
    await saveProfile(profile);
    if (password.trim().length >= 6) await enableEncryption(password);
    setBusy(false);
    onDone();
  }

  if (!profile) {
    return (
      <div className="onboard">
        <h1>Welcome to Formless</h1>
        <p className="muted">
          Your profile lives only on this device. Nothing is sent anywhere.
        </p>
        <div className="card">
          <p>Let's create your first profile. You can fill it in now or later.</p>
          <div className="toolbar">
            <button className="primary" disabled={busy} onClick={start}>
              Create my profile
            </button>
            <a className="btn-link" href={helpUrl()} target="_blank" rel="noreferrer">
              How it works
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="options">
      <h1>Your profile</h1>
      <p className="muted">Fill what you like — you can edit it anytime in Settings.</p>
      <ProfileEditor profile={profile} onChange={setProfile} />

      <div className="section">
        <h2>Protect with a master password (optional)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Encrypts your profile at rest with AES-GCM. Leave blank to skip. Minimum 6
          characters. If you forget it, the data can't be recovered.
        </p>
        <input
          type="password"
          placeholder="Master password (optional)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div className="toolbar">
        <button className="primary" disabled={busy} onClick={finish}>
          Save & finish
        </button>
      </div>
    </div>
  );
}
