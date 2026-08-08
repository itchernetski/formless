// Content script: receives fill/undo/detect requests, runs the detection engine
// in the page, manages overlay + undo state for the current page.

import { autofill, collectFields, undoFill, type FilledEntry } from "../detection";
import { collectLongFields } from "../detection/longfields";
import { captureForm } from "../detection/capture";
import { extractPageContext } from "../ai/context";
import { isContentMessage, type ContentMessage, type FillResponse } from "../shared/messaging";
import { clearHighlight, highlight, removeToast, showToast } from "./overlay";
import { openGenPanel } from "./gen-panel";

let lastFill: FilledEntry[] = [];
// Provenance: values this extension autofilled, so capture can skip fields the
// user never touched. Persists across fills on the page (keyed by element).
const autofilledValues = new Map<Element, string>();

function doUndo(): void {
  if (!lastFill.length) return;
  clearHighlight(lastFill);
  undoFill(lastFill);
  lastFill = [];
  removeToast();
}

chrome.runtime.onMessage.addListener(
  (msg: unknown, _sender, sendResponse: (r: FillResponse) => void) => {
    if (!isContentMessage(msg)) return;
    const m = msg as ContentMessage;
    try {
      if (m.type === "AUTOFILL_FILL") {
        // Clear any prior highlight before a fresh run.
        if (lastFill.length) clearHighlight(lastFill);
        const report = autofill(m.profile);
        lastFill = report.entries;
        for (const e of report.entries) autofilledValues.set(e.el, e.value);
        highlight(report.entries);
        if (report.filled > 0) showToast(report.filled, doUndo);
        sendResponse({
          forms: report.forms,
          candidates: report.candidates,
          filled: report.filled,
        });
      } else if (m.type === "AUTOFILL_UNDO") {
        doUndo();
        sendResponse({ forms: 0, candidates: 0, filled: 0 });
      } else if (m.type === "AUTOFILL_DETECT") {
        const fields = collectFields(document);
        sendResponse({
          forms: document.querySelectorAll("form").length,
          candidates: fields.length,
          filled: 0,
          longFields: collectLongFields(document).length,
        });
      } else if (m.type === "AUTOFILL_GENERATE") {
        const fields = collectLongFields(document);
        if (fields.length > 0) {
          openGenPanel({
            profile: m.profile,
            context: extractPageContext(document, location.href),
            fields,
          });
        }
        sendResponse({ forms: 0, candidates: 0, filled: 0, longFields: fields.length });
      } else if (m.type === "AUTOFILL_CAPTURE") {
        const host = location.hostname;
        const captured = captureForm(document, { host, autofilled: autofilledValues });
        sendResponse({ forms: 0, candidates: 0, filled: 0, captured, host });
      }
    } catch (e) {
      sendResponse({ forms: 0, candidates: 0, filled: 0, error: String(e) });
    }
    return true; // keep the message channel open for the async response
  },
);
