// Artifact schema test (SDD OS-1). Node, no dependencies. Usage: node src/test/schemas.mjs (from anywhere).
//
// 1. Every current witness (fixtures/witnesses/**/*.jsonld outside superseded/) validates against the schema for its
//    @type: schemas/{inventory,prompt-set,rerun-plan}-v1.schema.json and (SDD v0.5) schemas/{skeleton,check-report,sdd}-v2.schema.json.
// 2. Artifacts the core emits but no witness file holds (errored inventories, oversize PromptSet warnings, rejected
//    CheckReports for every R-S21 code family) are produced in-process by src/core and validated too.
// 3. Corrupted artifacts MUST fail.
// 4. shapes/sdd-v2.shacl.ttl: its generated term lists equal those re-derived from ontology/term-list.json. (No SHACL
//    engine runs here; the shapes are checked by an external engine.)
//
// Validation uses the core's own JSON Schema subset (src/core/jsonschema.mjs). The schemas use two keywords it does
// not implement, `minimum` and `uniqueItems`; a supplementary walker below checks exactly those (and the R-S1 key
// order of closed objects). Any other keyword in a schema fails the test.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../core/jsonschema.mjs';
import { parseSchema } from '../core/parse.mjs';
import { buildPrompts } from '../core/prompt.mjs';
import { checkProposal, extractAnswer } from '../core/check.mjs';
import { indexTerms } from '../core/terms.mjs';
import { canonicalBytes, cmp } from '../core/canonical.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = (...xs) => path.join(ROOT, ...xs);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));

const TYPES = {
  Inventory: 'inventory',
  Skeleton: 'skeleton',
  PromptSet: 'prompt-set',
  CheckReport: 'check-report',
  RerunPlan: 'rerun-plan',
  SemanticDataDictionary: 'sdd',
};
const VERSION = { skeleton: 2, 'check-report': 2, sdd: 2 }; // SDD v0.5 (R-S24); the rest are unchanged version 1
const SCHEMAS = Object.fromEntries(Object.entries(TYPES).map(([t, n]) => [t, readJson(P('schemas', `${n}-v${VERSION[n] || 1}.schema.json`))]));

let failures = 0;
const fail = (msg) => { failures++; console.log('FAIL ' + msg); };

// ---------- keyword audit ----------
const CORE_KEYWORDS = new Set(['$ref', 'type', 'enum', 'const', 'minLength', 'maxLength', 'pattern', 'required', 'properties',
  'additionalProperties', 'items', 'minItems', 'if', 'then', 'else']);
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$defs']);
const SUPPLEMENT = new Set(['minimum', 'uniqueItems']);
const used = new Set();
function audit(s, where) {
  if (typeof s === 'boolean') return;
  for (const [k, v] of Object.entries(s)) {
    used.add(k);
    if (!CORE_KEYWORDS.has(k) && !ANNOTATIONS.has(k) && !SUPPLEMENT.has(k)) fail(`${where}: keyword ${k} is neither in the core subset nor in the supplement`);
    if (k === 'properties' || k === '$defs') for (const [n, sub] of Object.entries(v)) audit(sub, `${where}/${k}/${n}`);
    else if (['items', 'additionalProperties', 'if', 'then', 'else'].includes(k) && typeof v === 'object') audit(v, `${where}/${k}`);
  }
}
for (const [t, s] of Object.entries(SCHEMAS)) audit(s, TYPES[t]);

// ---------- supplementary walker: minimum, uniqueItems, closed-object key order ----------
function resolve(root, ref) {
  return ref.slice(2).split('/').reduce((n, p) => n[p.replace(/~1/g, '/').replace(/~0/g, '~')], root);
}
function supplement(root, instance) {
  const errs = [];
  const walk = (s, v, ptr) => {
    if (s === true || s === false || s === undefined) return;
    if (s.$ref) walk(resolve(root, s.$ref), v, ptr);
    if (typeof s.minimum === 'number' && typeof v === 'number' && v < s.minimum) errs.push(`${ptr} minimum`);
    if (s.uniqueItems === true && Array.isArray(v)) {
      const seen = new Set(v.map((x) => JSON.stringify(x)));
      if (seen.size !== v.length) errs.push(`${ptr} uniqueItems`);
    }
    if (s.if !== undefined) {
      const ifOk = validate({ ...s.if, $defs: root.$defs }, v).length === 0;
      walk(ifOk ? s.then : s.else, v, ptr);
    }
    const isObj = v !== null && typeof v === 'object' && !Array.isArray(v);
    if (isObj && s.properties) {
      if (s.additionalProperties === false) {
        const order = Object.keys(s.properties);
        const idx = Object.keys(v).map((k) => order.indexOf(k)).filter((i) => i >= 0);
        if (idx.some((x, i) => i > 0 && x < idx[i - 1])) errs.push(`${ptr} key order (R-S1)`);
      }
      for (const [k, sub] of Object.entries(s.properties)) if (k in v) walk(sub, v[k], `${ptr}/${k}`);
    }
    if (Array.isArray(v) && s.items !== undefined && typeof s.items === 'object') v.forEach((x, i) => walk(s.items, x, `${ptr}/${i}`));
  };
  walk(root, instance, '');
  return errs;
}

