// Independent-oracle check for CheckReport witnesses. Two oracles, each a `check` function written by an isolated rater
// from the spec alone and kept byte-for-byte; neither shares code or assumptions with the witness generator:
//   oracle-b (tools/oracle/oracle-b.cjs): cycle-3 rater B, from spec v0.3. It predates SDD v0.5's `null` iceClass
//     (R-S5), so it judges every report whose reply has no null iceClass.
//   oracle-n (tools/oracle/oracle-n.cjs): an isolated rater, from spec v0.5 (2026-10-29). It judges every report.
// For every CheckReport witness this harness feeds each applicable oracle the report's own prompt (its DATA slots) and
// paste, and requires its errors and warnings, as (code, key) in order, to equal the report's. Reports whose outcome is
// decided before field checks (E-CHK-JSON, -SHAPE, -SKELETON, -BATCH) are out of both oracles' scope and are listed as
// such.
//
//   node tools/oracle-check.mjs     exit 1 on any disagreement
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ORACLES = { 'oracle-b': require('./oracle/oracle-b.cjs'), 'oracle-n': require('./oracle/oracle-n.cjs') };
const tl = JSON.parse(readFileSync(join(ROOT, 'ontology/term-list.json'), 'utf8'));
for (const o of Object.values(ORACLES)) o.setTerms(Object.fromEntries(tl.terms.map((x) => [x.curie, x])), Object.fromEntries(tl.terms.map((x) => [x.iri, x])));

const sha = (b) => createHash('sha256').update(b).digest('hex');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(join(ROOT, 'fixtures/witnesses')).filter((p) => !p.includes(`${sep}superseded${sep}`));
const byHash = new Map(files.map((p) => [sha(readFileSync(p)), p]));
const extract = (t) => { try { return JSON.parse(t.trim()); } catch { const m = [...t.matchAll(/```json\n([\s\S]*?)```/g)]; return m.length === 1 ? JSON.parse(m[0][1]) : null; } };
const slots = (prompt) => { const i = prompt.indexOf('-----BEGIN DATA (untrusted)-----\n') + 33; return prompt.slice(i, prompt.indexOf('\n-----END DATA-----', i)).split('\n').filter(Boolean).map((l) => JSON.parse(l)); };
const PRE = new Set(['E-CHK-JSON', 'E-CHK-SHAPE', 'E-CHK-SKELETON', 'E-CHK-BATCH']);
const hasNullIce = (prop) => Array.isArray(prop.mappings) && prop.mappings.some((m) => m && m.iceClass === null);

const problems = []; let outOfScope = 0;
const compared = { 'oracle-b': 0, 'oracle-n': 0 };
for (const p of files.filter((f) => f.endsWith('.jsonld'))) {
  const rep = JSON.parse(readFileSync(p, 'utf8'));
  if (rep['@type'] !== 'CheckReport') continue;
  const name = relative(ROOT, p).split(sep).join('/');
  if (rep.errors.some((e) => PRE.has(e.code))) { outOfScope++; continue; }
  const pr = byHash.get(rep.promptSha256), pa = byHash.get(rep.proposalSha256);
  if (!pr || !pa) { problems.push(`${name}: its prompt or paste is not a current witness file`); continue; }
  const prop = extract(readFileSync(pa, 'utf8'));
  for (const [id, oracle] of Object.entries(ORACLES)) {
    if (id === 'oracle-b' && hasNullIce(prop)) continue; // outside the v0.3 rater's spec
    const r = oracle.check(slots(readFileSync(pr, 'utf8')), JSON.parse(JSON.stringify(prop)));
    const want = (xs) => xs.map((e) => `${e[0]} ${e[1]}`).join(' | ');
    const have = (xs) => xs.map((e) => `${e.code} ${e.key}`).join(' | ');
    if (want(r.errs) !== have(rep.errors)) problems.push(`${name}: errors (${id})\n    oracle: ${want(r.errs) || '(none)'}\n    report: ${have(rep.errors) || '(none)'}`);
    if (want(r.warns) !== have(rep.warnings)) problems.push(`${name}: warnings (${id})\n    oracle: ${want(r.warns) || '(none)'}\n    report: ${have(rep.warnings) || '(none)'}`);
    if ((rep.status === 'validated') !== (r.errs.length === 0)) problems.push(`${name}: status ${rep.status}, ${id} finds ${r.errs.length} error(s)`);
    compared[id]++;
  }
}
if (problems.length) { for (const p of problems) console.log(p); process.exit(1); }
console.log(`ok: CheckReport witnesses agree with the independent oracles (errors, warnings, order, status): oracle-b ${compared['oracle-b']}, oracle-n ${compared['oracle-n']}; ${outOfScope} out of their scope`);
