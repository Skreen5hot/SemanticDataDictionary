// Author's reference generator for prop-001 literals (not the implementation).
// Usage: node gen.cjs <repoRoot> <outDir>
const fs = require('fs'), path = require('path'), c = require('crypto');
const [ROOT, OUT] = process.argv.slice(2);
const P = (...a) => path.join(ROOT, ...a);
const h = (b) => c.createHash('sha256').update(b).digest('hex');
const ser = (o) => JSON.stringify(o, null, 2) + '\n';
const CTX = 'https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld';
const esc = (s) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const write = (rel, s) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); return s; };
const report = [];
const note = (rel, s) => report.push([rel, h(s), Buffer.byteLength(s)]);

const tl = JSON.parse(fs.readFileSync(P('ontology/term-list.json'), 'utf8'));
const TL = tl.terms_sha256;
const ICE = 'https://www.commoncoreontologies.org/ont00000958';
const by = Object.fromEntries(tl.terms.map((x) => [x.iri, x]));
const byCurie = Object.fromEntries(tl.terms.map((x) => [x.curie, x]));
const anc = (i) => { const s = new Set(), st = [...(by[i].superclasses || [])]; while (st.length) { const q = st.pop(); if (s.has(q)) continue; s.add(q); if (by[q]) st.push(...(by[q].superclasses || [])); } return s; };
const isIce = (x) => x.iri === ICE || anc(x.iri).has(ICE);
const permitted = tl.terms.filter((x) => x.permitted);
const cmp = (a, b) => (a.curie < b.curie ? -1 : a.curie > b.curie ? 1 : 0);
const sec = (t, a) => '# ' + t + '\n' + a.slice().sort(cmp).map((x) => x.curie + '\t' + x.label).join('\n') + '\n';
const CATALOGUE = sec('Information Content Entity classes (recordClass, iceClass)', permitted.filter((x) => x.kind === 'class' && isIce(x)))
  + sec('Other classes (referentClass)', permitted.filter((x) => x.kind === 'class' && !isIce(x)))
  + sec('Object properties (relation)', permitted.filter((x) => x.kind === 'object_property'));
const TEMPLATE = fs.readFileSync(path.join(OUT, '..', 'prompt-template-v2.txt'), 'utf8');

const VALUE = { text: ['xsd:string', 'cco:ont00001765'], textarea: ['xsd:string', 'cco:ont00001765'], email: ['xsd:string', 'cco:ont00001765'], select: ['xsd:string', 'cco:ont00001765'], ipaddress: ['xsd:string', 'cco:ont00001765'], url: ['xsd:anyURI', 'cco:ont00001768'], integer: ['xsd:integer', 'cco:ont00001773'], double: ['xsd:double', 'cco:ont00001770'], boolean: ['xsd:boolean', 'cco:ont00001772'], date: ['xsd:date', 'cco:ont00001771'], date_time: ['xsd:dateTime', 'cco:ont00001767'], time: ['xsd:string', 'cco:ont00001765'] };

