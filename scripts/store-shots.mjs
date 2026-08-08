#!/usr/bin/env node
// Composes the Chrome Web Store screenshots: takes the raw UI captures from
// docs/assets/ and lays each on a 1280×800 canvas with a caption.
//
//   npm run build && node scripts/screenshots.mjs && node scripts/store-shots.mjs
//   → release/store/01-fill.png … 04-import.png
//
// 1280×800 is one of the two sizes the store accepts, and the uploader rejects
// anything else outright — so the output is verified for exact size and full
// opacity before the script exits. Transparency is the other common bounce.
//
// Framing rules, from docs/chrome-web-store.md §3: no browser-chrome mockup, no
// "download now" badges, no claim the extension doesn't deliver.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "docs", "assets");
const outDir = join(root, "release", "store");

const W = 1280;
const H = 800;

const REQUIRED = ["job-filled.png", "ai-panel.png", "popup.png", "options-encrypted.png", "import-review.png"];
const missing = REQUIRED.filter((f) => !existsSync(join(assets, f)));
if (missing.length) {
  console.error(`Missing ${missing.join(", ")} in docs/assets.`);
  console.error("Run `npm run build && node scripts/screenshots.mjs` first.");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  try {
    const body = await readFile(join(assets, path));
    res.writeHead(200, { "content-type": extname(path) === ".png" ? "image/png" : "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// The landing page's visual language, so the store carousel and the site read as
// one product rather than two.
const CSS = `
  @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: auto; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111827; background: #ffffff;
    -webkit-font-smoothing: antialiased;
    display: flex; flex-direction: column; align-items: center;
  }
  .caption { padding: 46px 64px 0; text-align: center; flex: none; }
  h1 { font-size: 38px; line-height: 1.15; letter-spacing: -0.025em; font-weight: 700; }
  h1 em { font-style: normal; color: #2563eb; }
  p { margin-top: 12px; font-size: 18px; line-height: 1.45; color: #5b6472; }
  .stage { position: relative; flex: 1; width: 100%; overflow: hidden; }
  /* Screenshots sit in a rounded, shadowed frame — the only chrome we add. */
  .shot {
    position: absolute; border-radius: 12px; overflow: hidden;
    border: 1px solid #e5e7eb; box-shadow: 0 18px 48px rgba(11, 16, 32, 0.16);
    background: #fff;
  }
  .shot img { display: block; }
  .wash { position: absolute; inset: 0; background: #f7f8fa; }
`;

// Each card places one or two raw captures on the stage. `img` widths are given
// in CSS px; the sources are 2× captures, so anything at or below half the
// source width stays pixel-sharp.
const CARDS = [
  {
    file: "01-fill.png",
    title: "One click. <em>Every field.</em>",
    sub: "Name, contact, address, work history — filled from your local profile.",
    // The filled form, with the popup floated over it the way it actually opens.
    body: `
      <div class="wash"></div>
      <div class="shot" style="left:118px; top:24px; width:704px;">
        <img src="/job-filled.png" style="width:704px;" />
      </div>
      <div class="shot" style="right:100px; top:6px; width:320px; z-index:2;">
        <img src="/popup.png" style="width:320px;" />
      </div>`,
  },
  {
    file: "02-ai.png",
    title: "Cover letters written <em>on your device</em>.",
    sub: "Chrome's built-in AI drafts the long answers. No API key, no server.",
    body: `
      <div class="wash"></div>
      <div class="shot" style="left:50%; top:22px; width:900px; transform:translateX(-50%);">
        <img src="/ai-panel.png" style="width:900px;" />
      </div>`,
  },
  {
    file: "03-encrypted.png",
    title: "Your profile. Your machine. <em>Encrypted.</em>",
    sub: "AES-GCM at rest behind a password you set. Nothing syncs anywhere.",
    body: `
      <div class="wash"></div>
      <div class="shot" style="left:50%; top:26px; width:700px; transform:translateX(-50%);">
        <img src="/options-encrypted.png" style="width:700px;" />
      </div>`,
  },
  {
    file: "04-import.png",
    // Caption describes what's actually in the frame: this is the capture flow's
    // review, and the same screen serves CV and LinkedIn import. Promising "your
    // CV" over a screenshot of something else is the kind of mismatch that gets
    // a listing flagged.
    title: "Nothing saves itself. <em>You approve every field.</em>",
    sub: "CV, LinkedIn export, or values you typed — reviewed before anything is written.",
    body: `
      <div class="wash"></div>
      <div class="shot" style="left:50%; top:26px; width:760px; transform:translateX(-50%);">
        <img src="/import-review.png" style="width:760px;" />
      </div>`,
  },
];

const html = (card) => `<!doctype html><html><head><meta charset="utf-8">
<style>${CSS}</style></head><body>
  <div class="caption"><h1>${card.title}</h1><p>${card.sub}</p></div>
  <div class="stage">${card.body}</div>
</body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

for (const card of CARDS) {
  await page.goto(origin, { waitUntil: "commit" });
  await page.setContent(html(card), { waitUntil: "load" });
  // setContent leaves the base URL at about:blank, so point the images at the
  // server explicitly and wait for every one to finish decoding.
  await page.evaluate((o) => {
    for (const img of document.images) img.src = o + new URL(img.src).pathname;
  }, origin);
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 15_000 },
  );
  await page.screenshot({ path: join(outDir, card.file), type: "png" });
  console.log(`✓ release/store/${card.file}`);
}

// Verify what the uploader checks: exact dimensions, and no transparent pixel
// anywhere. Both are silent rejections if wrong, so fail loudly here instead.
const verdicts = [];
for (const card of CARDS) {
  const url = `${origin}/../store/${card.file}`;
  const data = await readFile(join(outDir, card.file));
  const b64 = data.toString("base64");
  const v = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    const { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    let minAlpha = 255;
    for (let i = 3; i < data.length; i += 4) if (data[i] < minAlpha) minAlpha = data[i];
    return { w: img.naturalWidth, h: img.naturalHeight, minAlpha };
  }, `data:image/png;base64,${b64}`);
  void url;
  verdicts.push({ file: card.file, ...v });
}

await browser.close();
server.close();

const bad = verdicts.filter((v) => v.w !== W || v.h !== H || v.minAlpha !== 255);
for (const v of verdicts) {
  console.log(`  ${v.file}  ${v.w}×${v.h}  min alpha ${v.minAlpha}`);
}
if (bad.length) {
  console.error(`\n✗ ${bad.length} file(s) would be rejected: need ${W}×${H}, fully opaque.`);
  process.exit(1);
}
console.log(`\n✓ ${verdicts.length} store screenshots, ${W}×${H}, fully opaque.`);
