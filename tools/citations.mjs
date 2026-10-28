// OS-7: the reciprocity check for the SDD spec pair (WV-1 gates 1 and 2), under the normative citation rule in SDD §11.
//
//   node tools/citations.mjs           check; exit 1 on any mismatch
//   node tools/citations.mjs --write   regenerate both reciprocal tables and the mirrored S-O rows
//
// Excluded regions (rule item 5): the reciprocal tables (between the `reciprocity:begin/end` markers), the §11
// witness-registry tables (a file index, checked by tools/registry-check.mjs), and the mirrored S-O seam rows (gate 1,
// checked below: identical cells after the first in both documents; SDD-operator §8 is the source for --write).
// SDD-F67: exclusion is by REGION, never by a cell's formatting, so a table row elsewhere (e.g. SDD §5's `html` row)
// is always read.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDD_ID, OPR_ID, SEAM, ids, blocks, citingArtifact, isRegistryRow } from './lib/spec-blocks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVC = 'spec/sdd-service.md';
const OPR = 'spec/sdd-operator.md';
const BEGIN = '<!-- reciprocity:begin -->';
const END = '<!-- reciprocity:end -->';
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function withoutTables(text) {
  const i = text.indexOf(BEGIN), j = text.indexOf(END);
  if (i < 0 || j < i) throw new Error('reciprocity markers missing');
  return text.slice(0, i) + text.slice(j + END.length);
}

export function edges() {
  const set = new Set();
  for (const [doc, name, localRe, otherRe, sddSide] of [[SVC, 'SDD', SDD_ID, OPR_ID, true], [OPR, 'SDD-operator', OPR_ID, SDD_ID, false]]) {
    for (const b of blocks(withoutTables(read(doc)), name)) {
      if (SEAM.test(b.text) || isRegistryRow(b)) continue;
      const local = citingArtifact(b, localRe);
      for (const other of ids(b.text, otherRe)) set.add(sddSide ? `${local}\t${other}` : `${other}\t${local}`);
    }
  }
  return set;
}

const nat = (a, b) => a.localeCompare(b, 'en', { numeric: true });
function table(set) {
  const by = {};
  for (const e of set) { const [s, o] = e.split('\t'); (by[s] = by[s] || []).push(o); }
  const rows = Object.keys(by).sort(nat).map((s) => `| ${s} | ${by[s].sort(nat).join(', ')} |`);
  return `${BEGIN}\n| SDD artifact | SDD-operator artifacts citing it or cited by it |\n|---|---|\n${rows.join('\n')}\n${END}`;
}
function tableEdges(text) {
  const i = text.indexOf(BEGIN), j = text.indexOf(END);
  const set = new Set();
  for (const line of text.slice(i, j).split('\n')) {
    const m = /^\| ([^|]+) \| ([^|]+) \|$/.exec(line);
    if (!m || m[1].startsWith('SDD artifact') || m[1].startsWith('---')) continue;
    for (const o of m[2].split(',').map((x) => x.trim())) set.add(`${m[1].trim()}\t${o}`);
  }
  return set;
}
function seamRows(text) {
  const out = {};
  for (const l of text.split('\n')) {
    const m = SEAM.exec(l);
    if (!m) continue;
    if (m[1] in out) throw new Error(`seam ${m[1]} appears twice`);
    out[m[1]] = m[2];
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) {
  const want = edges();
  const problems = [];
  if (process.argv.includes('--write')) {
    const opRows = seamRows(read(OPR));
    for (const doc of [SVC, OPR]) {
      let t = read(doc);
      t = t.slice(0, t.indexOf(BEGIN)) + table(want) + t.slice(t.indexOf(END) + END.length);
      if (doc === SVC) t = t.split('\n').map((l) => { const m = SEAM.exec(l); return m && opRows[m[1]] ? l.slice(0, l.length - m[2].length) + opRows[m[1]] : l; }).join('\n');
      writeFileSync(join(ROOT, doc), t);
    }
  }
  for (const doc of [SVC, OPR]) {
    const have = tableEdges(read(doc));
    for (const e of want) if (!have.has(e)) problems.push(`${doc}: table lacks ${e.replace('\t', ' ↔ ')}`);
    for (const e of have) if (!want.has(e)) problems.push(`${doc}: table lists ${e.replace('\t', ' ↔ ')}, which no block cites`);
  }
  const a = seamRows(read(SVC)), b = seamRows(read(OPR));
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!a[k] || !b[k]) problems.push(`seam ${k} is not mirrored in both documents`);
    else if (a[k] !== b[k]) problems.push(`seam ${k}: cells differ between the documents`);
  }
  if (Object.keys(b).length === 0) problems.push('no seam rows found in SDD-operator §8');
  if (problems.length) { for (const p of problems) console.log(p); process.exit(1); }
  console.log(`ok: ${want.size} cross-document citations, recorded identically in both tables; ${Object.keys(a).length} mirrored seam rows identical`);
}
