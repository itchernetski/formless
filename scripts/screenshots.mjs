#!/usr/bin/env node
// Renders the extension's own pages in headless Chromium and saves PNGs for the
// README / store listing / landing page.
//
//   npm run build && node scripts/screenshots.mjs
//
// The pages are served from extension/dist over http and given a minimal `chrome`
// API stub plus a seeded IndexedDB vault, so no real browser profile or extension
// install is needed.
//
// The last three shots go further and drive the REAL content script against the
// fixture in scripts/fixtures/: the loader resolves through the stubbed
// chrome.runtime.getURL, so autofill, the overlay highlight and the AI panel all
// run their genuine code paths. That is what makes the store screenshots
// reproducible instead of hand-captured — see docs/chrome-web-store.md §3.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "extension", "dist");
const fixtures = join(root, "scripts", "fixtures");
const outDir = join(root, "docs", "assets");

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// The content-script loader is content-hashed, so read it out of the manifest
// rather than hardcoding a filename that changes on every build.
const CONTENT_LOADER = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"))
  .content_scripts[0].js[0];

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
  // /fixture/* serves the mock application page; everything else is the build.
  const file = path.startsWith("/fixture/")
    ? join(fixtures, path.slice("/fixture/".length))
    : join(dist, path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const JOB_URL = "https://jobs.lumensystems.example/senior-product-engineer";

// Minimal chrome API surface the popup/options/content script touch. Enough to
// render and to exchange messages; not a functional extension.
// `session` seeds chrome.storage.session, which is how the popup hands a capture
// over to the options page (see shared/messaging.ts PENDING_CAPTURE_KEY).
const chromeStub = (session = {}) => `
window.__msgListeners = [];
window.__session = ${JSON.stringify(session)};
window.chrome = {
  runtime: {
    id: "screenshot",
    lastError: undefined,
    getURL: (p) => location.origin + "/" + p,
    openOptionsPage: () => {},
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: (fn) => window.__msgListeners.push(fn) },
  },
  tabs: {
    query: async () => [{ id: 1, url: ${JSON.stringify(JOB_URL)} }],
    create: async () => ({}),
    sendMessage: (_id, _msg, cb) => cb && cb({ forms: 1, candidates: 12, filled: 11 }),
  },
  storage: {
    session: {
      get: async (k) => (k in window.__session ? { [k]: window.__session[k] } : {}),
      set: async () => {},
      remove: async (k) => { delete window.__session[k]; },
    },
    local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
  },
};
`;

// Stands in for Chrome's built-in Prompt API (globalThis.LanguageModel), which
// headless Chromium has no model for. Streams a fixed answer and then stalls, so
// the panel can be photographed mid-generation deterministically rather than
// racing a real model.
const LANGUAGE_MODEL_STUB = `
window.LanguageModel = {
  availability: async () => "available",
  create: async () => ({
    promptStreaming() {
      const text = ${JSON.stringify(
        "I've spent the last eight years building data platforms, and the part I keep " +
          "coming back to is the unglamorous half: making the thing dependable enough " +
          "that other engineers stop thinking about it. Lumen's posting is unusually " +
          "direct about owning reliability and developer experience together, which is " +
          "the pairing I'd argue for anyway.\n\nAt Northwind Labs I took our ingestion " +
          "pipeline from a weekly on-call fire to something the team shipped against " +
          "without ceremony.",
      )};
      const words = text.split(" ");
      return (async function* () {
        for (let i = 0; i < words.length; i++) {
          yield (i ? " " : "") + words[i];
          await new Promise((r) => setTimeout(r, 12));
        }
        // Hold the "Generating…" state open for the screenshot.
        await new Promise(() => {});
      })();
    },
    destroy() {},
  }),
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

// A complete Profile (the seeds above are sparse) for messages sent to the
// content script, which reads it directly rather than through the vault.
const EMPTY_SECTIONS = { identity: {}, contact: {}, address: {}, work: {}, education: {}, custom: {} };
const FULL_PROFILE = { ...EMPTY_SECTIONS, ...PROFILES[0], id: "seed-0", updatedAt: 0 };

// What the popup's "capture" hands to the options page: values a user typed into
// a form that aren't in the profile yet, plus one that disagrees with it.
const PENDING_CAPTURE = {
  pending_capture: {
    host: "jobs.lumensystems.example",
    fields: [
      { path: "work.salaryExpectation", value: "€85,000", source: "form:jobs.lumensystems.example" },
      { path: "work.yearsExperience", value: "9", source: "form:jobs.lumensystems.example" },
      { path: "contact.phone", value: "+34 611 909 220", source: "form:jobs.lumensystems.example" },
      { path: "address.city", value: "Valencia", source: "form:jobs.lumensystems.example" },
      { path: "custom.notice-period", value: "One month", source: "form:jobs.lumensystems.example" },
      { path: "custom.work-authorisation", value: "EU citizen", source: "form:jobs.lumensystems.example" },
    ],
  },
};

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

// Load the real content script and deliver a message to its listener, exactly as
// the popup would. Returns once the listener has responded.
async function runContentScript(page, message) {
  await page.addScriptTag({ url: `${origin}/${CONTENT_LOADER}` });
  await page.waitForFunction(() => window.__msgListeners.length > 0, null, { timeout: 10_000 });
  return page.evaluate(
    (msg) =>
      new Promise((res) => {
        for (const fn of window.__msgListeners) fn(msg, {}, res);
        setTimeout(() => res(null), 5000);
      }),
    message,
  );
}

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

  // The store-screenshot scenes. Viewport shots, not fullPage: the framing is
  // the point, and scripts/store-shots.mjs composes them onto 1280×800.
  {
    name: "job-filled",
    // Narrow enough that the application card nearly fills the frame — the
    // store card crops to this, and a legible form is the whole point.
    page: "fixture/job-application.html",
    width: 900,
    height: 800,
    profiles: [],
    fullPage: false,
    async drive(page) {
      const r = await runContentScript(page, { type: "AUTOFILL_FILL", profile: FULL_PROFILE });
      if (!r?.filled) throw new Error(`autofill filled nothing (${JSON.stringify(r)})`);
      await page.evaluate(() => window.scrollTo(0, 232));
      return `filled ${r.filled}/${r.candidates}`;
    },
  },
  {
    name: "ai-panel",
    // Tighter than the fill shot: the panel is the subject, so the frame is
    // sized to keep its 380px of UI legible once scaled onto the store card.
    page: "fixture/job-application.html",
    width: 1000,
    height: 740,
    profiles: [],
    fullPage: false,
    languageModel: true,
    async drive(page) {
      await runContentScript(page, { type: "AUTOFILL_FILL", profile: FULL_PROFILE });
      // The fill toast self-removes after 6s; wait it out so it doesn't compete
      // with the panel for attention in the same corner of the frame.
      await page.waitForSelector(".box", { state: "detached", timeout: 15_000 });
      const r = await runContentScript(page, { type: "AUTOFILL_GENERATE", profile: FULL_PROFILE });
      if (!r?.longFields) throw new Error("no long fields detected on the fixture");
      await page.evaluate(() => window.scrollTo(0, 232));
      // The panel must actually float. jsdom can't check this — it doesn't
      // implement the `all` shorthand, so a unit test would pass either way —
      // and a static host lands below the fold where nobody ever sees it.
      const pos = await page.evaluate(() => {
        const el = [...document.documentElement.children].find((n) =>
          n.shadowRoot?.getElementById("out"),
        );
        const s = getComputedStyle(el);
        return { position: s.position, top: el.getBoundingClientRect().top };
      });
      if (pos.position !== "fixed" || pos.top < 0 || pos.top > 200) {
        throw new Error(`AI panel is not pinned to the viewport: ${JSON.stringify(pos)}`);
      }
      // Draft the cover letter specifically — it's what the store caption
      // promises, and picking it exercises the panel's field/type sync.
      await page.selectOption("#field", { label: "Cover letter" });
      await page.click("#gen");
      // Photograph it mid-stream: enough text to read, still generating.
      // The panel lives in a shadow root on a host appended to <html>, so walk
      // documentElement's children rather than guessing a selector.
      await page.waitForFunction(
        () =>
          [...document.documentElement.children].some(
            (el) => el.shadowRoot?.getElementById("out")?.value.length > 260,
          ),
        null,
        { timeout: 15_000 },
      );
      return `${r.longFields} long fields`;
    },
  },
  {
    // Encryption actually turned on, through the real UI: the button runs
    // PBKDF2 over the seeded vault, so the "✓ encrypted at rest" state in the
    // screenshot is the genuine one and not a mocked string.
    name: "options-encrypted",
    page: "options.html",
    width: 900,
    height: 820,
    profiles: PROFILES,
    fullPage: false,
    async drive(page) {
      // A whitelist with entries in it, so the card shows the mitigation the
      // store listing points at rather than an empty box.
      await page.fill("textarea", "*.greenhouse.io\nlever.co\njobs.lumensystems.example");
      await page.click("text=Save whitelist");
      await page.fill('input[placeholder="Master password"]', "correct horse battery staple");
      await page.click("text=Enable encryption");
      await page.waitForSelector("text=Your vault is encrypted at rest", { timeout: 20_000 });
      await page.evaluate(() =>
        [...document.querySelectorAll("h2")]
          .find((h) => h.textContent === "Site whitelist")
          ?.scrollIntoView({ block: "start" }),
      );
      await page.evaluate(() => window.scrollBy(0, -24));
    },
  },
  {
    name: "import-review",
    page: "options.html#capture",
    width: 1000,
    height: 860,
    profiles: PROFILES,
    session: PENDING_CAPTURE,
    fullPage: false,
    async drive(page) {
      await page.waitForSelector(".modal", { timeout: 10_000 });
    },
  },
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
  await page.addInitScript(chromeStub(s.session));
  if (s.languageModel) await page.addInitScript(LANGUAGE_MODEL_STUB);
  // Seed before the app's scripts read IndexedDB.
  await page.goto(`${origin}/${s.page}`, { waitUntil: "commit" });
  if (s.profiles.length) await page.evaluate(seed(s.profiles));
  await page.goto(`${origin}/${s.page}`, { waitUntil: "networkidle" });
  if (!s.page.startsWith("fixture/")) await page.waitForSelector("#root > *", { timeout: 10_000 });
  // Expand the help accordions so the screenshot shows real answers.
  if (s.name === "help") {
    await page.evaluate(() =>
      document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")),
    );
  }
  const note = s.drive ? await s.drive(page) : "";
  const file = join(outDir, `${s.name}.png`);
  // The popup is a fixed-width panel — clip to it instead of padding the shot
  // with empty viewport. Full pages are captured whole unless told otherwise.
  const isPopup = s.page === "popup.html";
  const target = isPopup ? page.locator(".popup") : page;
  const fullPage = s.fullPage ?? !isPopup;
  await target.screenshot({ path: file, ...(isPopup ? {} : { fullPage }) });
  const suffix = [note, errors.length ? `page errors: ${errors.join("; ")}` : ""]
    .filter(Boolean)
    .join("; ");
  console.log(`✓ docs/assets/${s.name}.png${suffix ? `  (${suffix})` : ""}`);
  await ctx.close();
}
await browser.close();
server.close();
