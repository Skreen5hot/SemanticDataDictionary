// prop-002 drafting aid: retain superseded witness files, then rebuild the §11 registry tables from the files.
// Usage: node registry-build.cjs <worktree> <mainRepo>
'use strict';
const fs = require('fs'), path = require('path'), c = require('crypto'), { execFileSync } = require('child_process');
const [WT, MAIN] = process.argv.slice(2);
const sha = (b) => c.createHash('sha256').update(b).digest('hex');
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d).flatMap((n) => { const p = path.join(d, n); return fs.statSync(p).isDirectory() ? walk(p) : [p]; }) : [];
const rel = (p) => path.relative(WT, p).split(path.sep).join('/');
const mainBytes = (r) => { try { return execFileSync('git', ['show', 'HEAD:' + r], { cwd: MAIN, maxBuffer: 1 << 26 }); } catch { return null; } };

// 1. retain every current witness file that prop-002 changes (main's bytes -> superseded/v3/)
let retained = 0;
for (const p of walk(path.join(WT, 'fixtures/witnesses')).filter((x) => !rel(x).includes('/superseded/'))) {
  const r = rel(p); const old = mainBytes(r);
  if (old && sha(old) !== sha(fs.readFileSync(p))) {
    const dest = path.join(WT, 'fixtures/witnesses/superseded/v3', r.replace('fixtures/witnesses/', ''));
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, old); retained++;
  }
}
// 2. governed files and their citers
const svcPath = path.join(WT, 'spec/sdd-service.md'), oprPath = path.join(WT, 'spec/sdd-operator.md');
let svc = fs.readFileSync(svcPath, 'utf8'); const opr = fs.readFileSync(oprPath, 'utf8');
const governed = [
  ...walk(path.join(WT, 'fixtures')).filter((x) => !rel(x).includes('/superseded/') && !rel(x).endsWith('README.md')),
  path.join(WT, 'spec/prompt-template-v2.txt'), ...walk(path.join(WT, 'schemas')),
].map(rel).sort();
const blocks = (t) => t.split(/\n(?=- \*\*|\*\*[A-Z]-|\| )/);
const idOf = (b) => (/\*\*(W-[A-Z]+\d*-?(?:N|Δ\d+)?|W-J[SO]\d+|R-S\d+|S-[SO]\d+|V-S\d+|E-S\d+|C-S\d+)/.exec(b) || /^\| (\*\*)?(S-[SO]\d+)/.exec(b) || [])[1];
function citers(r) {
  const base = r.replace(/^fixtures\/(witnesses\/|jira-assets\/)/, '');
  const short = [base, base.replace(/^(minimal|full|hostile|invalid)\//, '')];
  const out = new Set();
  for (const t of [svc, opr]) for (const b of blocks(t)) {
    if (b.startsWith('| `fixtures') || b.startsWith('| `spec') || b.startsWith('| `schemas')) continue;
    if (short.some((s) => b.includes('`' + s + '`') || b.includes(s + '`') || b.includes('/' + s))) { const id = idOf(b) || (/\*\*(J-S\d+|J-O\d+)/.exec(b) || [])[1]; if (id) out.add(id); }
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).join(', ') || '—';
}
const verOf = (r) => { const old = mainBytes(r); if (!old) return 4; if (sha(old) !== sha(fs.readFileSync(path.join(WT, r)))) return 4; const m = new RegExp('^\\| `' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '` \\| (\\d+) \\|', 'm').exec(execFileSync('git', ['show', 'HEAD:spec/sdd-service.md'], { cwd: MAIN }).toString()); return m ? +m[1] : 1; };
const rows = governed.map((r) => `| \`${r}\` | ${verOf(r)} | \`${sha(fs.readFileSync(path.join(WT, r)))}\` | ${citers(r)} |`);
const tl = JSON.parse(fs.readFileSync(path.join(WT, 'ontology/term-list.json'), 'utf8')).terms_sha256;
rows.push(`| \`ontology/term-list.json\` | ADR-005 | \`terms_sha256\` \`${tl}\` | S-S3, every term-bearing witness |`);
const sup = walk(path.join(WT, 'fixtures/witnesses/superseded')).map(rel).sort();
const supRows = sup.map((r) => `| \`${r}\` | ${{ v1: 'v0.1', v2: 'v0.2', v3: 'v0.3' }[r.split('/')[3]]} | \`${sha(fs.readFileSync(path.join(WT, r)))}\` |`);
const table = '| File | Ver | sha256 | Cited by |\n|---|---|---|---|\n' + rows.join('\n') + '\n\n**Superseded files (retained; never cited by a current witness, enforced by `tools/witness-check.mjs`).**\n\n| File | Current in | sha256 |\n|---|---|---|\n' + supRows.join('\n') + '\n';
const start = svc.indexOf('| File | Ver | sha256 | Cited by |');
const end = svc.indexOf('\n**Supersession.**', start);
if (start < 0 || end < 0) throw new Error('registry table not found');
svc = svc.slice(0, start) + table + svc.slice(end);
fs.writeFileSync(svcPath, svc);
console.log(`retained ${retained} superseded files; registry: ${rows.length} rows (${rows.filter((r) => / \| 4 \| /.test(r)).length} at Ver 4), superseded table: ${supRows.length} rows; rows with no citer: ${rows.filter((r) => r.endsWith('| — |')).length}`);
