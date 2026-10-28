// core/accept (C-S6): Skeleton + Inventory + decisions + >= 1 (CheckReport, paste) pair (+ optional previous SDD)
// -> SemanticDataDictionary. Pure: the caller supplies bytes, the term index and the time of the act.
// Rules: R-S1, R-S9, R-S10, R-S14, R-S15, R-S16, R-S17 (merge), R-S18, R-S23; seam S-O3 (decisions).

import { sha256Hex, toU8, fromUtf8, itemSha256, cmp, CONTEXT_IRI } from './canonical.mjs';
import { readJsonLd, buildSlots, VALUE_TABLE, DomainError, UsageError } from './skeleton.mjs';
import { extractAnswer } from './check.mjs';

export const ABSENCE_KINDS = ['missing', 'explicit_null', 'empty_string', 'indistinguishable'];
const FIELD_SETS = {
  type: ['key', 'recordClass', 'referentClass', 'rationale'],
  attribute: ['key', 'iceClass', 'rationale'],
  reference: ['key', 'relation', 'rationale'],
  containment: ['key', 'relation', 'rationale'],
};
const AT_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/;

const usage = (detail) => new UsageError('E-USAGE', detail);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const refuse = (code, key, value, rule, message) => new DomainError(code, { key, field: null, value, rule, message });

/** S-O3: parse and shape-check the decisions input. Not JSON or wrong shape is E-USAGE (bad arguments). */
export function readDecisions(bytes) {
  let text = fromUtf8(toU8(bytes));
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let d;
  try { d = JSON.parse(text); } catch { throw usage('the decisions file is not JSON'); }
  if (!isObj(d)) throw usage('the decisions file is not a JSON object');
  for (const k of Object.keys(d)) if (!['by', 'decisions', 'nullEquivalents'].includes(k)) throw usage(`decisions: unknown member ${k}`);
  if (!isStr(d.by) || d.by.length === 0) throw usage('decisions: "by" must be a non-empty string');
  if (!Array.isArray(d.decisions)) throw usage('decisions: "decisions" must be an array');
  const seen = new Set();
  for (const x of d.decisions) {
    if (!isObj(x) || Object.keys(x).length !== 2 || !isStr(x.key) || (x.decision !== 'accept' && x.decision !== 'reject')) {
      throw usage('decisions: each decision must be {"key": string, "decision": "accept" | "reject"}');
    }
    if (seen.has(x.key)) throw usage(`decisions: key ${x.key} is decided more than once`);
    seen.add(x.key);
  }
  const ne = d.nullEquivalents === undefined ? {} : d.nullEquivalents;
  if (!isObj(ne)) throw usage('decisions: "nullEquivalents" must be an object');
  for (const [k, v] of Object.entries(ne)) {
    if (!Array.isArray(v) || !v.every(isStr)) throw usage(`decisions: nullEquivalents for ${k} must be an array of strings`);
  }
  return { by: d.by, decisions: d.decisions, nullEquivalents: ne };
}

function readReport(bytes, i) {
  const r = readJsonLd(bytes, `report ${i + 1}`);
  if (r['@type'] !== 'CheckReport' || !Array.isArray(r.errors) || !Number.isInteger(r.round) || r.round < 1 ||
      !isStr(r.batch) || !isStr(r.promptSha256) || !isStr(r.proposalSha256) || !isStr(r.skeletonSha256) ||
      (r.status !== 'validated' && r.status !== 'rejected')) {
    throw usage(`report ${i + 1} is not a CheckReport`);
  }
  return r;
}

/** A previous SemanticDataDictionary (C-S6 --previous, C-S7). Context foreign -> E-CTX-EXTERNAL; wrong kind -> E-USAGE. */
export function readPrevious(bytes) {
  const p = readJsonLd(bytes, 'previous SDD');
  if (p['@type'] !== 'SemanticDataDictionary' || !Array.isArray(p.mappings) || !Array.isArray(p.open) || !Array.isArray(p.retired) ||
      !p.mappings.every((m) => isObj(m) && isStr(m.key) && isStr(m.kind) && isObj(m.source) && isStr(m.source.itemSha256)) ||
      !p.retired.every((m) => isObj(m) && isStr(m.key)) ||
      !isObj(p.source) || !isStr(p.source.identification) || !isObj(p.environment) || !isStr(p.environment.termListSha256)) {
    throw usage('the previous file is not a SemanticDataDictionary');
  }
  return p;
}

