/*
 * oracle-n.cjs: independent reference implementation of the per-mapping checks of C-S4 "check".
 *
 * Written by an isolated rater from spec/sdd-service.md v0.5 alone (with the prompt template
 * spec/prompt-template-v3.txt, schemas/proposal-v1.schema.json and the term-list data format for
 * context), on 2026-10-29. No implementation code (src/, site/, harness/, tools/, fixtures/, ...)
 * was read. This file MUST NOT be modified by the author of the implementation under test.
 *
 * Scope: everything C-S4 does after R-S13 has passed: coverage (R-S6), then the R-S20 per-mapping
 * traversal (R-S10 human-only fields, the field set, then per field R-S7 term and kind, R-S5
 * category, R-S8 domain/range, and warnings), including the v0.5 null-iceClass rule.
 *
 * Exports: setTerms(byCurie, byIri); check(slots, prop) -> { errs, warns },
 * each an array of [code, key, field, value].
 */
'use strict';

const ICE_IRI = 'https://www.commoncoreontologies.org/ont00000958';
const ICE_CURIE = 'cco:ont00000958';
const BFO_IRI_PREFIX = 'http://purl.obolibrary.org/obo/BFO_';
const NO_RELATION = 'sdd:NoRelation';

// R-S10, in the order the rule lists them.
const HUMAN_FIELDS = ['nullEquivalents', 'acceptance', 'decision', 'datatype'];

// R-S20 field sets by slot kind (excluding human-only fields).
const FIELD_SETS = {
  type: ['key', 'recordClass', 'referentClass', 'rationale'],
  attribute: ['key', 'iceClass', 'rationale'],
  reference: ['key', 'relation', 'rationale'],
  containment: ['key', 'relation', 'rationale'],
};

// R-S20 field order.
const FIELD_ORDER = ['recordClass', 'referentClass', 'iceClass', 'relation'];

let BY_CURIE = Object.create(null);
let BY_IRI = Object.create(null);
let ANC_CACHE = new Map();

function setTerms(byCurie, byIri) {
  BY_CURIE = byCurie || Object.create(null);
  BY_IRI = byIri || Object.create(null);
  ANC_CACHE = new Map();
}

function own(obj, k) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, k);
}

function termByCurie(c) {
  return typeof c === 'string' && own(BY_CURIE, c) ? BY_CURIE[c] : undefined;
}

// Named ancestry (ADR-008): the transitive closure over named direct superclasses, plus the
// BFO ancestors the term list records for the class and for each class reached. Excludes self.
function ancestors(iri) {
  if (ANC_CACHE.has(iri)) return ANC_CACHE.get(iri);
  const seen = new Set();
  const stack = [iri];
  const visited = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (visited.has(cur)) continue;
    visited.add(cur);
    const e = own(BY_IRI, cur) ? BY_IRI[cur] : undefined;
    if (!e) continue;
    for (const s of e.superclasses || []) {
      if (s !== iri) seen.add(s);
      stack.push(s);
    }
    for (const b of e.bfo_ancestors || []) if (b !== iri) seen.add(b);
  }
  ANC_CACHE.set(iri, seen);
  return seen;
}

function isOrDescends(iri, ofIri) {
  return iri === ofIri || ancestors(iri).has(ofIri);
}

function isIce(term) {
  return isOrDescends(term.iri, ICE_IRI);
}

function isGeneric(term) {
  return term.curie === ICE_CURIE || (typeof term.iri === 'string' && term.iri.startsWith(BFO_IRI_PREFIX));
}

function isPermittedClass(c) {
  const t = termByCurie(c);
  return !!(t && t.permitted === true && t.kind === 'class');
}

