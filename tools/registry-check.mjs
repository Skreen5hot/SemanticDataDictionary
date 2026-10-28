// Witness-registry audit (SDD §11, §12 FC-A).
//   - every registry row (current and superseded tables) recomputes from its file's bytes;
//   - the term list's terms_sha256 matches the registry;
//   - COMPLETENESS (SDD-F59): every governed file (fixtures/** except READMEs, spec/prompt-template-*.txt,
//     schemas/**) has a row in the current table, and every retained file under fixtures/witnesses/superseded/** has
//     a row in the superseded table;
//   - every 8-hex prefix cited in either spec document resolves to a full registry hash;
//   - the "Cited by" column equals the citers derived under SDD §11 citation rule item (7) (SDD-F68): an artifact cites a
//     file iff one of its blocks names the file's repository path or its path relative to fixtures/witnesses/ or
//     fixtures/jira-assets/. Matching is on whole relative paths, never base names.
//
//   node tools/registry-check.mjs           exit 1 on any mismatch
//   node tools/registry-check.mjs --write   regenerate the "Cited by" column, then check
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { SDD_ID, OPR_ID, SEAM, blocks, citingArtifact, isRegistryRow } from './lib/spec-blocks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p));
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const walk = (d) => existsSync(d) ? readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }) : [];
const SVC = 'spec/sdd-service.md';
const ROW = /^(\| `([^`]+)` \| [^|]+ \| `[0-9a-f]{64}` \| )([^|]*?)( \|)$/;
const nat = (a, b) => a.localeCompare(b, 'en', { numeric: true });

// Citers of each registry file, per rule item (7): a block cites a file iff its text names, anywhere (inside a code
// span or not), the repository path or the path relative to fixtures/witnesses/ or fixtures/jira-assets/, as a whole
// path (never a suffix of a longer path or a prefix of a longer name). The reciprocal tables name no files.
function citers() {
  const files = [...read(SVC).toString('utf8').matchAll(/^\| `([^`]+)` \| [^|]+ \| `[0-9a-f]{64}` \|/gm)].map((m) => m[1]);
  const forms = files.map((f) => [f, [f, ...['fixtures/witnesses/', 'fixtures/jira-assets/'].filter((r) => f.startsWith(r)).map((r) => f.slice(r.length))]
    .map((s) => new RegExp(`(?<![\\w./-])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-]|\\.\\w)`))]);
  const by = {};
  for (const [doc, name, localRe] of [[SVC, 'SDD', SDD_ID], ['spec/sdd-operator.md', 'SDD-operator', OPR_ID]]) {
    for (const b of blocks(read(doc).toString('utf8'), name)) {
      if (isRegistryRow(b)) continue;
      const seam = SEAM.exec(b.text);
      const who = seam ? seam[1] : citingArtifact(b, localRe);
      for (const [f, res] of forms) if (res.some((re) => re.test(b.text))) (by[f] = by[f] || new Set()).add(who);
    }
  }
  return by;
}
if (process.argv.includes('--write')) {
  const by = citers();
  const text = read(SVC).toString('utf8').split('\n').map((l) => {
    const m = ROW.exec(l);
    return m && !m[2].includes('/superseded/') ? m[1] + [...(by[m[2]] || [])].sort(nat).join(', ') + m[4] : l;
  }).join('\n');
  writeFileSync(join(ROOT, SVC), text);
}
const svc = read(SVC).toString('utf8');
const all = svc + '\n' + read('spec/sdd-operator.md').toString('utf8');
const problems = [];
const listed = new Set();
let rows = 0;
for (const m of svc.matchAll(/^\| `([^`]+)` \| [^|]+ \| `([0-9a-f]{64})` \|/gm)) {
  rows++; listed.add(m[1]);
  if (!existsSync(join(ROOT, m[1]))) { problems.push(`${m[1]}: listed but missing`); continue; }
  const actual = createHash('sha256').update(read(m[1])).digest('hex');
  if (actual !== m[2]) problems.push(`${m[1]}: registry ${m[2].slice(0, 8)}, file ${actual.slice(0, 8)}`);
}
const tl = JSON.parse(read('ontology/term-list.json').toString('utf8')).terms_sha256;
const cited = /`terms_sha256` `([0-9a-f]{64})`/.exec(svc)?.[1];
if (cited !== tl) problems.push(`term list: registry ${cited?.slice(0, 8)}, file ${tl.slice(0, 8)}`);
const governed = [
  ...walk(join(ROOT, 'fixtures')).map(rel).filter((r) => !r.endsWith('README.md')),
  ...walk(join(ROOT, 'spec')).map(rel).filter((r) => /prompt-template-.*\.txt$/.test(r)),
  ...walk(join(ROOT, 'schemas')).map(rel),
];
for (const r of governed) if (!listed.has(r)) problems.push(`${r}: governed file with no registry row`);
// Prefixes must resolve to a CURRENT hash: superseded rows are excluded, so a stale prefix cannot hide behind a retained file.
const full = [...svc.matchAll(/^\| `([^`]+)` \| [^|]+ \| `([0-9a-f]{64})` \|/gm)].filter((m) => !m[1].includes('/superseded/')).map((m) => m[2]).concat(tl);
for (const p of new Set([...all.matchAll(/`([0-9a-f]{8})`/g)].map((x) => x[1]))) {
  if (!full.some((f) => f.startsWith(p))) problems.push(`prefix ${p} cited in prose matches no full hash`);
}
{
  const by = citers();
  for (const l of svc.split('\n')) {
    const m = ROW.exec(l);
    if (!m || m[2].includes('/superseded/')) continue;
    const want = [...(by[m[2]] || [])].sort(nat).join(', ');
    if (!want) problems.push(`${m[2]}: no artifact cites it`);
    else if (m[3] !== want) problems.push(`${m[2]}: "Cited by" is [${m[3]}], the rule derives [${want}]`);
  }
}
if (problems.length) { for (const p of problems) console.log(p); process.exit(1); }
console.log(`ok: ${rows} registry rows recompute (current and superseded), the term-list hash matches, all ${governed.length} governed files are listed, every cited prefix resolves, every "Cited by" cell matches the rule`);
