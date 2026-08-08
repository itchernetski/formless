// Vault public API. Ties persistence (db) + encryption (crypto) + unlocked-key
// lifetime (session) into CRUD over profiles, plus lock/unlock and settings.
//
// Encryption policy:
//   - encryption.enabled = false  → profiles stored as plaintext records.
//   - encryption.enabled = true   → profiles stored as encrypted blobs; reads
//     require an unlocked session key (set via unlock()).

import {
  decryptJSON,
  encryptJSON,
  keyFromPassword,
  VERIFY_TOKEN,
} from "./crypto";
import {
  allRecords,
  deleteRecord,
  getRecord,
  putRecord,
  readSettings,
  writeSettings,
  type ProfileRecord,
  type Settings,
} from "./db";
import { emptyProfile, type Profile } from "./schema";
import { getSessionKey, setSessionKey } from "./session";

export type { Profile } from "./schema";
export type { Settings } from "./db";

// crypto.randomUUID is available in browsers and Node ≥ 16.7.
function uid(): string {
  return crypto.randomUUID();
}

export class VaultLockedError extends Error {
  constructor() {
    super("Vault is locked — unlock with the master password.");
    this.name = "VaultLockedError";
  }
}

async function recordToProfile(rec: ProfileRecord): Promise<Profile> {
  if (rec.plain) return rec.plain;
  if (rec.enc) {
    const key = await getSessionKey();
    if (!key) throw new VaultLockedError();
    return decryptJSON<Profile>(key, rec.enc);
  }
  throw new Error(`Corrupt profile record: ${rec.id}`);
}

async function profileToRecord(p: Profile, encrypt: boolean): Promise<ProfileRecord> {
  if (!encrypt) return { id: p.id, plain: p, enc: null };
  const key = await getSessionKey();
  if (!key) throw new VaultLockedError();
  return { id: p.id, plain: null, enc: await encryptJSON(key, p) };
}

export async function getSettings(): Promise<Settings> {
  return readSettings();
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await readSettings()), ...patch };
  await writeSettings(next);
  return next;
}

export async function isEncrypted(): Promise<boolean> {
  return (await readSettings()).encryption.enabled;
}

export async function isLocked(): Promise<boolean> {
  if (!(await isEncrypted())) return false;
  return (await getSessionKey()) === null;
}

export async function listProfiles(): Promise<Profile[]> {
  const recs = await allRecords();
  return Promise.all(recs.map(recordToProfile));
}

export async function getProfile(id: string): Promise<Profile | null> {
  const rec = await getRecord(id);
  return rec ? recordToProfile(rec) : null;
}

export async function getActiveProfile(): Promise<Profile | null> {
  const s = await readSettings();
  if (s.activeProfileId) {
    const p = await getProfile(s.activeProfileId);
    if (p) return p;
  }
  const all = await listProfiles();
  return all[0] ?? null;
}

export async function saveProfile(p: Profile): Promise<Profile> {
  const settings = await readSettings();
  const next: Profile = { ...p, updatedAt: Date.now() };
  await putRecord(await profileToRecord(next, settings.encryption.enabled));
  if (!settings.activeProfileId) {
    await writeSettings({ ...settings, activeProfileId: next.id });
  }
  return next;
}

export async function createProfile(label = "Personal"): Promise<Profile> {
  return saveProfile(emptyProfile(uid(), label));
}

export async function removeProfile(id: string): Promise<void> {
  await deleteRecord(id);
  const s = await readSettings();
  if (s.activeProfileId === id) {
    const rest = (await allRecords()).map((r) => r.id);
    await writeSettings({ ...s, activeProfileId: rest[0] ?? null });
  }
}

export async function setActiveProfile(id: string): Promise<void> {
  await updateSettings({ activeProfileId: id });
}

// --- Encryption lifecycle --------------------------------------------------

// Turn on encryption with a fresh master password and re-write all profiles
// as ciphertext. Must currently be unlocked/plaintext.
export async function enableEncryption(password: string): Promise<void> {
  const settings = await readSettings();
  if (settings.encryption.enabled) throw new Error("Encryption already enabled.");
  const { key, saltB64 } = await keyFromPassword(password);
  await setSessionKey(key);
  const verify = await encryptJSON(key, VERIFY_TOKEN);
  // Re-encrypt every existing plaintext profile.
  const profiles = await Promise.all((await allRecords()).map(recordToProfile));
  await writeSettings({
    ...settings,
    encryption: { enabled: true, saltB64, verify },
  });
  for (const p of profiles) await putRecord(await profileToRecord(p, true));
}

// Unlock an encrypted vault for this session. Returns false on wrong password.
export async function unlock(password: string): Promise<boolean> {
  const settings = await readSettings();
  const { encryption } = settings;
  if (!encryption.enabled || !encryption.saltB64 || !encryption.verify) {
    return true; // nothing to unlock
  }
  const { key } = await keyFromPassword(password, encryption.saltB64);
  try {
    const token = await decryptJSON<string>(key, encryption.verify);
    if (token !== VERIFY_TOKEN) return false;
  } catch {
    return false; // GCM auth failure → wrong password
  }
  await setSessionKey(key);
  return true;
}

export async function lock(): Promise<void> {
  await setSessionKey(null);
}