/** R-S1 item hash of the inventory entry a slot was built from (containment: its FL-CONTAINMENT entry). */
export function sourceOf(slot, inventory) {
  if (slot.kind === 'type') {
    const t = inventory.objectTypes.find((x) => x.key === slot.key);
    return { source: { name: t.name, externalId: t.externalId, itemSha256: itemSha256(t) } };
  }
  if (slot.kind === 'containment') {
    const f = inventory.flags.find((x) => x.code === 'FL-CONTAINMENT' && 'ct:' + x.key === slot.key);
    return { source: { child: f.key, container: f.container, selector: f.selector, itemSha256: itemSha256(f) } };
  }
  const a = inventory.attributes.find((x) => x.key === slot.key);
  const source = { name: a.name, externalId: a.externalId, owner: a.owner, jiraType: a.type };
  if (slot.kind === 'reference') source.target = a.target;
  source.itemSha256 = itemSha256(a);
  return { source, jiraType: a.type };
}

/**
 * C-S6. `checked` is [{reportBytes, pasteBytes}] (>= 1); `previousBytes` optional; `at` is the time of the act
 * (ISO-8601 UTC, seconds, "Z"), supplied by the caller. Returns the SemanticDataDictionary value.
 * Throws DomainError (exit 1: E-CTX-EXTERNAL, E-ACC-UNVALIDATED, E-ACC-MISMATCH, E-ACC-UNCOVERED) or
 * UsageError (exit 2: E-USAGE, E-IO).
 */
