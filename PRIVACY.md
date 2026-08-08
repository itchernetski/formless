# Privacy Policy — Formless

**Last updated: 8 August 2026** · Applies to Formless browser extension 0.1.x

## The short version

Formless makes no network requests. It has no server, no account system, no analytics, and no telemetry. Everything you put into it stays in your browser's storage on your device.

There is no data for us to collect, sell, share, or lose, because none of it ever reaches us.

## What Formless stores, and where

All of it lives in your browser's local storage (IndexedDB and `chrome.storage`), on the device where you installed the extension:

| Data | Purpose |
|---|---|
| Profile fields — name, contact details, address, work and education history, custom fields | Filling forms and drafting text |
| Settings — on/off state, site whitelist, active profile, encryption metadata (salt + verification blob) | Making the extension behave as you configured it |
| Unlocked encryption key, when encryption is enabled | Held in `chrome.storage.session` only; discarded when the browser closes |

If you enable encryption, profile records are stored as AES-GCM ciphertext, with the key derived from your master password (PBKDF2, 210,000 iterations, SHA-256). The password itself is never stored. If you lose it, the data cannot be recovered — not by us, not by anyone.

## What Formless reads while you browse

To find and fill forms, the content script reads the structure of pages you use it on: field names, labels, `autocomplete` attributes, placeholders, and for AI drafting, visible page text such as a job title and description.

This reading happens locally, in the moment, to compute what to fill or draft. It is not stored, logged, or transmitted. If you restrict the site whitelist in Settings, the extension won't act outside it.

## AI generation

Drafting uses the AI model built into your browser (Chrome's Gemini Nano). Your prompt — page context plus the relevant parts of your profile — is processed by that on-device model. No API key, no request to us, no request to Anthropic, OpenAI, Google, or anyone else. If the model isn't available, the feature simply reports that and does nothing.

## Saving what you type ("capture")

When you click *Save filled fields to profile*, Formless reads the values currently in the form and proposes profile updates, which you approve field by field. Fields recognised as sensitive — passwords, card numbers, CVV, OTP, PIN, SSN — are excluded before the proposal is built, and never enter the profile through this path.

## What Formless never does

- Send any data off your device
- Submit forms on your behalf
- Solve or circumvent CAPTCHAs or bot detection
- Load remote code, remote fonts, or remote configuration
- Include analytics, crash reporting, A/B testing, or usage counters
- Create an account or identifier for you

## Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Keep your profile and settings on the device |
| `activeTab` | Know which page you clicked the icon on |
| Content script on `http://*/*` and `https://*/*` | Detect and fill forms on the page you're using. Narrow this with the site whitelist. |

Formless requests no permission to contact remote hosts, because it doesn't contact any.

## Your data, your control

- **See it** — Settings shows every stored field.
- **Change it** — edit or delete any field, or delete a whole profile.
- **Back it up** — Settings → Backup exports plain JSON. It is unencrypted by design so it stays readable; store it somewhere safe.
- **Erase it** — removing the extension from your browser deletes its storage. Nothing survives elsewhere.

## Children

Formless isn't directed at children under 13 and collects nothing from anyone, including them.

## Third parties

There are none. No processors, no sub-processors, no SDKs phoning home. Dependencies are bundled at build time and listed in `extension/package.json`; you can audit them in the repository.

## If this ever changes

A future optional paid tier may send page context and selected profile fields to a server in order to generate text with a hosted model. That would be strictly opt-in, off by default, and documented here before it ships — and the local tier will keep working with no network access. Any such change will be announced in `CHANGELOG.md` with a new "Last updated" date above.

## Contact

Questions: **privacy@tchernetski.com**. Security issues: see [SECURITY.md](SECURITY.md).
