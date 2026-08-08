// Score each form field against every field definition and pick the best match.
// Scoring is additive across signal sources, weighted by reliability.

import { FIELD_DEFS, type FieldDef } from "./fielddefs";
import { extractSignals, tokenHit, type FieldSignals } from "./signals";

export interface Mapping {
  path: string;
  score: number;
}

// Reliability weights per signal source.
const W = {
  autocompleteExact: 12,
  autocompleteToken: 6,
  name: 6,
  id: 5,
  label: 4,
  placeholder: 4,
  aria: 4,
};

const MIN_SCORE = 4; // below this we don't trust the match

function scoreDef(sig: FieldSignals, def: FieldDef): number {
  let score = 0;

  if (sig.autocomplete) {
    if (def.autocomplete.includes(sig.autocomplete)) score += W.autocompleteExact;
    else if (def.autocomplete.some((a) => tokenHit(sig.autocomplete, a)))
      score += W.autocompleteToken;
  }

  for (const t of def.tokens) {
    if (tokenHit(sig.name, t)) score += W.name;
    if (tokenHit(sig.id, t)) score += W.id;
    if (tokenHit(sig.label, t)) score += W.label;
    if (tokenHit(sig.placeholder, t)) score += W.placeholder;
    if (tokenHit(sig.aria, t)) score += W.aria;
  }

  return score;
}

// Best-matching profile path for one element, or null if nothing clears MIN_SCORE.
export function mapField(el: Element): Mapping | null {
  const sig = extractSignals(el);
  if (!sig.autocomplete && !sig.name && !sig.id && !sig.placeholder && !sig.aria && !sig.label)
    return null;

  let best: Mapping | null = null;
  for (const def of FIELD_DEFS) {
    const score = scoreDef(sig, def);
    if (score >= MIN_SCORE && (!best || score > best.score)) {
      best = { path: def.path, score };
    }
  }
  return best;
}
