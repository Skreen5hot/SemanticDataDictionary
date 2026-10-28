// Minimal JSON Schema validator: exactly the keyword subset used by the vendored Atlassian import schema
// (draft 2019-09) and schemas/proposal-v1.schema.json (draft 2020-12). Pure.
//
// Supported: boolean schemas, $ref (local "#/..." pointers only), type, enum, const, minLength, maxLength,
// pattern, required, properties, additionalProperties, items (single schema), minItems, if/then/else.
// Annotation-only keywords (title, description, $schema, $id, contentMediaType, contentEncoding) are ignored.
//
// Errors: {pointer, keyword, detail}, in a deterministic traversal order:
//   per instance node: type (stops the node on failure), enum, const, minLength, maxLength, pattern,
//   required (in the schema's array order), if/then/else (only the nested errors of then/else are reported,
//   never an umbrella error, R-S3), properties/additionalProperties (in instance key order), minItems, items.

import { esc } from './canonical.mjs';

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v; // string, boolean, object
}

function typeMatches(v, t) {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#')) throw new Error(`external $ref not supported: ${ref}`);
  const parts = ref.slice(1).split('/').slice(1).map((p) => decodeURIComponent(p).replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = root;
  for (const p of parts) {
    if (node == null || !(p in node)) throw new Error(`unresolvable $ref: ${ref}`);
    node = node[p];
  }
  return node;
}

function codePointLength(s) {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/**
 * Validate `instance` against `schema`. Returns an array of errors (empty when valid).
 * With {firstOnly: true}, returns at most the first error in traversal order.
 */
export function validate(schema, instance, { firstOnly = false } = {}) {
  const errors = [];
  const STOP = Symbol('stop');
  const push = (e) => {
    errors.push(e);
    if (firstOnly) throw STOP;
  };
  const patternCache = new Map();
  const re = (p) => {
    if (!patternCache.has(p)) patternCache.set(p, new RegExp(p, 'u'));
    return patternCache.get(p);
  };

  // Returns true when the node validates; errors are pushed to `sink`.
  function walk(s, v, ptr, sink) {
    if (s === true || s === undefined) return true;
    if (s === false) { sink({ pointer: ptr, keyword: 'false schema', detail: null }); return false; }
    let ok = true;
    const fail = (e) => { ok = false; sink(e); };

    if (typeof s.$ref === 'string') {
      if (!walk(resolveRef(schema, s.$ref), v, ptr, sink)) ok = false;
    }
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      if (!types.some((t) => typeMatches(v, t))) {
        fail({ pointer: ptr, keyword: 'type', detail: types.join(',') });
        return false;
      }
    }
    if (Array.isArray(s.enum) && !s.enum.some((x) => deepEqual(x, v))) fail({ pointer: ptr, keyword: 'enum', detail: v });
    if ('const' in s && !deepEqual(s.const, v)) fail({ pointer: ptr, keyword: 'const', detail: v });
    if (typeof v === 'string') {
      if (typeof s.minLength === 'number' && codePointLength(v) < s.minLength) fail({ pointer: ptr, keyword: 'minLength', detail: v });
      if (typeof s.maxLength === 'number' && codePointLength(v) > s.maxLength) fail({ pointer: ptr, keyword: 'maxLength', detail: v });
      if (typeof s.pattern === 'string' && !re(s.pattern).test(v)) fail({ pointer: ptr, keyword: 'pattern', detail: v });
    }
    const isObj = typeOf(v) === 'object';
    if (isObj && Array.isArray(s.required)) {
      for (const r of s.required) {
        if (!Object.prototype.hasOwnProperty.call(v, r)) fail({ pointer: ptr, keyword: 'required', detail: r });
      }
    }
    if (s.if !== undefined) {
      // Evaluate `if` silently; report only the nested causes from then/else (R-S3).
      const ifOk = walk(s.if, v, ptr, () => {});
      const branch = ifOk ? s.then : s.else;
      if (branch !== undefined && !walk(branch, v, ptr, sink)) ok = false;
    }
    if (isObj && (s.properties !== undefined || s.additionalProperties !== undefined)) {
      const props = s.properties || {};
      for (const k of Object.keys(v)) {
        const childPtr = ptr + '/' + esc(k);
        if (Object.prototype.hasOwnProperty.call(props, k)) {
          if (!walk(props[k], v[k], childPtr, sink)) ok = false;
        } else if (s.additionalProperties === false) {
          fail({ pointer: ptr, keyword: 'additionalProperties', detail: k });
        } else if (s.additionalProperties !== undefined && s.additionalProperties !== true) {
          if (!walk(s.additionalProperties, v[k], childPtr, sink)) ok = false;
        }
      }
    }
    if (Array.isArray(v)) {
      if (typeof s.minItems === 'number' && v.length < s.minItems) fail({ pointer: ptr, keyword: 'minItems', detail: v.length });
      if (s.items !== undefined && !Array.isArray(s.items)) {
        v.forEach((item, i) => { if (!walk(s.items, item, ptr + '/' + i, sink)) ok = false; });
      }
    }
    return ok;
  }

  try {
    walk(schema, instance, '', push);
  } catch (e) {
    if (e !== STOP) throw e;
  }
  return errors;
}
