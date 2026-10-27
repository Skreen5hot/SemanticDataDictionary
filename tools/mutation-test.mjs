// Mutation test for the checks themselves (registrar direction, cycle 3: "checks can detect deliberately corrupted
// artifacts"). Copies the repository to a temporary directory, plants one corruption at a time, runs
//   tools/registry-check.mjs, tools/witness-check.mjs, tools/oracle-check.mjs, tools/citations.mjs
// and requires that at least one of them fails. Corruptions that would only trip the registry hash are also replayed
// with the registry row re-synchronised, the way SDD-F50 slipped through, so that the deeper checks must catch them.
//
//   node tools/mutation-test.mjs     exit 1 if the baseline fails or any corruption goes undetected
import { cpSync, readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = mkdtempSync(join(tmpdir(), 'sdd-mutation-'));
cpSync(SRC, T, { recursive: true, filter: (p) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(p) });
const CHECKS = ['registry-check', 'witness-check', 'oracle-check', 'citations'];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const rd = (r) => readFileSync(join(T, r));
const touched = new Map();
const wr = (r, b) => { if (!touched.has(r)) touched.set(r, existsSync(join(T, r)) ? readFileSync(join(T, r)) : null); writeFileSync(join(T, r), b); };
const restore = () => { for (const [r, b] of touched) { if (b === null) rmSync(join(T, r)); else writeFileSync(join(T, r), b); } touched.clear(); };
const edit = (r, fn) => { const s = rd(r).toString('utf8'); const t = fn(s); if (t === s) throw new Error(`mutation did not apply to ${r}`); wr(r, t); };
const resync = (r) => { const now = sha(rd(r)); edit('spec/sdd-service.md', (s) => s.replace(new RegExp('^(\\| `' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '` \\| [^|]+ \\| `)[0-9a-f]{64}', 'm'), '$1' + now)); };
function run() {
  const failed = [];
  for (const c of CHECKS) { try { execFileSync(process.execPath, [join(T, 'tools', c + '.mjs')], { cwd: T, stdio: 'ignore' }); } catch { failed.push(c); } }
  return failed;
}
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => relative(T, p).split(sep).join('/');
const LS = String.fromCharCode(0x2028);
const supSkeleton = walk(join(T, 'fixtures/witnesses/superseded')).map(rel).find((r) => r.endsWith('minimal/skeleton.jsonld'));

const MUTATIONS = [
  ['F50 replay: paste names a superseded skeleton (registry re-synced)', () => { const old = sha(rd(supSkeleton)); edit('fixtures/witnesses/minimal/proposal-pasted.txt', (s) => s.replace(/"skeletonSha256": "[0-9a-f]{64}"/, `"skeletonSha256": "${old}"`)); resync('fixtures/witnesses/minimal/proposal-pasted.txt'); }],
  ['F51 replay: SDD S-O1 seam row holds closure-report cells', () => edit('spec/sdd-service.md', (s) => s.replace(/^(\| \*\*S-O1\*\* \*\([^)]*\)\* \|).*$/m, '$1 FC-X | crossing examples, §8 | integration | §14.4 |'))],
  ['F52 replay: report errors listed out of R-S20 order (registry re-synced)', () => { edit('fixtures/witnesses/minimal/bad-check-report.jsonld', (s) => { const o = JSON.parse(s); o.errors.reverse(); return JSON.stringify(o, null, 2) + '\n'; }); resync('fixtures/witnesses/minimal/bad-check-report.jsonld'); }],
  ['report drops an error but stays rejected (registry re-synced)', () => { edit('fixtures/witnesses/minimal/bad-check-report.jsonld', (s) => { const o = JSON.parse(s); o.errors.pop(); return JSON.stringify(o, null, 2) + '\n'; }); resync('fixtures/witnesses/minimal/bad-check-report.jsonld'); }],
  ['report status contradicts its errors (registry re-synced)', () => { edit('fixtures/witnesses/minimal/check-report.jsonld', (s) => s.replace('"status": "validated"', '"status": "rejected"')); resync('fixtures/witnesses/minimal/check-report.jsonld'); }],
  ['SDD provenance round tampered (registry re-synced)', () => { edit('fixtures/witnesses/minimal/sdd.jsonld', (s) => s.replace('"round": 1', '"round": 9')); resync('fixtures/witnesses/minimal/sdd.jsonld'); }],
  ['SDD itemSha256 tampered (registry re-synced)', () => { edit('fixtures/witnesses/minimal/sdd.jsonld', (s) => s.replace(/("itemSha256": ")[0-9a-f]/, '$1' + 'f')); resync('fixtures/witnesses/minimal/sdd.jsonld'); }],
  ['raw U+2028 in a prompt\'s DATA (registry re-synced)', () => { edit('fixtures/witnesses/hostile/prompt.txt', (s) => s.replace('\\u2028', LS)); resync('fixtures/witnesses/hostile/prompt.txt'); }],
  ['catalogue line dropped from a prompt (registry re-synced)', () => { edit('fixtures/witnesses/minimal/prompt.txt', (s) => s.replace(/\ncco:ont00000077\t[^\n]*/, '')); resync('fixtures/witnesses/minimal/prompt.txt'); }],
  ['term-list label changed, terms_sha256 left alone', () => edit('ontology/term-list.json', (s) => s.replace('"label": "Code Identifier"', '"label": "Code Identifyer"'))],
  ['reciprocal table entry dropped', () => edit('spec/sdd-operator.md', (s) => s.replace(/^(\| W-CS6-N \| [^\n]*?), W-PRO1-N /m, '$1 '))],
  ['citation added in a scene but not recorded', () => edit('spec/sdd-operator.md', (s) => s.replace('- **W-PRO6-N:** ', '- **W-PRO6-N:** (see SDD R-S19) '))],
  ['stale 8-hex prefix in prose', () => { const old = sha(rd(supSkeleton)).slice(0, 8); edit('spec/sdd-service.md', (s) => s.replace(/(skeleton\.jsonld` \*\*`)[0-9a-f]{8}/, '$1' + old)); }],
  ['governed file added without a registry row', () => wr('fixtures/witnesses/minimal/extra.json', '{}\n')],
];
const witnessFiles = walk(join(T, 'fixtures')).map(rel).filter((r) => !r.includes('/superseded/') && !r.endsWith('README.md')).concat(['spec/prompt-template-v2.txt', 'schemas/proposal-v1.schema.json']);
for (const r of witnessFiles) MUTATIONS.push([`flip one byte: ${r}`, () => { const b = Buffer.from(rd(r)); b[Math.floor(b.length / 2)] ^= 1; wr(r, b); }]);

const results = [];
const base = run();
results.push(['baseline (no corruption)', base, base.length === 0]);
for (const [name, apply] of MUTATIONS) {
  apply();
  const failed = run();
  results.push([name, failed, failed.length > 0]);
  restore();
}
rmSync(T, { recursive: true, force: true });
let bad = 0;
for (const [name, failed, ok] of results) {
  if (!ok) bad++;
  if (!name.startsWith('flip one byte') || !ok) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ->  ${failed.length ? 'caught by ' + failed.join(', ') : 'nothing failed'}`);
}
const flips = results.filter(([n]) => n.startsWith('flip one byte'));
console.log(`PASS  byte flips: ${flips.filter((x) => x[2]).length}/${flips.length} governed files detected`);
console.log(bad ? `\n${bad} problem(s)` : `\nok: baseline clean; all ${results.length - 1} corruptions detected`);
process.exit(bad ? 1 : 0);
