// core/parse (C-S1): Jira Assets import schema bytes -> Inventory. Pure.
// Rules: R-S1 (canonical), R-S2 (keys), R-S3 (validation), R-S4 (hierarchy vs containment), R-S19 (flags).

import { sha256Hex, fromUtf8, toU8, esc, cmp, CONTEXT_IRI } from './canonical.mjs';
import { validate } from './jsonschema.mjs';

export const SOURCE_FORMAT = 'jira-assets-import/2021_09_15';

const FLAG_ORDER = [
  'FL-CONTAINMENT',
  'FL-INHERITED-USE',
  'FL-NO-LABEL',
  'FL-SELECT-VALUES-UNKNOWN',
  'FL-UNMAPPED-TYPE',
  'FL-KEY-SCHEME-CHANGED',
];

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);

function inventoryShell(sha, schemaName, identification) {
  return {
    '@context': CONTEXT_IRI,
    '@type': 'Inventory',
    source: { format: SOURCE_FORMAT, sha256: sha, schemaName, identification },
    objectTypes: [],
    attributes: [],
    flags: [],
    errors: [],
  };
}

/** Flatten the object-type tree depth-first, pre-order (document order). Defensive against bad shapes. */
function flattenTypes(objectSchema) {
  const out = [];
  const visit = (list, parentIdx) => {
    for (const t of arr(list)) {
      if (!isObj(t)) continue;
      const idx = out.length;
      out.push({ raw: t, parentIdx, attrs: arr(t.attributes).filter(isObj) });
      visit(t.children, idx);
    }
  };
  visit(isObj(objectSchema) ? objectSchema.objectTypes : null, null);
  return out;
}

function identificationOf(types) {
  let withId = 0, total = 0;
  for (const t of types) {
    total++; if (isStr(t.raw.externalId)) withId++;
    for (const a of t.attrs) { total++; if (isStr(a.externalId)) withId++; }
  }
  if (total > 0 && withId === total) return 'externalId';
  if (withId === 0) return 'name';
  return 'mixed';
}

/**
 * FL-CONTAINMENT flags (R-S4), in mapping order: a selector nested under another mapped type's selector
 * ("P.rest"); the longest such P names the container; the type's own mappings are not candidates.
 */
function containmentsOf(resolvedMappings) {
  const out = [];
  for (const { m, type: t } of resolvedMappings) {
    let best = null;
    for (const other of resolvedMappings) {
      if (other.type === t) continue;
      const p = other.m.selector;
      if (m.selector.startsWith(p + '.') && (!best || p.length > best.m.selector.length)) best = other;
    }
    if (best && !out.some((f) => f.key === t.key && f.selector === m.selector)) {
      out.push({ code: 'FL-CONTAINMENT', key: t.key, container: best.type.key, selector: m.selector });
    }
  }
  return out;
}

/**
 * C-S1. `schemaBytes`: the source file bytes. `atlassianSchema`: the vendored JSON Schema (parsed value).
 * Returns the Inventory value (errors, if any, are inside it; R-S3).
 */