export function acceptMappings({ skeletonBytes, inventoryBytes, decisionsBytes, checked, previousBytes, terms, at }) {
  if (!isStr(at) || !AT_FORMAT.test(at)) throw new TypeError('at must be YYYY-MM-DDTHH:MM:SSZ');
  if (!Array.isArray(checked) || checked.length === 0) throw usage('accept needs at least one --checked <report> <paste> pair');

  // 1. Each input is readable, of its kind, and in the bundled context (R-S16, R-S23).
  const skeleton = readJsonLd(skeletonBytes, 'skeleton');
  if (skeleton['@type'] !== 'Skeleton' || !Array.isArray(skeleton.slots)) throw usage('skeleton is not a Skeleton');
  const inventory = readJsonLd(inventoryBytes, 'inventory');
  if (inventory['@type'] !== 'Inventory' || !Array.isArray(inventory.objectTypes) || !Array.isArray(inventory.attributes) ||
      !Array.isArray(inventory.flags) || !Array.isArray(inventory.errors) || !isObj(inventory.source)) {
    throw usage('inventory is not an Inventory');
  }
  const reports = checked.map((c, i) => readReport(c.reportBytes, i));
  const previous = previousBytes === undefined || previousBytes === null ? null : readPrevious(previousBytes);
  const dec = readDecisions(decisionsBytes);

  // 2. R-S18: every report validated; each paste is the one its report checked; each report checked this skeleton.
  const skeletonSha256 = sha256Hex(toU8(skeletonBytes));
  reports.forEach((r, i) => {
    if (r.status !== 'validated' || r.errors.length !== 0) {
      throw refuse('E-ACC-UNVALIDATED', null, r.status, 'R-S18', `Check report ${i + 1} is ${r.status}; only a validated report can support a decision.`);
    }
  });
  reports.forEach((r, i) => {
    if (sha256Hex(toU8(checked[i].pasteBytes)) !== r.proposalSha256) {
      throw refuse('E-ACC-MISMATCH', null, r.proposalSha256, 'R-S18', `Paste ${i + 1} is not the reply check report ${i + 1} checked (proposalSha256 differs).`);
    }
  });
  reports.forEach((r, i) => {
    if (r.skeletonSha256 !== skeletonSha256) {
      throw refuse('E-ACC-MISMATCH', null, r.skeletonSha256, 'R-S18', `Check report ${i + 1} was made against a different skeleton (skeletonSha256 differs).`);
    }
  });

  // 3. R-S23: the remaining inputs belong together.
  if (skeleton.inventorySha256 !== sha256Hex(toU8(inventoryBytes))) throw usage('the skeleton was not built from this inventory (inventorySha256 differs)');
  if (skeleton.termListSha256 !== terms.termsSha256) throw usage('the skeleton cites a different term list (termListSha256 differs)');
  if (inventory.errors.length) throw usage('the inventory holds errors');
  const slots = buildSlots(inventory);
  if (JSON.stringify(slots) !== JSON.stringify(skeleton.slots)) throw usage('the skeleton slots are not those of this inventory');
  const slotByKey = new Map(slots.map((s) => [s.key, s]));

  // The reply each validated report checked, re-read from its paste; covering report per key = highest round
  // (the first such pair in argument order on a tie).
  const cover = new Map(); // key -> {mapping, report, reportSha256}
  reports.forEach((r, i) => {
    if (r.termListSha256 !== terms.termsSha256) throw usage(`check report ${i + 1} cites a different term list`);
    const answer = extractAnswer(fromUtf8(toU8(checked[i].pasteBytes)));
    if (!isObj(answer) || answer.skeletonSha256 !== skeletonSha256 || answer.batch !== r.batch || !Array.isArray(answer.mappings)) {
      throw usage(`paste ${i + 1} does not hold the reply its check report describes`);
    }
    const keys = new Set();
    for (const m of answer.mappings) {
      const slot = isObj(m) && isStr(m.key) ? slotByKey.get(m.key) : undefined;
      const fields = slot && FIELD_SETS[slot.kind];
      if (!slot || keys.has(m.key) || Object.keys(m).length !== fields.length || !fields.every((f) => isStr(m[f]))) {
        throw usage(`paste ${i + 1} does not hold the reply its check report describes`);
      }
      keys.add(m.key);
      const prior = cover.get(m.key);
      if (!prior || r.round > prior.report.round) {
        cover.set(m.key, { mapping: m, report: r, reportSha256: sha256Hex(toU8(checked[i].reportBytes)) });
      }
    }
  });

  // 4. Decisions: each decided key covered (R-S18); null-equivalents only on attributes accepted in this act (R-S15).
  for (const d of dec.decisions) {
    if (!cover.has(d.key)) {
      throw refuse('E-ACC-UNCOVERED', d.key, d.decision, 'R-S18', `No supplied validated check report covers ${d.key}.`);
    }
  }
  const decided = new Map(dec.decisions.map((d) => [d.key, d.decision]));
  for (const k of Object.keys(dec.nullEquivalents)) {
    if (decided.get(k) !== 'accept' || slotByKey.get(k).kind !== 'attribute') {
      throw usage(`nullEquivalents names ${k}, which is not an attribute decided "accept" in these decisions`);
    }
  }

  // 5. Build: decided keys from the covering report; undecided keys carried from the previous SDD if unchanged (R-S17).
  // R-S17 (SDD-F72): a previous SDD made under another term list carries no mapping; its keys that are still slots
  // and not decided here become open, and removed keys still move to `retired`.
  const carryable = previous !== null && previous.environment.termListSha256 === terms.termsSha256;
  const prevByKey = new Map(carryable ? previous.mappings.map((m) => [m.key, m]) : []);
  const mappings = [];
  const open = [];
  for (const slot of slots) {
    const { source, jiraType } = sourceOf(slot, inventory);
    const decision = decided.get(slot.key);
    if (decision === 'accept') {
      const { mapping: p, report: r, reportSha256 } = cover.get(slot.key);
      const m = { key: slot.key, kind: slot.kind, source };
      if (slot.kind === 'type') {
        m.recordClass = p.recordClass;
        m.referentClass = p.referentClass;
      } else if (slot.kind === 'attribute') {
        const [datatype, valueProperty] = VALUE_TABLE[jiraType];
        const ne = [...new Set(dec.nullEquivalents[slot.key] || [])].sort(cmp);
        m.iceClass = p.iceClass;
        m.datatype = datatype;
        m.valueProperty = valueProperty;
        m.nullEquivalents = ne;
      } else {
        m.relation = p.relation;
      }
      m.rationale = p.rationale;
      m.provenance = { round: r.round, batch: r.batch, promptSha256: r.promptSha256, proposalSha256: r.proposalSha256, checkReportSha256: reportSha256 };
      m.acceptance = { decision: 'accepted', by: dec.by, at };
      mappings.push(m);
      continue;
    }
    const prev = prevByKey.get(slot.key);
    if (decision === undefined && prev && prev.kind === slot.kind && prev.source.itemSha256 === source.itemSha256) {
      mappings.push(prev); // unchanged: carried byte-identical, with its own acceptance record
      continue;
    }
    open.push(slot.key);
  }
  // Previously accepted mappings whose key is no longer a slot move to `retired` with their last acceptance record.
  const retired = previous ? [...previous.retired, ...previous.mappings.filter((m) => !slotByKey.has(m.key))] : [];
  retired.sort((a, b) => cmp(a.key, b.key));
  open.sort(cmp);

  return {
    '@context': CONTEXT_IRI,
    '@type': 'SemanticDataDictionary',
    sddVersion: 1,
    source: {
      format: inventory.source.format,
      sha256: inventory.source.sha256,
      schemaName: inventory.source.schemaName,
      identification: inventory.source.identification,
      inventorySha256: sha256Hex(toU8(inventoryBytes)),
    },
    environment: {
      termListSha256: terms.termsSha256,
      ontologyTemplateCommit: terms.ontologyTemplateCommit,
      contextIri: CONTEXT_IRI,
    },
    absenceKinds: [...ABSENCE_KINDS],
    mappings,
    open,
    retired,
  };
}