function check(slots, prop) {
  const errs = [];
  const warns = [];
  const mappings = Array.isArray(prop && prop.mappings) ? prop.mappings : [];

  const slotByKey = new Map();
  for (const s of slots) slotByKey.set(s.key, s);

  // ---- R-S6 coverage ----
  const byKey = new Map(); // key -> mappings in proposal order
  for (const m of mappings) {
    const k = m && m.key;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(m);
  }
  for (const s of slots) {
    const n = byKey.has(s.key) ? byKey.get(s.key).length : 0;
    if (n === 0) errs.push(['E-CHK-MISSING', s.key, null, null]);
    else if (n > 1) errs.push(['E-CHK-DUPLICATE', s.key, null, null]);
  }
  for (const m of mappings) {
    if (!slotByKey.has(m && m.key)) errs.push(['E-CHK-UNKNOWN-KEY', m && m.key, null, null]);
  }

  // referentClass "given, as a permitted class, by the same proposal" (R-S8): first mapping
  // for the type key that carries a permitted class as referentClass.
  function givenReferent(typeRef) {
    if (typeof typeRef !== 'string') return undefined;
    const candidates = [typeRef, 'ot:' + typeRef.replace(/~/g, '~0').replace(/\//g, '~1')];
    // also resolve a type name to a type slot of this batch
    for (const s of slots) if (s.kind === 'type' && s.name === typeRef) candidates.push(s.key);
    for (const k of candidates) {
      const ms = byKey.get(k);
      if (!ms) continue;
      for (const m of ms) {
        if (own(m, 'referentClass') && isPermittedClass(m.referentClass)) return termByCurie(m.referentClass);
      }
    }
    return undefined;
  }

  // ---- R-S20 traversal: each mapping whose key is a slot, in skeleton order ----
  for (const s of slots) {
    const ms = byKey.get(s.key);
    if (!ms) continue;
    for (const m of ms) checkMapping(s, m);
  }

  function checkMapping(slot, m) {
    const key = slot.key;
    // R-S10
    for (const h of HUMAN_FIELDS) {
      if (own(m, h)) errs.push(['E-CHK-HUMAN-FIELD', key, h, m[h]]);
    }
    // field set
    const expected = FIELD_SETS[slot.kind] || [];
    const present = Object.keys(m).filter((f) => !HUMAN_FIELDS.includes(f));
    const ok = present.length === expected.length && expected.every((f) => present.includes(f));
    if (!ok) {
      errs.push(['E-CHK-FIELDS', key, null, null]);
      return;
    }
    for (const field of FIELD_ORDER) {
      if (!own(m, field)) continue;
      const value = m[field];
      if (field === 'iceClass' && value === null) continue; // R-S5 v0.5
      checkField(slot, field, value);
    }
  }

  function checkField(slot, field, value) {
    const key = slot.key;
    const isRelation = field === 'relation';

    // sdd:NoRelation: containment only; exempt from R-S8; raises nothing.
    if (isRelation && value === NO_RELATION) {
      if (slot.kind !== 'containment') errs.push(['E-CHK-KIND', key, field, value]);
      return;
    }

    // R-S7 term
    const t = termByCurie(value);
    if (!t) {
      errs.push(['E-CHK-TERM', key, field, value]);
      return;
    }
    // R-S7 permitted and kind
    const wantKind = isRelation ? 'object_property' : 'class';
    if (t.permitted !== true || t.kind !== wantKind) {
      errs.push(['E-CHK-KIND', key, field, value]);
      return;
    }
    // R-S5 category
    if ((field === 'recordClass' || field === 'iceClass') && !isIce(t)) {
      errs.push(['E-CHK-CATEGORY', key, field, value]);
      return;
    }
    // R-S8 domain/range
    if (isRelation) {
      let ownerRef, targetRef;
      if (slot.kind === 'reference') {
        ownerRef = slot.owner;
        targetRef = slot.target;
      } else {
        ownerRef = slot.child;
        targetRef = slot.container;
      }
      const ownerT = givenReferent(ownerRef);
      const targetT = givenReferent(targetRef);
      if (!ownerT || !targetT) {
        warns.push(['W-CHK-RANGE-UNRESOLVED', key, field, value]);
        return;
      }
      const domOk = (t.domain || []).every((d) => isOrDescends(ownerT.iri, d));
      const rngOk = (t.range || []).every((r) => isOrDescends(targetT.iri, r));
      if (!domOk || !rngOk) {
        errs.push(['E-CHK-RANGE', key, field, value]);
        return;
      }
      return;
    }
    // warnings (R-S5), only when the field has no error
    if (isGeneric(t)) warns.push(['W-CHK-GENERIC', key, field, value]);
    if (field === 'referentClass' && isIce(t)) warns.push(['W-CHK-ICE-REFERENT', key, field, value]);
  }

  return { errs, warns };
}

module.exports = { setTerms, check };
