import { describe, expect, it } from "vitest";
import { fillField } from "../src/detection/fill";
import { autofill, undoFill } from "../src/detection";
import { emptyProfile, type Profile } from "../src/vault/schema";

function profile(): Profile {
  const p = emptyProfile("p1", "Test");
  p.identity.firstName = "Ilya";
  p.identity.lastName = "Chernetskiy";
  p.contact.email = "ilya@example.com";
  p.contact.phone = "+34600123456";
  p.address.city = "Valencia";
  p.address.country = "Spain";
  p.work.company = "Indie";
  return p;
}

describe("long-form fields are left to the AI panel", () => {
  it("does not fill a textarea whose name matches a profile token", () => {
    // Regression: `why_company` scored as work.company and got the employer
    // name pasted into a field meant for a written answer.
    document.body.innerHTML = `
      <label for="why_company">Why do you want to work at Lumen Systems?</label>
      <textarea id="why_company" name="why_company"></textarea>`;
    const el = document.querySelector("textarea")!;
    autofill(profile(), document);
    expect(el.value).toBe("");
  });

  it("still fills a generic textarea that maps to a profile field", () => {
    document.body.innerHTML = `
      <label for="addr">Street address</label>
      <textarea id="addr" name="address"></textarea>`;
    const el = document.querySelector("textarea")!;
    const p = profile();
    p.address.line1 = "Carrer de Colom 12";
    autofill(p, document);
    expect(el.value).toBe("Carrer de Colom 12");
  });
});

describe("fillField", () => {
  it("fills text inputs", () => {
    document.body.innerHTML = `<input name="email">`;
    const el = document.querySelector("input")!;
    expect(fillField(el, "a@b.com")).toBe(true);
    expect(el.value).toBe("a@b.com");
  });

  it("selects an option by value, text, or prefix", () => {
    document.body.innerHTML = `
      <select><option value="">-</option><option value="ES">Spain</option></select>`;
    const el = document.querySelector("select")!;
    expect(fillField(el, "Spain")).toBe(true);
    expect(el.value).toBe("ES");
  });

  it("toggles checkboxes from truthy strings", () => {
    document.body.innerHTML = `<input type="checkbox">`;
    const el = document.querySelector("input")!;
    fillField(el, "yes");
    expect(el.checked).toBe(true);
  });

  it("fires input and change events", () => {
    document.body.innerHTML = `<input name="email">`;
    const el = document.querySelector("input")!;
    let inputs = 0;
    let changes = 0;
    el.addEventListener("input", () => inputs++);
    el.addEventListener("change", () => changes++);
    fillField(el, "x@y.com");
    expect(inputs).toBe(1);
    expect(changes).toBe(1);
  });
});

describe("autofill end-to-end on a DOM", () => {
  it("fills mapped fields and reports counts", () => {
    document.body.innerHTML = `
      <form>
        <input autocomplete="given-name">
        <input autocomplete="family-name">
        <input type="email" name="email">
        <input name="phone">
        <input name="city">
        <select name="country"><option value="">-</option><option value="ES">Spain</option></select>
        <input name="company">
        <input name="captcha">
      </form>`;
    const report = autofill(profile());
    expect(report.filled).toBe(7);
    expect((document.querySelector('[autocomplete="given-name"]') as HTMLInputElement).value).toBe(
      "Ilya",
    );
    expect((document.querySelector('select[name="country"]') as HTMLSelectElement).value).toBe(
      "ES",
    );
    expect((document.querySelector('input[name="captcha"]') as HTMLInputElement).value).toBe("");
  });

  it("does not overwrite fields the user already filled", () => {
    document.body.innerHTML = `<input type="email" name="email" value="keep@me.com">`;
    const report = autofill(profile());
    expect(report.filled).toBe(0);
    expect((document.querySelector("input")! as HTMLInputElement).value).toBe("keep@me.com");
  });

  it("undo reverts filled fields to their previous value", () => {
    document.body.innerHTML = `<input autocomplete="given-name"><input type="email" name="email">`;
    const report = autofill(profile());
    expect(report.filled).toBe(2);
    undoFill(report.entries);
    expect((document.querySelector('[autocomplete="given-name"]') as HTMLInputElement).value).toBe(
      "",
    );
    expect((document.querySelector('[name="email"]') as HTMLInputElement).value).toBe("");
  });

  it("detects fields inside open shadow roots", () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const host = document.getElementById("host")!;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<input type="email" name="email">`;
    const report = autofill(profile());
    expect(report.filled).toBe(1);
    expect((root.querySelector("input")! as HTMLInputElement).value).toBe("ilya@example.com");
  });
});
