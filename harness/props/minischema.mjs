// Minimal JSON Schema (draft 2019-09 subset) validator, written for the OS-3 harness to check that every G1 schema
// is valid against vendor/atlassian/assets-import-schema-2021_09_15.json. It implements exactly the assertion
// keywords that schema uses (type, required, properties, items, minItems, enum, const, if/then, minLength,
// maxLength, pattern, local $ref) and THROWS on any other keyword, so it can never silently skip an assertion.
// Annotation-only keywords are listed in ANNOTATIONS. Self-test: validSelfTest() (fixtures valid/invalid as the
// fixture README records them).
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$defs', 'contentMediaType', 'contentEncoding']);
const ASSERT = new Set(['type', 'required', 'properties', 'items', 'minItems', 'enum', 'const', 'if', 'then', 'minLength', 'maxLength', 'pattern', '$ref']);
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const typeOk = (v, t) => t === typeOf(v) || (t === 'number' && typeof v === 'number');
const ptr = (p) => p.map((s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).map((s) => '/' + s).join('');
const eqJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validate(root, value) {
  const errors = [];
  const resolve = (ref) => { if (!ref.startsWith('#/')) throw new Error('non-local $ref ' + ref); return ref.slice(2).split('/').reduce((o, k) => o[k], root); };
  function v(s, x, path, out) {
    for (const k of Object.keys(s)) if (!ANNOTATIONS.has(k) && !ASSERT.has(k)) throw new Error(`minischema: unsupported keyword ${k}`);
    if (s.$ref) v(resolve(s.$ref), x, path, out);
    if (s.type && !typeOk(x, s.type)) { out.push({ pointer: ptr(path), keyword: 'type', detail: s.type }); return; }
    if ('const' in s && !eqJson(x, s.const)) out.push({ pointer: ptr(path), keyword: 'const' });
    if (s.enum && !s.enum.some((e) => eqJson(e, x))) out.push({ pointer: ptr(path), keyword: 'enum', detail: x });
    if (typeof x === 'string') {
      const len = [...x].length;
      if (s.minLength != null && len < s.minLength) out.push({ pointer: ptr(path), keyword: 'minLength' });
      if (s.maxLength != null && len > s.maxLength) out.push({ pointer: ptr(path), keyword: 'maxLength' });
      if (s.pattern && !new RegExp(s.pattern, 'u').test(x)) out.push({ pointer: ptr(path), keyword: 'pattern' });
    }
    if (typeOf(x) === 'object') {
      for (const r of s.required || []) if (!(r in x)) out.push({ pointer: ptr(path), keyword: 'required', detail: r });
      for (const [k, ss] of Object.entries(s.properties || {})) if (k in x) v(ss, x[k], [...path, k], out);
    }
    if (Array.isArray(x)) {
      if (s.minItems != null && x.length < s.minItems) out.push({ pointer: ptr(path), keyword: 'minItems' });
      if (s.items) x.forEach((it, i) => v(s.items, it, [...path, i], out));
    }
    if (s.if) { const t = []; v(s.if, x, path, t); if (t.length === 0 && s.then) v(s.then, x, path, out); }
  }
  v(root, value, [], errors);
  return errors;
}
