# Chrome Web Store — publishing Formless, step by step

Everything from a cold Google account to a public listing, in order, with the exact values to paste. Listing copy lives in [`store-listing.md`](store-listing.md); this document is the mechanics.

Read [§0](#0-before-you-touch-the-dashboard) first — two of those items will get you rejected, and one of them is a code change you probably want to make *before* the first submission rather than after.

---

## 0. Before you touch the dashboard

### 0.1 Drop the `tabs` permission — done

> **Status:** removed. `permissions` in `extension/manifest.config.ts` is now `["storage", "activeTab"]`, and the permission tables in `README.md`, `PRIVACY.md`, `landing/privacy.html` and `store-listing.md` were updated to match. Verified in a real browser; the automated e2e harness can't load an unpacked MV3 extension headlessly, so that check stays manual.

This is the single biggest lever on review friction. Reviewers scrutinise `tabs` because it reads URLs of *all* tabs; `activeTab` grants the same access to the one tab the user clicked on, only after they click.

What Formless actually uses:

| Call | Needs `tabs`? |
|---|---|
| `chrome.tabs.query({active: true, currentWindow: true})` | No |
| `chrome.tabs.create(...)` (Settings, Help, capture review) | No |
| `chrome.tabs.sendMessage(...)` | No |
| Reading `tab.url` in `Popup.tsx` → `hostOf(tab?.url)` for the whitelist check | **Yes — or `activeTab`** |

`activeTab` grants host access to the active tab once the user invokes the extension, and that includes reading its `url`. Since the whitelist check only ever runs from the popup — which *is* a user invocation — `activeTab` alone should cover it.

So: remove `"tabs"` from `permissions` in `extension/manifest.config.ts`, rebuild, and verify in a real browser that the popup still shows the hostname and the whitelist gate still works. That deletes a whole permission justification and a reviewer's favourite question.

- [x] `"tabs"` removed from the manifest; `npm test` (68 tests) and `npm run package` both pass, all three zips ship `["storage", "activeTab"]`
- [x] **Manual check** — `extension/dist` loaded unpacked, popup renders the hostname and the whitelist still gates filling with `activeTab` alone

Do this **before** the first submission. Reducing permissions in an update is fine; adding them later triggers a fresh review and can re-prompt users.

### 0.2 Host a public privacy policy

Chrome will not accept a link to a file inside a GitHub repo as a privacy policy. It needs a real, public, stable URL.

`landing/privacy.html` exists for exactly this, and **GitHub Pages serves it** — `.github/workflows/pages.yml` deploys `landing/` on every push that touches it. → `https://itchernetski.github.io/formless/privacy.html`

The "Pages only serves `/` or `/docs`" limitation applies to the *branch* deploy source. With **Source: GitHub Actions**, `actions/upload-pages-artifact` publishes any directory, so `landing/` needs neither a copy into `docs/` nor a `gh-pages` subtree push. Every path in `landing/` is relative, so the `/formless/` subpath doesn't break the stylesheet, icons or the `index.html` ↔ `privacy.html` links.

One manual step, once: **Settings → Pages → Source: GitHub Actions**. The workflow fails until it's set.

Verify it loads in a private window before pasting it into the dashboard.

### 0.3 Everything else in the pre-flight

- [ ] Manual walkthrough in a real Chrome — the checklist in [`oss-release.md` §3](oss-release.md). A listing rejected for a broken feature costs days; five minutes of clicking costs five minutes.
- [x] Support contact is `tchernetski@gmail.com` — a real inbox, and the address to put in the dashboard's contact field
- [x] Four composed 1280×800 screenshots — `npm run store-shots`, see [§3](#3-graphic-assets)
- [ ] The GitHub repo is **public**, because the listing links to it and reviewers will open it
- [x] `npm run package` produces `release/formless-0.1.0-chrome.zip` (plus the edge and firefox zips)

---

## 1. Developer account

1. Go to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) and sign in with the Google account that will own the extension. **Pick this deliberately** — transferring an item between accounts later is painful. A dedicated project account is a reasonable choice if you don't want the listing tied to a personal address.
2. Enable **2-Step Verification** on that account. Publishing is blocked without it.
3. Pay the **one-time $5 USD registration fee**. It covers the account, not per-item.
4. **Account → Account settings**, fill in:
   - **Publisher name** — what users see under the extension name. `Ilya Chernetskiy` or a project name; not an email address.
   - **Contact email** — and verify it. Google uses it for review correspondence, including rejection reasons.
   - **Privacy policy URL** — the URL from §0.2. This is set once at the account level and applies to all your items.
   - **Trader status** — a declaration required for EU distribution. Confirm the current wording and consequences in the dashboard: the answer affects whether your item is distributed in the EU, and getting it wrong is a compliance problem, not a cosmetic one. If you're in the EU yourself and want EU users, read this screen carefully rather than clicking through it.

> Values here are account-wide and are shown publicly. Fill them before creating the item, so the item form doesn't block on a missing field.

---

## 2. Create the item and upload

```bash
npm run package     # → release/formless-0.1.0-chrome.zip
```

The zip must have `manifest.json` at its **root**, not nested in a folder. `scripts/package.mjs` zips the contents of `extension/dist`, so this is already correct — but if you ever hand-zip, check it:

```bash
unzip -l release/formless-0.1.0-chrome.zip | head
```

Then: **Items → Add new item → Choose file** → upload the chrome zip.

The dashboard parses the manifest and creates a draft. Version, name and description are read from the package, not typed in — to change them, change `manifest.config.ts` (or `extension/package.json` for the version) and re-upload.

**Save the draft** before filling anything else in. The form loses work on navigation more often than you'd hope.

---

## 3. Graphic assets

| Asset | Spec | Required | Source |
|---|---|---|---|
| Store icon | 128×128 PNG, no alpha padding tricks | Yes | `extension/public/icons/icon-128.png` |
| Screenshots | **1280×800** or 640×400 PNG/JPEG, 1–5 of them | Yes (≥1) | compose from `docs/assets/` |
| Small promo tile | 440×280 PNG | No, but strongly recommended — needed for most store placements | compose from `brand/` |
| Marquee promo tile | 1400×560 PNG | No — only used for featured placement | skip for now |

Screenshots are the listing. Most people decide from the first one.

All four are generated. One command:

```bash
npm run store-shots     # → release/store/01-fill.png … 04-import.png
```

That runs `scripts/screenshots.mjs` (raw UI at 2× into `docs/assets/`) and then `scripts/store-shots.mjs`, which lays each capture on a 1280×800 canvas in the landing page's visual language and verifies the output is exactly 1280×800 with no transparent pixel — the two things the uploader rejects silently.

The set, in order:

| # | File | Shows | Caption |
|---|---|---|---|
| 1 | `01-fill.png` | filled form + popup + "Filled 10 fields" toast | *One click. Every field.* |
| 2 | `02-ai.png` | AI panel mid-stream drafting a cover letter | *Cover letters written on your device.* |
| 3 | `03-encrypted.png` | whitelist populated, vault encrypted | *Your profile. Your machine. Encrypted.* |
| 4 | `04-import.png` | review modal, new/update/unchanged per field | *Nothing saves itself. You approve every field.* |

Nothing here is staged. The scenes drive the **real** content script against `scripts/fixtures/job-application.html`: shot 1 runs the actual fill (and reports what it filled, failing if that's zero), shot 2 opens the genuine AI panel against a stubbed Prompt API and asserts the panel is pinned to the viewport, shot 3 clicks through the real "Enable encryption" button so the ✓ state is earned, and shot 4 comes through the real pending-capture handoff.

The fixture is a **neutral** application page, not a capture of Greenhouse or Lever. Putting a third party's trademark in your own store artwork invites a takedown after publication, which is worse than a rejection before it.

**Don't** put a browser chrome mockup around them, don't add "Download now" badges, and don't include text that promises anything the extension doesn't do — all three are common rejection or takedown triggers. Caption 4 is worded the way it is for exactly this reason: the frame shows the capture flow, so it doesn't claim to show a CV import.

---

## 4. Store listing tab

Paste from [`store-listing.md`](store-listing.md). Field limits:

| Field | Limit | Value |
|---|---|---|
| Title | 75 chars | `Formless — privacy-first form autofill` (38) |
| Summary | **132 chars**, single line, no line breaks | `Fill forms from a local, encrypted profile and draft the long answers with on-device AI. Nothing leaves your browser.` (131) |
| Description | 16,000 chars | the block in `store-listing.md` |
| Category | — | **Productivity** → Workflow & Planning |
| Language | — | English |

Notes that matter:

- The **summary** is what shows in search results. Do not waste it restating the title.
- The description's first two lines are what expand in the listing preview — the "no account, no server, nothing leaves your browser" line earns the click, so keep it near the top.
- Keyword stuffing, competitor names, and "best/#1" claims are policy violations. The description as written is clean; don't "optimise" it later by adding a keyword list.
- Add the **support URL** → `https://github.com/itchernetski/formless/issues` and **homepage URL** → the landing page or the repo.

---

## 5. Privacy tab — the part that gets people rejected

This is where a mismatch between what you declare and what the code does becomes a rejection, so answer it from the code, not from memory.

### Single purpose

Formless does autofill *and* AI drafting *and* CV import, and a reviewer may read that as three purposes. Frame it as one — the narrow purpose is "filling out web forms", and everything else serves it:

> Formless fills web forms from a locally stored user profile and helps the user draft long-form answers to form questions using the browser's on-device AI model.

Import and capture are how the profile gets populated, so they're in service of that same purpose. If a reviewer pushes back, that's the argument to make.

### Permission justifications

One field per permission. Keep them to what's true and mechanical:

| Permission | Justification to paste |
|---|---|
| `storage` | Stores the user's profile and settings locally on their device. No remote storage is used. |
| `activeTab` | Identifies the page the user clicked the extension icon on, so the correct form is detected and filled. |
| `tabs` | *(omit entirely if you dropped it in §0.1)* Opens the extension's own Settings and Help pages, and reads the active tab's hostname to apply the user's site whitelist. |
| Host permissions `http://*/*`, `https://*/*` | The content script must run on the page containing the form in order to detect its fields and fill them. Users can restrict this to specific sites using the built-in whitelist. |

The host permission field is the one that draws scrutiny. The honest, effective answer is the functional necessity plus the mitigation (the whitelist) — which is exactly what's written above.

### Remote code

Answer **No**. Then, if asked to elaborate: all code is bundled into the package at build time; nothing is fetched, injected, or evaluated at runtime. This is true — verify it stays true by checking that no `eval`, `new Function`, or remote `<script>`/`import()` of a URL exists in `extension/dist`.

### Data usage disclosures

Declare **nothing collected** for every category:

- Personally identifiable information — no
- Health information — no
- Financial and payment information — no
- Authentication information — no
- Personal communications — no
- Location — no
- Web history — no
- User activity — no
- Website content — no

That last one deserves a moment of thought, because the content script *reads* page content. "Collect" in Google's sense means transmit or store off-device for your own use. Formless computes over page content in memory and discards it; nothing is transmitted anywhere and nothing is retained. So "no" is correct — and if a reviewer questions it, the answer is that there is no network egress at all, which they can verify in seconds.

Then check all three certifications:

- [ ] I do not sell or transfer user data to third parties, apart from the approved use cases
- [ ] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [ ] I do not use or transfer user data to determine creditworthiness or for lending purposes

All three are true for Formless.

---

## 6. Distribution tab

| Setting | Value |
|---|---|
| Visibility | **Unlisted** for the first submission — see below |
| Distribution regions | All, unless the trader-status screen in §0.4 says otherwise for the EU |
| Pricing | Free |

**Publish Unlisted first.** An unlisted item still goes through full review, but it doesn't appear in search or category browsing — only people with the direct link can find it. That gives you:

- a real store install to test (store installs behave differently from unpacked: no `chrome://extensions` developer mode, real extension ID, real update channel)
- a link to hand to alpha testers, which converts far better than "clone and build"
- room to fix a mortifying bug before anyone is watching

When you're happy, flip visibility to **Public**. That's a listing change and goes through review again, but it's a fast one.

Do **not** launch on Product Hunt off an unlisted item — the listing needs to be public and searchable first. See [`launch/product-hunt.md`](launch/product-hunt.md).

---

## 7. Submit

Hit **Submit for review**. You'll be asked whether to publish automatically on approval or hold it — for the first submission, **hold it**, so you control the moment it goes live.

What to expect:

- Many reviews finish within a day. Extensions with broad host permissions — which Formless has, by necessity — routinely take longer. Plan for **several days**, not hours, and don't schedule anything around an assumed approval date.
- The item is locked while in review. You can't edit the draft; a new upload cancels and restarts.
- Correspondence goes to the account contact email. Check spam.

While you wait, tag the submitted build so a rejection can be diffed against exactly what was reviewed:

```bash
git tag -a submitted/cws-0.1.0 -m "Submitted to Chrome Web Store"
git push --tags
```

---

## 8. If it's rejected

Rejections are routine and usually specific. The email names a policy; read the named policy, not the summary.

The ones Formless is most likely to hit, and the fix for each:

| Rejection | What it actually means | Fix |
|---|---|---|
| **Broad host permissions not justified** | The `http://*/*` + `https://*/*` content script looked broader than the described function | Strengthen the justification: forms appear on arbitrary sites, and the whitelist lets users narrow it. Point at the specific source file that does the filling. |
| **Single purpose violation** | Autofill + AI + import read as a bundle of features | Re-state as §5: one purpose (filling forms), with import/capture as the means of populating the profile |
| **Privacy policy missing or inadequate** | The URL 404s, isn't public, or doesn't cover declared practices | Verify the URL in a private window; `landing/privacy.html` covers every category |
| **Data disclosure mismatch** | Declared "no collection" but reviewer saw the content script reading page data | Explain in-memory processing with zero egress; offer that there are no network calls at all |
| **Metadata / keyword spam** | Description or title stuffed with terms | Use the copy as written in `store-listing.md` |
| **Requested permission not used** | A permission in the manifest that no code path needs | This is exactly why §0.1 matters — remove what you don't use |

Fix, bump the version in `extension/package.json`, `npm run package`, re-upload, resubmit. Reply to the rejection email with what you changed; it visibly speeds up the second pass.

---

## 9. After it's live

1. **Note the extension ID** from the dashboard URL. It's permanent, and you'll want it for the store link, the README install line, and any future update tooling.
2. **Update the docs** with the real store link:
   - `README.md` → replace the "From a store: Not published yet" section with the install link
   - `landing/index.html` → the install section currently shows build-from-source; add the store button as the primary CTA
   - `docs/store-listing.md` → change the status line from "not submitted"
3. **Tag the release** so GitHub and the store agree on what 0.1.0 is:
   ```bash
   git tag v0.1.0 && git push --tags     # release.yml attaches the three zips
   ```
4. **Watch the first reviews.** Store reviews are the only feedback channel most users will ever use, and they're public. Reply to them.

### Shipping updates

```bash
# bump extension/package.json version — the manifest reads it
npm run package
# upload the new zip to the existing item → submit for review
```

Notes:

- Version must be strictly higher than the published one. Chrome uses dotted integers; `0.1.1` and `0.2.0` are both fine, `0.1.0-beta` is not.
- Every update goes through review, including one-line fixes.
- **Adding** a permission can trigger a re-prompt that disables the extension for existing users until they accept. Removing permissions never does. Batch permission changes deliberately.
- For anything risky, use the dashboard's **partial rollout** to release to a percentage of users first.
- Update `CHANGELOG.md` in the same commit. The store's "What's new" field is a worse changelog than a real one, but it should say the same thing.

---

## Other stores, briefly

Both can wait until Chrome is live and stable.

**Edge Add-ons** — free Microsoft Partner Center account, `release/formless-0.1.0-edge.zip` (byte-identical to the Chrome build). Same listing copy. Reviews are typically slower but less demanding. The store surface is much smaller; do it because it's ~30 minutes, not because it's growth.

**Firefox AMO** — free account, `release/formless-0.1.0-firefox.zip`. Two real caveats: the Gecko manifest generated by `scripts/package.mjs` has **never been loaded in Firefox**, so verify it via `about:debugging` → This Firefox → Load Temporary Add-on first; and AMO reviewers will ask harder questions about the all-sites content script than Google did. Their reviewers read source, so the MIT repo helps. Expect to iterate on the manifest.
