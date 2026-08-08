// Phase 1 E2E: loads the REAL built extension (extension/dist) into Chrome,
// serves the test forms over http (so the content script auto-injects), and
// drives an autofill from the extension's own service-worker context — then
// asserts the page fields were filled. Run: `node tests/e2e-extension.mjs`
// (requires `npm run build` in extension/ first).
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "../extension/dist");
if (!existsSync(resolve(distDir, "manifest.json"))) {
  console.error("Build missing. Run `npm run build` in extension/ first.");
  process.exit(2);
}

// --- tiny static server for the fixture ---
const html = readFileSync(resolve(here, "e2e-forms.html"), "utf8");
const server = createServer((_req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const pageUrl = `http://127.0.0.1:${port}/`;

const profile = {
  id: "e2e",
  label: "E2E",
  identity: { firstName: "Ilya", lastName: "Chernetskiy", fullName: "", dateOfBirth: "", gender: "", nationality: "" },
  contact: { email: "ilya@example.com", phone: "+34600123456", website: "", linkedin: "" },
  address: { line1: "Carrer de Colon 1", line2: "", city: "Valencia", state: "", postalCode: "46004", country: "Spain" },
  work: { company: "Indie", jobTitle: "Founder", yearsExperience: "", salaryExpectation: "" },
  education: { school: "", degree: "", fieldOfStudy: "", graduationYear: "" },
  custom: {},
  updatedAt: 0,
};

const ctx = await chromium.launchPersistentContext("", {
  channel: "chrome",
  headless: false, // extensions require a (headless=new) headed-style context
  args: [
    "--headless=new",
    `--disable-extensions-except=${distDir}`,
    `--load-extension=${distDir}`,
  ],
});

function fail(msg) {
  console.error("NO-GO ❌ " + msg);
}

try {
  // Get the extension's service worker (MV3).
  let [sw] = ctx.serviceWorkers();
  if (!sw) {
    sw = await ctx
      .waitForEvent("serviceworker", { timeout: 10000 })
      .catch(() => null);
  }
  if (!sw) {
    console.log(
      "SKIP ⚠️  extension service worker unavailable — this environment can't " +
        "load an unpacked MV3 extension (needs a headed Chrome / display). " +
        "Run on a desktop to exercise the full extension path.",
    );
    await ctx.close();
    server.close();
    process.exit(2); // skip, not fail
  }

  const page = await ctx.newPage();
  await page.goto(pageUrl, { waitUntil: "load" });
  await page.waitForTimeout(500); // let content script settle (document_idle)

  // Drive a fill from the SW context straight to the content script.
  const sent = await sw.evaluate(async ({ url, profile }) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url && t.url.startsWith(url));
    if (!tab) return { error: "tab not found" };
    return await chrome.tabs.sendMessage(tab.id, { type: "AUTOFILL_FILL", profile });
  }, { url: pageUrl, profile });

  const readback = await page.evaluate(() => ({
    first: document.querySelector('[name="first"]').value,
    last: document.querySelector('[name="last"]').value,
    email: document.querySelector('[name="email"]').value,
    phone: document.querySelector('[name="phone"]').value,
    company: document.querySelector('[name="employer"]').value,
    jobTitle: document.querySelector('[name="job-title"]').value,
    country: document.querySelector('[name="country"]').value,
    address: document.querySelector('[name="address-line1"]').value,
    city: document.querySelector('[name="city"]').value,
    zip: document.querySelector('[name="zip"]').value,
    captcha: document.querySelector('[name="captcha"]').value,
  }));

  const checks = [
    ["fill response ok", sent && !sent.error && sent.filled >= 9],
    ["first name", readback.first === "Ilya"],
    ["last name", readback.last === "Chernetskiy"],
    ["email", readback.email === "ilya@example.com"],
    ["phone", readback.phone === "+34600123456"],
    ["company", readback.company === "Indie"],
    ["job title", readback.jobTitle === "Founder"],
    ["country select → ES", readback.country === "ES"],
    ["address", readback.address === "Carrer de Colon 1"],
    ["city", readback.city === "Valencia"],
    ["zip", readback.zip === "46004"],
    ["captcha left empty", readback.captcha === ""],
  ];

  console.log(JSON.stringify({ sent, readback }, null, 2));
  console.log("\n--- CHECKS ---");
  let allPass = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) allPass = false;
  }
  console.log(allPass ? "\nGO ✅ extension fills real forms" : "\nNO-GO ❌ see failures");
  await ctx.close();
  server.close();
  process.exit(allPass ? 0 : 1);
} catch (e) {
  fail(String(e));
  await ctx.close();
  server.close();
  process.exit(1);
}
