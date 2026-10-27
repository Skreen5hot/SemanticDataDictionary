// Independent-oracle check for CheckReport witnesses. The oracle (tools/oracle/oracle-b.cjs) is the `check` function
// written by an isolated cycle-3 rater from spec v0.3 alone, kept byte-for-byte. It shares no code or assumptions
// with the witness generator. For every CheckReport witness this harness feeds the oracle the report's own prompt
// (its DATA slots) and paste, and requires the oracle's errors and warnings, as (code, key) in order, to equal the
// report's. Reports whose outcome is decided before field checks (E-CHK-JSON, -SHAPE, -SKELETON, -BATCH) are out of
// the oracle's scope and are listed as such.
//
//   node tools/oracle-check.mjs     exit 1 on any disagreement
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const oracle = createRequire(import.meta.url)('./oracle/oracle-b.cjs');
const tl = JSON.parse(readFileSync(join(ROOT, 'ontology/term-list.json'), 'utf8'));
oracle.setTerms(Object.fromEntries(tl.terms.map((x) => [x.curie, x])), Object.fromEntries(tl.terms.map((x) => [x.iri, x])));

const sha = (b) => createHash('sha256').update(b).digest('hex');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(join(ROOT, 'fixtures/witnesses')).filter((p) => !p.includes(`${sep}superseded${sep}`));
const byHash = new Map(files.map((p) => [sha(readFileSync(p)), p]));
const extract = (t) => { try { return JSON.parse(t.trim()); } catch { const m = [...t.matchAll(/```json\n([\s\S]*?)```/g)]; return m.length === 1 ? JSON.parse(m[0][1]) : null; } };
const slots = (prompt) => { const i = prompt.indexOf('-----BEGIN DATA (untrusted)-----\n') + 33; return prompt.slice(i, prompt.indexOf('\n-----END DATA-----', i)).split('\n').filter(Boolean).map((l) => JSON.parse(l)); };
const PRE = new Set(['E-CHK-JSON', 'E-CHK-SHAPE', 'E-CHK-SKELETON', 'E-CHK-BATCH']);

const problems = []; let compared = 0, outOfScope = 0;
for (const p of files.filter((f) => f.endsWith('.jsonld'))) {
  const rep = JSON.parse(readFileSync(p, 'utf8'));
  if (rep['@type'] !== 'CheckReport') continue;
  const name = relative(ROOT, p).split(sep).join('/');
  if (rep.errors.some((e) => PRE.has(e.code))) { outOfScope++; continue; }
  const pr = byHash.get(rep.promptSha256), pa = byHash.get(rep.proposalSha256);
  if (!pr || !pa) { problems.push(`${name}: its prompt or paste is not a current witness file`); continue; }
  const r = oracle.check(slots(readFileSync(pr, 'utf8')), extract(readFileSync(pa, 'utf8')));
  const want = (xs) => xs.map((e) => `${e[0]} ${e[1]}`).join(' | ');
  const have = (xs) => xs.map((e) => `${e.code} ${e.key}`).join(' | ');
  if (want(r.errs) !== have(rep.errors)) problems.push(`${name}: errors\n    oracle: ${want(r.errs) || '(none)'}\n    report: ${have(rep.errors) || '(none)'}`);
  if (want(r.warns) !== have(rep.warnings)) problems.push(`${name}: warnings\n    oracle: ${want(r.warns) || '(none)'}\n    report: ${have(rep.warnings) || '(none)'}`);
  if ((rep.status === 'validated') !== (r.errs.length === 0)) problems.push(`${name}: status ${rep.status}, oracle finds ${r.errs.length} error(s)`);
  compared++;
}
if (problems.length) { for (const p of problems) console.log(p); process.exit(1); }
console.log(`ok: ${compared} CheckReport witnesses agree with the independent oracle (errors, warnings, order, status); ${outOfScope} out of its scope`);
