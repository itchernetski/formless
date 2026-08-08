import { describe, expect, it } from "vitest";
import { applyDiff, diffProfile } from "../src/import/merge";
import { emptyProfile, getPath, type Profile } from "../src/vault/schema";
import type { ExtractedField } from "../src/import/types";

function base(): Profile {
  const p = emptyProfile("p1", "Personal");
  p.identity.firstName = "Ada";
  p.contact.email = "ada@old.com";
  return p;
}

const f = (path: string, value: string): ExtractedField => ({ path, value, source: "cv" });

describe("diffProfile", () => {
  it("classifies new, update and same", () => {
    const entries = diffProfile(base(), [
      f("identity.firstName", "Ada"), // same
      f("contact.email", "ada@new.com"), // update
      f("identity.lastName", "Lovelace"), // new
    ]);
    const byPath = Object.fromEntries(entries.map((e) => [e.path, e]));
    expect(byPath["identity.firstName"].status).toBe("same");
    expect(byPath["identity.firstName"].apply).toBe(false);
    expect(byPath["contact.email"].status).toBe("update");
    expect(byPath["contact.email"].current).toBe("ada@old.com");
    expect(byPath["identity.lastName"].status).toBe("new");
    expect(byPath["identity.lastName"].apply).toBe(true);
  });

  it("drops blank values and dedupes by path (last wins)", () => {
    const entries = diffProfile(base(), [
      f("work.company", "  "),
      f("work.jobTitle", "Dev"),
      f("work.jobTitle", "Senior Dev"),
    ]);
    expect(entries.find((e) => e.path === "work.company")).toBeUndefined();
    expect(entries.find((e) => e.path === "work.jobTitle")?.incoming).toBe("Senior Dev");
  });

  it("orders new before update before same", () => {
    const entries = diffProfile(base(), [
      f("contact.email", "x@y.com"), // update
      f("identity.lastName", "L"), // new
      f("identity.firstName", "Ada"), // same
    ]);
    expect(entries.map((e) => e.status)).toEqual(["new", "update", "same"]);
  });
});

describe("applyDiff", () => {
  it("writes only checked entries with edited values", () => {
    const entries = diffProfile(base(), [
      f("identity.lastName", "Lovelace"),
      f("contact.email", "ada@new.com"),
    ]);
    // Uncheck the email update; edit the last name.
    const edited = entries.map((e) =>
      e.path === "contact.email" ? { ...e, apply: false } : { ...e, incoming: "Byron" },
    );
    const result = applyDiff(base(), edited);
    expect(getPath(result, "identity.lastName")).toBe("Byron");
    expect(getPath(result, "contact.email")).toBe("ada@old.com"); // unchanged
  });

  it("writes custom.* paths", () => {
    const result = applyDiff(base(), diffProfile(base(), [f("custom.skills", "Go, Rust")]));
    expect(getPath(result, "custom.skills")).toBe("Go, Rust");
  });
});
