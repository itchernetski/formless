# Contributing to Formless

Thanks for being here. Formless is a small project with a narrow promise — fill forms well, keep data on the device — so contributions that sharpen that promise are worth far more than ones that widen it.

## The most useful contribution: site reports

Field detection is heuristic. It works until it meets a form built in a way nobody anticipated, and then it quietly fills the wrong box. Every fix starts with a report.

Open a **Site not working** issue with:

- the URL (or the ATS: Greenhouse, Lever, Workday, Ashby…)
- which fields were wrong, missed, or filled with the wrong value
- what you expected instead
- browser and version

If the page is behind a login, a saved copy of the form HTML (`Ctrl/Cmd-U` → save, or DevTools → Copy outerHTML of the `<form>`) is enough to build a regression fixture. **Scrub your own data first** — replace real names, emails and addresses with placeholders.

## Ground rules

Two rules that aren't negotiable, because they define the product:

1. **No network requests in the free tier.** No analytics, no telemetry, no remote config, no CDN fonts, no "anonymous" pings. If a PR adds a `fetch` to the extension, it needs to be an explicit, documented, opt-in feature — not a default.
2. **No CAPTCHA or bot-detection circumvention, and no auto-submit.** Formless fills and drafts; the human reviews and submits. PRs that automate submission or work around anti-bot measures will be closed.

Also worth knowing before you write code:

- Sensitive fields (password, card number, CVV, OTP, PIN, SSN) must stay excluded from capture. If you touch `src/detection/sensitive.ts`, add tests.
- Imports and captures always go through the review diff. Never write to the vault behind the user's back.
- Keep dependencies boring and few. Every new dependency in an extension that holds identity data is a supply-chain question.

## Setup

```bash
git clone https://github.com/itchernetski/formless.git
cd formless
npm install
npm run build
```

Load `extension/dist` via `chrome://extensions` → Developer mode → **Load unpacked**. `npm run dev` gives HMR for the popup/options UI; reload the extension after changes to the service worker or content script.

Handy commands:

```bash
npm test              # Vitest
npm run test:watch    # inside extension/
npm run typecheck
npm run lint
npm run package       # zips for Chrome / Firefox / Edge → release/
node scripts/screenshots.mjs   # regenerate docs/assets/*.png
```

## Working on field detection

The interesting code lives in `extension/src/detection/`:

| File | Role |
|---|---|
| `signals.ts` | extracts what a field tells us about itself (autocomplete, name, id, label, aria-label, placeholder) |
| `fielddefs.ts` | the catalogue of profile fields and the tokens that hint at each |
| `mapping.ts` | weighted scoring of signals → best profile field, above a confidence threshold |
| `fill.ts` | writing values in a way frameworks notice (native setters + `input`/`change` events) |
| `capture.ts` | the reverse direction: page values → profile fields |
| `sensitive.ts` | the blocklist that capture must respect |

To add coverage for a new field or site pattern, start with a failing test in `extension/tests/mapping.test.ts` using a minimal HTML fixture, then adjust `fielddefs.ts`. Prefer a new token or synonym over a new special case; prefer a special case over lowering the threshold. Lowering the threshold makes every site slightly wronger.

## Pull requests

- Branch off `main`, one concern per PR.
- Add tests for anything with logic. Detection and vault changes without tests won't be merged.
- `npm run lint && npm run typecheck && npm test && npm run build` must pass — CI runs exactly this.
- Match the surrounding code: existing comment density, existing naming, no reformatting of untouched lines.
- Describe the user-visible effect in the PR body, and say how you verified it. "Tested on <URL>" is a great sentence.

Commits and code in English; issue discussion in English or Russian, whichever you prefer.

## Scope

Things that fit: better detection, more field types, site-specific fixes, accessibility, import sources, i18n of the UI, reducing bundle size, tests.

Things that likely don't: submitting forms for the user, scraping sites for profile data, cloud storage of plaintext profiles, analytics, bundling a large local model into the extension package.

If you're unsure whether an idea fits, open a Discussion before building it. Much better than a closed PR.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
