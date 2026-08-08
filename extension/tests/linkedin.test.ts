import { describe, expect, it } from "vitest";
import { parseCsv, parseLinkedInCsv, parseLinkedInExport } from "../src/import/linkedin";

describe("parseCsv", () => {
  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,b,c\n"x, y","he said ""hi""",z');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', "z"],
    ]);
  });

  it("handles newlines inside quotes", () => {
    const rows = parseCsv('h1,h2\n"line1\nline2",v');
    expect(rows[1][0]).toBe("line1\nline2");
  });
});

describe("parseLinkedInCsv", () => {
  it("maps Profile.csv", () => {
    const csv =
      'First Name,Last Name,Headline,Summary,Zip Code,Websites\n' +
      'Ada,Lovelace,Mathematician,"Pioneer of computing",46001,https://ada.dev';
    const fields = parseLinkedInCsv(csv);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f.value]));
    expect(byPath["identity.firstName"]).toBe("Ada");
    expect(byPath["identity.lastName"]).toBe("Lovelace");
    expect(byPath["custom.headline"]).toBe("Mathematician");
    expect(byPath["address.postalCode"]).toBe("46001");
    expect(byPath["contact.website"]).toBe("https://ada.dev");
    expect(fields.every((f) => f.source === "linkedin")).toBe(true);
  });

  it("maps the most recent Positions.csv row", () => {
    const csv =
      "Company Name,Title,Started On\n" +
      "Acme,Senior Engineer,2024\n" +
      "Globex,Engineer,2020";
    const fields = parseLinkedInCsv(csv);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f.value]));
    expect(byPath["work.company"]).toBe("Acme");
    expect(byPath["work.jobTitle"]).toBe("Senior Engineer");
  });

  it("picks the primary email from Email Addresses.csv", () => {
    const csv =
      "Email Address,Confirmed,Primary\n" +
      "secondary@x.com,Yes,No\n" +
      "main@x.com,Yes,Yes";
    expect(parseLinkedInCsv(csv)).toEqual([
      { path: "contact.email", value: "main@x.com", source: "linkedin" },
    ]);
  });

  it("returns [] for an unrecognised CSV", () => {
    expect(parseLinkedInCsv("Foo,Bar\n1,2")).toEqual([]);
  });
});

describe("parseLinkedInExport", () => {
  it("merges fields from several files", () => {
    const profile = "First Name,Last Name\nAda,Lovelace";
    const email = "Email Address,Primary\nada@x.com,Yes";
    const fields = parseLinkedInExport([profile, email]);
    expect(fields.map((f) => f.path)).toContain("identity.firstName");
    expect(fields.map((f) => f.path)).toContain("contact.email");
  });
});
