// Mutation test for the checks themselves (registrar direction, cycle 3: "checks can detect deliberately corrupted
// artifacts"; corrected per the registrar's prop-002 review). Copies the repository to a temporary directory, plants one
// corruption at a time, and runs
//   tools/registry-check.mjs, tools/witness-check.mjs, tools/oracle-check.mjs, tools/citations.mjs
//
// Each corruption names the check EXPECTED to detect it. A corruption passes only if that check fails; failures of
// other checks are reported but never substitute for it. A corruption marked `resynced` also brings the registry row
// AND every prose prefix of the mutated file up to date (the way SDD-F50 slipped through); for it the registry check
// MUST pass, so detection cannot come from a hash or prose-prefix inconsistency. A control case proves the harness
// itself: a registry-only corruption that declares a semantic expectation must be classified as NOT detected.
//
//   node tools/mutation-test.mjs     exit 1 if the baseline fails, any corruption is missed, or the control misbehaves
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
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Bring the registry row and every 8-hex prose prefix of `r` up to date with its mutated bytes.
function resync(r, before) {
  const now = sha(rd(r));
  for (const doc of ['spec/sdd-service.md', 'spec/sdd-operator.md']) {
    const s = rd(doc).toString('utf8');
    let t = doc.endsWith('service.md') ? s.replace(new RegExp('^(\\| `' + reEsc(r) + '` \\| [^|]+ \\| `)[0-9a-f]{64}', 'm'), '$1' + now) : s;
    t = t.split('`' + before.slice(0, 8) + '`').join('`' + now.slice(0, 8) + '`');
    if (t !== s) wr(doc, t);
  }
}
function run() {
  const failed = [];
  for (const c of CHECKS) { try { execFileSync(process.execPath, [join(T, 'tools', c + '.mjs')], { cwd: T, stdio: 'ignore' }); } catch { failed.push(c); } }
  return failed;
}
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => relative(T, p).split(sep).join('/');
const LS = String.fromCharCode(0x2028);
const supSkeleton = walk(join(T, 'fixtures/witnesses/superseded')).map(rel).find((r) => r.endsWith('minimal/skeleton.jsonld'));
// Mutate a witness file, then resynchronise the registry and prose (detection must come from `expect`).
const witnessMut = (r, fn) => () => { const before = sha(rd(r)); edit(r, fn); resync(r, before); };
const json = (fn) => (s) => { const o = JSON.parse(s); fn(o); return JSON.stringify(o, null, 2) + '\n'; };

