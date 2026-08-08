#!/usr/bin/env node
// Renders the extension's own pages in headless Chromium and saves PNGs for the
// README / store listing / landing page.
//
//   npm run build && node scripts/screenshots.mjs
//
// The pages are served from extension/dist over http and given a minimal `chrome`
// API stub plus a seeded IndexedDB vault, so no real browser profile or extension
// install is needed. Anything that genuinely requires a live extension host — the
// in-page overlay and the AI panel — has to be captured by hand; see
// docs/store-listing.md.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "extension", "dist");
const outDir = join(root, "docs", "assets");

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  try {
    const body = await readFile(join(dist, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// Minimal chrome API surface the popup/options touch. Enough to render; not a
// functional extension.
const CHROME_STUB = `
window.chrome = {
  runtime: {
    id: "screenshot",
    lastError: undefined,
    getURL: (p) => location.origin + "/" + p,
    openOptionsPage: () => {},
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} },
  },
  tabs: {
    query: async () => [{ id: 1, url: "https://boards.greenhouse.io/acme/jobs/1234" }],
    create: async () => ({}),
    sendMessage: (_id, _msg, cb) => cb && cb({ forms: 1, candidates: 12, filled: 11 }),
  },
  storage: {
    session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
    local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
  },
};
`;

const PROFILES = [
  {
    label: "Personal",
    identity: {
      firstName: "Alex",
      lastName: "Rivera",
      fullName: "Alex Rivera",
      dateOfBirth: "1992-04-17",
      gender: "",
      nationality: "Spain",
    },
    contact: {
      email: "alex.rivera@example.com",
      phone: "+34 600 123 456",
      website: "https://alexrivera.dev",
      linkedin: "https://linkedin.com/in/alexrivera",
    },
    address: {
      line1: "Carrer de Colom 12",
      line2: "3º B",
      city: "Valencia",
      state: "Valencia",
      postalCode: "46004",
      country: "Spain",
    },
    work: {
      company: "Northwind Labs",
      jobTitle: "Senior Product Engineer",
      yearsExperience: "8",
      salaryExpectation: "",
    },
    education: {
      school: "Universitat Politècnica de València",
      degree: "BSc",
      fieldOfStudy: "Computer Science",
      graduationYear: "2014",
    },
    custom: { "how-did-you-hear": "A friend" },
  },
  { label: "Work", contact: { email: "a.rivera@northwind.example" } },
  { label: "Freelance", contact: { email: "hi@alexrivera.dev" } },
];

// Seed the vault directly through IndexedDB, matching src/vault/db.ts.
const seed = (profiles) => `
new Promise((done, fail) => {
  const req = indexedDB.open("autofill", 1);
  req.onupgradeneeded = () => {
    const d = req.result;
    if (!d.objectStoreNames.contains("profiles")) d.createObjectStore("profiles", { keyPath: "id" });
    if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
  };
  req.onerror = () => fail(req.error);
  req.onsuccess = () => {
    const d = req.result;
    const tx = d.transaction(["profiles", "meta"], "readwrite");
    const empty = { identity: {}, contact: {}, address: {}, work: {}, education: {}, custom: {} };
    const profiles = ${JSON.stringify(profiles)};
    const ids = [];
    profiles.forEach((p, i) => {
      const id = "seed-" + i;
      ids.push(id);
      tx.objectStore("profiles").put({
        id,
        plain: { ...empty, ...p, id, updatedAt: Date.now() },
        enc: null,
      });
    });
    tx.objectStore("meta").put(
      {
        enabled: true,
        activeProfileId: ids[0],
        whitelist: [],
        encryption: { enabled: false, saltB64: null, verify: null },
      },
      "settings",
    );
    tx.oncomplete = () => { d.close(); done(true); };
    tx.onerror = () => fail(tx.error);
  };
})
`;

const shots = [
  { name: "popup", page: "popup.html", width: 360, height: 420, profiles: PROFILES },
  {
    name: "popup-single-profile",
    page: "popup.html",
    width: 360,
    height: 400,
    profiles: [PROFILES[0]],
  },
  { name: "options", page: "options.html", width: 900, height: 1100, profiles: PROFILES },
  { name: "help", page: "help.html", width: 900, height: 1000, profiles: [] },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(CHROME_STUB);
  // Seed before the app's scripts read IndexedDB.
  await page.goto(`${origin}/${s.page}`, { waitUntil: "commit" });
  if (s.profiles.length) await page.evaluate(seed(s.profiles));
  await page.goto(`${origin}/${s.page}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#root > *", { timeout: 10_000 });
  // Expand the help accordions so the screenshot shows real answers.
  if (s.name === "help") {
    await page.evaluate(() =>
      document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")),
    );
  }
  const file = join(outDir, `${s.name}.png`);
  // The popup is a fixed-width panel — clip to it instead of padding the shot
  // with empty viewport. Full pages are captured whole.
  const target = s.page === "popup.html" ? page.locator(".popup") : page;
  await target.screenshot({ path: file, ...(s.page === "popup.html" ? {} : { fullPage: true }) });
  console.log(`✓ docs/assets/${s.name}.png${errors.length ? `  (page errors: ${errors.join("; ")})` : ""}`);
  await ctx.close();
}
await browser.close();
server.close();
