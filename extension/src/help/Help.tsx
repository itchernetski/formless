// Bundled help page. Ships inside the extension so it works offline and makes
// zero network requests — same privacy promise as the rest of the product.
// Opened from the popup / options via chrome.runtime.getURL("help.html").

import type { ReactNode } from "react";

const REPO = "https://github.com/itchernetski/formless";

type Item = { q: string; a: ReactNode };

const sections: { title: string; items: Item[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do I fill a form?",
        a: (
          <>
            Open a page with a form, click the Formless icon, then{" "}
            <strong>Fill this form</strong>. Filled fields flash green;{" "}
            <strong>Undo</strong> reverts the last fill. If nothing happens, check that the
            toggle in the popup says <strong>On</strong> and that the site passes your
            whitelist.
          </>
        ),
      },
      {
        q: "Where does my data live?",
        a: (
          <>
            In your browser's IndexedDB, on this device only. Formless has no server and no
            account. Turn on <strong>Encryption</strong> in Settings to protect the vault at
            rest with AES-GCM (key derived from your master password via PBKDF2).
          </>
        ),
      },
      {
        q: "I have several profiles — how do I switch?",
        a: (
          <>
            Use the profile dropdown at the top of the popup. The selected profile is the one
            used for filling, capturing and AI generation. Create and delete profiles in{" "}
            <strong>Settings → Profiles</strong>.
          </>
        ),
      },
    ],
  },
  {
    title: "Filling in your profile fast",
    items: [
      {
        q: "Import from a CV (PDF)",
        a: (
          <>
            <strong>Settings → Import data → Import from CV</strong>. The PDF is parsed
            locally, then the on-device AI structures it into fields. You review every field
            before anything is saved.
          </>
        ),
      },
      {
        q: "Import from LinkedIn",
        a: (
          <>
            Request your LinkedIn data export (Settings → Data privacy → Get a copy of your
            data), unzip it, then pick <code>Profile.csv</code>, <code>Positions.csv</code> and{" "}
            <code>Email Addresses.csv</code> in{" "}
            <strong>Settings → Import data → Import from LinkedIn</strong>. Formless reads the
            export instead of scraping the site — more reliable, and no terms-of-service risk.
          </>
        ),
      },
      {
        q: "Remember what I typed by hand",
        a: (
          <>
            After filling a form manually, click{" "}
            <strong>＋ Save filled fields to profile</strong> in the popup. Formless reads what
            you typed, maps it back onto profile fields and opens a review screen. Passwords,
            card numbers, CVV, OTP, PIN and SSN fields are never captured.
          </>
        ),
      },
    ],
  },
  {
    title: "AI generation",
    items: [
      {
        q: "How does ✨ Generate with AI work?",
        a: (
          <>
            On a page with a long text field (cover letter, "why this company", bio), Formless
            reads the page context — job title, company, description — and drafts an answer
            from your profile. Pick type, tone and length, edit the draft in place, then
            insert it. Nothing is submitted for you.
          </>
        ),
      },
      {
        q: "Which model runs, and does my data leave the device?",
        a: (
          <>
            Chrome's built-in Gemini Nano, running locally. No text leaves your browser and
            there is no API key or subscription. Requires Chrome with Built-in AI available —
            see the next answer if the panel says no model was found.
          </>
        ),
      },
      {
        q: '"No AI model available" — what now?',
        a: (
          <>
            Built-in AI isn't ready in this browser. Use a recent Chrome on desktop, then check{" "}
            <code>chrome://on-device-internals</code> to confirm the model has downloaded (it
            needs a few GB of free disk). Everything else — filling, import, capture — works
            without AI.
          </>
        ),
      },
    ],
  },
  {
    title: "When something breaks",
    items: [
      {
        q: "Fields stay empty on a complex site",
        a: (
          <>
            Some single-page apps render forms late or inside closed shadow DOM. Wait for the
            form to be fully visible and click <strong>Fill this form</strong> again. If a site
            is consistently broken, open an issue with the URL — site-specific fixes are how
            coverage grows.
          </>
        ),
      },
      {
        q: '"Can\'t run here"',
        a: (
          <>
            Content scripts can't run on <code>chrome://</code> pages, the Chrome Web Store, or
            other extensions' pages. Try a normal web page.
          </>
        ),
      },
      {
        q: "The vault is locked and I forgot the master password",
        a: (
          <>
            It can't be recovered — the key never leaves your device and isn't stored anywhere.
            You'll need to remove the extension's data and start over. Keep a JSON export
            (Settings → Backup) somewhere safe.
          </>
        ),
      },
      {
        q: "Does Formless submit forms for me?",
        a: (
          <>
            No. It fills and drafts; you review and submit. It also never attempts to solve or
            bypass CAPTCHAs or bot detection.
          </>
        ),
      },
    ],
  },
];

export function Help() {
  return (
    <div className="options help">
      <h1>Formless help</h1>
      <p className="muted">
        Everything on this page works offline — it ships with the extension and makes no
        network requests.
      </p>

      {sections.map((s) => (
        <div className="section" key={s.title}>
          <h2>{s.title}</h2>
          {s.items.map((it) => (
            <details key={it.q}>
              <summary>{it.q}</summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      ))}

      <div className="section">
        <h2>Still stuck?</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Formless is open source (MIT). Bug reports with a URL and what you expected are the
          most useful thing you can send.
        </p>
        <div className="toolbar">
          <a className="btn-link" href={`${REPO}/issues/new/choose`} target="_blank" rel="noreferrer">
            Report an issue
          </a>
          <a className="btn-link" href={`${REPO}/discussions`} target="_blank" rel="noreferrer">
            Ask a question
          </a>
          <a className="btn-link" href={REPO} target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
