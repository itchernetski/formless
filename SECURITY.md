# Security Policy

Formless holds personal data — names, addresses, phone numbers, employment history, sometimes more. It is worth treating security reports seriously, and I do.

## Reporting a vulnerability

**Please don't open a public issue.**

Use GitHub's private reporting: **Security → Report a vulnerability** on the repository, or email **security@tchernetski.com**.

Include:

- what the issue is and roughly how bad you think it is
- steps to reproduce, or a proof of concept
- affected version (the extension version from `chrome://extensions`) and browser
- whether it's already public anywhere

What to expect:

| | |
|---|---|
| Acknowledgement | within 72 hours |
| Initial assessment | within 7 days |
| Fix for confirmed high-severity issues | as fast as I can, target 14 days |
| Credit | in the release notes and `CHANGELOG.md`, unless you'd rather stay anonymous |

This is a solo-maintained project, not a company with an on-call rotation. I'll tell you honestly if something will take longer.

## In scope

- Reading vault contents without the master password when encryption is enabled
- Key material leaking outside `chrome.storage.session` — into `localStorage`, IndexedDB in plaintext, page context, logs
- A web page reading the profile, or reaching extension internals through the content script or `web_accessible_resources`
- Filling credentials or profile data into an unintended origin, or leaking values cross-origin (including via iframes, since the content script runs in all frames)
- Capture writing sensitive fields (password, card number, CVV, OTP, PIN, SSN) into the profile
- Any outbound network request from the extension — there should be exactly none
- Weaknesses in the crypto construction: PBKDF2 parameters, AES-GCM nonce reuse, salt handling
- Prompt injection from page content that causes the AI layer to exfiltrate profile data or take unintended action
- Supply-chain problems in the dependency tree that are exploitable in the extension context

## Out of scope

- Attacks requiring an already-compromised device, OS account, or browser profile
- Attacks requiring the victim to install a malicious extension, or to paste attacker-supplied code into DevTools
- Physical access to an unlocked machine
- Forgotten master password (unrecoverable by design — that's not a bug)
- Fields filled incorrectly, or forms not detected — real bugs, but functional ones: open a normal issue
- Reports about the not-yet-existent backend, or about `itchernetski/formless` placeholder URLs
- Findings from automated scanners with no demonstrated impact in the extension context

## Threat model, briefly

Formless assumes the device and browser are trusted, and that the web pages you visit are not. It defends the profile against hostile pages and against someone reading browser storage at rest. It does not defend against malware running as you.

Design choices that follow from that:

- No backend, no account, no sync in the current release — the smallest possible attack surface is no server at all.
- The vault is AES-GCM encrypted at rest with a PBKDF2-derived key (210k iterations, SHA-256). The unlocked key lives only in `chrome.storage.session` and is gone when the browser closes.
- AI generation runs on-device via Chrome's built-in model. No prompt, profile field or page content is transmitted anywhere.
- Capture applies a sensitive-field blocklist before values ever reach the review screen, and every import/capture requires explicit per-field approval.
- Exports are deliberately plaintext JSON, clearly labelled as such in the UI, so backups stay usable. That's a documented trade-off, not an oversight.

## Supported versions

The latest release gets security fixes. Given the project's age, older versions get none — please update.
