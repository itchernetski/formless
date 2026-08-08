// IndexedDB wrapper (idb). Stores profile records (encrypted or plaintext) and
// a single settings/meta record. Pure persistence — no crypto policy here.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Profile } from "./schema";
import type { EncryptedBlob } from "./crypto";

export interface Settings {
  enabled: boolean; // master on/off for autofill
  activeProfileId: string | null;
  whitelist: string[]; // host patterns; empty = run everywhere
  encryption: {
    enabled: boolean;
    saltB64: string | null;
    verify: EncryptedBlob | null; // encrypted VERIFY_TOKEN, to validate unlock
  };
}

// A stored profile is either plaintext or an encrypted blob, never both.
export interface ProfileRecord {
  id: string;
  plain: Profile | null;
  enc: EncryptedBlob | null;
}

interface VaultDB extends DBSchema {
  profiles: { key: string; value: ProfileRecord };
  meta: { key: string; value: Settings };
}

const DB_NAME = "autofill";
const DB_VERSION = 1;
const SETTINGS_KEY = "settings";

let dbp: Promise<IDBPDatabase<VaultDB>> | null = null;

function db(): Promise<IDBPDatabase<VaultDB>> {
  if (!dbp) {
    dbp = openDB<VaultDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("profiles")) {
          d.createObjectStore("profiles", { keyPath: "id" });
        }
        if (!d.objectStoreNames.contains("meta")) {
          d.createObjectStore("meta");
        }
      },
    });
  }
  return dbp;
}

export const defaultSettings: Settings = {
  enabled: true,
  activeProfileId: null,
  whitelist: [],
  encryption: { enabled: false, saltB64: null, verify: null },
};

export async function readSettings(): Promise<Settings> {
  const s = await (await db()).get("meta", SETTINGS_KEY);
  return s ?? { ...defaultSettings };
}

export async function writeSettings(s: Settings): Promise<void> {
  await (await db()).put("meta", s, SETTINGS_KEY);
}

export async function putRecord(rec: ProfileRecord): Promise<void> {
  await (await db()).put("profiles", rec);
}

export async function getRecord(id: string): Promise<ProfileRecord | undefined> {
  return (await db()).get("profiles", id);
}

export async function allRecords(): Promise<ProfileRecord[]> {
  return (await db()).getAll("profiles");
}

export async function deleteRecord(id: string): Promise<void> {
  await (await db()).delete("profiles", id);
}

// Test/maintenance helper: drop the whole database.
export async function _resetDB(): Promise<void> {
  const d = await db();
  await d.clear("profiles");
  await d.clear("meta");
}
