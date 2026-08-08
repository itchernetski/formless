// Service worker. Opens onboarding on first install. The vault lives in the
// extension-origin pages (popup/options) which share IndexedDB; the background
// only needs to bootstrap onboarding here in Phase 1.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html#onboarding") });
  }
});
