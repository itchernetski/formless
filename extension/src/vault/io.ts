// Export / import of profiles as JSON for backup and device migration.
// Export is always plaintext JSON (the user explicitly asked for a backup);
// import validates shape and re-saves through the vault (re-encrypting if on).

import { emptyProfile, type Profile, SECTION_KEYS } from "./schema";
import { listProfiles, saveProfile } from "./index";

export interface ProfileExport {
  format: "autofill-profiles";
  version: 1;
  exportedAt: number;
  profiles: Profile[];
}

export async function exportProfiles(): Promise<ProfileExport> {
  return {
    format: "autofill-profiles",
    version: 1,
    exportedAt: Date.now(),
    profiles: await listProfiles(),
  };
}

export function serializeExport(data: ProfileExport): string {
  return JSON.stringify(data, null, 2);
}

// Coerce an untrusted object into a valid Profile, filling gaps from a blank.
function coerceProfile(raw: unknown): Profile {
  const base = emptyProfile(
    typeof (raw as Profile)?.id === "string" ? (raw as Profile).id : crypto.randomUUID(),
    typeof (raw as Profile)?.label === "string" ? (raw as Profile).label : "Imported",
  );
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  for (const section of SECTION_KEYS) {
    const incoming = r[section];
    if (incoming && typeof incoming === "object") {
      const target = base[section] as unknown as Record<string, string>;
      for (const k of Object.keys(target)) {
        const v = (incoming as Record<string, unknown>)[k];
        if (typeof v === "string") target[k] = v;
      }
    }
  }
  if (r.custom && typeof r.custom === "object") {
    for (const [k, v] of Object.entries(r.custom as Record<string, unknown>)) {
      if (typeof v === "string") base.custom[k] = v;
    }
  }
  return base;
}

export async function importProfiles(json: string): Promise<Profile[]> {
  const parsed = JSON.parse(json) as Partial<ProfileExport>;
  if (parsed?.format !== "autofill-profiles" || !Array.isArray(parsed.profiles)) {
    throw new Error("Not a valid autofill profile export.");
  }
  const saved: Profile[] = [];
  for (const raw of parsed.profiles) {
    saved.push(await saveProfile(coerceProfile(raw)));
  }
  return saved;
}
