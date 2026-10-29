// core/skeleton (C-S2): Inventory -> Skeleton. Pure. Rules: R-S3 (refuse errored), R-S4, R-S9, R-S16.

import { sha256Hex, fromUtf8, toU8, CONTEXT_IRI } from './canonical.mjs';

/** R-S9 value table (the 12 non-reference Jira types): the datatype only (v0.5: no value property). */
export const VALUE_TABLE = {
  text: 'xsd:string',
  textarea: 'xsd:string',
  email: 'xsd:string',
  select: 'xsd:string',
  ipaddress: 'xsd:string',
  url: 'xsd:anyURI',
  integer: 'xsd:integer',
  double: 'xsd:double',
  boolean: 'xsd:boolean',
  date: 'xsd:date',
  date_time: 'xsd:dateTime',
  time: 'xsd:string',
};

export class DomainError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    this.extra = extra;
  }
}
export class UsageError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
    this.detail = detail;
  }
}

export const MESSAGES = {
  'E-CTX-EXTERNAL': "The file's @context is not the bundled SDD context.",
};

/** Parse a JSON-LD artifact's bytes and enforce R-S16 without dereferencing anything. */
export function readJsonLd(bytes, what) {
  let text = fromUtf8(toU8(bytes));
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new UsageError('E-IO', `${what} is not readable JSON`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new UsageError('E-IO', `${what} is not a JSON object`);
  if (value['@context'] !== CONTEXT_IRI) {
    const ctx = value['@context'];
    throw new DomainError('E-CTX-EXTERNAL', {
      key: null, field: null, value: typeof ctx === 'string' ? ctx : ctx === undefined ? null : JSON.stringify(ctx),
      rule: 'R-S16', message: MESSAGES['E-CTX-EXTERNAL'],
    });
  }
  return value;
}

/** Slots in skeleton order: per object type, the type slot, its attribute/reference slots, its containment slots. */
export function buildSlots(inventory) {
  const slots = [];
  const containments = inventory.flags.filter((f) => f.code === 'FL-CONTAINMENT');
  for (const t of inventory.objectTypes) {
    slots.push({ key: t.key, kind: 'type', recordClass: null, referentClass: null });
    for (const a of inventory.attributes) {
      if (a.owner !== t.key) continue;
      if (a.type === 'referenced_object') {
        slots.push({ key: a.key, kind: 'reference', target: a.target, relation: null });
      } else {
        const datatype = VALUE_TABLE[a.type];
        if (!datatype) throw new UsageError('E-USAGE', `inventory attribute ${a.key} has unknown type ${a.type}`);
        slots.push({ key: a.key, kind: 'attribute', jiraType: a.type, datatype, iceClass: null });
      }
    }
    for (const f of containments) {
      if (f.key !== t.key) continue;
      slots.push({ key: 'ct:' + t.key, kind: 'containment', child: t.key, container: f.container, relation: null });
    }
  }
  return slots;
}

/** C-S2. Returns the Skeleton value; throws DomainError (exit 1) or UsageError (exit 2). */
export function buildSkeleton(inventoryBytes, termListSha256) {
  const inv = readJsonLd(inventoryBytes, 'inventory');
  if (!Array.isArray(inv.errors) || !Array.isArray(inv.objectTypes) || !Array.isArray(inv.attributes) || !Array.isArray(inv.flags)) {
    throw new UsageError('E-USAGE', 'inventory is not an Inventory');
  }
  if (inv.errors.length) throw new DomainError('E-SKEL-ERRORED', { key: null, field: null, value: null, rule: 'R-S3' });
  return {
    '@context': CONTEXT_IRI,
    '@type': 'Skeleton',
    inventorySha256: sha256Hex(toU8(inventoryBytes)),
    termListSha256,
    slots: buildSlots(inv),
  };
}
