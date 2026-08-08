import { beforeEach, describe, expect, it } from "vitest";
import {
  createProfile,
  enableEncryption,
  getActiveProfile,
  isLocked,
  listProfiles,
  lock,
  removeProfile,
  saveProfile,
  setActiveProfile,
  unlock,
} from "../src/vault";
import { exportProfiles, importProfiles, serializeExport } from "../src/vault/io";
import { _resetDB } from "../src/vault/db";
import { setSessionKey } from "../src/vault/session";

beforeEach(async () => {
  await _resetDB();
  await setSessionKey(null);
});

describe("vault CRUD (plaintext)", () => {
  it("creates, lists, and updates profiles", async () => {
    const p = await createProfile("Personal");
    p.identity.firstName = "Ilya";
    await saveProfile(p);

    const all = await listProfiles();
    expect(all).toHaveLength(1);
    expect(all[0].identity.firstName).toBe("Ilya");

    const active = await getActiveProfile();
    expect(active?.id).toBe(p.id);
  });
});

// Backs the popup's profile dropdown: switching the active profile must change
// what getActiveProfile() hands to fill/generate/capture, and survive deletion.
describe("multi-profile switching", () => {
  it("switches the active profile and keeps each profile's data", async () => {
    const personal = await createProfile("Personal");
    personal.contact.email = "me@example.com";
    await saveProfile(personal);
    const work = await createProfile("Work");
    work.contact.email = "me@company.com";
    await saveProfile(work);

    // First profile created stays active until explicitly switched.
    expect((await getActiveProfile())?.id).toBe(personal.id);

    await setActiveProfile(work.id);
    const active = await getActiveProfile();
    expect(active?.label).toBe("Work");
    expect(active?.contact.email).toBe("me@company.com");

    await setActiveProfile(personal.id);
    expect((await getActiveProfile())?.contact.email).toBe("me@example.com");
  });

  it("falls back to a remaining profile when the active one is deleted", async () => {
    const a = await createProfile("A");
    const b = await createProfile("B");
    await setActiveProfile(b.id);

    await removeProfile(b.id);
    expect((await getActiveProfile())?.id).toBe(a.id);
    expect(await listProfiles()).toHaveLength(1);
  });
});

describe("vault encryption", () => {
  it("encrypts at rest and round-trips through lock/unlock", async () => {
    const p = await createProfile("Personal");
    p.contact.email = "secret@example.com";
    await saveProfile(p);

    await enableEncryption("hunter2-strong");
    expect(await isLocked()).toBe(false);

    // Lock → reads require unlock
    await lock();
    expect(await isLocked()).toBe(true);
    await expect(listProfiles()).rejects.toThrow();

    // Wrong password fails, right password works
    expect(await unlock("wrong")).toBe(false);
    expect(await unlock("hunter2-strong")).toBe(true);
    const all = await listProfiles();
    expect(all[0].contact.email).toBe("secret@example.com");
  });
});

describe("export / import", () => {
  it("round-trips profiles through JSON", async () => {
    const p = await createProfile("Work");
    p.identity.firstName = "Ilya";
    p.custom.referral = "a-friend";
    await saveProfile(p);

    const json = serializeExport(await exportProfiles());
    await _resetDB();
    await setSessionKey(null);

    const imported = await importProfiles(json);
    expect(imported).toHaveLength(1);
    expect(imported[0].identity.firstName).toBe("Ilya");
    expect(imported[0].custom.referral).toBe("a-friend");
  });

  it("rejects malformed import data", async () => {
    await expect(importProfiles(`{"foo":1}`)).rejects.toThrow();
  });
});
