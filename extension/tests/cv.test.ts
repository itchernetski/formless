import { describe, expect, it } from "vitest";
import { buildCvUserPrompt, parseCvJson } from "../src/import/cv";

describe("buildCvUserPrompt", () => {
  it("lists target fields and embeds the CV text", () => {
    const p = buildCvUserPrompt("John Doe — Software Engineer at Acme");
    expect(p).toContain("identity.firstName");
    expect(p).toContain("custom.skills");
    expect(p).toContain("John Doe");
  });

  it("truncates very long CVs", () => {
    const p = buildCvUserPrompt("x".repeat(20000));
    expect(p.length).toBeLessThan(13000);
  });
});

describe("parseCvJson", () => {
  it("parses plain JSON into extracted fields", () => {
    const fields = parseCvJson(
      JSON.stringify({
        "identity.firstName": "Ada",
        "work.company": "Analytical Engines",
        "custom.skills": "Math, Logic",
      }),
    );
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f.value]));
    expect(byPath["identity.firstName"]).toBe("Ada");
    expect(byPath["work.company"]).toBe("Analytical Engines");
    expect(byPath["custom.skills"]).toBe("Math, Logic");
    expect(fields.every((f) => f.source === "cv")).toBe(true);
  });

  it("strips code fences and surrounding prose", () => {
    const out = 'Here you go:\n```json\n{ "contact.email": "a@b.com" }\n```\nDone.';
    expect(parseCvJson(out)).toEqual([{ path: "contact.email", value: "a@b.com", source: "cv" }]);
  });

  it("ignores unknown keys, null and empty values", () => {
    const fields = parseCvJson(
      JSON.stringify({
        "identity.firstName": "Ada",
        unknownKey: "nope",
        "contact.phone": "",
        "work.jobTitle": null,
      }),
    );
    expect(fields).toEqual([{ path: "identity.firstName", value: "Ada", source: "cv" }]);
  });

  it("returns [] for non-JSON output", () => {
    expect(parseCvJson("I could not find anything.")).toEqual([]);
  });
});
