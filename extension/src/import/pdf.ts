// Extract plain text from a PDF using pdf.js. Lazily imported so the heavy
// library + worker only load in the options page when the user actually imports
// a CV. The worker is bundled (Vite ?url) — no CDN, which MV3 CSP would block.

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    pages.push(text);
  }
  await doc.destroy();
  return pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
}