// --- minimal parse (name-form fixtures only; enough for literals) ---
function parse(fx, fxBytes) {
  const types = []; const walk = (ts, parent) => { for (const t of ts) { types.push({ t, parent }); if (t.children) walk(t.children, t.name); } };
  walk(fx.schema.objectSchema.objectTypes, null);
  const maps = Object.fromEntries(fx.mapping.objectTypeMappings.map((m) => [m.objectTypeName, m]));
  const objectTypes = types.map(({ t, parent }) => {
    const m = maps[t.name];
    const label = (t.attributes || []).find((a) => a.label);
    const ident = m ? m.attributesMapping.filter((a) => a.externalIdPart).map((a) => 'at:' + esc(ownerOf(a.attributeName, t.name)) + '/' + esc(a.attributeName)) : [];
    return { key: 'ot:' + esc(t.name), name: t.name, externalId: null, description: t.description, parent: parent ? 'ot:' + esc(parent) : null, label: label ? 'at:' + esc(t.name) + '/' + esc(label.name) : null, identity: ident, selectors: m ? [m.selector] : [] };
  });
  function ownerOf(attr, typeName) { let cur = typeName; while (cur) { const e = types.find((x) => x.t.name === cur); if ((e.t.attributes || []).some((a) => a.name === attr)) return cur; cur = e.parent; } return typeName; }
  const attributes = [];
  for (const { t } of types) for (const a of t.attributes || []) {
    const users = fx.mapping.objectTypeMappings.flatMap((m) => m.attributesMapping.filter((am) => am.attributeName === a.name && ownerOf(a.name, m.objectTypeName) === t.name));
    attributes.push({ key: 'at:' + esc(t.name) + '/' + esc(a.name), name: a.name, externalId: null, owner: 'ot:' + esc(t.name), description: a.description, type: a.type, target: a.type === 'referenced_object' ? 'ot:' + esc(a.referenceObjectTypeName) : null, isLabel: !!a.label, isIdentityPart: users.some((u) => u.externalIdPart), locators: users.length ? users[0].attributeLocators : [] });
  }
  return { '@context': CTX, '@type': 'Inventory', source: { format: 'jira-assets-import/2021_09_15', sha256: h(fxBytes), schemaName: fx.schema.objectSchema.name, identification: 'name' }, objectTypes, attributes, flags: [], errors: [] };
}
function containments(fx, inv) {
  const sel = Object.fromEntries(fx.mapping.objectTypeMappings.map((m) => [m.selector, m.objectTypeName]));
  const out = [];
  for (const m of fx.mapping.objectTypeMappings) { const i = m.selector.lastIndexOf('.'); if (i > 0 && sel[m.selector.slice(0, i)]) out.push({ child: 'ot:' + esc(m.objectTypeName), container: 'ot:' + esc(sel[m.selector.slice(0, i)]), selector: m.selector }); }
  return out;
}
function skeleton(inv, invS, cont) {
  const slots = [];
  for (const t of inv.objectTypes) {
    slots.push({ key: t.key, kind: 'type', recordClass: null, referentClass: null });
    for (const a of inv.attributes.filter((x) => x.owner === t.key)) {
      if (a.type === 'referenced_object') slots.push({ key: a.key, kind: 'reference', target: a.target, relation: null });
      else slots.push({ key: a.key, kind: 'attribute', jiraType: a.type, datatype: VALUE[a.type][0], valueProperty: VALUE[a.type][1], iceClass: null });
    }
    for (const k of cont.filter((x) => x.child === t.key)) slots.push({ key: 'ct:' + k.child, kind: 'containment', child: k.child, container: k.container, relation: null });
  }
  return { '@context': CTX, '@type': 'Skeleton', inventorySha256: h(invS), termListSha256: TL, slots };
}
function dataLine(slot, inv, cont) {
  const t = inv.objectTypes.find((x) => x.key === slot.key), a = inv.attributes.find((x) => x.key === slot.key);
  if (slot.kind === 'type') return JSON.stringify({ key: t.key, kind: 'type', name: t.name, description: t.description, parent: t.parent, selectors: t.selectors });
  if (slot.kind === 'attribute') return JSON.stringify({ key: a.key, kind: 'attribute', name: a.name, description: a.description, owner: a.owner, jiraType: a.type });
  if (slot.kind === 'reference') return JSON.stringify({ key: a.key, kind: 'reference', name: a.name, description: a.description, owner: a.owner, target: a.target });
  const k = cont.find((x) => 'ct:' + x.child === slot.key);
  return JSON.stringify({ key: slot.key, kind: 'containment', child: k.child, container: k.container, selector: k.selector });
}
function prompt(skS, batch, round, data, errors) {
  return TEMPLATE.replace('{{SKELETON}}', h(skS)).replace('{{TERMS}}', TL).replace('{{BATCH}}', batch).replace('{{ROUND}}', String(round))
    .replace('{{ERRORS}}', errors).replace('{{SKELETON2}}', h(skS)).replace('{{BATCH2}}', batch).replace('{{DATA}}', data).replace('{{CATALOGUE}}', CATALOGUE);
}
const errorsBlock = (errs) => '\nERRORS IN YOUR PREVIOUS REPLY\nYour previous reply for this batch was rejected for the reasons below. Return the complete corrected mapping set for every DATA line, not only the lines named here.\n' + errs.map((e) => JSON.stringify(e)).join('\n') + '\n';

// ---------------- minimal fixture ----------------
const fxB = fs.readFileSync(P('fixtures/jira-assets/minimal-organization.json'), 'utf8');
const fx = JSON.parse(fxB);
const inv = parse(fx, fxB); const invS = ser(inv);
if (invS !== fs.readFileSync(P('fixtures/witnesses/minimal/inventory.jsonld'), 'utf8')) throw new Error('inventory drift');
const sk = skeleton(inv, invS, []); const skS = ser(sk);
if (skS !== fs.readFileSync(P('fixtures/witnesses/minimal/skeleton.jsonld'), 'utf8')) throw new Error('skeleton drift');
const DATA = sk.slots.map((s) => dataLine(s, inv, []) + '\n').join('');
const pr1 = write('fixtures/witnesses/minimal/prompt.txt', prompt(skS, '1/1', 1, DATA, '')); note('minimal/prompt.txt (v2)', pr1);
const pasted = fs.readFileSync(P('fixtures/witnesses/minimal/proposal-pasted.txt'), 'utf8');
const bad = fs.readFileSync(P('fixtures/witnesses/minimal/bad-proposal.txt'), 'utf8');
const lab = (cu) => byCurie[cu].label;
const badErrs = [
  { code: 'E-CHK-CATEGORY', key: 'at:Organization/Name', field: 'iceClass', value: 'cco:ont00001180', rule: 'R-S5', message: 'iceClass cco:ont00001180 (' + lab('cco:ont00001180') + ') is not cco:ont00000958 (Information Content Entity) or a subclass of it.' },
  { code: 'E-CHK-MISSING', key: 'at:Organization/Cost Center', field: null, value: null, rule: 'R-S6', message: 'Slot at:Organization/Cost Center has no mapping in this batch.' }];
