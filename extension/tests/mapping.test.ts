import { describe, expect, it } from "vitest";
import { mapField } from "../src/detection/mapping";

function field(html: string): Element {
  const doc = new DOMParser().parseFromString(`<form>${html}</form>`, "text/html");
  return doc.querySelector("input, select, textarea")!;
}

function withLabel(html: string, sel = "input,select,textarea"): Element {
  const doc = new DOMParser().parseFromString(`<form>${html}</form>`, "text/html");
  return doc.querySelector(sel)!;
}

describe("field mapping", () => {
  it("maps autocomplete tokens with high confidence", () => {
    expect(mapField(field(`<input autocomplete="given-name">`))?.path).toBe(
      "identity.firstName",
    );
    expect(mapField(field(`<input autocomplete="family-name">`))?.path).toBe(
      "identity.lastName",
    );
    expect(mapField(field(`<input autocomplete="email">`))?.path).toBe("contact.email");
    expect(mapField(field(`<input autocomplete="postal-code">`))?.path).toBe(
      "address.postalCode",
    );
  });

  it("maps by name attribute", () => {
    expect(mapField(field(`<input name="zip">`))?.path).toBe("address.postalCode");
    expect(mapField(field(`<input name="company">`))?.path).toBe("work.company");
    expect(mapField(field(`<input name="phone">`))?.path).toBe("contact.phone");
  });

  it("prefers first/last name over generic full name", () => {
    expect(mapField(field(`<input name="firstName">`))?.path).toBe("identity.firstName");
    expect(mapField(field(`<input name="fullName">`))?.path).toBe("identity.fullName");
    expect(mapField(field(`<input name="name">`))?.path).toBe("identity.fullName");
  });

  it("does not match 'name' inside 'username' at a word boundary", () => {
    // username has no token defined → should not map to fullName off a stray 'name'
    const m = mapField(field(`<input name="username">`));
    expect(m?.path).not.toBe("identity.fullName");
  });

  it("uses associated <label> text", () => {
    const el = withLabel(
      `<label for="x">Email address</label><input id="x">`,
      "input",
    );
    expect(mapField(el)?.path).toBe("contact.email");
  });

  it("uses placeholder and aria-label as weaker signals", () => {
    expect(mapField(field(`<input placeholder="City">`))?.path).toBe("address.city");
    expect(mapField(field(`<input aria-label="Job title">`))?.path).toBe("work.jobTitle");
  });

  it("returns null for unrelated fields", () => {
    expect(mapField(field(`<input name="captcha_answer">`))).toBeNull();
    expect(mapField(field(`<input>`))).toBeNull();
  });
});
