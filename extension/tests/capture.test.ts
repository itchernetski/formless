import { describe, expect, it } from "vitest";
import { captureForm } from "../src/detection/capture";

function form(html: string): Document {
  return new DOMParser().parseFromString(`<body><form>${html}</form></body>`, "text/html");
}

function byPath(doc: Document, opts?: Parameters<typeof captureForm>[1]) {
  const fields = captureForm(doc, opts ?? { host: "example.com" });
  return Object.fromEntries(fields.map((f) => [f.path, f.value]));
}

describe("captureForm", () => {
  it("captures filled, mapped fields via reverse mapping", () => {
    const map = byPath(
      form(`
        <input name="firstName" value="Ada">
        <input autocomplete="email" value="ada@x.com">
        <input name="company" value="Acme">
      `),
    );
    expect(map["identity.firstName"]).toBe("Ada");
    expect(map["contact.email"]).toBe("ada@x.com");
    expect(map["work.company"]).toBe("Acme");
  });

  it("tags the source with the host", () => {
    const fields = captureForm(form(`<input name="firstName" value="Ada">`), { host: "jobs.io" });
    expect(fields[0].source).toBe("form:jobs.io");
  });

  it("skips empty and sensitive fields", () => {
    const map = byPath(
      form(`
        <input name="firstName" value="Ada">
        <input name="lastName" value="">
        <input type="password" name="password" value="hunter2">
        <input name="cvv" value="123">
      `),
    );
    expect(map["identity.firstName"]).toBe("Ada");
    expect(Object.keys(map)).toEqual(["identity.firstName"]);
  });

  it("skips autofilled fields the user left unchanged (provenance)", () => {
    const doc = form(`<input name="firstName" value="Ada"><input name="company" value="Acme">`);
    const first = doc.querySelector('[name="firstName"]') as HTMLInputElement;
    const autofilled = new Map<Element, string>([[first, "Ada"]]);
    const map = byPath(doc, { host: "x.com", autofilled });
    expect(map["identity.firstName"]).toBeUndefined(); // unchanged autofill → skipped
    expect(map["work.company"]).toBe("Acme"); // user-entered → kept
  });

  it("captures an autofilled field the user then edited", () => {
    const doc = form(`<input name="firstName" value="Adelaide">`);
    const first = doc.querySelector('[name="firstName"]') as HTMLInputElement;
    const autofilled = new Map<Element, string>([[first, "Ada"]]); // we filled "Ada", user changed it
    const map = byPath(doc, { host: "x.com", autofilled });
    expect(map["identity.firstName"]).toBe("Adelaide");
  });

  it("proposes unmapped filled fields as custom paths", () => {
    const map = byPath(
      form(`<label for="ref">How did you hear about us</label><input id="ref" value="A friend">`),
    );
    expect(map["custom.how_did_you_hear_about_us"]).toBe("A friend");
  });

  it("reads select option text and checked radios", () => {
    const map = byPath(
      form(`
        <label for="c">Country</label>
        <select id="c"><option value="">--</option><option value="es" selected>Spain</option></select>
        <input type="radio" name="gender" value="f" checked> Female
      `),
    );
    expect(map["address.country"]).toBe("Spain");
    expect(map["identity.gender"]).toBe("f");
  });
});
