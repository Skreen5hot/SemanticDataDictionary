// core/rerun (C-S7): new schema bytes + previous SemanticDataDictionary -> Inventory + RerunPlan. Pure.
// Rules: R-S1, R-S2, R-S16, R-S17, R-S19, R-S23. The inventory is C-S1's parse of the schema, unchanged; each new
// item's itemSha256 is computed exactly as C-S6 records it in `source.itemSha256` (accept.sourceOf).

import { sha256Hex, toU8, canonicalBytes, cmp, CONTEXT_IRI } from './canonical.mjs';
import { parseSchema, SOURCE_FORMAT } from './parse.mjs';
import { buildSlots, UsageError } from './skeleton.mjs';
import { readPrevious, sourceOf } from './accept.mjs';

/**
 * C-S7. Returns {inventory, plan}: `plan` is null when the new schema has source errors (the errored Inventory is
 * the domain report, R-S3/R-S23; no plan can be formed from it). Throws DomainError (E-CTX-EXTERNAL) or
 * UsageError (E-IO, E-USAGE) for a previous file that is not a usable SDD; those are checked before the schema.
 */
export function rerunPlan({ schemaBytes, previousBytes, atlassianSchema, terms }) {
  const previous = readPrevious(previousBytes);
  if (previous.source.format !== SOURCE_FORMAT) {
    throw new UsageError('E-USAGE', `the previous SDD was made from another source format (${previous.source.format})`);
  }

  const inventory = parseSchema(schemaBytes, atlassianSchema);
  if (inventory.errors.length) return { inventory, plan: null };

  // Current items: one per slot (type, attribute, reference, containment), hashed as C-S6 records them.
  const current = new Map();
  for (const slot of buildSlots(inventory)) current.set(slot.key, { kind: slot.kind, itemSha256: sourceOf(slot, inventory).source.itemSha256 });

  // Previous items: the previous SDD's mappings (the accepted items, each with its recorded source.itemSha256).
  const prev = new Map(previous.mappings.map((m) => [m.key, m]));
  const termsChanged = previous.environment.termListSha256 !== terms.termsSha256;

  const unchanged = [], changed = [], added = [], removed = [];
  for (const [key, cur] of current) {
    const p = prev.get(key);
    if (!p) added.push(key);
    else if (!termsChanged && p.kind === cur.kind && p.source.itemSha256 === cur.itemSha256) unchanged.push(key);
    else changed.push(key);
  }
  for (const key of prev.keys()) if (!current.has(key)) removed.push(key);

  // R-S19: C-S7 flags, sorted by code (FL-KEY-SCHEME-CHANGED < FL-TERMS-CHANGED), each with key null.
  const flags = [];
  if (previous.source.identification !== inventory.source.identification) {
    flags.push({ code: 'FL-KEY-SCHEME-CHANGED', key: null, previous: previous.source.identification, current: inventory.source.identification });
  }
  if (termsChanged) {
    flags.push({ code: 'FL-TERMS-CHANGED', key: null, previous: previous.environment.termListSha256, current: terms.termsSha256 });
  }

  const plan = {
    '@context': CONTEXT_IRI,
    '@type': 'RerunPlan',
    previousSddSha256: sha256Hex(toU8(previousBytes)),
    inventorySha256: sha256Hex(canonicalBytes(inventory)),
    unchanged: unchanged.sort(cmp),
    changed: changed.sort(cmp),
    added: added.sort(cmp),
    removed: removed.sort(cmp),
    flags,
  };
  return { inventory, plan };
}
