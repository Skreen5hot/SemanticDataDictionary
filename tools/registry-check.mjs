// Witness-registry audit (SDD §11, §12 FC-A): every governed file's sha256 recomputes to its registry value, the
// term list's terms_sha256 matches, and every 8-hex prefix cited in either spec document belongs to a full hash.
//
//   node tools/registry-check.mjs      exit 1 on any mismatch
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p));
const svc = read('spec/sdd-service.md').toString('utf8');
const all = svc + '\n' + read('spec/sdd-operator.md').toString('utf8');
const problems = [];
let rows = 0;
for (const m of svc.matchAll(/^\| `([^`]+)` \| [^|]+ \| `([0-9a-f]{64})` \|/gm)) {
  rows++;
  const actual = createHash('sha256').update(read(m[1])).digest('hex');
  if (actual !== m[2]) problems.push(`${m[1]}: registry ${m[2].slice(0, 8)}, file ${actual.slice(0, 8)}`);
}
const tl = JSON.parse(read('ontology/term-list.json').toString('utf8')).terms_sha256;
const cited = /`terms_sha256` `([0-9a-f]{64})`/.exec(svc)?.[1];
if (cited !== tl) problems.push(`term list: registry ${cited?.slice(0, 8)}, file ${tl.slice(0, 8)}`);
const full = [...all.matchAll(/[0-9a-f]{64}/g)].map((x) => x[0]);
for (const p of new Set([...all.matchAll(/`([0-9a-f]{8})`/g)].map((x) => x[1]))) {
  if (!full.some((f) => f.startsWith(p))) problems.push(`prefix ${p} cited in prose matches no full hash`);
}
if (problems.length) { for (const p of problems) console.log(p); process.exit(1); }
console.log(`ok: ${rows} registry rows and the term-list hash recompute; every cited prefix resolves`);
