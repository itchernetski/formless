// Import from a LinkedIn data export. LinkedIn lets users download their data as
// a ZIP of CSVs; we parse the relevant ones (Profile.csv, Email Addresses.csv,
// Positions.csv) from their text. No scraping, no extra dependencies.

import type { ExtractedField } from "./types";

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes ("")
// and embedded commas/newlines. Returns rows of string cells.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Header → profile path maps per LinkedIn export file.
const PROFILE_MAP: Record<string, string> = {
  "first name": "identity.firstName",
  "last name": "identity.lastName",
  "zip code": "address.postalCode",
  "geo location": "custom.location",
  headline: "custom.headline",
  summary: "custom.summary",
  industry: "custom.industry",
  websites: "contact.website",
};
const POSITION_MAP: Record<string, string> = {
  "company name": "work.company",
  title: "work.jobTitle",
};

function rowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

function mapRow(
  obj: Record<string, string>,
  map: Record<string, string>,
): ExtractedField[] {
  const out: ExtractedField[] = [];
  for (const [header, path] of Object.entries(map)) {
    const v = obj[header];
    if (v) out.push({ path, value: v, source: "linkedin" });
  }
  return out;
}

// Parse one CSV file's text; routes by which known headers are present.
export function parseLinkedInCsv(text: string): ExtractedField[] {
  const rows = parseCsv(text);
  const objs = rowsToObjects(rows);
  if (objs.length === 0) return [];
  const headers = Object.keys(objs[0]);

  if (headers.includes("first name") || headers.includes("headline")) {
    return mapRow(objs[0], PROFILE_MAP);
  }
  if (headers.includes("company name") && headers.includes("title")) {
    // Most recent position is the first data row.
    return mapRow(objs[0], POSITION_MAP);
  }
  if (headers.includes("email address")) {
    // Prefer the row flagged Primary = Yes, else the first.
    const primary = objs.find((o) => (o["primary"] ?? "").toLowerCase() === "yes") ?? objs[0];
    const email = primary["email address"];
    return email ? [{ path: "contact.email", value: email, source: "linkedin" }] : [];
  }
  return [];
}

// Parse several CSV files (e.g. Profile + Email + Positions) into one field list.
export function parseLinkedInExport(files: string[]): ExtractedField[] {
  return files.flatMap(parseLinkedInCsv);
}
