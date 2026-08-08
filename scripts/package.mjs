#!/usr/bin/env node
// Packages the built extension into store-ready zips.
//
//   node scripts/package.mjs            → chrome + firefox + edge
//   node scripts/package.mjs chrome     → one target
//
// Chrome and Edge ship the same Chromium MV3 build (separate zips only because
// the two stores want separate uploads). Firefox needs a patched manifest:
// Gecko MV3 has no background.service_worker and wants an add-on id.
//
// Requires `zip` on PATH (preinstalled on macOS/Linux; on Windows use WSL or 7z).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "extension", "dist");
const outDir = join(root, "release");
const GECKO_ID = "formless@tchernetski.com";

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("No build found. Run `npm run build` first (expected extension/dist).");
  process.exit(1);
}

const base = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
const version = base.version;

// Chromium manifest is used as-is; Firefox gets a transformed copy.
function firefoxManifest(m) {
  const out = structuredClone(m);
  const sw = out.background?.service_worker;
  if (sw) out.background = { scripts: [sw], type: "module" };
  out.browser_specific_settings = {
    gecko: { id: GECKO_ID, strict_min_version: "128.0" },
  };
  // Gecko rejects unknown manifest keys in web_accessible_resources.
  out.web_accessible_resources = (out.web_accessible_resources ?? []).map((entry) => {
    const { use_dynamic_url: _drop, ...rest } = entry;
    return rest;
  });
  return out;
}

function build(target) {
  const stage = join(outDir, `stage-${target}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(dist, stage, { recursive: true });

  if (target === "firefox") {
    writeFileSync(
      join(stage, "manifest.json"),
      JSON.stringify(firefoxManifest(base), null, 2) + "\n",
    );
  }

  const zip = join(outDir, `formless-${version}-${target}.zip`);
  rmSync(zip, { force: true });
  // -r recurse, -q quiet, -X strip extra file attributes (smaller, reproducible)
  execFileSync("zip", ["-rqX", zip, "."], { cwd: stage, stdio: "inherit" });
  rmSync(stage, { recursive: true, force: true });
  console.log(`✓ ${zip.replace(root + "/", "")}`);
}

const targets = process.argv.slice(2);
const all = ["chrome", "firefox", "edge"];
const chosen = targets.length ? targets : all;
for (const t of chosen) {
  if (!all.includes(t)) {
    console.error(`Unknown target "${t}". Expected one of: ${all.join(", ")}`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
for (const t of chosen) build(t);

console.log(
  "\nFirefox note: the Gecko manifest is generated but unverified by CI — load it\n" +
    "via about:debugging → This Firefox → Load Temporary Add-on before submitting.",
);
