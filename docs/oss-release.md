# OSS release runbook — Formless

What's already prepared, what you have to do by hand, and the order to do it in.

---

## 1. Repo links — done

All public-facing links point at **`itchernetski/formless`** (set 2026-08-08). Verify after any future rename:

```bash
grep -rn 'github.com/' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=release --exclude-dir=.git . \
  | grep -v 'itchernetski/formless'
```

The URL is compiled into the extension bundle (`extension/manifest.config.ts` → `homepage_url`, `extension/src/help/Help.tsx` → Help page links), so **rebuild after any rename** or the in-extension Help links break.

Still to decide: the contact addresses used across the docs, and either set them up or change them:

| Address | Used in |
|---|---|
| `security@tchernetski.com` | `SECURITY.md` |
| `privacy@tchernetski.com` | `PRIVACY.md`, `landing/privacy.html` |
| `conduct@tchernetski.com` | `CODE_OF_CONDUCT.md` |
| `tchernetski@gmail.com` | store listing (support contact) |

## 2. Create the repo and push

The working copy is already a git repo (`git init -b main`, no commits yet) with a `.gitignore` covering `node_modules/`, `dist/`, `release/`, `brand/dist/` and local tool config. Review `git status` before the first commit.

```bash
git add -A
git commit -m "Formless 0.1.0 — privacy-first form autofill with on-device AI"
gh repo create "$OWNER/$REPO" --public --source=. --push \
  --description "Fill forms from a local, encrypted profile and draft the long answers with on-device AI. Zero network requests."
```

Then in repo settings:

- [ ] Topics: `chrome-extension`, `autofill`, `privacy`, `local-first`, `manifest-v3`, `gemini-nano`, `on-device-ai`, `job-search`, `typescript`
- [ ] Enable **Discussions** (the issue-template config links to it)
- [ ] Enable **Private vulnerability reporting** (Settings → Security) — `SECURITY.md` and the issue-template config both point at it
- [ ] Branch protection on `main`: require the CI check
- [ ] Description and website field → landing page URL

## 3. Verify the build in a real browser

CI covers lint, typecheck, tests and build. It cannot cover an actual extension host, so this part is manual — and it's the part that catches real breakage.

```bash
npm install
npm run build
```

`chrome://extensions` → Developer mode → **Load unpacked** → `extension/dist`, then walk through:

- [ ] Onboarding opens on install; profile saves
- [ ] Popup fills a form on a real job posting (Greenhouse or Lever are good tests)
- [ ] Undo reverts the fill
- [ ] Profile dropdown appears with 2+ profiles and switching changes what gets filled
- [ ] **Help ?** in the popup opens `help.html`, accordions expand, GitHub links resolve
- [ ] Help link in Settings header and the "How it works" link in onboarding both work
- [ ] ✨ Generate with AI streams a draft, or reports no model cleanly if Built-in AI is off
- [ ] ＋ Save filled fields → review diff → applies, and Undo restores
- [ ] CV import (PDF) and LinkedIn CSV import
- [ ] Encryption: enable, lock (restart browser), unlock with the master password, wrong password rejected
- [ ] Export/import JSON round-trips
- [ ] Whitelist blocks a non-listed site

Capture the remaining marketing assets while you're in there — see the checklist at the end of `store-listing.md`. The generated screenshots in `docs/assets/` cover the extension's own pages; the in-page overlay, the AI panel and the demo GIF need a live install.

## 4. Package

```bash
npm run package     # → release/formless-0.1.0-{chrome,firefox,edge}.zip
```

Firefox: the Gecko manifest is generated (`background.scripts` instead of `service_worker`, plus `browser_specific_settings`) but **has never been loaded in Firefox**. Before submitting to AMO, check it via `about:debugging` → This Firefox → Load Temporary Add-on. Expect to iterate.

Edge: byte-identical to the Chrome build; the separate zip exists only because it's a separate upload.

## 5. Tag the release

```bash
git tag v0.1.0
git push --tags
```

`.github/workflows/release.yml` builds, packages, and attaches the three zips to a GitHub release. Store submission stays manual on purpose.

## 6. Store submission

Follow [`chrome-web-store.md`](chrome-web-store.md) — the full procedure, from a cold Google account through every dashboard field to the rejection playbook. [`store-listing.md`](store-listing.md) holds the copy it tells you to paste.

Three things it asks you to do *before* the first submission:

- ~~**Try dropping the `tabs` permission**~~ — done (`chrome-web-store.md` §0.1). `activeTab` covers everything Formless used it for. Still verify in a real browser that the popup shows the hostname.
- **Host the privacy policy publicly.** Chrome rejects a link into a repo. `landing/privacy.html` exists for this — deploy `landing/` to Cloudflare Pages / Netlify (output dir `landing`, no build command), or push it to `gh-pages`:
  ```bash
  git subtree push --prefix landing origin gh-pages
  # → https://itchernetski.github.io/formless/privacy.html
  ```
- **Compose the four 1280×800 screenshots.** `docs/assets/*.png` are raw 2× UI captures, not store-ready.

## 7. Launch

[`launch/product-hunt.md`](launch/product-hunt.md) has the tagline, maker comment, gallery plan, hour-by-hour sequence, and prepared answers to the questions that always come up. Don't run it before the store listing is live — "load unpacked from source" converts terribly on Product Hunt.

Alpha round first: put it in front of a handful of people who'll actually use it, collect site reports, fix detection, *then* launch.

---

## What's done vs. what's blocked

**Done and in the repo:**

- MIT `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `PRIVACY.md`, `CHANGELOG.md`
- Issue templates (bug, feature, site-not-working) + Discussions/security contact links, PR template
- Branding: name, `brand/icon.svg`, `brand/logo.svg`, rendered PNG icon set wired into the manifest
- Generated UI screenshots (`scripts/screenshots.mjs` → `docs/assets/`)
- Cross-browser packaging (`scripts/package.mjs`) and a release workflow
- Landing page with a hostable privacy policy (`landing/`)
- Store listing copy, permission justifications, data-disclosure answers
- Product Hunt kit

**Blocked on you (accounts, credentials, a real browser, or a decision):**

- Replacing `itchernetski/formless` and creating the GitHub repo
- The manual browser walkthrough in step 3
- Hand-captured assets: in-page overlay, AI panel, import diff, demo GIF
- Chrome Web Store ($5 account), Edge Partner Center, Firefox AMO submissions
- Hosting the landing page so the privacy URL is public
- Setting up the four contact email addresses
- Firefox/Gecko verification
- Alpha round and the Product Hunt date
