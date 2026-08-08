// Scrape job/page context for generation. Layered heuristics, most reliable
// first: schema.org JobPosting JSON-LD → Open Graph / meta → DOM headings.
// Pure over a Document so it unit-tests against fixture HTML.

import { emptyContext, type PageContext } from "./types";

function meta(doc: Document, selector: string): string {
  const el = doc.querySelector(selector);
  return (el?.getAttribute("content") ?? "").trim();
}

// Collapse whitespace and strip tags' leftover indentation from textContent.
function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

interface JobPosting {
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
}

function readJsonLd(doc: Document): JobPosting | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(s.textContent || "");
    } catch {
      continue;
    }
    // JSON-LD may be a single object, an array, or a @graph wrapper.
    const candidates: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { "@graph"?: unknown[] })?.["@graph"])
        ? (data as { "@graph": unknown[] })["@graph"]
        : [data];
    for (const c of candidates) {
      const obj = c as { "@type"?: string | string[] } & JobPosting;
      const type = obj?.["@type"];
      const isJob = Array.isArray(type)
        ? type.includes("JobPosting")
        : type === "JobPosting";
      if (isJob) return obj;
    }
  }
  return null;
}

function orgName(job: JobPosting | null): string {
  if (!job?.hiringOrganization) return "";
  return typeof job.hiringOrganization === "string"
    ? job.hiringOrganization
    : (job.hiringOrganization.name ?? "");
}

// Heuristic: take the page's main heading as the job title fallback.
function headingTitle(doc: Document): string {
  const h1 = doc.querySelector("h1");
  return clean(h1?.textContent);
}

// Pull the largest plausible description block when no JSON-LD is present.
function domDescription(doc: Document): string {
  const sel = [
    '[class*="job-description" i]',
    '[class*="description" i]',
    "article",
    "main",
  ];
  for (const s of sel) {
    const el = doc.querySelector(s);
    const text = clean(el?.textContent);
    if (text.length > 120) return text.slice(0, 4000);
  }
  return "";
}

export function extractPageContext(
  doc: Document = document,
  url: string = doc.location?.href ?? "",
): PageContext {
  const ctx = emptyContext();
  ctx.url = url;
  ctx.pageTitle = clean(doc.title);

  const job = readJsonLd(doc);

  ctx.jobTitle = clean(job?.title) || meta(doc, 'meta[property="og:title"]') || headingTitle(doc);
  ctx.company =
    clean(orgName(job)) ||
    meta(doc, 'meta[property="og:site_name"]') ||
    meta(doc, 'meta[name="author"]');
  ctx.description =
    clean(job?.description) ||
    meta(doc, 'meta[property="og:description"]') ||
    meta(doc, 'meta[name="description"]') ||
    domDescription(doc);

  return ctx;
}
