import { describe, expect, it } from "vitest";
import { buildPrompt, profileSummary } from "../src/ai/prompts";
import { emptyContext } from "../src/ai/types";
import { emptyProfile, type Profile } from "../src/vault/schema";

function sampleProfile(): Profile {
  const p = emptyProfile("p1", "Personal");
  p.identity.fullName = "Ada Lovelace";
  p.work.jobTitle = "Engineer";
  p.work.company = "Analytical Engines Ltd";
  p.custom.skills = "Python, Rust";
  return p;
}

describe("profileSummary", () => {
  it("includes filled fields and custom entries, skips blanks", () => {
    const s = profileSummary(sampleProfile());
    expect(s).toContain("Ada Lovelace");
    expect(s).toContain("Engineer");
    expect(s).toContain("skills: Python, Rust");
    expect(s).not.toContain("Years of experience"); // blank → omitted
  });
});

describe("buildPrompt", () => {
  it("tailors the system prompt to type, tone and length", () => {
    const { system } = buildPrompt({
      context: emptyContext(),
      profile: sampleProfile(),
      options: { type: "coverLetter", tone: "casual", length: "short" },
    });
    expect(system).toContain("cover letter");
    expect(system.toLowerCase()).toContain("conversational");
    expect(system).toContain("60-90 words");
    expect(system).toContain("never invent");
  });

  it("embeds job context and applicant summary in the user prompt", () => {
    const ctx = { ...emptyContext(), jobTitle: "SRE", company: "Globex", description: "Keep things up." };
    const { user } = buildPrompt({
      context: ctx,
      profile: sampleProfile(),
      options: { type: "whyCompany", tone: "formal", length: "medium" },
    });
    expect(user).toContain("Role: SRE");
    expect(user).toContain("Company: Globex");
    expect(user).toContain("Keep things up.");
    expect(user).toContain("Ada Lovelace");
  });

  it("produces a usable prompt even with no context", () => {
    const { user } = buildPrompt({
      context: emptyContext(),
      profile: emptyProfile("x"),
      options: { type: "bio", tone: "formal", length: "medium" },
    });
    expect(user.length).toBeGreaterThan(0);
  });
});
