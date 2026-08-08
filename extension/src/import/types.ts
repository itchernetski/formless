// Shared shapes for getting data INTO the vault from any source: CV import,
// LinkedIn export (Phase 3), or capture-from-form (Phase 3.5).

// A single field value extracted from some source, targeting a profile path.
export interface ExtractedField {
  path: string; // dotted profile path or "custom.<key>"
  value: string;
  source: string; // provenance: "cv" | "linkedin" | "form:<host>"
}
