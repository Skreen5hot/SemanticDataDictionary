// core/check (C-S4): Skeleton + the prompt being answered + pasted bytes -> CheckReport. Pure.
// Rules: R-S5, R-S6, R-S7, R-S8, R-S10, R-S13, R-S14, R-S20, R-S21.

import { sha256Hex, toU8, fromUtf8, CONTEXT_IRI } from './canonical.mjs';
import { validate } from './jsonschema.mjs';
import { readJsonLd, UsageError } from './skeleton.mjs';
import { ICE_CURIE, NO_RELATION } from './terms.mjs';

const BEGIN_DATA = '-----BEGIN DATA (untrusted)-----';
const END_DATA = '-----END DATA-----';
const HUMAN_FIELDS = ['nullEquivalents', 'acceptance', 'decision', 'datatype'];
const FIELD_SETS = {
  type: ['key', 'recordClass', 'referentClass', 'rationale'],
  attribute: ['key', 'iceClass', 'rationale'],
  reference: ['key', 'relation', 'rationale'],
  containment: ['key', 'relation', 'rationale'],
};
const FIELD_ORDER = ['recordClass', 'referentClass', 'iceClass', 'relation'];

/** Read the prompt's header (skeleton, terms, batch, round) and its DATA lines (parsed, and as raw text). */
export function parsePrompt(promptBytes) {
  const text = fromUtf8(toU8(promptBytes));
  const lines = text.split('\n');
  const header = (name) => {
    const prefix = name + ': ';
    const l = lines.slice(0, 8).find((x) => x.startsWith(prefix));
    return l === undefined ? undefined : l.slice(prefix.length);
  };
  const skeletonSha256 = header('skeleton');
  const batch = header('batch');
  const roundText = header('round');
  const begin = lines.indexOf(BEGIN_DATA);
  const end = begin < 0 ? -1 : lines.indexOf(END_DATA, begin + 1);
  if (!skeletonSha256 || !batch || !/^[1-9][0-9]*$/.test(roundText || '') || begin < 0 || end < 0) {
    throw new UsageError('E-USAGE', 'the prompt is not an SDD mapping request');
  }
  const data = [];
  const dataLines = lines.slice(begin + 1, end);
  for (const l of dataLines) {
    let obj;
    try { obj = JSON.parse(l); } catch { throw new UsageError('E-USAGE', 'the prompt has a DATA line that is not JSON'); }
    if (!obj || typeof obj.key !== 'string' || typeof obj.kind !== 'string') throw new UsageError('E-USAGE', 'the prompt has a malformed DATA line');
    data.push(obj);
  }
  return { skeletonSha256, termsSha256: header('terms'), batch, round: Number(roundText), data, dataLines };
}

