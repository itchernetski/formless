import { describe, expect, it } from "vitest";
import { classifyLongField, collectLongFields } from "../src/detection/longfields";

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

describe("long-field classification", () => {
  it("recognises cover letters, bios and why-company", () => {
    expect(classifyLongField("Cover letter")).toBe("coverLetter");
    expect(classifyLongField("Tell us about yourself")).toBe("bio");
    expect(classifyLongField("Why do you want to work here?")).toBe("whyCompany");
  });

  it("prefers why-company over a generic cover-letter match", () => {
    expect(classifyLongField("Why this company motivates you")).toBe("whyCompany");
  });

  it("returns generic for unrelated text", () => {
    expect(classifyLongField("Additional comments")).toBe("generic");
  });
});

describe("collectLongFields", () => {
  it("collects textareas and contenteditable, classifying by label", () => {
    const d = doc(`
      <label for="cl">Cover letter</label><textarea id="cl"></textarea>
      <textarea placeholder="Tell us about yourself"></textarea>
      <div contenteditable="true" aria-label="Why this role"></div>
      <input type="text" name="firstName">
    `);
    const fields = collectLongFields(d);
    expect(fields).toHaveLength(3);
    const kinds = fields.map((f) => f.kind);
    expect(kinds).toContain("coverLetter");
    expect(kinds).toContain("bio");
    expect(kinds).toContain("whyCompany");
  });

  it("skips disabled and readonly textareas", () => {
    const d = doc(`<textarea disabled></textarea><textarea readonly></textarea><textarea></textarea>`);
    expect(collectLongFields(d)).toHaveLength(1);
  });
});
