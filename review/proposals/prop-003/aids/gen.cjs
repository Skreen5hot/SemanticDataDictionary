// prop-003 reference generator (spec v0.5, release candidate v1.0.0-rc.2): prop-002's generator, which shares no code
// with src/core, extended by (1) the W-CS3-Δ7 placeholder witnesses with single-pass substitution (R-S11, SDD-F69),
// (2) the v0.5 attribute contract (no valueProperty, iceClass may be null, sddVersion 2, template v3), and
// (3) the v0.5 witnesses W-CS4-Δ19 and W-CS6-Δ11. Its outputs are cross-checked by independent tools (witness-check,
// oracle-b, oracle-n, os1_judge). With --v1 it reproduces the version-1 witnesses byte for byte (the baseline check).
// Usage: node gen.cjs <repoRoot> [--v1]   (writes into <repoRoot>/fixtures/...)
'use strict';
const fs = require('fs'), path = require('path'), c = require('crypto');
const ROOT = process.argv[2];
const V1 = process.argv.includes('--v1');
const P = (...a) => path.join(ROOT, ...a);
const h = (b) => c.createHash('sha256').update(b).digest('hex');
const ser = (o) => JSON.stringify(o, null, 2) + '\n';
const CTX = 'https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld';
const AT = '2026-10-27T18:00:00Z';
const esc = (s) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const written = [];
const write = (rel, s) => { fs.mkdirSync(path.dirname(P(rel)), { recursive: true }); fs.writeFileSync(P(rel), s); written.push([rel, h(s), Buffer.byteLength(s)]); return s; };
const read = (rel) => fs.readFileSync(P(rel), 'utf8');

// ---------- terms ----------
const tl = JSON.parse(read('ontology/term-list.json'));
const TL = tl.terms_sha256;
const ICE = 'https://www.commoncoreontologies.org/ont00000958';
const BFO_NS = 'http://purl.obolibrary.org/obo/BFO_';
const byIri = Object.fromEntries(tl.terms.map((x) => [x.iri, x]));
const byCurie = Object.fromEntries(tl.terms.map((x) => [x.curie, x]));
const anc = (i) => { const s = new Set([i]), st = [i]; while (st.length) { const q = st.pop(); for (const p of (byIri[q] && byIri[q].superclasses) || []) if (!s.has(p)) { s.add(p); st.push(p); } } return s; };
const isIce = (x) => anc(x.iri).has(ICE);
const permitted = tl.terms.filter((x) => x.permitted);
const cmp = (a, b) => (a.curie < b.curie ? -1 : a.curie > b.curie ? 1 : 0);
const sec = (t, a) => '# ' + t + '\n' + a.slice().sort(cmp).map((x) => x.curie + '\t' + x.label).join('\n') + '\n';
const CATALOGUE = sec('Information Content Entity classes (recordClass, iceClass)', permitted.filter((x) => x.kind === 'class' && isIce(x)))
  + sec('Other classes (referentClass)', permitted.filter((x) => x.kind === 'class' && !isIce(x)))
  + sec('Object properties (relation)', permitted.filter((x) => x.kind === 'object_property'));
const TEMPLATE = read(V1 ? 'spec/prompt-template-v2.txt' : 'spec/prompt-template-v3.txt');
// R-S9: v1 = (datatype, valueProperty); v0.5 = datatype only.
const VALUE = { text: ['xsd:string', 'cco:ont00001765'], textarea: ['xsd:string', 'cco:ont00001765'], email: ['xsd:string', 'cco:ont00001765'], select: ['xsd:string', 'cco:ont00001765'], ipaddress: ['xsd:string', 'cco:ont00001765'], url: ['xsd:anyURI', 'cco:ont00001768'], integer: ['xsd:integer', 'cco:ont00001773'], double: ['xsd:double', 'cco:ont00001770'], boolean: ['xsd:boolean', 'cco:ont00001772'], date: ['xsd:date', 'cco:ont00001771'], date_time: ['xsd:dateTime', 'cco:ont00001767'], time: ['xsd:string', 'cco:ont00001765'] };

