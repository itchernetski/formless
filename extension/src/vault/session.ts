// Holds the unlocked AES key for the lifetime of a browser session.
// In the extension we persist the raw key in chrome.storage.session (memory-only,
// cleared on browser close). Outside the extension (tests/node) we fall back to a
// module-level variable so the vault is usable without the chrome API.

import { exportKey, importKey } from "./crypto";

const SESSION_KEY = "vault_session_key";
let memKey: CryptoKey | null = null;

interface SessionArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string): Promise<void>;
}
type ChromeLike = { storage?: { session?: SessionArea } };

function sessionArea(): SessionArea | null {
  const c = (globalThis as unknown as { chrome?: ChromeLike }).chrome;
  return c?.storage?.session ?? null;
}

export async function setSessionKey(key: CryptoKey | null): Promise<void> {
  memKey = key;
  const area = sessionArea();
  if (!area) return;
  if (key) {
    await area.set({ [SESSION_KEY]: await exportKey(key) });
  } else {
    await area.remove(SESSION_KEY);
  }
}

export async function getSessionKey(): Promise<CryptoKey | null> {
  if (memKey) return memKey;
  const area = sessionArea();
  if (!area) return null;
  const raw = (await area.get(SESSION_KEY))?.[SESSION_KEY] as string | undefined;
  if (!raw) return null;
  memKey = await importKey(raw);
  return memKey;
}