function check(doc) {
  const schema = SCHEMAS[doc && doc['@type']];
  if (!schema) return [`no schema for @type ${doc && doc['@type']}`];
  return [...validate(schema, doc).map((e) => `${e.pointer} ${e.keyword} ${JSON.stringify(e.detail)}`), ...supplement(schema, doc)];
}

const counts = {};
const tally = (group, type) => { const k = `${group} ${type}`; counts[k] = (counts[k] || 0) + 1; };
// Optional: SDD_SCHEMA_DUMP=<dir> writes every case (pass/<n>.json, fail/<n>.json) for cross-checking with another validator.
const DUMP = process.env.SDD_SCHEMA_DUMP;
let dumped = 0;
const dump = (kind, label, doc) => {
  if (!DUMP) return;
  fs.mkdirSync(path.join(DUMP, kind), { recursive: true });
  fs.writeFileSync(path.join(DUMP, kind, `${dumped++}.json`), JSON.stringify({ label, doc }));
};
function mustPass(label, doc, group) {
  dump('pass', label, doc);
  const errs = check(doc);
  if (errs.length) fail(`${label}: ${errs.slice(0, 3).join('; ')}`);
  else tally(group, doc['@type']);
}

// ---------- 1. witnesses ----------
const witnessFiles = [];
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'superseded') scan(p); } else if (e.name.endsWith('.jsonld')) witnessFiles.push(p);
  }
})(P('fixtures', 'witnesses'));
for (const f of witnessFiles.sort()) {
  const bytes = fs.readFileSync(f);
  const doc = JSON.parse(bytes.toString('utf8'));
  if (Buffer.compare(Buffer.from(canonicalBytes(doc)), bytes) !== 0) fail(`${path.relative(ROOT, f)} is not R-S1 canonical bytes`);
  mustPass(path.relative(ROOT, f), doc, 'witness');
}

// ---------- 2. derived artifacts produced by the core ----------
const termList = readJson(P('ontology', 'term-list.json'));
const terms = indexTerms(termList);
const template = fs.readFileSync(P('spec', 'prompt-template-v2.txt'), 'utf8');
const proposalSchema = readJson(P('schemas', 'proposal-v2.schema.json'));
const atlassian = readJson(P('vendor', 'atlassian', 'assets-import-schema-2021_09_15.json'));
const W = (p) => fs.readFileSync(P('fixtures', 'witnesses', p));

// 2a. errored inventories: every invalid fixture, plus bytes that are not JSON.
const invalidDir = P('fixtures', 'jira-assets', 'invalid');
for (const f of fs.readdirSync(invalidDir).filter((x) => x.endsWith('.json')).sort()) {
  const inv = parseSchema(fs.readFileSync(path.join(invalidDir, f)), atlassian);
  if (inv.errors.length === 0) fail(`invalid/${f} parsed without errors`);
  mustPass(`errored inventory from invalid/${f}`, inv, 'derived');
}
mustPass('errored inventory from non-JSON bytes', parseSchema(new TextEncoder().encode('{'), atlassian), 'derived');
for (const f of ['hostile-separators.json', 'synthetic-it-assets.json', 'minimal-organization-v3-removed.json']) {
  mustPass(`inventory from ${f}`, parseSchema(fs.readFileSync(P('fixtures', 'jira-assets', f)), atlassian), 'derived');
}