const rep = (round, prS, paste, status, errors, warnings) => ser({ '@context': CTX, '@type': 'CheckReport', skeletonSha256: h(skS), batch: '1/1', round, promptSha256: h(prS), proposalSha256: h(paste), termListSha256: TL, status, errors, warnings });
const badRep = write('fixtures/witnesses/minimal/bad-check-report.jsonld', rep(1, pr1, bad, 'rejected', badErrs, [])); note('minimal/bad-check-report.jsonld (v2)', badRep);
const okRep1 = write('fixtures/witnesses/minimal/check-report.jsonld', rep(1, pr1, pasted, 'validated', [], [])); note('minimal/check-report.jsonld (v2)', okRep1);
const pr2 = write('fixtures/witnesses/minimal/repair-prompt.txt', prompt(skS, '1/1', 2, DATA, errorsBlock(badErrs))); note('minimal/repair-prompt.txt (new)', pr2);
const okRep2 = write('fixtures/witnesses/minimal/check-report-round2.jsonld', rep(2, pr2, pasted, 'validated', [], [])); note('minimal/check-report-round2.jsonld (new)', okRep2);

// accepted SDD (W-CS6-N), acceptance.at fixed for the literal
const prop = JSON.parse(pasted.slice(pasted.indexOf('{'), pasted.lastIndexOf('}') + 1));
const itemSha = (o) => h(ser(o));
function sdd(fixBytes, invObj, invStr, prS, paste, repS, round, at) {
  const mappings = sk.slots.map((s) => {
    const m = prop.mappings.find((x) => x.key === s.key);
    const prov = { round, batch: '1/1', promptSha256: h(prS), proposalSha256: h(paste), checkReportSha256: h(repS) };
    const acc = { decision: 'accepted', by: 'Aaron Damiano', at };
    if (s.kind === 'type') { const t = invObj.objectTypes.find((x) => x.key === s.key); return { key: s.key, kind: 'type', source: { name: t.name, externalId: null, itemSha256: itemSha(t) }, recordClass: m.recordClass, referentClass: m.referentClass, rationale: m.rationale, provenance: prov, acceptance: acc }; }
    const a = invObj.attributes.find((x) => x.key === s.key);
    return { key: s.key, kind: 'attribute', source: { name: a.name, externalId: null, owner: a.owner, jiraType: a.type, itemSha256: itemSha(a) }, iceClass: m.iceClass, datatype: s.datatype, valueProperty: s.valueProperty, nullEquivalents: [], rationale: m.rationale, provenance: prov, acceptance: acc };
  });
  return ser({ '@context': CTX, '@type': 'SemanticDataDictionary', sddVersion: 1, source: { format: 'jira-assets-import/2021_09_15', sha256: h(fixBytes), schemaName: invObj.source.schemaName, identification: 'name', inventorySha256: h(invStr) }, environment: { termListSha256: TL, ontologyTemplateCommit: tl.ontology_template_commit, contextIri: CTX }, absenceKinds: ['missing', 'explicit_null', 'empty_string', 'indistinguishable'], mappings, open: [], retired: [] });
}
const SDD1 = write('fixtures/witnesses/minimal/sdd.jsonld', sdd(fxB, inv, invS, pr1, pasted, okRep1, 1, '2026-10-27T18:00:00Z')); note('minimal/sdd.jsonld (new)', SDD1);
const SDD2 = write('fixtures/witnesses/minimal/sdd-round2.jsonld', sdd(fxB, inv, invS, pr2, pasted, okRep2, 2, '2026-10-27T18:00:00Z')); note('minimal/sdd-round2.jsonld (new)', SDD2);

