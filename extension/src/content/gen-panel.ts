// In-page AI generation panel (shadow DOM, isolated styles). Lets the user pick
// a long-text field, type/tone/length, generate locally, review & edit the
// result, then insert it. All logic is self-contained so the content script just
// calls openGenPanel().

import { generate, NoProviderError, resolveProvider } from "../ai";
import type { GenType, Length, PageContext, Tone } from "../ai/types";
import type { LongField } from "../detection/longfields";
import type { Profile } from "../vault/schema";

const TYPE_OPTIONS: Array<[GenType, string]> = [
  ["coverLetter", "Cover letter"],
  ["bio", "About yourself / bio"],
  ["whyCompany", "Why this company"],
];

let host: HTMLDivElement | null = null;

export function closeGenPanel(): void {
  host?.remove();
  host = null;
}

// Write generated text into the target field, handling textarea + contenteditable.
function insertInto(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement) {
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    desc?.set?.call(el, text);
  } else {
    el.textContent = text;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export interface GenPanelArgs {
  profile: Profile;
  context: PageContext;
  fields: LongField[];
}

export function openGenPanel({ profile, context, fields }: GenPanelArgs): void {
  closeGenPanel();
  host = document.createElement("div");
  host.style.cssText =
    "position:fixed;z-index:2147483647;top:24px;right:24px;all:initial;";
  const root = host.attachShadow({ mode: "open" });

  const fieldOptions = fields
    .map((f, i) => `<option value="${i}">${(f.label || "Text field").slice(0, 60)}</option>`)
    .join("");
  const typeOptions = TYPE_OPTIONS.map(
    ([v, l]) => `<option value="${v}">${l}</option>`,
  ).join("");

  root.innerHTML = `
    <style>
      *{box-sizing:border-box;font-family:system-ui,sans-serif;}
      .panel{width:380px;max-height:80vh;overflow:auto;background:#fff;color:#111827;
        border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);
        padding:16px;font-size:13px;}
      .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
      .hd h2{font-size:15px;margin:0;}
      .x{cursor:pointer;border:none;background:none;font-size:18px;color:#6b7280;}
      label{display:block;font-weight:600;margin:8px 0 4px;}
      select,textarea{width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;
        font:inherit;}
      textarea{min-height:160px;resize:vertical;}
      .row{display:flex;gap:8px;}
      .row>div{flex:1;}
      .actions{display:flex;gap:8px;margin-top:12px;}
      button.btn{flex:1;padding:9px;border-radius:8px;border:1px solid #d1d5db;
        background:#f9fafb;cursor:pointer;font:inherit;}
      button.primary{background:#2563eb;color:#fff;border-color:#2563eb;}
      button:disabled{opacity:.55;cursor:default;}
      .note{margin-top:10px;padding:8px 10px;border-radius:8px;background:#fef3c7;
        color:#92400e;font-size:12px;}
      .muted{color:#6b7280;font-size:12px;}
    </style>
    <div class="panel">
      <div class="hd"><h2>✨ Generate with AI</h2><button class="x" id="close">×</button></div>
      ${fields.length > 1 ? `<label>Field</label><select id="field">${fieldOptions}</select>` : ""}
      <label>What to write</label>
      <select id="type">${typeOptions}</select>
      <div class="row">
        <div><label>Tone</label>
          <select id="tone"><option value="formal">Formal</option><option value="casual">Casual</option></select>
        </div>
        <div><label>Length</label>
          <select id="length"><option value="short">Short</option><option value="medium" selected>Medium</option><option value="long">Long</option></select>
        </div>
      </div>
      <label>Result <span class="muted">(editable)</span></label>
      <textarea id="out" placeholder="Click Generate — runs locally, on your device."></textarea>
      <div id="note"></div>
      <div class="actions">
        <button class="btn primary" id="gen">Generate</button>
        <button class="btn" id="insert" disabled>Insert</button>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(id: string) => root.getElementById(id) as T;
  const out = $<HTMLTextAreaElement>("out");
  const note = $<HTMLDivElement>("note");
  const genBtn = $<HTMLButtonElement>("gen");
  const insertBtn = $<HTMLButtonElement>("insert");
  const typeSel = $<HTMLSelectElement>("type");

  const targetField = (): LongField => {
    const sel = root.getElementById("field") as HTMLSelectElement | null;
    return fields[sel ? Number(sel.value) : 0];
  };

  // Pre-select the type guessed from the chosen field's label.
  const syncType = () => {
    const k = targetField().kind;
    if (k !== "generic") typeSel.value = k;
  };
  syncType();
  root.getElementById("field")?.addEventListener("change", syncType);

  $<HTMLButtonElement>("close").addEventListener("click", closeGenPanel);

  genBtn.addEventListener("click", async () => {
    note.textContent = "";
    note.className = "";
    out.value = "";
    genBtn.disabled = true;
    genBtn.textContent = "Generating…";
    insertBtn.disabled = true;
    try {
      const resolved = await resolveProvider();
      if (resolved?.availability === "downloadable") {
        note.className = "note";
        note.textContent = "Downloading the on-device model on first use — this can take a minute.";
      }
      await generate(
        {
          context,
          profile,
          options: {
            type: typeSel.value as GenType,
            tone: ($<HTMLSelectElement>("tone").value) as Tone,
            length: ($<HTMLSelectElement>("length").value) as Length,
          },
        },
        (delta) => {
          out.value += delta;
          out.scrollTop = out.scrollHeight;
        },
      );
      insertBtn.disabled = out.value.trim() === "";
    } catch (e) {
      note.className = "note";
      note.textContent =
        e instanceof NoProviderError
          ? "No on-device AI model is available in this browser. The upcoming Pro plan generates this on the server."
          : `Generation failed: ${String(e)}`;
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = "Regenerate";
    }
  });

  insertBtn.addEventListener("click", () => {
    insertInto(targetField().el, out.value);
    closeGenPanel();
  });

  document.documentElement.appendChild(host);
}
