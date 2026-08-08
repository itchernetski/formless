// The fill engine. Writes a value into a field using the native prototype value
// setter (the Phase-0 go/no-go technique) so React/Vue controlled inputs update
// their internal state, then dispatches input+change. Handles text, select,
// checkbox, radio, textarea, date and contenteditable.

export type Fillable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const SKIP_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  "password",
]);

export function isFillable(el: Element): el is Fillable {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return !el.disabled && !(el as HTMLTextAreaElement).readOnly;
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (SKIP_INPUT_TYPES.has(type)) return false;
    return !el.disabled && !el.readOnly;
  }
  return false;
}

function setNativeValue(el: Fillable, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc?.set) desc.set.call(el, value);
  else (el as { value: string }).value = value;
}

function fireEvents(el: Element): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const v = value.trim().toLowerCase();
  for (const opt of Array.from(el.options)) {
    if (
      opt.value.toLowerCase() === v ||
      opt.textContent?.trim().toLowerCase() === v ||
      // common case: country full-name in option text, ISO code in value
      opt.textContent?.trim().toLowerCase().startsWith(v)
    ) {
      setNativeValue(el, opt.value);
      fireEvents(el);
      return true;
    }
  }
  return false;
}

function fillCheckable(el: HTMLInputElement, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (el.type === "checkbox") {
    const truthy = ["true", "yes", "1", "on", "checked"].includes(v);
    if (el.checked !== truthy) {
      el.checked = truthy;
      fireEvents(el);
    }
    return true;
  }
  // radio: check the radio whose value/label matches
  const labelMatch = (el.labels && el.labels[0]?.textContent?.trim().toLowerCase()) || "";
  if (el.value.toLowerCase() === v || labelMatch === v) {
    if (!el.checked) {
      el.checked = true;
      fireEvents(el);
    }
    return true;
  }
  return false;
}

function fillDate(el: HTMLInputElement, value: string): boolean {
  // Accept ISO yyyy-mm-dd; native date inputs require exactly that.
  const iso = value.trim();
  setNativeValue(el, iso);
  fireEvents(el);
  return el.value === iso;
}

// Fill one element with a string value. Returns whether the value took.
export function fillField(el: Fillable, value: string): boolean {
  if (value === "" || value == null) return false;

  if (el instanceof HTMLSelectElement) return fillSelect(el, value);

  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") return fillCheckable(el, value);
    if (type === "date") return fillDate(el, value);
  }

  setNativeValue(el, value);
  fireEvents(el);
  return el.value === value;
}