// rerun (W-CS7-N): v2 fixture changes Cost Center's description only
const fx2 = JSON.parse(fxB); fx2.schema.objectSchema.objectTypes[0].attributes[1].description = 'Finance code';
const fx2B = write('fixtures/jira-assets/minimal-organization-v2.json', ser(fx2)); note('jira-assets/minimal-organization-v2.json (new)', fx2B);
const inv2 = parse(fx2, fx2B); const inv2S = write('fixtures/witnesses/minimal/inventory-v2.jsonld', ser(inv2)); note('minimal/inventory-v2.jsonld (new)', inv2S);
const prevItems = {}; for (const m of JSON.parse(SDD1).mappings) prevItems[m.key] = m.source.itemSha256;
const curItems = {}; for (const o of [...inv2.objectTypes, ...inv2.attributes]) curItems[o.key] = itemSha(o);
const keys = [...new Set([...Object.keys(prevItems), ...Object.keys(curItems)])].sort();
const plan = { '@context': CTX, '@type': 'RerunPlan', previousSddSha256: h(SDD1), inventorySha256: h(inv2S), unchanged: keys.filter((k) => prevItems[k] && curItems[k] && prevItems[k] === curItems[k]), changed: keys.filter((k) => prevItems[k] && curItems[k] && prevItems[k] !== curItems[k]), added: keys.filter((k) => !prevItems[k]), removed: keys.filter((k) => !curItems[k]), flags: [] };
const planS = write('fixtures/witnesses/minimal/rerun-plan.jsonld', ser(plan)); note('minimal/rerun-plan.jsonld (new)', planS);

// new one-defect invalid fixtures
const base = JSON.parse(fs.readFileSync(P('fixtures/jira-assets/synthetic-it-assets.json'), 'utf8'));
const cl = () => JSON.parse(JSON.stringify(base));
let b = cl(); b.mapping.objectTypeMappings.push({ objectTypeName: 'Printer', selector: 'printers', description: 'Printers', attributesMapping: [{ attributeName: 'Name', attributeLocators: ['name'] }] }); b.schema.objectSchema.description = 'INVALID: mapping names an object type the schema does not define (Printer)';
note('jira-assets/invalid/mapping-unknown-type.json (new)', write('fixtures/jira-assets/invalid/mapping-unknown-type.json', JSON.stringify(b, null, 2) + '\n'));
b = cl(); b.schema.objectSchema.objectTypes[0].attributes.push({ name: 'Cost Center', description: 'A second Cost Center attribute', type: 'text' }); b.schema.objectSchema.description = 'INVALID: two attributes named Cost Center on Organization';
note('jira-assets/invalid/duplicate-attribute-name.json (new)', write('fixtures/jira-assets/invalid/duplicate-attribute-name.json', JSON.stringify(b, null, 2) + '\n'));
const x = JSON.parse(fs.readFileSync(P('fixtures/jira-assets/synthetic-it-assets-externalids.json'), 'utf8'));
x.schema.objectSchema.objectTypes.push({ name: 'object-type/organization', description: 'A type with no externalId whose name equals Organization\'s externalId', attributes: [{ name: 'Name', description: 'Name', type: 'text', label: true }] });
x.schema.objectSchema.description = 'INVALID: mixed identification produces the key ot:object-type~1organization twice';
note('jira-assets/invalid/key-collision.json (new)', write('fixtures/jira-assets/invalid/key-collision.json', JSON.stringify(x, null, 2) + '\n'));

// full fixture: prompt sizes and batching
const fB = fs.readFileSync(P('fixtures/jira-assets/synthetic-it-assets.json'), 'utf8'); const f = JSON.parse(fB);
const finv = parse(f, fB); const finvS = ser(finv); const fcont = containments(f, finv); const fsk = skeleton(finv, finvS, fcont); const fskS = ser(fsk);
const counts = {}; for (const s of fsk.slots) counts[s.kind] = (counts[s.kind] || 0) + 1;
const groups = []; for (const s of fsk.slots) { if (s.kind === 'type') groups.push([]); groups[groups.length - 1].push(dataLine(s, finv, fcont) + '\n'); }
const overhead = Buffer.byteLength(prompt(fskS, '1/1', 1, '', ''));
const single = Buffer.byteLength(prompt(fskS, '1/1', 1, groups.flat().join(''), ''));
function batches(budget) { const out = []; let cur = []; for (const g of groups) { const t = [...cur, ...g]; if (cur.length && overhead + Buffer.byteLength(t.join('')) > budget) { out.push(cur); cur = [...g]; } else cur = t; } out.push(cur); return out; }
const budget = overhead + Math.round((single - overhead) / 2);
const bs = batches(budget);
console.log(JSON.stringify({ fullFixture: { slots: counts, overheadBytes: overhead, singlePromptBytes: single, dataBytes: single - overhead, proposedBudget: budget, batchesAtBudget: bs.length, batchBytes: bs.map((x, i) => Buffer.byteLength(prompt(fskS, `${i + 1}/${bs.length}`, 1, x.join(''), ''))), batchGroups: bs.map((x) => x.length) } }, null, 1));
for (const [r, hh, n] of report) console.log(r.padEnd(48), hh, n);
