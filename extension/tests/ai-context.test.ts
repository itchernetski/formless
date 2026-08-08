import { describe, expect, it } from "vitest";
import { extractPageContext } from "../src/ai/context";

function doc(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("page context extraction", () => {
  it("reads schema.org JobPosting JSON-LD first", () => {
    const ld = {
      "@type": "JobPosting",
      title: "Senior Backend Engineer",
      hiringOrganization: { name: "Acme Corp" },
      description: "Build scalable services in Go and Postgres.",
    };
    const ctx = extractPageContext(
      doc(`<html><head><title>Careers</title>
        <script type="application/ld+json">${JSON.stringify(ld)}</script>
        </head><body><h1>Some other heading</h1></body></html>`),
      "https://jobs.example.com/123",
    );
    expect(ctx.jobTitle).toBe("Senior Backend Engineer");
    expect(ctx.company).toBe("Acme Corp");
    expect(ctx.description).toContain("Go and Postgres");
    expect(ctx.url).toBe("https://jobs.example.com/123");
  });

  it("handles a @graph wrapper", () => {
    const ld = { "@graph": [{ "@type": "WebPage" }, { "@type": "JobPosting", title: "PM" }] };
    const ctx = extractPageContext(
      doc(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`),
    );
    expect(ctx.jobTitle).toBe("PM");
  });

  it("falls back to Open Graph and meta tags", () => {
    const ctx = extractPageContext(
      doc(`<html><head>
        <meta property="og:title" content="Product Designer">
        <meta property="og:site_name" content="Globex">
        <meta name="description" content="Design delightful experiences.">
      </head><body></body></html>`),
    );
    expect(ctx.jobTitle).toBe("Product Designer");
    expect(ctx.company).toBe("Globex");
    expect(ctx.description).toBe("Design delightful experiences.");
  });

  it("falls back to the H1 and a description block when nothing else exists", () => {
    const ctx = extractPageContext(
      doc(`<body><h1>  Data\n Scientist </h1>
        <article>${"We are hiring a data scientist to work on models. ".repeat(6)}</article>
      </body>`),
    );
    expect(ctx.jobTitle).toBe("Data Scientist");
    expect(ctx.description).toContain("data scientist");
  });
});
