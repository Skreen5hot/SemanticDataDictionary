// Generator G1 (SDD §7): seeded random Jira Assets import schemas, valid against the vendored Atlassian JSON Schema.
//   1–40 object types in trees of depth ≤ 4 (root = depth 1); 0–12 non-reference attributes per type over the 12
//   non-reference Jira types plus 0–3 `referenced_object` attributes (together: the 13 types), targets including
//   self and ancestors; 0–2 nested mapping selectors; per-schema identification mode {name, externalId, mixed}
//   with per-item random externalId presence in mixed mode; descriptions from K1; a mapping section consistent with
//   the schema (objectTypeName / attributeName always name existing items, inherited attributes used on purpose).
// Also: the R-S2 / R-S4 / R-S19 expectations computed from the generator's own model (an oracle derived from the
// spec text, not from the implementation), permutation and description editing (V-S2), and rerun edits (V-S5).
//
//   node harness/props/g1.mjs --selftest            validator self-test on the fixtures + 500 G1 schemas
//   node harness/props/g1.mjs --seed s --out f.json write one schema
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng } from './rng.mjs';
import { k1Description } from './k1.mjs';
import { validate } from './minischema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ATLASSIAN = JSON.parse(readFileSync(join(ROOT, 'vendor/atlassian/assets-import-schema-2021_09_15.json'), 'utf8'));
export const NONREF_TYPES = ['text', 'integer', 'boolean', 'double', 'date', 'time', 'date_time', 'url', 'email', 'textarea', 'select', 'ipaddress'];
const TYPE_WORDS = ['Organization', 'Person', 'Location', 'Hardware', 'Server', 'Laptop', 'Software', 'Licence', 'Rack', 'Contract', 'Vendor', 'Site', 'Network', 'Scan Event', 'Ticket', 'Café', 'Ports/Protocols', 'Cost~Center', 'Rack \u{1F5A5}', 'Größe', 'Data "Center"'];
const ATTR_WORDS = ['Name', 'Code', 'Status', 'Owner', 'Serial Number', 'Purchase Date', 'IP Address', 'Notes', 'Ports/Protocols', 'Cost~Center', 'Größe', 'Label \u{1F3F7}', 'Start', 'Active', 'Capacity GB', 'URL', 'Email', 'a/b~c', 'Version'];
export const esc = (s) => s.replace(/~/g, '~0').replace(/\//g, '~1');
export const unesc = (s) => s.replace(/~1/g, '/').replace(/~0/g, '~');

// ---------------- model ----------------
// model = { name, description, mode, types: [{ id, name, extId, desc, parent, attrs: [{ name, extId, desc, type, label, target }], mapping }] }
// mapping = { selector, desc, attrMaps: [{ name, owner (type id), locators, extIdPart, iql }] } | null
export function generateModel(seed, opts = {}) {
  const rng = new Rng(seed);
  const maxTypes = opts.maxTypes ?? 40;
  const nTypes = rng.int(opts.minTypes ?? 1, maxTypes);
  const mode = opts.mode ?? rng.pick(['name', 'externalId', 'mixed']);
  const hasId = () => (mode === 'externalId' ? true : mode === 'name' ? false : rng.bool(0.5));
  const types = [];
  const depth = (t) => (t.parent == null ? 1 : 1 + depth(types[t.parent]));
  for (let i = 0; i < nTypes; i++) {
    const candidates = types.filter((t) => depth(t) < 4);
    const parent = candidates.length && rng.bool(0.55) ? rng.pick(candidates).id : null;
    const name = `${rng.pick(TYPE_WORDS)} ${i}`;
    types.push({ id: i, name, extId: null, desc: k1Description(rng), parent, attrs: [], mapping: null, _idWanted: hasId() });
  }
  const ancestors = (t) => { const a = []; for (let p = t.parent; p != null; p = types[p].parent) a.push(types[p]); return a; };
  const lineageNames = (t) => new Set([t, ...ancestors(t)].flatMap((x) => x.attrs.map((a) => a.name)));
  for (const t of types) {
    if (t._idWanted) t.extId = `object-type/${slug(t.name)}-${t.id}`;
    delete t._idWanted;
  }
  let attrSerial = 0;
  const newAttr = (t, type, target) => {
    const used = lineageNames(t); let base = rng.pick(ATTR_WORDS); let name = base; let k = 2;
    while (used.has(name)) name = `${base} ${k++}`;
    const a = { name, extId: null, desc: k1Description(rng), type, label: false, target: target ?? null };
    if (hasId()) a.extId = `object-type-attribute/${slug(t.name)}/${slug(name)}-${attrSerial++}`;
    return a;
  };
  for (const t of types) {
    const n = rng.int(0, 12);
    for (let j = 0; j < n; j++) t.attrs.push(newAttr(t, rng.pick(NONREF_TYPES)));
    if (t.attrs.length && rng.bool(0.6)) rng.pick(t.attrs).label = true;
  }
  for (const t of types) { // references after every type exists: self, ancestor or any
    const n = rng.int(0, 3);
    for (let j = 0; j < n; j++) {
      const anc = ancestors(t); const r = rng.next();
      const target = r < 0.25 ? t.id : r < 0.5 && anc.length ? rng.pick(anc).id : rng.int(0, types.length - 1);
      t.attrs.push(newAttr(t, 'referenced_object', target));
    }
    if (rng.bool(0.3)) t.attrs = rng.shuffle(t.attrs);
  }
  // mapping section
  let sel = 0;
  for (const t of types) {
    if (!rng.bool(0.8)) continue;
    const avail = [...t.attrs.map((a) => ({ a, owner: t.id })), ...ancestors(t).flatMap((x) => x.attrs.map((a) => ({ a, owner: x.id })))];
    const chosen = rng.sample(avail, rng.int(0, avail.length));
    t.mapping = {
      selector: `sel${sel++}`, desc: `Rows for ${t.name}`,
      attrMaps: chosen.map(({ a, owner }) => ({ name: a.name, owner, locators: rng.sample(['id', 'name', 'code', 'value', 'first', 'last'], rng.int(1, 2)), extIdPart: rng.bool(0.2), iql: a.type === 'referenced_object' ? `Name = \${${slug(a.name)}}` : null })),
    };
  }
  const mapped = types.filter((t) => t.mapping);
  const nNested = Math.min(rng.int(0, 2), Math.max(0, mapped.length - 1));
  const nestedIds = new Set();
  for (let k = 0; k < nNested; k++) {
    const child = rng.pick(mapped.filter((t) => !nestedIds.has(t.id)));
    if (!child) continue;
    const container = rng.pick(mapped.filter((t) => t.id !== child.id && !t.mapping.selector.startsWith(child.mapping.selector + '.')));
    if (!container) continue;
    // keep selectors of anything already nested under the child consistent (none exist: children are nested at most once and first)
    if (mapped.some((t) => t !== child && t.mapping.selector.startsWith(child.mapping.selector + '.'))) continue;
    child.mapping.selector = `${container.mapping.selector}.n${k}`;
    nestedIds.add(child.id);
  }
  // optional key collision (V-S2): a type's externalId equal to another (externalId-less) type's name, or two
  // attributes sharing an externalId.
  const collisions = [];
  if (opts.collisionRate && rng.bool(opts.collisionRate) && types.length >= 2) {
    if (rng.bool(0.5)) {
      const [a, b] = rng.sample(types, 2); b.extId = null; a.extId = b.name; collisions.push('type');
    } else {
      const attrs = types.flatMap((t) => t.attrs);
      if (attrs.length >= 2) { const [a, b] = rng.sample(attrs, 2); const id = `object-type-attribute/shared-${rng.int(0, 999)}`; a.extId = id; b.extId = id; collisions.push('attribute'); }
    }
  }
  return { seed: String(seed), name: `G1 schema ${seed}`, description: k1Description(rng), mode, types, injected: collisions };
}
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

// ---------------- rendering ----------------
export function render(model) {
  const byParent = new Map();
  for (const t of model.types) { const k = t.parent ?? -1; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(t); }
  const nameOf = (id) => model.types[id].name;
  const ot = (t) => {
    const o = { name: t.name, description: t.desc };
    if (t.attrs.length || t.id % 2 === 0) o.attributes = t.attrs.map((a) => {
      const x = { name: a.name, description: a.desc, type: a.type };
      if (a.label) x.label = true;
      if (a.type === 'referenced_object') x.referenceObjectTypeName = nameOf(a.target);
      if (a.extId != null) x.externalId = a.extId;
      return x;
    });
    const kids = byParent.get(t.id) || [];
    if (kids.length) o.children = kids.map(ot);
    if (t.extId != null) o.externalId = t.extId;
    return o;
  };
  const otm = model.types.filter((t) => t.mapping).map((t) => {
    const m = { objectTypeName: t.name, selector: t.mapping.selector, description: t.mapping.desc, attributesMapping: t.mapping.attrMaps.map((am) => {
      const a = model.types[am.owner].attrs.find((x) => x.name === am.name);
      const x = { attributeName: am.name, attributeLocators: am.locators };
      if (am.extIdPart) x.externalIdPart = true;
      if (am.iql) x.objectMappingIQL = am.iql;
      if (a && a.extId != null) x.attributeExternalId = a.extId;
      return x;
    }) };
    if (t.extId != null) m.objectTypeExternalId = t.extId;
    return m;
  });
  return {
    $schema: 'https://api.atlassian.com/jsm/assets/imports/external/schema/versions/2021_09_15',
    schema: { objectSchema: { name: model.name, description: model.description, objectTypes: (byParent.get(-1) || []).map(ot) } },
    mapping: { objectTypeMappings: otm },
  };
}
export const toBytes = (schema) => Buffer.from(JSON.stringify(schema, null, 2) + '\n', 'utf8');

// ---------------- spec-derived expectations (R-S2, R-S4, R-S19) ----------------
export function expected(model) {
  const T = model.types;
  const tkey = (t) => 'ot:' + esc(t.extId ?? t.name);
  const akey = (t, a) => (a.extId != null ? 'at:' + esc(a.extId) : 'at:' + esc(t.name) + '/' + esc(a.name));
  const ancestors = (t) => { const a = []; for (let p = t.parent; p != null; p = T[p].parent) a.push(T[p]); return a; };
  const items = [...T.map((t) => ({ kind: 'type', key: tkey(t), t })), ...T.flatMap((t) => t.attrs.map((a) => ({ kind: a.type === 'referenced_object' ? 'reference' : 'attribute', key: akey(t, a), t, a })))];
  const all = items.every((i) => (i.a ?? i.t).extId != null), none = items.every((i) => (i.a ?? i.t).extId == null);
  const identification = all ? 'externalId' : none ? 'name' : 'mixed';
  // containment (R-S4): longest other mapped selector that prefixes this one + '.'
  const containment = [];
  for (const t of T) {
    if (!t.mapping) continue;
    let best = null;
    for (const u of T) if (u !== t && u.mapping && t.mapping.selector.startsWith(u.mapping.selector + '.') && (!best || u.mapping.selector.length > best.mapping.selector.length)) best = u;
    if (best) containment.push({ key: 'ct:' + tkey(t), child: tkey(t), container: tkey(best), selector: t.mapping.selector });
  }
  const keys = [...items.map((i) => i.key), ...containment.map((c) => c.key)];
  const counts = new Map(); for (const k of keys) counts.set(k, (counts.get(k) || 0) + 1);
  const colliding = [...counts].filter(([, n]) => n > 1).map(([k]) => k).sort();
  const flags = [];
  for (const c of containment) flags.push({ code: 'FL-CONTAINMENT', key: c.child, container: c.container, selector: c.selector });
  for (const t of T) {
    if (t.mapping) {
      const own = new Set(t.attrs.map((a) => a.name));
      const inh = [...new Set(t.mapping.attrMaps.filter((am) => !own.has(am.name)).map((am) => am.name))].sort();
      if (inh.length) flags.push({ code: 'FL-INHERITED-USE', key: tkey(t), attributes: inh });
    }
    if (![t, ...ancestors(t)].some((x) => x.attrs.some((a) => a.label))) flags.push({ code: 'FL-NO-LABEL', key: tkey(t) });
    for (const a of t.attrs) if (a.type === 'select') flags.push({ code: 'FL-SELECT-VALUES-UNKNOWN', key: akey(t, a) });
    if (!t.mapping) flags.push({ code: 'FL-UNMAPPED-TYPE', key: tkey(t) });
  }
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  flags.sort((x, y) => cmp(x.code, y.code) || cmp(x.key, y.key));
  // slot keys by kind (no slot from a children edge: every slot is an item or a nested selector)
  const slots = { type: items.filter((i) => i.kind === 'type').map((i) => i.key), attribute: items.filter((i) => i.kind === 'attribute').map((i) => i.key), reference: items.filter((i) => i.kind === 'reference').map((i) => i.key), containment: containment.map((c) => c.key) };
  // source identifiers per key (for "every key unescapes to its source identifier")
  const sourceIds = items.map((i) => ({ key: i.key, kind: i.kind, id: i.a ? (i.a.extId ?? null) : (i.t.extId ?? null), name: i.a ? i.a.name : i.t.name, owner: i.a ? i.t.name : null }));
  const descriptions = items.map((i) => (i.a ?? i.t).desc);
  return { identification, keys, colliding, flags, slots, containment, sourceIds, descriptions, nNested: containment.length };
}

// ---------------- V-S2 transforms ----------------
export function permute(schema, rng) {
  const s = JSON.parse(JSON.stringify(schema));
  const walk = (ts) => { const r = rng.shuffle(ts); for (const t of r) { if (t.attributes) t.attributes = rng.shuffle(t.attributes); if (t.children) t.children = walk(t.children); } return r; };
  s.schema.objectSchema.objectTypes = walk(s.schema.objectSchema.objectTypes);
  s.mapping.objectTypeMappings = rng.shuffle(s.mapping.objectTypeMappings).map((m) => ({ ...m, attributesMapping: rng.shuffle(m.attributesMapping || []) }));
  return s;
}
export function editDescriptions(schema, rng) {
  const s = JSON.parse(JSON.stringify(schema));
  const walk = (ts) => { for (const t of ts) { if (rng.bool(0.7)) t.description = k1Description(rng) + ' (edited)'; for (const a of t.attributes || []) if (rng.bool(0.7)) a.description = k1Description(rng) + ' (edited)'; walk(t.children || []); } };
  walk(s.schema.objectSchema.objectTypes);
  return s;
}
// Same model, every type/attribute description replaced (V-S4 (iii) pairs).
export function withDescriptions(model, rng) {
  const m = JSON.parse(JSON.stringify(model));
  for (const t of m.types) { t.desc = k1Description(rng); for (const a of t.attrs) a.desc = k1Description(rng); }
  return m;
}

// ---------------- rerun edits (V-S1 rerun, V-S5) ----------------
export function editModel(model, rng, nEdits = rng.int(1, 4)) {
  const m = JSON.parse(JSON.stringify(model)); const log = [];
  const ancestorsOf = (t) => { const a = []; for (let p = t.parent; p != null; p = m.types[p].parent) a.push(m.types[p]); return a; };
  for (let e = 0; e < nEdits; e++) {
    const op = rng.pick(['desc', 'desc', 'addAttr', 'removeAttr', 'changeType', 'addType', 'removeType', rng.bool(0.15) ? 'switchIds' : 'desc']);
    const live = m.types.filter((t) => !t.removed);
    const t = rng.pick(live);
    if (op === 'desc') { if (t.attrs.length && rng.bool(0.6)) { const a = rng.pick(t.attrs); a.desc = k1Description(rng) + ' v' + e; log.push(`desc ${t.name}.${a.name}`); } else { t.desc = k1Description(rng) + ' v' + e; log.push(`desc ${t.name}`); } }
    else if (op === 'addAttr') { const used = new Set([t, ...ancestorsOf(t)].flatMap((x) => x.attrs.map((a) => a.name))); let name = `Added ${e}`; let k = 0; while (used.has(name)) name = `Added ${e}.${k++}`; t.attrs.push({ name, extId: m.mode === 'externalId' ? `object-type-attribute/added-${rng.int(0, 1e6)}` : null, desc: k1Description(rng), type: rng.pick(NONREF_TYPES), label: false, target: null }); log.push(`addAttr ${t.name}.${name}`); }
    else if (op === 'removeAttr' && t.attrs.length) { const a = rng.pick(t.attrs); t.attrs = t.attrs.filter((x) => x !== a); for (const u of m.types) if (u.mapping) u.mapping.attrMaps = u.mapping.attrMaps.filter((am) => !(am.owner === t.id && am.name === a.name)); log.push(`removeAttr ${t.name}.${a.name}`); }
    else if (op === 'changeType' && t.attrs.some((a) => a.type !== 'referenced_object')) { const a = rng.pick(t.attrs.filter((x) => x.type !== 'referenced_object')); a.type = rng.pick(NONREF_TYPES.filter((x) => x !== a.type)); log.push(`changeType ${t.name}.${a.name}`); }
    else if (op === 'addType') { const id = m.types.length; m.types.push({ id, name: `New Type ${id}`, extId: m.mode === 'externalId' ? `object-type/new-${id}` : null, desc: k1Description(rng), parent: null, attrs: [{ name: 'Name', extId: m.mode === 'externalId' ? `object-type-attribute/new-${id}/name` : null, desc: k1Description(rng), type: 'text', label: true, target: null }], mapping: { selector: `selnew${id}`, desc: 'new', attrMaps: [{ name: 'Name', owner: id, locators: ['name'], extIdPart: true, iql: null }] } }); log.push(`addType New Type ${id}`); }
    else if (op === 'removeType' && live.length > 1) {
      const removable = live.filter((u) => !m.types.some((v) => !v.removed && v.parent === u.id) && !m.types.some((v) => !v.removed && v.attrs.some((a) => a.target === u.id && v !== u)) && !(u.mapping && m.types.some((v) => v !== u && v.mapping && !v.removed && v.mapping.selector.startsWith(u.mapping.selector + '.'))));
      if (removable.length) { const u = rng.pick(removable); u.removed = true; log.push(`removeType ${u.name}`); }
    }
    else if (op === 'switchIds') {
      const to = m.mode === 'externalId' ? 'name' : 'externalId'; m.mode = to;
      for (const u of m.types) { u.extId = to === 'externalId' ? `object-type/sw-${u.id}` : null; u.attrs.forEach((a, j) => { a.extId = to === 'externalId' ? `object-type-attribute/sw-${u.id}-${j}` : null; }); }
      log.push(`switchIds → ${to}`);
    }
  }
  // compact: drop removed types, renumber ids
  const keep = m.types.filter((t) => !t.removed); const map = new Map(keep.map((t, i) => [t.id, i]));
  for (const t of keep) { t.id = map.get(t.id); t.parent = t.parent == null ? null : map.get(t.parent); for (const a of t.attrs) if (a.target != null) a.target = map.get(a.target); if (t.mapping) for (const am of t.mapping.attrMaps) am.owner = map.get(am.owner); }
  m.types = keep;
  return { model: m, log };
}

// ---------------- G1 entry point ----------------
export function g1(seed, opts) {
  const model = generateModel(seed, opts);
  const schema = render(model);
  const errs = validate(ATLASSIAN, schema);
  if (errs.length) throw new Error(`G1 seed ${seed}: schema invalid against the Atlassian JSON Schema: ${JSON.stringify(errs.slice(0, 3))}`);
  return { seed: String(seed), model, schema, bytes: toBytes(schema), exp: expected(model) };
}
export function validateAtlassian(schema) { return validate(ATLASSIAN, schema); }

// ---------------- self-test / CLI ----------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  if (process.argv.includes('--selftest')) {
    const F = (p) => JSON.parse(readFileSync(join(ROOT, 'fixtures/jira-assets', p), 'utf8'));
    // fixture README: three files invalid against the Atlassian schema, all others valid
    const want = { 'minimal-organization.json': 0, 'synthetic-it-assets.json': 0, 'synthetic-it-assets-externalids.json': 0, 'hostile-separators.json': 0, 'hostile-placeholders.json': 0, 'invalid/missing-attribute-type.json': 1, 'invalid/unknown-attribute-type.json': 1, 'invalid/reference-without-target.json': 1, 'invalid/unknown-reference-target.json': 0, 'invalid/mapping-unknown-attribute.json': 0, 'invalid/duplicate-object-type-name.json': 0 };
    let bad = 0;
    for (const [f, n] of Object.entries(want)) { const e = validate(ATLASSIAN, F(f)); const ok = (e.length > 0) === (n > 0); if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}: ${e.length} error(s) ${JSON.stringify(e)}`); }
    const stats = { modes: {}, ident: {}, nested: [0, 0, 0], types: [Infinity, 0], maxDepth: 0, attrTypes: new Set(), selfRef: 0, ancRef: 0 };
    for (let i = 0; i < 500; i++) {
      const g = g1(`selftest-${i}`);
      stats.ident[g.exp.identification] = (stats.ident[g.exp.identification] || 0) + 1; stats.nested[g.exp.nNested]++;
      stats.types = [Math.min(stats.types[0], g.model.types.length), Math.max(stats.types[1], g.model.types.length)];
      const T = g.model.types; const d = (t) => (t.parent == null ? 1 : 1 + d(T[t.parent]));
      for (const t of T) { stats.maxDepth = Math.max(stats.maxDepth, d(t)); for (const a of t.attrs) { stats.attrTypes.add(a.type); if (a.target === t.id) stats.selfRef++; let p = t.parent; while (p != null) { if (a.target === p) { stats.ancRef++; break; } p = T[p].parent; } } }
    }
    console.log(JSON.stringify({ ...stats, attrTypes: [...stats.attrTypes].length }));
    process.exit(bad ? 1 : 0);
  } else {
    const g = g1(arg('--seed') || 'demo'); const out = arg('--out');
    if (out) writeFileSync(out, g.bytes); else process.stdout.write(g.bytes);
  }
}
