# Changelog

All notable changes to Formless are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-08-08

First public release. Everything runs locally; the extension makes no network requests.

### Added

**Autofill**
- Field detection over `autocomplete`, `name`, `id`, `placeholder`, associated `<label>` and `aria-label`, with weighted scoring and a confidence threshold
- Filling that works with React/Vue controlled inputs (native value setters plus `input`/`change` events), including select, checkbox, radio, textarea, date and shadow DOM
- Overlay highlight of filled fields and one-click undo

**Vault**
- Local profile storage in IndexedDB, with a schema covering identity, contact, address, work, education and custom fields
- Optional encryption at rest: AES-GCM with a PBKDF2-derived key (210,000 iterations, SHA-256); unlocked key held in `chrome.storage.session` only
- Multiple profiles, switchable from the popup
- JSON export and import for backup

**AI generation**
- On-device drafting of cover letters, bios and "why this company" answers via Chrome's built-in Gemini Nano, with a WebLLM extension point
- Page-context extraction: JSON-LD `JobPosting` → OpenGraph/meta → DOM headings
- Long-field detection (textarea, contenteditable) with type classification
- Review panel with streaming output, editable draft, and tone/length controls
- Graceful message when no local model is available

**Import and capture**
- CV import: PDF parsed locally with pdf.js, structured by the on-device model
- LinkedIn import from an official data export (`Profile.csv`, `Positions.csv`, `Email Addresses.csv`)
- Capture of hand-typed form values back into the profile, with provenance tracking so autofilled values aren't re-imported
- Field-by-field review diff for every import and capture, with one-step undo
- Sensitive-field blocklist — password, card number, CVV, OTP, PIN, SSN are never captured

**UI and docs**
- Popup: on/off, profile switcher, fill, undo, generate, capture, help
- Options: profile editor, imports, site whitelist, encryption, backup
- First-run onboarding
- Bundled offline help page, reachable from the popup, Settings and onboarding
- Chrome Web Store listing material, privacy policy, security policy, contributor docs

### Notes

- AI generation requires a Chrome build with Built-in AI available; all other features work without it
- Firefox packaging is generated but not yet verified on Gecko — see `scripts/package.mjs`
- Formless never submits forms and never attempts to bypass CAPTCHAs or bot detection

[Unreleased]: https://github.com/itchernetski/formless/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/itchernetski/formless/releases/tag/v0.1.0