/** R-S13 answer extraction: the whole trimmed paste if it is one JSON object, else exactly one ```json block. */
export function extractAnswer(pasteText) {
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  try {
    const v = JSON.parse(pasteText.trim());
    if (isObject(v)) return v;
  } catch { /* fall through to fenced extraction */ }
  const blocks = [...pasteText.matchAll(/```json[ \t]*\r?\n([\s\S]*?)```/g)];
  if (blocks.length !== 1) return undefined;
  try {
    const v = JSON.parse(blocks[0][1].trim());
    return isObject(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

function entry(code, key, field, value, rule, message) {
  return { code, key, field, value, rule, message };
}

/**
 * C-S4. Inputs are bytes plus the parsed proposal schema and a term index. Returns the CheckReport value.
 * Throws DomainError (E-CTX-EXTERNAL) or UsageError for inputs that are not a matching skeleton/prompt pair.
 */
export function checkProposal({ skeletonBytes, promptBytes, pasteBytes, proposalSchema, terms }) {
  const skeleton = readJsonLd(skeletonBytes, 'skeleton');
  if (!Array.isArray(skeleton.slots)) throw new UsageError('E-USAGE', 'skeleton is not a Skeleton');
  const prompt = parsePrompt(promptBytes);
  if (prompt.skeletonSha256 !== sha256Hex(toU8(skeletonBytes))) {
    throw new UsageError('E-USAGE', 'the prompt was not built from this skeleton');
  }
  const slotByKey = new Map(skeleton.slots.map((s) => [s.key, s]));
  for (const d of prompt.data) {
    const s = slotByKey.get(d.key);
    if (!s || s.kind !== d.kind) throw new UsageError('E-USAGE', `prompt DATA key ${d.key} is not a slot of this skeleton`);
  }

  const errors = [];
  const warnings = [];
  const report = {
    '@context': CONTEXT_IRI,
    '@type': 'CheckReport',
    skeletonSha256: prompt.skeletonSha256,
    batch: prompt.batch,
    round: prompt.round,
    promptSha256: sha256Hex(toU8(promptBytes)),
    proposalSha256: sha256Hex(toU8(pasteBytes)),
    termListSha256: terms.termsSha256,
    status: null,
    errors,
    warnings,
  };
  const finish = () => {
    report.status = errors.length === 0 ? 'validated' : 'rejected';
    return report;
  };

  // ---- R-S13: extraction, schema, skeleton, batch (each failure stops) ----
  let text = fromUtf8(toU8(pasteBytes));
  const answer = extractAnswer(text);
  if (answer === undefined) {
    errors.push(entry('E-CHK-JSON', null, null, null, 'R-S13', 'The reply does not contain exactly one JSON object.'));
    return finish();
  }
  const shape = validate(proposalSchema, answer, { firstOnly: true });
  if (shape.length) {
    const { pointer, keyword } = shape[0];
    errors.push(entry('E-CHK-SHAPE', null, null, pointer, 'R-S13', `The reply does not match the proposal schema at ${pointer} (${keyword}).`));
    return finish();
  }
  if (answer.skeletonSha256 !== prompt.skeletonSha256) {
    errors.push(entry('E-CHK-SKELETON', null, null, answer.skeletonSha256, 'R-S13', 'The reply names a different skeleton than the prompt.'));
    return finish();
  }
  if (answer.batch !== prompt.batch) {
    errors.push(entry('E-CHK-BATCH', null, null, answer.batch, 'R-S13', `The reply names batch ${answer.batch}; the prompt is batch ${prompt.batch}.`));
    return finish();
  }

  // ---- R-S6 coverage ----
  const batchKeys = prompt.data.map((d) => d.key);
  const batchSet = new Set(batchKeys);
  const byKey = new Map();
  for (const m of answer.mappings) {
    if (!byKey.has(m.key)) byKey.set(m.key, []);
    byKey.get(m.key).push(m);
  }
  for (const k of batchKeys) {
    const n = (byKey.get(k) || []).length;
    if (n === 0) errors.push(entry('E-CHK-MISSING', k, null, null, 'R-S6', `Slot ${k} has no mapping in this batch.`));
    else if (n > 1) errors.push(entry('E-CHK-DUPLICATE', k, null, null, 'R-S6', `Slot ${k} is mapped more than once.`));
  }
  const reportedUnknown = new Set();
  for (const m of answer.mappings) {
    if (!batchSet.has(m.key) && !reportedUnknown.has(m.key)) {
      reportedUnknown.add(m.key);
      errors.push(entry('E-CHK-UNKNOWN-KEY', m.key, null, null, 'R-S6', `${m.key} is not a slot in this batch.`));
    }
  }

  // referentClass available for R-S8: the type's mapping in this proposal (first occurrence), if it names a
  // permitted class. (C-S4 takes no previous SDD on its CLI surface, so "same proposal" is the only source.)
  const referentOf = (typeKey) => {
    const ms = batchSet.has(typeKey) ? byKey.get(typeKey) : undefined;
    const rc = ms && ms[0].referentClass;
    if (typeof rc !== 'string') return null;
    const t = terms.get(rc);
    return t && t.permitted && t.kind === 'class' ? rc : null;
  };
  const dataByKey = new Map(prompt.data.map((d) => [d.key, d]));

  // ---- R-S20 per-mapping traversal, in skeleton (DATA) order ----
  for (const k of batchKeys) {
    const ms = byKey.get(k);
    if (!ms) continue;
    const m = ms[0];
    const slot = slotByKey.get(k);

    for (const h of HUMAN_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(m, h)) {
        errors.push(entry('E-CHK-HUMAN-FIELD', k, h, null, 'R-S10', `${h} can only be set by a person at acceptance.`));
      }
    }
    const expected = FIELD_SETS[slot.kind];
    const present = Object.keys(m).filter((f) => !HUMAN_FIELDS.includes(f));
    const sameSet = present.length === expected.length && expected.every((f) => present.includes(f));
    if (!sameSet) {
      errors.push(entry('E-CHK-FIELDS', k, null, null, 'R-S20', `${k} must have exactly the fields ${expected.join(', ')}.`));
      continue;
    }

    for (const field of FIELD_ORDER) {
      if (!expected.includes(field)) continue;
      const value = m[field];
      const err = (code, rule, message) => errors.push(entry(code, k, field, value, rule, message));
      const isRelation = field === 'relation';
      const expectedKind = isRelation ? 'object property' : 'class';

      // R-S5 (v0.5): a null iceClass asserts no specific classification; no term, kind or category check, no warning.
      if (field === 'iceClass' && value === null) continue;
      // R-S7: term, then kind.
      if (isRelation && value === NO_RELATION) {
        if (slot.kind === 'containment') continue; // exempt from kind, category and R-S8
        err('E-CHK-KIND', 'R-S7', `${field} ${value} is not a permitted ${expectedKind} term.`);
        continue;
      }
      const term = terms.get(value);
      if (!term) { err('E-CHK-TERM', 'R-S7', `${field} ${value} is not in the term list.`); continue; }
      if (!term.permitted || term.kind !== (isRelation ? 'object_property' : 'class')) {
        err('E-CHK-KIND', 'R-S7', `${field} ${value} is not a permitted ${expectedKind} term.`);
        continue;
      }
      const label = term.label;

      // R-S5: category.
      if ((field === 'recordClass' || field === 'iceClass') && !terms.isIce(value)) {
        err('E-CHK-CATEGORY', 'R-S5', `${field} ${value} (${label}) is not cco:ont00000958 (Information Content Entity) or a subclass of it.`);
        continue;
      }

      // R-S8: domain and range.
      if (isRelation) {
        const data = dataByKey.get(k);
        const [domainSide, rangeSide] = slot.kind === 'containment' ? [data.child, data.container] : [data.owner, data.target];
        const dRc = referentOf(domainSide);
        const rRc = referentOf(rangeSide);
        if (dRc === null || rRc === null) {
          warnings.push(entry('W-CHK-RANGE-UNRESOLVED', k, field, value, 'R-S8', `${field} ${value}: the domain/range check needs a referentClass not yet mapped.`));
          continue;
        }
        const ok = (term.domain || []).every((iri) => terms.isOrDescendsIri(dRc, iri)) &&
          (term.range || []).every((iri) => terms.isOrDescendsIri(rRc, iri));
        if (!ok) err('E-CHK-RANGE', 'R-S8', `${field} ${value} does not admit the referent classes it connects (domain/range).`);
        continue;
      }

      // Warnings (no error on this field), R-S5: W-CHK-GENERIC first, then W-CHK-ICE-REFERENT.
      if (value.startsWith('bfo:') || value === ICE_CURIE) {
        warnings.push(entry('W-CHK-GENERIC', k, field, value, 'R-S5', `${field} ${value} (${label}) is a top-level class; check it is specific enough.`));
      }
      if (field === 'referentClass' && terms.isIce(value)) {
        warnings.push(entry('W-CHK-ICE-REFERENT', k, field, value, 'R-S5', `referentClass ${value} (${label}) is information content; check the record is about information.`));
      }
    }
  }
  return finish();
}
