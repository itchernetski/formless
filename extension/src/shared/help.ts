// Opens the bundled help page (help.html) in a new tab. Reused by popup and
// options so there is a single definition of "where help lives".

export const HELP_PAGE = "help.html";

export function helpUrl(hash = ""): string {
  return chrome.runtime.getURL(HELP_PAGE) + hash;
}

export async function openHelp(hash = ""): Promise<void> {
  await chrome.tabs.create({ url: helpUrl(hash) });
}