export function parseSchema(schemaBytes, atlassianSchema) {
  const bytes = toU8(schemaBytes);
  const sha = sha256Hex(bytes);
  let text = fromUtf8(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    const inv = inventoryShell(sha, null, 'name');
    inv.errors.push({ code: 'E-SRC-SHAPE', pointer: '', keyword: 'json', detail: null });
    return inv;
  }

  const objectSchema = isObj(doc) && isObj(doc.schema) ? doc.schema.objectSchema : undefined;
  const types = flattenTypes(objectSchema);
  const schemaName = isObj(objectSchema) && isStr(objectSchema.name) ? objectSchema.name : null;
  const inv = inventoryShell(sha, schemaName, identificationOf(types));

  // R-S3 step 1: vendored Atlassian schema; every failure, no umbrella if/then errors.
  const shapeErrors = validate(atlassianSchema, doc);
  if (shapeErrors.length) {
    for (const e of shapeErrors) inv.errors.push({ code: 'E-SRC-SHAPE', pointer: e.pointer, keyword: e.keyword, detail: e.detail });
    return inv;
  }

  // ---- keys (R-S2) ----
  for (const t of types) {
    t.name = t.raw.name;
    t.externalId = isStr(t.raw.externalId) ? t.raw.externalId : null;
    t.key = 'ot:' + esc(t.externalId ?? t.name);
  }
  for (const t of types) {
    t.parent = t.parentIdx === null ? null : types[t.parentIdx];
    t.attrItems = t.attrs.map((a) => ({
      raw: a,
      owner: t,
      name: a.name,
      externalId: isStr(a.externalId) ? a.externalId : null,
      key: isStr(a.externalId) ? 'at:' + esc(a.externalId) : 'at:' + esc(t.name) + '/' + esc(a.name),
      locators: [],
      isIdentityPart: false,
    }));
  }
  const allAttrs = types.flatMap((t) => t.attrItems);
  const typeByName = new Map();
  for (const t of types) if (!typeByName.has(t.name)) typeByName.set(t.name, t);

  const ancestors = (t) => { const out = []; for (let p = t.parent; p; p = p.parent) out.push(p); return out; };
  // Resolve an attribute name on a type: own first, then nearest ancestor (R-S4).
  const resolveAttr = (t, name) => {
    for (const x of [t, ...ancestors(t)]) {
      const a = x.attrItems.find((ai) => ai.name === name);
      if (a) return a;
    }
    return null;
  };

  // ---- cross-reference checks (R-S3 step 2), reported in the R-S3 listing order ----
  const errRef = [], errMapType = [], errMapAttr = [], errDupType = [], errDupAttr = [], errColl = [];

  for (const a of allAttrs) {
    if (a.raw.type === 'referenced_object' && !typeByName.has(a.raw.referenceObjectTypeName)) {
      errRef.push({ code: 'E-SRC-REF-TARGET', key: a.key, value: a.raw.referenceObjectTypeName });
    }
  }

  const mappings = isObj(doc.mapping) ? arr(doc.mapping.objectTypeMappings) : [];
  const resolvedMappings = [];
  for (const m of mappings) {
    const t = typeByName.get(m.objectTypeName);
    if (!t) { errMapType.push({ code: 'E-SRC-MAP-TYPE', key: null, value: m.objectTypeName }); continue; }
    const uses = [];
    for (const am of arr(m.attributesMapping)) {
      const a = resolveAttr(t, am.attributeName);
      if (!a) { errMapAttr.push({ code: 'E-SRC-MAP-ATTR', key: t.key, value: am.attributeName }); continue; }
      uses.push({ attr: a, am });
    }
    resolvedMappings.push({ m, type: t, uses });
  }

  const seenType = new Map(); const dupKeys = new Set();
  for (const t of types) {
    if (seenType.has(t.name)) {
      if (seenType.get(t.name) === 1) { errDupType.push({ code: 'E-SRC-DUP-TYPE', key: t.key }); dupKeys.add(t.key); }
      seenType.set(t.name, seenType.get(t.name) + 1);
    } else seenType.set(t.name, 1);
  }
  for (const t of types) {
    const seen = new Map();
    for (const a of t.attrItems) {
      if (seen.has(a.name)) {
        if (seen.get(a.name) === 1) { errDupAttr.push({ code: 'E-SRC-DUP-ATTR', key: a.key }); dupKeys.add(a.key); }
        seen.set(a.name, seen.get(a.name) + 1);
      } else seen.set(a.name, 1);
    }
  }
  const keyCount = new Map();
  for (const item of [...types, ...allAttrs]) keyCount.set(item.key, (keyCount.get(item.key) || 0) + 1);
  for (const [k, n] of keyCount) {
    if (n > 1 && !dupKeys.has(k)) errColl.push({ code: 'E-SRC-KEY-COLLISION', key: k });
  }
  // R-S2 (Decision C): each FL-CONTAINMENT becomes one containment slot keyed `ct:` + the contained type's key,
  // so two of them for one type (e.g. a type mapped under two containers) collide on that key.
  const containments = containmentsOf(resolvedMappings);
  const ctCount = new Map();
  for (const c of containments) ctCount.set('ct:' + c.key, (ctCount.get('ct:' + c.key) || 0) + 1);
  for (const [k, n] of ctCount) {
    if (n > 1 && !dupKeys.has(k)) errColl.push({ code: 'E-SRC-KEY-COLLISION', key: k });
  }

  const errors = [...errRef, ...errMapType, ...errMapAttr, ...errDupType, ...errDupAttr, ...errColl];
  if (errors.length) {
    inv.errors = errors;
    return inv;
  }

  // ---- usage facts from mappings ----
  for (const t of types) { t.selectors = []; t.identity = []; t.inherited = new Set(); t.mapped = false; }
  for (const { m, type: t, uses } of resolvedMappings) {
    t.mapped = true;
    if (!t.selectors.includes(m.selector)) t.selectors.push(m.selector);
    for (const { attr, am } of uses) {
      for (const loc of arr(am.attributeLocators)) if (!attr.locators.includes(loc)) attr.locators.push(loc);
      if (am.externalIdPart === true) {
        attr.isIdentityPart = true;
        if (!t.identity.includes(attr.key)) t.identity.push(attr.key);
      }
      if (attr.owner !== t) t.inherited.add(attr.name);
    }
  }

  // ---- flags (R-S4, R-S19) ----
  const flags = [];
  flags.push(...containments);
  for (const t of types) {
    if (t.inherited.size) flags.push({ code: 'FL-INHERITED-USE', key: t.key, attributes: [...t.inherited].sort(cmp) });
  }
  for (const t of types) {
    const hasLabel = [t, ...ancestors(t)].some((x) => x.attrItems.some((a) => a.raw.label === true));
    if (!hasLabel) flags.push({ code: 'FL-NO-LABEL', key: t.key });
  }
  for (const a of allAttrs) if (a.raw.type === 'select') flags.push({ code: 'FL-SELECT-VALUES-UNKNOWN', key: a.key });
  for (const t of types) if (!t.mapped) flags.push({ code: 'FL-UNMAPPED-TYPE', key: t.key });
  const order = (c) => { const i = FLAG_ORDER.indexOf(c); return i < 0 ? FLAG_ORDER.length : i; };
  flags.sort((x, y) => order(x.code) - order(y.code) || cmp(x.key ?? '', y.key ?? ''));

  // ---- assemble ----
  inv.objectTypes = types.map((t) => {
    const labelAttr = t.attrItems.find((a) => a.raw.label === true);
    return {
      key: t.key,
      name: t.name,
      externalId: t.externalId,
      description: t.raw.description,
      parent: t.parent ? t.parent.key : null,
      label: labelAttr ? labelAttr.key : null,
      identity: t.identity,
      selectors: t.selectors,
    };
  });
  inv.attributes = allAttrs.map((a) => ({
    key: a.key,
    name: a.name,
    externalId: a.externalId,
    owner: a.owner.key,
    description: a.raw.description,
    type: a.raw.type,
    target: a.raw.type === 'referenced_object' ? typeByName.get(a.raw.referenceObjectTypeName).key : null,
    isLabel: a.raw.label === true,
    isIdentityPart: a.isIdentityPart,
    locators: a.locators,
  }));
  inv.flags = flags;
  return inv;
}