// 2b. PromptSets: oversize warnings (W-CS3-Δ4), two batches (W-CS3-Δ2), a key subset (W-CS3-Δ3).
const fullSk = W('full/skeleton.jsonld'), fullInv = W('full/inventory.jsonld');
const minSk = W('minimal/skeleton.jsonld'), minInv = W('minimal/inventory.jsonld');
const ps = (o) => buildPrompts({ template, terms, ...o }).promptSet;
const oversize = ps({ skeletonBytes: fullSk, inventoryBytes: fullInv, budget: 63700 });
if (oversize.warnings.length !== 5) fail('budget 63700 should give 5 W-PROMPT-OVERSIZE warnings');
mustPass('PromptSet budget 63700', oversize, 'derived');
mustPass('PromptSet budget 69000', ps({ skeletonBytes: fullSk, inventoryBytes: fullInv, budget: 69000 }), 'derived');
mustPass('PromptSet --keys', ps({ skeletonBytes: minSk, inventoryBytes: minInv, keys: ['at:Organization/Cost Center'] }), 'derived');

// 2c. CheckReports, one per R-S21 code family, from mutated pastes against the minimal prompt.
const minPrompt = W('minimal/prompt.txt');
const goodAnswer = extractAnswer(W('minimal/proposal-pasted.txt').toString('utf8'));
const report = (paste, sk = minSk, prompt = minPrompt) =>
  checkProposal({ skeletonBytes: sk, promptBytes: prompt, pasteBytes: new TextEncoder().encode(paste), proposalSchema, terms });
const withAnswer = (f) => { const a = clone(goodAnswer); f(a); return JSON.stringify(a); };
const m = (a, key) => a.mappings.find((x) => x.key === key);
const reportCases = [
  ['E-CHK-JSON', 'no JSON here'],
  ['E-CHK-SHAPE', withAnswer((a) => { a.mappings = {}; })],
  ['E-CHK-SKELETON', withAnswer((a) => { a.skeletonSha256 = '0'.repeat(64); })],
  ['E-CHK-BATCH', withAnswer((a) => { a.batch = '2/2'; })],
  ['E-CHK-DUPLICATE+E-CHK-UNKNOWN-KEY', withAnswer((a) => { a.mappings.push(clone(m(a, 'at:Organization/Name')), { key: 'at:Organization/Budget', iceClass: 'cco:ont00001014', rationale: 'x' }); })],
  ['E-CHK-MISSING', withAnswer((a) => { a.mappings = a.mappings.filter((x) => x.key !== 'at:Organization/Cost Center'); })],
  ['E-CHK-TERM', withAnswer((a) => { m(a, 'at:Organization/Name').iceClass = 'cco:ont99999999'; })],
  ['E-CHK-KIND', withAnswer((a) => { m(a, 'at:Organization/Name').iceClass = 'cco:ont00001808'; })],
  ['E-CHK-CATEGORY', withAnswer((a) => { m(a, 'ot:Organization').recordClass = 'cco:ont00001180'; })],
  ['E-CHK-HUMAN-FIELD', withAnswer((a) => { m(a, 'at:Organization/Cost Center').nullEquivalents = ['N/A']; })],
  ['E-CHK-FIELDS', withAnswer((a) => { const x = m(a, 'at:Organization/Name'); delete x.iceClass; x.relation = 'cco:ont00001808'; })],
  ['W-CHK-GENERIC', withAnswer((a) => { m(a, 'ot:Organization').referentClass = 'bfo:BFO_0000001'; })],
  ['W-CHK-GENERIC+W-CHK-ICE-REFERENT', withAnswer((a) => { m(a, 'ot:Organization').referentClass = 'cco:ont00000958'; })],
];
for (const [label, paste] of reportCases) {
  const r = report(paste);
  const codes = [...r.errors, ...r.warnings].map((e) => e.code).join(',');
  if (!label.split('+').every((c) => codes.split(',').includes(c))) fail(`${label}: report codes ${codes}`);
  mustPass(`CheckReport ${label}`, r, 'derived');
}
// W-CS4-Δ10 (all-BFO injection on the full fixture: CATEGORY, KIND, GENERIC at scale).
{
  const { prompts } = buildPrompts({ skeletonBytes: fullSk, inventoryBytes: fullInv, template, terms });
  const skSha = readJson(P('fixtures', 'witnesses', 'full', 'check-report-valid.jsonld')).skeletonSha256;
  const slots = JSON.parse(fullSk.toString('utf8')).slots;
  const fields = { type: ['recordClass', 'referentClass'], attribute: ['iceClass'], reference: ['relation'], containment: ['relation'] };
  const ans = { skeletonSha256: skSha, batch: '1/1', mappings: slots.map((s) => Object.fromEntries([['key', s.key], ...fields[s.kind].map((f) => [f, 'bfo:BFO_0000001']), ['rationale', 'x']])) };
  const r = report(JSON.stringify(ans), fullSk, prompts[0].bytes);
  if (r.errors.length !== 52 || r.warnings.length !== 10) fail(`W-CS4-Δ10 gives ${r.errors.length} errors, ${r.warnings.length} warnings`);
  mustPass('CheckReport all-BFO injection', r, 'derived');
}