// ---------- C-S1 parse (R-S2, R-S19) ----------
function parse(fxBytes) {
  const fx = JSON.parse(fxBytes);
  const types = []; const walk = (ts, parent) => { for (const t of ts) { types.push({ t, parent }); if (t.children) walk(t.children, t); } };
  walk(fx.schema.objectSchema.objectTypes, null);
  const tkey = (t) => 'ot:' + esc(t.externalId || t.name);
  const byName = Object.fromEntries(types.map((e) => [e.t.name, e]));
  const akey = (t, a) => a.externalId ? 'at:' + esc(a.externalId) : 'at:' + esc(t.name) + '/' + esc(a.name);
  const chain = (name) => { const r = []; let e = byName[name]; while (e) { r.push(e.t); e = e.parent ? byName[e.parent.name] : null; } return r; };
  const definer = (attr, typeName) => chain(typeName).find((t) => (t.attributes || []).some((a) => a.name === attr));
  const maps = Object.fromEntries(fx.mapping.objectTypeMappings.map((m) => [m.objectTypeName, m]));
  const objectTypes = types.map(({ t, parent }) => {
    const m = maps[t.name]; const label = (t.attributes || []).find((a) => a.label);
    const ident = m ? m.attributesMapping.filter((a) => a.externalIdPart).map((a) => { const d = definer(a.attributeName, t.name); return akey(d, d.attributes.find((x) => x.name === a.attributeName)); }) : [];
    return { key: tkey(t), name: t.name, externalId: t.externalId || null, description: t.description, parent: parent ? tkey(parent) : null, label: label ? akey(t, label) : null, identity: ident, selectors: m ? [m.selector] : [] };
  });
  const attributes = [];
  for (const { t } of types) for (const a of t.attributes || []) {
    const users = fx.mapping.objectTypeMappings.flatMap((m) => m.attributesMapping.filter((am) => am.attributeName === a.name && definer(a.name, m.objectTypeName) === t));
    attributes.push({ key: akey(t, a), name: a.name, externalId: a.externalId || null, owner: tkey(t), description: a.description, type: a.type, target: a.type === 'referenced_object' ? tkey(byName[a.referenceObjectTypeName].t) : null, isLabel: !!a.label, isIdentityPart: users.some((u) => u.externalIdPart), locators: users.length ? users[0].attributeLocators : [] });
  }
  const flags = [];
  const sel = Object.fromEntries(fx.mapping.objectTypeMappings.map((m) => [m.selector, m.objectTypeName]));
  for (const m of fx.mapping.objectTypeMappings) { const i = m.selector.lastIndexOf('.'); if (i > 0 && sel[m.selector.slice(0, i)]) flags.push({ code: 'FL-CONTAINMENT', key: tkey(byName[m.objectTypeName].t), container: tkey(byName[sel[m.selector.slice(0, i)]].t), selector: m.selector }); }
  for (const m of fx.mapping.objectTypeMappings) { const own = new Set((byName[m.objectTypeName].t.attributes || []).map((a) => a.name)); const inh = m.attributesMapping.map((a) => a.attributeName).filter((n) => !own.has(n)).sort(); if (inh.length) flags.push({ code: 'FL-INHERITED-USE', key: tkey(byName[m.objectTypeName].t), attributes: inh }); }
  for (const { t } of types) if (!chain(t.name).some((x) => (x.attributes || []).some((a) => a.label))) flags.push({ code: 'FL-NO-LABEL', key: tkey(t) });
  for (const a of attributes) if (a.type === 'select') flags.push({ code: 'FL-SELECT-VALUES-UNKNOWN', key: a.key });
  for (const { t } of types) if (!maps[t.name]) flags.push({ code: 'FL-UNMAPPED-TYPE', key: tkey(t) });
  flags.sort((x, y) => (x.code < y.code ? -1 : x.code > y.code ? 1 : x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  const ids = [...types.map((e) => e.t), ...types.flatMap((e) => e.t.attributes || [])];
  const identification = ids.every((x) => x.externalId) ? 'externalId' : ids.some((x) => x.externalId) ? 'mixed' : 'name';
  return { '@context': CTX, '@type': 'Inventory', source: { format: 'jira-assets-import/2021_09_15', sha256: h(fxBytes), schemaName: fx.schema.objectSchema.name, identification }, objectTypes, attributes, flags, errors: [] };
}
const itemSha = (o) => h(ser(o));

// ---------- C-S2 skeleton ----------
function skeleton(inv, invS) {
  const slots = [];
  const cont = inv.flags.filter((f) => f.code === 'FL-CONTAINMENT');
  for (const t of inv.objectTypes) {
    slots.push({ key: t.key, kind: 'type', recordClass: null, referentClass: null });
    for (const a of inv.attributes.filter((x) => x.owner === t.key)) {
      if (a.type === 'referenced_object') slots.push({ key: a.key, kind: 'reference', target: a.target, relation: null });
      else if (V1) slots.push({ key: a.key, kind: 'attribute', jiraType: a.type, datatype: VALUE[a.type][0], valueProperty: VALUE[a.type][1], iceClass: null });
      else slots.push({ key: a.key, kind: 'attribute', jiraType: a.type, datatype: VALUE[a.type][0], iceClass: null });
    }
    for (const k of cont.filter((x) => x.key === t.key)) slots.push({ key: 'ct:' + k.key, kind: 'containment', child: k.key, container: k.container, relation: null });
  }
  return { '@context': CTX, '@type': 'Skeleton', inventorySha256: h(invS), termListSha256: TL, slots };
}

// ---------- C-S3 prompt (R-S11, R-S12; U+2028/U+2029 escaped per SDD-F54) ----------
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const jline = (o) => JSON.stringify(o).split(LS).join("\\u2028").split(PS).join("\\u2029");
function dataLine(slot, inv) {
  const t = inv.objectTypes.find((x) => x.key === slot.key), a = inv.attributes.find((x) => x.key === slot.key);
  if (slot.kind === 'type') return jline({ key: t.key, kind: 'type', name: t.name, description: t.description, parent: t.parent, selectors: t.selectors });
  if (slot.kind === 'attribute') return jline({ key: a.key, kind: 'attribute', name: a.name, description: a.description, owner: a.owner, jiraType: a.type });
  if (slot.kind === 'reference') return jline({ key: a.key, kind: 'reference', name: a.name, description: a.description, owner: a.owner, target: a.target });
  const f = inv.flags.find((x) => x.code === 'FL-CONTAINMENT' && 'ct:' + x.key === slot.key);
  return jline({ key: slot.key, kind: 'containment', child: f.key, container: f.container, selector: f.selector });
}
const errorsBlock = (errs) => '\nERRORS IN YOUR PREVIOUS REPLY\nYour previous reply for this batch was rejected for the reasons below. Return the complete corrected mapping set for every DATA line, not only the lines named here.\n' + errs.map((e) => JSON.stringify(e)).join('\n') + '\n';
// R-S11 (SDD-F69): one pass over the template; inserted text is never scanned again.
const render = (skHash, batch, round, data, errors) => {
  const val = { SKELETON: skHash, TERMS: TL, BATCH: batch, ROUND: String(round), ERRORS: errors, SKELETON2: skHash, BATCH2: batch, DATA: data, CATALOGUE };
  return TEMPLATE.replace(/\{\{([A-Z0-9]+)\}\}/g, (m, n) => (Object.prototype.hasOwnProperty.call(val, n) ? val[n] : m));
};
function groupsOf(sk, inv, keys) {
  const groups = [];
  for (const s of sk.slots) { if (keys && !keys.includes(s.key)) continue; if (s.kind === 'type' || !groups.length) groups.push([]); groups[groups.length - 1].push(dataLine(s, inv) + '\n'); }
  return groups;
}
function promptSet(sk, skS, inv, budget, keys) {
  const groups = groupsOf(sk, inv, keys);
  const size = (lines) => Buffer.byteLength(render(h(skS), '1/1', 1, lines.join(''), ''));
  if (size([]) > budget) return { error: 'E-PROMPT-BUDGET' };
  const batches = []; let cur = [];
  for (const g of groups) { if (cur.length && size([...cur, ...g]) > budget) { batches.push(cur); cur = [...g]; } else cur = [...cur, ...g]; }
  if (cur.length) batches.push(cur);
  const warnings = batches.filter((b) => size(b) > budget).map((b) => ({ code: 'W-PROMPT-OVERSIZE', key: JSON.parse(b[0]).key }));
  const prompts = batches.map((b, i) => render(h(skS), `${i + 1}/${batches.length}`, 1, b.join(''), ''));
  return { prompts, warnings };
}
const promptHeader = (p) => ({ skeleton: /^skeleton: ([0-9a-f]{64})$/m.exec(p)[1], batch: /^batch: (\S+)$/m.exec(p)[1], round: +/^round: (\d+)$/m.exec(p)[1] });
const promptData = (p) => p.slice(p.indexOf('-----BEGIN DATA (untrusted)-----\n') + 33, p.indexOf('\n-----END DATA-----') + 1);
const promptSlots = (p) => promptData(p).split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ---------- C-S4 check (R-S13, R-S6, R-S10, R-S20, R-S5, R-S7, R-S8, R-S21) ----------
const KIND_FIELDS = { type: ['key', 'recordClass', 'referentClass', 'rationale'], attribute: ['key', 'iceClass', 'rationale'], reference: ['key', 'relation', 'rationale'], containment: ['key', 'relation', 'rationale'] };
const HUMAN = V1 ? ['nullEquivalents', 'acceptance', 'decision', 'datatype', 'valueProperty'] : ['nullEquivalents', 'acceptance', 'decision', 'datatype'];
const MSG = {
  'E-CHK-JSON': () => 'The reply does not contain exactly one JSON object.',
  'E-CHK-SKELETON': () => 'The reply names a different skeleton than the prompt.',
  'E-CHK-BATCH': (e, ctx) => `The reply names batch ${e.value}; the prompt is batch ${ctx.batch}.`,
  'E-CHK-MISSING': (e) => `Slot ${e.key} has no mapping in this batch.`,
  'E-CHK-DUPLICATE': (e) => `Slot ${e.key} is mapped more than once.`,
  'E-CHK-UNKNOWN-KEY': (e) => `${e.key} is not a slot in this batch.`,
  'E-CHK-HUMAN-FIELD': (e) => `${e.field} can only be set by a person at acceptance.`,
  'E-CHK-FIELDS': (e, ctx) => `${e.key} must have exactly the fields ${ctx.expected}.`,
  'E-CHK-TERM': (e) => `${e.field} ${e.value} is not in the term list.`,
  'E-CHK-KIND': (e) => `${e.field} ${e.value} is not a permitted ${e.field === 'relation' ? 'object property' : 'class'} term.`,
  'E-CHK-CATEGORY': (e) => `${e.field} ${e.value} (${byCurie[e.value].label}) is not cco:ont00000958 (Information Content Entity) or a subclass of it.`,
  'E-CHK-RANGE': (e) => `${e.field} ${e.value} does not admit the referent classes it connects (domain/range).`,
  'W-CHK-GENERIC': (e) => `${e.field} ${e.value} (${byCurie[e.value].label}) is a top-level class; check it is specific enough.`,
  'W-CHK-ICE-REFERENT': (e) => `referentClass ${e.value} (${byCurie[e.value].label}) is information content; check the record is about information.`,
  'W-CHK-RANGE-UNRESOLVED': (e) => `${e.field} ${e.value}: the domain/range check needs a referentClass not yet mapped.`,
};
const RULE = { 'E-CHK-JSON': 'R-S13', 'E-CHK-SKELETON': 'R-S13', 'E-CHK-BATCH': 'R-S13', 'E-CHK-MISSING': 'R-S6', 'E-CHK-DUPLICATE': 'R-S6', 'E-CHK-UNKNOWN-KEY': 'R-S6', 'E-CHK-HUMAN-FIELD': 'R-S10', 'E-CHK-FIELDS': 'R-S20', 'E-CHK-TERM': 'R-S7', 'E-CHK-KIND': 'R-S7', 'E-CHK-CATEGORY': 'R-S5', 'E-CHK-RANGE': 'R-S8', 'W-CHK-GENERIC': 'R-S5', 'W-CHK-ICE-REFERENT': 'R-S5', 'W-CHK-RANGE-UNRESOLVED': 'R-S8' };
const item = (code, key, field, value, ctx = {}) => { const e = { code, key, field, value, rule: RULE[code] }; e.message = MSG[code](e, ctx); return e; };
function extract(text) {
  try { const o = JSON.parse(text.trim()); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch { /* fall through */ }
  const fences = [...text.matchAll(/```json\n([\s\S]*?)```/g)];
  if (fences.length !== 1) return null;
  try { const o = JSON.parse(fences[0][1]); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}
function check(promptText, pasteText, previous) {
  const hdr = promptHeader(promptText); const slots = promptSlots(promptText);
  const errors = [], warnings = [];
  const prop = extract(pasteText);
  if (!prop) return { errors: [item('E-CHK-JSON', null, null, null)], warnings };
  if (prop.skeletonSha256 !== hdr.skeleton) return { errors: [item('E-CHK-SKELETON', null, 'skeletonSha256', prop.skeletonSha256)], warnings };
  if (prop.batch !== hdr.batch) return { errors: [item('E-CHK-BATCH', null, 'batch', prop.batch, hdr)], warnings };
  const keys = slots.map((s) => s.key); const count = {};
  for (const m of prop.mappings) count[m.key] = (count[m.key] || 0) + 1;
  for (const s of slots) { if (!count[s.key]) errors.push(item('E-CHK-MISSING', s.key, null, null)); else if (count[s.key] > 1) errors.push(item('E-CHK-DUPLICATE', s.key, null, null)); }
  for (const m of prop.mappings) if (!keys.includes(m.key)) errors.push(item('E-CHK-UNKNOWN-KEY', m.key, null, null));
  const referent = {}; for (const m of prop.mappings) if (m.referentClass) referent[m.key] = m.referentClass;
  if (previous) for (const m of previous.mappings) if (m.referentClass && !referent[m.key]) referent[m.key] = m.referentClass;
  for (const s of slots) {
    const m = prop.mappings.find((x) => x.key === s.key); if (!m) continue;
    for (const f of HUMAN) if (f in m) errors.push(item('E-CHK-HUMAN-FIELD', s.key, f, null));
    const have = Object.keys(m).filter((k) => !HUMAN.includes(k)).sort().join(); const want = KIND_FIELDS[s.kind];
    if (have !== want.slice().sort().join()) { errors.push(item('E-CHK-FIELDS', s.key, null, null, { expected: want.join(', ') })); continue; }
    for (const f of ['recordClass', 'referentClass', 'iceClass', 'relation']) {
      if (!(f in m)) continue; const v = m[f];
      if (!V1 && f === 'iceClass' && v === null) continue; // R-S5 (v0.5): no specific classification asserted
      if (f === 'relation' && v === 'sdd:NoRelation' && s.kind === 'containment') continue;
      const t = byCurie[v];
      if (!t) { errors.push(item('E-CHK-TERM', s.key, f, v)); continue; }
      if (!t.permitted || t.kind !== (f === 'relation' ? 'object_property' : 'class')) { errors.push(item('E-CHK-KIND', s.key, f, v)); continue; }
      if ((f === 'recordClass' || f === 'iceClass') && !isIce(t)) { errors.push(item('E-CHK-CATEGORY', s.key, f, v)); continue; }
      if (f === 'relation') {
        const from = s.kind === 'reference' ? referent[s.owner] : referent[s.child];
        const to = s.kind === 'reference' ? referent[s.target] : referent[s.container];
        if (!from || !to) { warnings.push(item('W-CHK-RANGE-UNRESOLVED', s.key, f, v)); continue; }
        const ok = t.domain.every((d) => anc(byCurie[from].iri).has(d)) && t.range.every((r) => anc(byCurie[to].iri).has(r));
        if (!ok) errors.push(item('E-CHK-RANGE', s.key, f, v));
        continue;
      }
      if (t.iri.startsWith(BFO_NS) || t.iri === ICE) warnings.push(item('W-CHK-GENERIC', s.key, f, v));
      if (f === 'referentClass' && isIce(t)) warnings.push(item('W-CHK-ICE-REFERENT', s.key, f, v));
    }
  }
  return { errors, warnings, prop };
}
const reportOf = (skS, promptText, paste, r) => { const hdr = promptHeader(promptText); return ser({ '@context': CTX, '@type': 'CheckReport', skeletonSha256: h(skS), batch: hdr.batch, round: hdr.round, promptSha256: h(promptText), proposalSha256: h(paste), termListSha256: TL, status: r.errors.length ? 'rejected' : 'validated', errors: r.errors, warnings: r.warnings }); };

// ---------- C-S5 repair (R-S22) ----------
function repair(promptText, reportS) {
  const rep = JSON.parse(reportS); const hdr = promptHeader(promptText);
  return render(hdr.skeleton, hdr.batch, rep.round + 1, promptData(promptText), errorsBlock(rep.errors));
}

// ---------- C-S6 accept (R-S15, R-S17, R-S18) ----------
function accept(sk, skS, inv, invS, fxBytes, decisions, checked, previous) {
  const cov = {}; // key -> {mapping, prov}
  for (const { reportS, paste, promptText } of checked) {
    const rep = JSON.parse(reportS); const prop = extract(paste);
    for (const m of prop.mappings) {
      const prov = { round: rep.round, batch: rep.batch, promptSha256: h(promptText), proposalSha256: h(paste), checkReportSha256: h(reportS) };
      if (!cov[m.key] || cov[m.key].prov.round <= rep.round) cov[m.key] = { m, prov };
    }
  }
  const dec = Object.fromEntries(decisions.decisions.map((d) => [d.key, d.decision]));
  const src = (s) => {
    if (s.kind === 'type') { const t = inv.objectTypes.find((x) => x.key === s.key); return { name: t.name, externalId: t.externalId, itemSha256: itemSha(t) }; }
    if (s.kind === 'containment') { const f = inv.flags.find((x) => x.code === 'FL-CONTAINMENT' && 'ct:' + x.key === s.key); return { child: f.key, container: f.container, selector: f.selector, itemSha256: itemSha(f) }; }
    const a = inv.attributes.find((x) => x.key === s.key); return s.kind === 'reference' ? { name: a.name, externalId: a.externalId, owner: a.owner, jiraType: a.type, target: a.target, itemSha256: itemSha(a) } : { name: a.name, externalId: a.externalId, owner: a.owner, jiraType: a.type, itemSha256: itemSha(a) };
  };
  const prev = previous ? Object.fromEntries(JSON.parse(previous).mappings.map((m) => [m.key, m])) : {};
  const mappings = [], open = [];
  for (const s of sk.slots) {
    if (dec[s.key] === 'accept') {
      const { m, prov } = cov[s.key]; const acc = { decision: 'accepted', by: decisions.by, at: AT }; const source = src(s);
      if (s.kind === 'type') mappings.push({ key: s.key, kind: 'type', source, recordClass: m.recordClass, referentClass: m.referentClass, rationale: m.rationale, provenance: prov, acceptance: acc });
      else if (s.kind === 'attribute' && V1) mappings.push({ key: s.key, kind: 'attribute', source, iceClass: m.iceClass, datatype: s.datatype, valueProperty: s.valueProperty, nullEquivalents: ((decisions.nullEquivalents || {})[s.key] || []).slice().sort(), rationale: m.rationale, provenance: prov, acceptance: acc });
      else if (s.kind === 'attribute') mappings.push({ key: s.key, kind: 'attribute', source, iceClass: m.iceClass, datatype: s.datatype, nullEquivalents: ((decisions.nullEquivalents || {})[s.key] || []).slice().sort(), rationale: m.rationale, provenance: prov, acceptance: acc });
      else mappings.push({ key: s.key, kind: s.kind, source, relation: m.relation, rationale: m.rationale, provenance: prov, acceptance: acc });
    } else if (!dec[s.key] && prev[s.key] && prev[s.key].source.itemSha256 === src(s).itemSha256) mappings.push(prev[s.key]);
    else open.push(s.key);
  }
  const live = new Set(sk.slots.map((s) => s.key));
  const retired = Object.values(prev).filter((m) => !live.has(m.key));
  return ser({ '@context': CTX, '@type': 'SemanticDataDictionary', sddVersion: V1 ? 1 : 2, source: { format: 'jira-assets-import/2021_09_15', sha256: h(fxBytes), schemaName: inv.source.schemaName, identification: inv.source.identification, inventorySha256: h(invS) }, environment: { termListSha256: TL, ontologyTemplateCommit: tl.ontology_template_commit, contextIri: CTX }, absenceKinds: ['missing', 'explicit_null', 'empty_string', 'indistinguishable'], mappings, open, retired });
}

// ---------- C-S7 rerun (R-S17) ----------
function rerun(newInv, newInvS, prevSddS) {
  const prev = JSON.parse(prevSddS); const p = {}; for (const m of prev.mappings) p[m.key] = m.source.itemSha256;
  const cur = {}; for (const o of [...newInv.objectTypes, ...newInv.attributes]) cur[o.key] = itemSha(o);
  for (const f of newInv.flags.filter((x) => x.code === 'FL-CONTAINMENT')) cur['ct:' + f.key] = itemSha(f);
  const keys = [...new Set([...Object.keys(p), ...Object.keys(cur)])].sort();
  const flags = prev.source.identification !== newInv.source.identification ? [{ code: 'FL-KEY-SCHEME-CHANGED', key: null, previous: prev.source.identification, current: newInv.source.identification }] : [];
  return ser({ '@context': CTX, '@type': 'RerunPlan', previousSddSha256: h(prevSddS), inventorySha256: h(newInvS), unchanged: keys.filter((k) => p[k] && cur[k] && p[k] === cur[k]), changed: keys.filter((k) => p[k] && cur[k] && p[k] !== cur[k]), added: keys.filter((k) => !p[k] && cur[k]), removed: keys.filter((k) => p[k] && !cur[k]), flags });
}

// ---------- proposals are BUILT from the current skeleton (never reused across supersessions) ----------
const paste = (obj, fenced) => fenced ? 'Here is the mapping:\n\n```json\n' + JSON.stringify(obj, null, 2) + '\n```\n' : JSON.stringify(obj, null, 2) + '\n';
const MIN_MAP = { 'ot:Organization': { key: 'ot:Organization', recordClass: 'cco:ont00000853', referentClass: 'cco:ont00001180', rationale: 'The Assets object is a descriptive record about an organization.' }, 'at:Organization/Name': { key: 'at:Organization/Name', iceClass: 'cco:ont00001014', rationale: "The label is the organization's proper name." }, 'at:Organization/Cost Center': { key: 'at:Organization/Cost Center', iceClass: 'cco:ont00000077', rationale: 'A cost center is a code identifier assigned by finance.' } };
const DEC = (keys, rejects = []) => ({ by: 'Aaron Damiano', decisions: keys.map((k) => ({ key: k, decision: rejects.includes(k) ? 'reject' : 'accept' })), nullEquivalents: {} });
const W = 'fixtures/witnesses/';

// ===== minimal: J-S1, J-S2, J-S4, W-CS6-Δ9 =====
const fxB = read('fixtures/jira-assets/minimal-organization.json');
const inv = parse(fxB); const invS = write(W + 'minimal/inventory.jsonld', ser(inv));
const sk = skeleton(inv, invS); const skS = write(W + 'minimal/skeleton.jsonld', ser(sk));
const ps = promptSet(sk, skS, inv, 200000); const pr1 = write(W + 'minimal/prompt.txt', ps.prompts[0]);
write(W + 'minimal/prompt-set.jsonld', ser({ '@context': CTX, '@type': 'PromptSet', skeletonSha256: h(skS), round: 1, budget: 200000, prompts: [{ batch: '1/1', file: 'prompt-1-of-1.txt', bytes: Buffer.byteLength(pr1), sha256: h(pr1) }], warnings: [] }));
const goodObj = { skeletonSha256: h(skS), batch: '1/1', mappings: Object.values(MIN_MAP) };
const good = write(W + 'minimal/proposal-pasted.txt', paste(goodObj, true));
const badObj = { skeletonSha256: h(skS), batch: '1/1', mappings: [MIN_MAP['ot:Organization'], { key: 'at:Organization/Name', iceClass: 'cco:ont00001180', rationale: 'The name of the organization.' }] };
const bad = write(W + 'minimal/bad-proposal.txt', paste(badObj, false));
const rep1 = write(W + 'minimal/check-report.jsonld', reportOf(skS, pr1, good, check(pr1, good)));
const repBad = write(W + 'minimal/bad-check-report.jsonld', reportOf(skS, pr1, bad, check(pr1, bad)));
const pr2 = write(W + 'minimal/repair-prompt.txt', repair(pr1, repBad));
const rep2 = write(W + 'minimal/check-report-round2.jsonld', reportOf(skS, pr2, good, check(pr2, good)));
const ALL3 = Object.keys(MIN_MAP);
const sdd1 = write(W + 'minimal/sdd.jsonld', accept(sk, skS, inv, invS, fxB, DEC(ALL3), [{ reportS: rep1, paste: good, promptText: pr1 }]));
write(W + 'minimal/sdd-round2.jsonld', accept(sk, skS, inv, invS, fxB, DEC(ALL3), [{ reportS: rep2, paste: good, promptText: pr2 }]));
const sddR12 = accept(sk, skS, inv, invS, fxB, DEC(ALL3), [{ reportS: rep1, paste: good, promptText: pr1 }, { reportS: rep2, paste: good, promptText: pr2 }]);
if (sddR12 !== read(W + 'minimal/sdd-round2.jsonld')) throw new Error('W-CS6-Δ9: highest-round selection does not reproduce sdd-round2');
// J-S4
const sddPart = write(W + 'minimal/sdd-partial.jsonld', accept(sk, skS, inv, invS, fxB, DEC(ALL3, ['at:Organization/Cost Center']), [{ reportS: rep1, paste: good, promptText: pr1 }]));
const openKeys = JSON.parse(sddPart).open; write(W + 'minimal/keys-open.json', JSON.stringify(openKeys) + '\n');
const prOpen = write(W + 'minimal/prompt-open.txt', promptSet(sk, skS, inv, 200000, openKeys).prompts[0]);
const openPaste = write(W + 'minimal/proposal-open.txt', paste({ skeletonSha256: h(skS), batch: '1/1', mappings: [MIN_MAP['at:Organization/Cost Center']] }, false));
const repOpen = write(W + 'minimal/check-report-open.jsonld', reportOf(skS, prOpen, openPaste, check(prOpen, openPaste)));
write(W + 'minimal/sdd-j4.jsonld', accept(sk, skS, inv, invS, fxB, DEC(['at:Organization/Cost Center']), [{ reportS: repOpen, paste: openPaste, promptText: prOpen }], sddPart));
// J-S3
const fx2B = read('fixtures/jira-assets/minimal-organization-v2.json');
const inv2 = parse(fx2B); const inv2S = write(W + 'minimal/inventory-v2.jsonld', ser(inv2));
const plan = write(W + 'minimal/rerun-plan.jsonld', rerun(inv2, inv2S, sdd1)); const planO = JSON.parse(plan);
const sk2 = skeleton(inv2, inv2S); const sk2S = write(W + 'minimal/skeleton-v2.jsonld', ser(sk2));
const rKeys = [...planO.changed, ...planO.added].sort(); write(W + 'minimal/keys-rerun.json', JSON.stringify(rKeys) + '\n');
const prRerun = write(W + 'minimal/prompt-rerun.txt', promptSet(sk2, sk2S, inv2, 200000, rKeys).prompts[0]);
const rerunPaste = write(W + 'minimal/proposal-rerun.txt', paste({ skeletonSha256: h(sk2S), batch: '1/1', mappings: [MIN_MAP['at:Organization/Cost Center']] }, false));
const repRerun = write(W + 'minimal/check-report-rerun.jsonld', reportOf(sk2S, prRerun, rerunPaste, check(prRerun, rerunPaste)));
write(W + 'minimal/sdd-v2.jsonld', accept(sk2, sk2S, inv2, inv2S, fx2B, DEC(['at:Organization/Cost Center']), [{ reportS: repRerun, paste: rerunPaste, promptText: prRerun }], sdd1));
// W-CS7-Δ1: removal
const fx3 = JSON.parse(fxB); fx3.schema.objectSchema.objectTypes[0].attributes.splice(1, 1); fx3.mapping.objectTypeMappings[0].attributesMapping.splice(1, 1);
const fx3B = write('fixtures/jira-assets/minimal-organization-v3-removed.json', ser(fx3));
const inv3 = parse(fx3B); const inv3S = write(W + 'minimal/inventory-v3.jsonld', ser(inv3));
write(W + 'minimal/rerun-plan-removed.jsonld', rerun(inv3, inv3S, sdd1));

// ===== full fixture =====
const fB = read('fixtures/jira-assets/synthetic-it-assets.json');
const finv = parse(fB); const finvS = write(W + 'full/inventory.jsonld', ser(finv));
const fsk = skeleton(finv, finvS); const fskS = write(W + 'full/skeleton.jsonld', ser(fsk));
const fpr = write(W + 'full/prompt.txt', promptSet(fsk, fskS, finv, 200000).prompts[0]);
const b2 = promptSet(fsk, fskS, finv, 69000); b2.prompts.forEach((p, i) => write(W + `full/prompt-${i + 1}-of-${b2.prompts.length}.txt`, p));
const REF = { 'ot:Organization': 'cco:ont00001180', 'ot:Person': 'cco:ont00001262', 'ot:Location': 'cco:ont00000192', 'ot:Hardware': 'cco:ont00000995', 'ot:Laptop': 'cco:ont00000420', 'ot:Server': 'cco:ont00000420', 'ot:Blade Server': 'cco:ont00000420', 'ot:Hard Drive': 'cco:ont00000117', 'ot:Software': 'cco:ont00000853', 'ot:Scan Event': 'cco:ont00000037' };
const REL = { 'at:Person/Department': 'cco:ont00001939', 'at:Person/Manager': 'cco:ont00001798', 'at:Hardware/Owner': 'cco:ont00001925', 'at:Hardware/Location': 'bfo:BFO_0000171', 'at:Software/Installed On': 'bfo:BFO_0000084', 'ct:ot:Blade Server': 'bfo:BFO_0000176', 'ct:ot:Hard Drive': 'bfo:BFO_0000176' };
const nomMap = (s) => s.kind === 'type' ? { key: s.key, recordClass: 'cco:ont00000853', referentClass: REF[s.key], rationale: 'Witness mapping.' } : s.kind === 'attribute' ? { key: s.key, iceClass: 'cco:ont00000853', rationale: 'Witness mapping.' } : { key: s.key, relation: REL[s.key], rationale: 'Witness mapping.' };
const nominal = { skeletonSha256: h(fskS), batch: '1/1', mappings: fsk.slots.map(nomMap) };
const vP = write(W + 'full/proposal-valid.txt', paste(nominal, false));
write(W + 'full/check-report-valid.jsonld', reportOf(fskS, fpr, vP, check(fpr, vP)));
const rng = JSON.parse(JSON.stringify(nominal)); rng.mappings.find((m) => m.key === 'at:Person/Manager').relation = 'bfo:BFO_0000056';
const rP = write(W + 'full/proposal-range.txt', paste(rng, false));
write(W + 'full/check-report-range.jsonld', reportOf(fskS, fpr, rP, check(fpr, rP)));
// W-CS4-Δ16: unresolved range in batch 2 of 2 (container Server's referent is in batch 1)
const b2keys = promptSlots(b2.prompts[1]).map((s) => s.key);
const ub = { skeletonSha256: h(fskS), batch: '2/2', mappings: fsk.slots.filter((s) => b2keys.includes(s.key)).map(nomMap) };
const uP = write(W + 'full/proposal-batch2.txt', paste(ub, false));
write(W + 'full/check-report-batch2.jsonld', reportOf(fskS, b2.prompts[1], uP, check(b2.prompts[1], uP)));
// W-CS7-Δ2: identification switch (previous SDD = all nominal mappings accepted)
const fullRep = read(W + 'full/check-report-valid.jsonld');
const sddFull = write(W + 'full/sdd.jsonld', accept(fsk, fskS, finv, finvS, fB, DEC(fsk.slots.map((s) => s.key)), [{ reportS: fullRep, paste: vP, promptText: fpr }]));
const xB = read('fixtures/jira-assets/synthetic-it-assets-externalids.json');
const xinv = parse(xB); const xinvS = write(W + 'full/inventory-externalids.jsonld', ser(xinv));
write(W + 'full/rerun-plan-switch.jsonld', rerun(xinv, xinvS, sddFull));

// ===== hostile separators (SDD-F54) =====
const hB = read('fixtures/jira-assets/hostile-separators.json');
const hinv = parse(hB); const hinvS = write(W + 'hostile/inventory.jsonld', ser(hinv)); const hsk = skeleton(hinv, hinvS); const hskS = write(W + 'hostile/skeleton.jsonld', ser(hsk));
write(W + 'hostile/prompt.txt', promptSet(hsk, hskS, hinv, 200000).prompts[0]);

// ===== placeholder text in source (W-CS3-Δ7, SDD-F69) =====
const phB = read('fixtures/jira-assets/hostile-placeholders.json');
const phinv = parse(phB); const phinvS = write(W + 'hostile/placeholders-inventory.jsonld', ser(phinv)); const phsk = skeleton(phinv, phinvS); const phskS = write(W + 'hostile/placeholders-skeleton.jsonld', ser(phsk));
write(W + 'hostile/placeholders-prompt.txt', promptSet(phsk, phskS, phinv, 200000).prompts[0]);

// ===== v0.5: no specific classification (W-CS4-Δ19, W-CS6-Δ11) =====
if (!V1) {
  const nullObj = { skeletonSha256: h(skS), batch: '1/1', mappings: [MIN_MAP['ot:Organization'], MIN_MAP['at:Organization/Name'], { key: 'at:Organization/Cost Center', iceClass: null, rationale: 'The finance code system is not described in the schema, so no specific identifier class can be justified.' }] };
  const nullPaste = write(W + 'minimal/proposal-null.txt', paste(nullObj, false));
  const nullRep = write(W + 'minimal/check-report-null.jsonld', reportOf(skS, pr1, nullPaste, check(pr1, nullPaste)));
  write(W + 'minimal/sdd-null.jsonld', accept(sk, skS, inv, invS, fxB, DEC(ALL3), [{ reportS: nullRep, paste: nullPaste, promptText: pr1 }]));
}

for (const [r, hh, n] of written) console.log(r.replace(W, '').padEnd(46), hh.slice(0, 8), n);
