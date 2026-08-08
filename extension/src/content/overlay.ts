// Visual feedback in the page: highlight filled fields and show a small toast
// with an Undo button. All styling is inline + a shadow root so host-page CSS
// can't interfere and we leave no lasting DOM.

import type { FilledEntry } from "../detection";

const HIGHLIGHT = "2px solid #22c55e";
let toastHost: HTMLDivElement | null = null;

export function highlight(entries: FilledEntry[]): void {
  for (const e of entries) {
    const el = e.el as HTMLElement;
    el.dataset.autofillPrevOutline = el.style.outline || "";
    el.style.outline = HIGHLIGHT;
    el.style.outlineOffset = "1px";
  }
}

export function clearHighlight(entries: FilledEntry[]): void {
  for (const e of entries) {
    const el = e.el as HTMLElement;
    el.style.outline = el.dataset.autofillPrevOutline ?? "";
    delete el.dataset.autofillPrevOutline;
  }
}

export function showToast(filled: number, onUndo: () => void): void {
  removeToast();
  const host = document.createElement("div");
  // `all:initial` first — see the note in gen-panel.ts; declared last it resets
  // the positioning above it and the toast drops to the bottom of the document.
  host.style.cssText =
    "all:initial;position:fixed;z-index:2147483647;bottom:20px;right:20px;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .box{font:13px/1.4 system-ui,sans-serif;background:#111827;color:#fff;
        padding:10px 12px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);
        display:flex;align-items:center;gap:10px;}
      .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;}
      button{font:inherit;color:#93c5fd;background:none;border:none;cursor:pointer;
        padding:2px 4px;border-radius:6px;}
      button:hover{background:rgba(255,255,255,.1);}
    </style>
    <div class="box">
      <span class="dot"></span>
      <span>Filled ${filled} field${filled === 1 ? "" : "s"}</span>
      <button id="undo">Undo</button>
    </div>`;
  root.getElementById("undo")?.addEventListener("click", () => {
    onUndo();
    removeToast();
  });
  document.documentElement.appendChild(host);
  toastHost = host;
  setTimeout(removeToast, 6000);
}

export function removeToast(): void {
  toastHost?.remove();
  toastHost = null;
}