// 2d. SDD variants C-S6 can emit (W-CS6-Δ4 null-equivalents, R-S17 retired, containment sdd:NoRelation).
{
  const sdd = readJson(P('fixtures', 'witnesses', 'minimal', 'sdd.jsonld'));
  const a = clone(sdd); a.mappings[2].nullEquivalents = ['-', 'N/A']; mustPass('SDD with nullEquivalents', a, 'derived');
  const b = clone(sdd); b.retired = [b.mappings.pop()]; mustPass('SDD with a retired mapping', b, 'derived');
  const c = readJson(P('fixtures', 'witnesses', 'full', 'sdd.jsonld')); c.mappings.find((x) => x.kind === 'containment').relation = 'sdd:NoRelation';
  mustPass('SDD with containment sdd:NoRelation', c, 'derived');
}

// ---------- 3. corruptions MUST fail ----------
const base = (p) => readJson(P('fixtures', 'witnesses', p));
const corrupt = (label, file, f) => { const d = base(file); f(d); return [label, d]; };
const find = (arr, pred) => arr.find(pred);
const corruptions = [
  // every type
  ...Object.entries({ Inventory: 'minimal/inventory.jsonld', Skeleton: 'minimal/skeleton.jsonld', PromptSet: 'minimal/prompt-set.jsonld',
    CheckReport: 'minimal/check-report.jsonld', RerunPlan: 'minimal/rerun-plan.jsonld', SemanticDataDictionary: 'minimal/sdd.jsonld' })
    .flatMap(([t, file]) => [
      corrupt(`${t}: foreign @context`, file, (d) => { d['@context'] = 'https://example.org/ctx'; }),
      corrupt(`${t}: extra top-level member`, file, (d) => { d.extra = 1; }),
      corrupt(`${t}: missing member`, file, (d) => { delete d[Object.keys(d)[2]]; }),
      corrupt(`${t}: key order`, file, (d) => { const k = Object.keys(d)[2]; const v = d[k]; delete d[k]; d[k] = v; }),
    ]),
  // Inventory
  corrupt('Inventory: wrong @type', 'minimal/inventory.jsonld', (d) => { d['@type'] = 'Skeleton'; d.flags = 1; }),
  corrupt('Inventory: errors with objectTypes', 'minimal/inventory.jsonld', (d) => { d.errors.push({ code: 'E-SRC-DUP-TYPE', key: 'ot:Organization' }); }),
  corrupt('Inventory: unknown error code', 'minimal/inventory.jsonld', (d) => { d.objectTypes = []; d.attributes = []; d.errors.push({ code: 'E-SRC-OTHER', key: 'ot:X' }); }),
  corrupt('Inventory: E-SRC-SHAPE without pointer', 'minimal/inventory.jsonld', (d) => { d.objectTypes = []; d.attributes = []; d.errors.push({ code: 'E-SRC-SHAPE', keyword: 'required', detail: 'type' }); }),
  corrupt('Inventory: bad source sha256', 'minimal/inventory.jsonld', (d) => { d.source.sha256 = d.source.sha256.toUpperCase(); }),
  corrupt('Inventory: unknown jira type', 'minimal/inventory.jsonld', (d) => { d.attributes[0].type = 'currency'; }),
  corrupt('Inventory: target on non-reference', 'minimal/inventory.jsonld', (d) => { d.attributes[0].target = 'ot:Organization'; }),
  corrupt('Inventory: key without prefix', 'minimal/inventory.jsonld', (d) => { d.objectTypes[0].key = 'Organization'; }),
  corrupt('Inventory: unescaped / in type key', 'minimal/inventory.jsonld', (d) => { d.objectTypes[0].key = 'ot:A/B'; }),
  corrupt('Inventory: externalId under name identification', 'minimal/inventory.jsonld', (d) => { d.attributes[0].externalId = 'x'; }),
  corrupt('Inventory: duplicate locator', 'minimal/inventory.jsonld', (d) => { d.attributes[0].locators.push('name'); }),
  corrupt('Inventory: C-S7 flag in inventory', 'minimal/inventory.jsonld', (d) => { d.flags.push({ code: 'FL-TERMS-CHANGED', key: null, previous: '0'.repeat(64), current: '0'.repeat(64) }); }),
  corrupt('Inventory: FL-CONTAINMENT without selector', 'full/inventory.jsonld', (d) => { delete find(d.flags, (f) => f.code === 'FL-CONTAINMENT').selector; }),
  corrupt('Inventory: FL-INHERITED-USE empty', 'full/inventory.jsonld', (d) => { find(d.flags, (f) => f.code === 'FL-INHERITED-USE').attributes = []; }),
  // Skeleton
  corrupt('Skeleton: meaning field pre-filled', 'minimal/skeleton.jsonld', (d) => { d.slots[0].recordClass = 'cco:ont00000853'; }),
  corrupt('Skeleton: datatype not by jira type', 'minimal/skeleton.jsonld', (d) => { d.slots[1].datatype = 'xsd:integer'; }),
  corrupt('Skeleton: valueProperty present (v0.5, R-S9)', 'minimal/skeleton.jsonld', (d) => { d.slots[1].valueProperty = 'cco:ont00001765'; }),
  corrupt('Skeleton: iceClass pre-filled', 'minimal/skeleton.jsonld', (d) => { d.slots[1].iceClass = 'cco:ont00001014'; }),
  corrupt('Skeleton: unknown kind', 'minimal/skeleton.jsonld', (d) => { d.slots[0].kind = 'thing'; }),
  corrupt('Skeleton: attribute slot with type key', 'minimal/skeleton.jsonld', (d) => { d.slots[1].key = 'ot:Name'; }),
  corrupt('Skeleton: containment key without ct:', 'full/skeleton.jsonld', (d) => { find(d.slots, (s) => s.kind === 'containment').key = 'ot:Hard Drive'; }),
  corrupt('Skeleton: reference slot for a referenced_object attribute slot', 'full/skeleton.jsonld', (d) => { find(d.slots, (s) => s.kind === 'attribute').jiraType = 'referenced_object'; }),
  // PromptSet
  corrupt('PromptSet: round 2', 'minimal/prompt-set.jsonld', (d) => { d.round = 2; }),
  corrupt('PromptSet: budget 0', 'minimal/prompt-set.jsonld', (d) => { d.budget = 0; }),
  corrupt('PromptSet: no prompts', 'minimal/prompt-set.jsonld', (d) => { d.prompts = []; }),
  corrupt('PromptSet: bad batch label', 'minimal/prompt-set.jsonld', (d) => { d.prompts[0].batch = '0/1'; }),
  corrupt('PromptSet: bad file name', 'minimal/prompt-set.jsonld', (d) => { d.prompts[0].file = 'prompt.txt'; }),
  corrupt('PromptSet: fractional bytes', 'minimal/prompt-set.jsonld', (d) => { d.prompts[0].bytes = 1.5; }),
  corrupt('PromptSet: unknown warning', 'minimal/prompt-set.jsonld', (d) => { d.warnings.push({ code: 'W-OTHER', key: 'ot:Organization', bytes: 1, budget: 1 }); }),
  // CheckReport
  corrupt('CheckReport: validated with errors', 'minimal/bad-check-report.jsonld', (d) => { d.status = 'validated'; }),
  corrupt('CheckReport: rejected without errors', 'minimal/check-report.jsonld', (d) => { d.status = 'rejected'; }),
  corrupt('CheckReport: status accepted (R-S14)', 'minimal/check-report.jsonld', (d) => { d.status = 'accepted'; }),
  corrupt('CheckReport: round 0', 'minimal/check-report.jsonld', (d) => { d.round = 0; }),
  corrupt('CheckReport: error without message', 'minimal/bad-check-report.jsonld', (d) => { delete d.errors[0].message; }),
  corrupt('CheckReport: wrong rule for code', 'minimal/bad-check-report.jsonld', (d) => { d.errors[1].rule = 'R-S7'; }),
  corrupt('CheckReport: message off template', 'minimal/bad-check-report.jsonld', (d) => { d.errors[1].message = 'iceClass is wrong.'; }),
  corrupt('CheckReport: message says correct', 'minimal/bad-check-report.jsonld', (d) => { d.errors[0].message = 'Slot at:Organization/Cost Center is correct.'; }),
  corrupt('CheckReport: CATEGORY on referentClass', 'minimal/bad-check-report.jsonld', (d) => { d.errors[1].field = 'referentClass'; }),
  corrupt('CheckReport: MISSING with a field', 'minimal/bad-check-report.jsonld', (d) => { d.errors[0].field = 'iceClass'; }),
  corrupt('CheckReport: unknown error code', 'minimal/bad-check-report.jsonld', (d) => { d.errors[0].code = 'E-CHK-OTHER'; }),
  corrupt('CheckReport: warning code in errors', 'minimal/bad-check-report.jsonld', (d) => { d.errors[1].code = 'W-CHK-GENERIC'; }),
  corrupt('CheckReport: refusal code in errors', 'minimal/bad-check-report.jsonld', (d) => { d.errors[0].code = 'E-CTX-EXTERNAL'; }),
  corrupt('CheckReport: ICE-REFERENT on recordClass', 'full/check-report-valid.jsonld', (d) => { d.warnings[0].field = 'recordClass'; }),
  corrupt('CheckReport: warning value not a CURIE', 'full/check-report-valid.jsonld', (d) => { d.warnings[0].value = 'Organization'; }),
  // RerunPlan
  corrupt('RerunPlan: duplicate key', 'minimal/rerun-plan.jsonld', (d) => { d.unchanged.push('ot:Organization'); }),
  corrupt('RerunPlan: malformed key', 'minimal/rerun-plan.jsonld', (d) => { d.changed.push('Cost Center'); }),
  corrupt('RerunPlan: flag with key', 'full/rerun-plan-switch.jsonld', (d) => { d.flags[0].key = 'ot:Organization'; }),
  corrupt('RerunPlan: scheme flag with hashes', 'full/rerun-plan-switch.jsonld', (d) => { d.flags[0].previous = '0'.repeat(64); }),
  corrupt('RerunPlan: inventory flag', 'minimal/rerun-plan.jsonld', (d) => { d.flags.push({ code: 'FL-NO-LABEL', key: 'ot:Organization' }); }),
  corrupt('RerunPlan: terms flag with identification', 'minimal/rerun-plan.jsonld', (d) => { d.flags.push({ code: 'FL-TERMS-CHANGED', key: null, previous: 'name', current: 'externalId' }); }),
  // SemanticDataDictionary
  corrupt('SDD: sddVersion 1 (R-S24)', 'minimal/sdd.jsonld', (d) => { d.sddVersion = 1; }),
  corrupt('SDD: valueProperty present (v0.5, R-S9)', 'minimal/sdd.jsonld', (d) => { d.mappings[1].valueProperty = 'cco:ont00001765'; }),
  corrupt('SDD: attribute without iceClass member (R-S5)', 'minimal/sdd-null.jsonld', (d) => { delete d.mappings[2].iceClass; }),
  corrupt('SDD: iceClass not a CURIE or null', 'minimal/sdd-null.jsonld', (d) => { d.mappings[2].iceClass = 'none'; }),
  corrupt('SDD: type mapping with null referentClass', 'minimal/sdd.jsonld', (d) => { d.mappings[0].referentClass = null; }),
  corrupt('SDD: absenceKinds reordered', 'minimal/sdd.jsonld', (d) => { d.absenceKinds.reverse(); }),
  corrupt('SDD: absenceKinds short', 'minimal/sdd.jsonld', (d) => { d.absenceKinds.pop(); }),
  corrupt('SDD: decision rejected', 'minimal/sdd.jsonld', (d) => { d.mappings[0].acceptance.decision = 'rejected'; }),
  corrupt('SDD: at with offset', 'minimal/sdd.jsonld', (d) => { d.mappings[0].acceptance.at = '2026-10-27T18:00:00+01:00'; }),
  corrupt('SDD: at with milliseconds', 'minimal/sdd.jsonld', (d) => { d.mappings[0].acceptance.at = '2026-10-27T18:00:00.000Z'; }),
  corrupt('SDD: at month 13', 'minimal/sdd.jsonld', (d) => { d.mappings[0].acceptance.at = '2026-13-27T18:00:00Z'; }),
  corrupt('SDD: by empty', 'minimal/sdd.jsonld', (d) => { d.mappings[0].acceptance.by = ''; }),
  corrupt('SDD: no acceptance', 'minimal/sdd.jsonld', (d) => { delete d.mappings[0].acceptance; }),
  corrupt('SDD: type mapping with iceClass', 'minimal/sdd.jsonld', (d) => { d.mappings[0].iceClass = 'cco:ont00001014'; }),
  corrupt('SDD: attribute without nullEquivalents', 'minimal/sdd.jsonld', (d) => { delete d.mappings[1].nullEquivalents; }),
  corrupt('SDD: duplicate nullEquivalents', 'minimal/sdd.jsonld', (d) => { d.mappings[1].nullEquivalents = ['-', '-']; }),
  corrupt('SDD: datatype not by jira type', 'minimal/sdd.jsonld', (d) => { d.mappings[1].datatype = 'xsd:date'; }),
  corrupt('SDD: class not a CURIE', 'minimal/sdd.jsonld', (d) => { d.mappings[0].referentClass = 'Organization'; }),
  corrupt('SDD: reference sdd:NoRelation', 'full/sdd.jsonld', (d) => { find(d.mappings, (x) => x.kind === 'reference').relation = 'sdd:NoRelation'; }),
  corrupt('SDD: provenance round 0', 'minimal/sdd.jsonld', (d) => { d.mappings[0].provenance.round = 0; }),
  corrupt('SDD: externalId under name identification', 'minimal/sdd.jsonld', (d) => { d.mappings[0].source.externalId = 'x'; }),
  corrupt('SDD: retired entry not a mapping', 'minimal/sdd.jsonld', (d) => { d.retired.push({ key: 'ot:X' }); }),
  corrupt('SDD: open duplicate', 'minimal/sdd-partial.jsonld', (d) => { d.open.push(d.open[0]); }),
  corrupt('SDD: commit not 40 hex', 'minimal/sdd.jsonld', (d) => { d.environment.ontologyTemplateCommit = 'main'; }),
];
let caught = 0;
for (const [label, doc] of corruptions) {
  dump('fail', label, doc);
  if (check(doc).length === 0) fail(`corruption passed: ${label}`);
  else caught++;
}

