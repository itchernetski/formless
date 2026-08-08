import { describe, expect, it } from "vitest";
import { isSensitive } from "../src/detection/sensitive";

function field(html: string): Element {
  return new DOMParser().parseFromString(`<form>${html}</form>`, "text/html").querySelector(
    "input,select,textarea",
  )!;
}

describe("isSensitive", () => {
  it("blocks password inputs", () => {
    expect(isSensitive(field(`<input type="password" name="whatever">`))).toBe(true);
  });

  it("blocks payment-card fields by autocomplete", () => {
    expect(isSensitive(field(`<input autocomplete="cc-number">`))).toBe(true);
    expect(isSensitive(field(`<input autocomplete="cc-csc">`))).toBe(true);
  });

  it("blocks CVV, OTP, PIN and SSN by name/label tokens", () => {
    expect(isSensitive(field(`<input name="cvv">`))).toBe(true);
    expect(isSensitive(field(`<input name="otp-code">`))).toBe(true);
    expect(isSensitive(field(`<input id="pin">`))).toBe(true);
    expect(isSensitive(field(`<input placeholder="SSN">`))).toBe(true);
    expect(isSensitive(field(`<input aria-label="Card number">`))).toBe(true);
  });

  it("does not block ordinary fields", () => {
    expect(isSensitive(field(`<input name="email" type="email">`))).toBe(false);
    expect(isSensitive(field(`<input name="firstName">`))).toBe(false);
  });
});
