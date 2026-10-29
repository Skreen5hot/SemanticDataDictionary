// Shared helpers for v-s.mjs: hashing, canonical form, result recording, the chain steps.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sdd, stderrCode, brief } from './run.mjs';

export const sha = (b) => createHash('sha256').update(b).digest('hex');
export const canon = (v) => JSON.stringify(v, null, 2) + '\n';
export const isCanonical = (buf) => { try { return canon(JSON.parse(buf.toString('utf8'))) === buf.toString('utf8'); } catch { return false; } };
export const rd = (p) => readFileSync(p);
export const rj = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const wr = (p, b) => writeFileSync(p, b);
export const CTX = 'https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld';
export const AT_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
export function dirFiles(d) { if (!existsSync(d)) return null; const o = {}; for (const f of readdirSync(d).sort()) { const p = join(d, f); if (statSync(p).isFile()) o[f] = readFileSync(p); } return o; }
export function sameDir(a, b) {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  if (ka.join('|') !== kb.join('|')) return `file sets differ: ${ka} vs ${kb}`;
  for (const k of ka) if (Buffer.compare(a[k], b[k]) !== 0) return `${k} differs: ${firstDiff(a[k], b[k])}`;
  return true;
}
export function firstDiff(a, b) { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return `at byte ${i} (${a.length} vs ${b.length} bytes): ${JSON.stringify(a.subarray(i, i + 50).toString())} vs ${JSON.stringify(b.subarray(i, i + 50).toString())}`; }
export const mkdirp = (d) => { mkdirSync(d, { recursive: true }); return d; };

// ---------- result recorder ----------
export class Prop {
  constructor(id, statement) { this.id = id; this.statement = statement; this.cases = 0; this.casePass = 0; this.caseFail = 0; this.clauses = {}; this.failures = []; this.seeds = []; this.notChecked = []; this.notes = []; this.t0 = Date.now(); this.extra = {}; }
  clause(name) { return (this.clauses[name] ||= { pass: 0, fail: 0 }); }
  begin(seed) { this.seeds.push(seed); return { seed, ok: true }; }
  check(c, clause, ok, info = {}) {
    const cl = this.clause(clause);
    if (ok === true) { cl.pass++; return true; }
    cl.fail++; c.ok = false;
    if (this.failures.length < 400) this.failures.push({ clause, seed: c.seed, detail: typeof ok === 'string' ? ok.slice(0, 800) : String(ok), ...info });
    return false;
  }
  end(c) { this.cases++; if (c.ok) this.casePass++; else this.caseFail++; }
  json() { return { id: this.id, statement: this.statement, n: this.cases, pass: this.casePass, fail: this.caseFail, clauses: this.clauses, failures: this.failures, failuresTruncated: this.failures.length >= 400, notChecked: this.notChecked, notes: this.notes, extra: this.extra, seeds: this.seeds, ms: Date.now() - this.t0 }; }
}
export { sdd, stderrCode, brief };

// item hashes (R-S1): objectTypes / attributes entries; containment = its FL-CONTAINMENT flag (witness-derived:
// full/sdd.jsonld's containment itemSha256 equals the sha256 of that flag's R-S1 bytes; R-S1 does not say so).
export function itemHashes(inv) {
  const h = new Map();
  for (const o of inv.objectTypes || []) h.set(o.key, sha(canon(o)));
  for (const a of inv.attributes || []) h.set(a.key, sha(canon(a)));
  for (const f of inv.flags || []) if (f.code === 'FL-CONTAINMENT') h.set('ct:' + f.key, sha(canon(f)));
  return h;
}