// ---------- 4. SHACL term lists match the term list ----------
{
  const ttl = fs.readFileSync(P('shapes', 'sdd-v2.shacl.ttl'), 'utf8');
  const generated = (name) => {
    const mm = ttl.match(new RegExp(`# BEGIN GENERATED ${name} \\((\\d+)\\)\\n[\\s\\S]*?sh:in \\(([\\s\\S]*?)\\) \\.\\n# END GENERATED ${name}`));
    if (!mm) { fail(`shapes: no generated list ${name}`); return []; }
    return mm[2].split(/\s+/).filter(Boolean);
  };
  const permitted = termList.terms.filter((t) => t.permitted);
  const classes = permitted.filter((t) => t.kind === 'class').map((t) => t.curie).sort(cmp);
  const want = {
    InformationContentEntityClass: classes.filter((c) => terms.isIce(c)),
    PermittedClass: classes,
    PermittedObjectProperty: permitted.filter((t) => t.kind === 'object_property').map((t) => t.curie).sort(cmp),
  };
  for (const [name, list] of Object.entries(want)) {
    const got = generated(name);
    if (JSON.stringify(got) !== JSON.stringify(list)) fail(`shapes: ${name} differs from the term list (${got.length} vs ${list.length})`);
    else console.log(`shapes: ${name} = ${list.length} terms, matches ontology/term-list.json`);
  }
  if (!ttl.includes(`sh:hasValue "${termList.terms_sha256}"`)) fail('shapes: termListSha256 pin differs from the term list');
  if (!ttl.includes(`sh:hasValue "${termList.ontology_template_commit}"`)) fail('shapes: ontologyTemplateCommit pin differs');
  if (/\bsh:sparql\b|\bsh:SPARQL/.test(ttl)) fail('shapes: SPARQL constraint present (SHACL Core only)');
}

// ---------- report ----------
for (const [k, n] of Object.entries(counts).sort()) console.log(`valid: ${k} = ${n}`);
console.log(`witness files: ${witnessFiles.length}; corruptions rejected: ${caught}/${corruptions.length}`);
console.log(`keywords used: ${[...used].sort().join(' ')} (supplement-checked: ${[...SUPPLEMENT].join(', ')})`);
console.log(failures === 0 ? 'PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
