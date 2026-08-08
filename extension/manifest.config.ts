import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

const icons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export default defineManifest({
  manifest_version: 3,
  name: "Formless — privacy-first form autofill",
  short_name: "Formless",
  version: pkg.version,
  description:
    "Fill forms from a local, encrypted profile and draft answers with on-device AI. Your data never leaves your browser.",
  homepage_url: "https://github.com/itchernetski/formless",
  icons,
  action: { default_popup: "popup.html", default_title: "Formless", default_icon: icons },
  options_page: "options.html",
  background: { service_worker: "src/background/index.ts", type: "module" },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
      all_frames: true,
    },
  ],
  // No "tabs": chrome.tabs.create/sendMessage need no permission, and reading the
  // active tab's url for the whitelist check is covered by activeTab, which the
  // popup's own invocation grants.
  permissions: ["storage", "activeTab"],
  // Deliberately no web_accessible_resources entry for help.html: the extension
  // opens it itself via chrome.runtime.getURL, which needs no page-side access.
  // Exposing it to <all_urls> would only hand web pages a way to fingerprint the
  // extension.
});
