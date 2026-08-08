// Privacy guard for capture-from-form: never read secrets back into the vault.
// Blocks passwords, payment-card fields, CVV/CVC, OTP/2FA codes, PIN, SSN.

import { extractSignals, tokenHit } from "./signals";

// autocomplete tokens that always indicate a secret.
const SENSITIVE_AUTOCOMPLETE = new Set([
  "current-password",
  "new-password",
  "cc-number",
  "cc-csc",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "one-time-code",
]);

// Substrings (word-boundary) in name/id/placeholder/label/aria.
const SENSITIVE_TOKENS = [
  "password",
  "passwd",
  "pwd",
  "cvv",
  "cvc",
  "cvc2",
  "csc",
  "card",
  "cardnumber",
  "card-number",
  "creditcard",
  "credit-card",
  "ccnumber",
  "securitycode",
  "security-code",
  "otp",
  "one-time",
  "onetime",
  "2fa",
  "totp",
  "verificationcode",
  "verification-code",
  "pin",
  "ssn",
  "social-security",
];

export function isSensitive(el: Element): boolean {
  // Password inputs are never captured, regardless of labelling.
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "password") return true;
  }
  const sig = extractSignals(el);
  if (sig.autocomplete && SENSITIVE_AUTOCOMPLETE.has(sig.autocomplete)) return true;
  const haystacks = [sig.name, sig.id, sig.placeholder, sig.label, sig.aria];
  return SENSITIVE_TOKENS.some((t) => haystacks.some((h) => tokenHit(h, t)));
}