// [name, expected detecting check, resynced?, apply]
const MUTATIONS = [
  ['F50 replay: paste names a superseded skeleton', 'witness-check', true, witnessMut('fixtures/witnesses/minimal/proposal-pasted.txt', (s) => s.replace(/"skeletonSha256": "[0-9a-f]{64}"/, `"skeletonSha256": "${sha(rd(supSkeleton))}"`))],
  ['F51 replay: SDD S-O1 seam row holds closure-report cells', 'citations', false, () => edit('spec/sdd-service.md', (s) => s.replace(/^(\| \*\*S-O1\*\* \*\([^)]*\)\* \|).*$/m, '$1 FC-X | crossing examples, §8 | integration | §14.4 |'))],
  ['F52 replay: report errors out of R-S20 order', 'oracle-check', true, witnessMut('fixtures/witnesses/minimal/bad-check-report.jsonld', json((o) => o.errors.reverse()))],
  ['report drops an error but stays rejected', 'oracle-check', true, witnessMut('fixtures/witnesses/minimal/bad-check-report.jsonld', json((o) => o.errors.pop()))],
  ['report status contradicts its errors', 'witness-check', true, witnessMut('fixtures/witnesses/minimal/check-report.jsonld', (s) => s.replace('"status": "validated"', '"status": "rejected"'))],
  ['SDD provenance round tampered', 'witness-check', true, witnessMut('fixtures/witnesses/minimal/sdd.jsonld', (s) => s.replace('"round": 1', '"round": 9'))],
  ['SDD itemSha256 tampered', 'witness-check', true, witnessMut('fixtures/witnesses/minimal/sdd.jsonld', (s) => s.replace(/("itemSha256": ")[0-9a-f]/, '$1' + 'f'))],
  ['raw U+2028 in a prompt\'s DATA', 'witness-check', true, witnessMut('fixtures/witnesses/hostile/prompt.txt', (s) => s.replace('\\u2028', LS))],
  ['catalogue line dropped from a prompt', 'witness-check', true, witnessMut('fixtures/witnesses/minimal/prompt.txt', (s) => s.replace(/\ncco:ont00000077\t[^\n]*/, ''))],
  ['term-list label changed, terms_sha256 left alone', 'witness-check', true, () => edit('ontology/term-list.json', (s) => s.replace('"label": "Code Identifier"', '"label": "Code Identifyer"'))],
  ['reciprocal table entry dropped', 'citations', false, () => edit('spec/sdd-operator.md', (s) => s.replace(/^(\| W-CS6-N \| [^\n]*?), W-PRO1-N /m, '$1 '))],
  ['citation added in a scene but not recorded', 'citations', false, () => edit('spec/sdd-operator.md', (s) => s.replace('- **W-PRO6-N:** ', '- **W-PRO6-N:** (see SDD R-S19) '))],
  ['stale 8-hex prefix in prose', 'registry-check', false, () => edit('spec/sdd-service.md', (s) => s.replace(/(skeleton\.jsonld` \*\*`)[0-9a-f]{8}/, '$1' + sha(rd(supSkeleton)).slice(0, 8)))],
  ['governed file added without a registry row', 'registry-check', false, () => wr('fixtures/witnesses/minimal/extra.json', '{}\n')],
  // Regressions for the C1–C4 milestone defects, each the exact failure found.
  ['F69 replay: chained fill expands {{CATALOGUE}} inside DATA', 'witness-check', true, witnessMut('fixtures/witnesses/hostile/placeholders-prompt.txt', (s) => {
    const cat = s.slice(s.indexOf('-----BEGIN CATALOGUE-----\n') + 26, s.indexOf('-----END CATALOGUE-----'));
    const at = s.indexOf('{{CATALOGUE}}');
    return s.slice(0, at) + cat + s.slice(at + 13);
  })],
  ['F67 replay: SDD §5 html row (CV-O1–CV-O3) missing from both tables', 'citations', false, () => {
    for (const doc of ['spec/sdd-service.md', 'spec/sdd-operator.md']) edit(doc, (s) => s.replace(/^\| SDD §5 \| [^\n]*\n/m, ''));
  }],
  ['F68 replay: full/ registry row copies minimal/ "Cited by"', 'registry-check', false, () => edit('spec/sdd-service.md', (s) => {
    const minimal = /^\| `fixtures\/witnesses\/minimal\/prompt\.txt` \|[^|]+\|[^|]+\| ([^|]+) \|$/m.exec(s)[1];
    return s.replace(/^(\| `fixtures\/witnesses\/full\/prompt\.txt` \|[^|]+\|[^|]+\| )[^|]+( \|)$/m, `$1${minimal}$2`);
  })],
];
const governed = walk(join(T, 'fixtures')).map(rel).filter((r) => !r.includes('/superseded/') && !r.endsWith('README.md')).concat(['spec/prompt-template-v2.txt', 'spec/prompt-template-v3.txt', 'schemas/proposal-v1.schema.json', 'schemas/proposal-v2.schema.json']);
for (const r of governed) MUTATIONS.push([`flip one byte: ${r}`, 'registry-check', false, () => { const b = Buffer.from(rd(r)); b[Math.floor(b.length / 2)] ^= 1; wr(r, b); }]);

// Control (registrar item 4): a registry-only corruption (stale prose prefix) that DECLARES a semantic expectation.
// The harness must classify it as not detected; if it did not, unrelated registry failures could stand in for misses.
const CONTROL = ['CONTROL: registry-only corruption declared as needing witness-check', 'witness-check', false,
  () => edit('spec/sdd-service.md', (s) => s.replace(/(skeleton\.jsonld` \*\*`)[0-9a-f]{8}/, '$1' + sha(rd(supSkeleton)).slice(0, 8)))];

function judge([name, expect, resynced], failed) {
  const detected = failed.includes(expect);
  const registryClean = !failed.includes('registry-check');
  const ok = detected && (!resynced || registryClean);
  const why = !detected ? `expected ${expect} to fail; ${failed.length ? 'only ' + failed.join(', ') + ' failed' : 'nothing failed'}`
    : resynced && !registryClean ? 'registry not clean after resync: detection may depend on a hash inconsistency'
    : `${expect} failed${failed.length > 1 ? ' (also: ' + failed.filter((c) => c !== expect).join(', ') + ')' : ''}${resynced ? '; registry clean' : ''}`;
  return { ok, why };
}

const lines = [];
let problems = 0;
const base = run();
if (base.length) { problems++; lines.push(`FAIL  baseline: ${base.join(', ')} failed`); } else lines.push('PASS  baseline: all checks pass');
let flipsOk = 0, flips = 0;
for (const m of MUTATIONS) {
  m[3](); const failed = run(); restore();
  const { ok, why } = judge(m, failed);
  if (m[0].startsWith('flip one byte')) { flips++; if (ok) flipsOk++; else { problems++; lines.push(`FAIL  ${m[0]}: ${why}`); } continue; }
  if (!ok) problems++;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${m[0]}  [expects ${m[1]}${m[2] ? ', resynced' : ''}]: ${why}`);
}
lines.push(`${flipsOk === flips ? 'PASS' : 'FAIL'}  byte flips [expect registry-check]: ${flipsOk}/${flips} governed files detected`);
CONTROL[3](); const cf = run(); restore();
const control = judge(CONTROL, cf);
const controlOk = !control.ok && cf.includes('registry-check') && !cf.includes('witness-check');
if (!controlOk) problems++;
lines.push(`${controlOk ? 'PASS' : 'FAIL'}  ${CONTROL[0]}: classified ${control.ok ? 'DETECTED (harness defect)' : 'NOT detected'}; failing checks: ${cf.join(', ') || 'none'}`);
rmSync(T, { recursive: true, force: true });
for (const l of lines) console.log(l);
console.log(problems ? `\n${problems} problem(s)` : `\nok: baseline clean; ${MUTATIONS.length} corruptions detected by their expected check; control correctly classified`);
process.exit(problems ? 1 : 0);
