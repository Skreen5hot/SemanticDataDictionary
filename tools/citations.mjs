// OS-7: the reciprocity check for the SDD spec pair (WV-1 gates 1 and 2).
//
//   node tools/citations.mjs           check; exit 1 on any mismatch
//   node tools/citations.mjs --write   regenerate both reciprocal tables and the mirrored S-O rows
//
// Rule (SDD §11): a citation is an explicit identifier. An artifact cites another iff the text of the artifact's
// block names that id. A block is a paragraph, bullet or table row; its local id is the chain witness it defines
// (W-JS*/W-JO*) if any, else the first bold local id it contains, else its section (e.g. "SDD §2"), so that a block
// defining no identifier still has its citations recorded (SDD-F64). The reciprocal tables (between the
// `reciprocity:begin/end` markers) are excluded from extraction and MUST equal the extracted edge set, grouped by SDD
// artifact, identically in both documents. The cross-document seam rows S-O1–S-O6 MUST have identical cells after the
// first in both documents (operator §8 is the source for --write). A seam row's first cell is exactly one S-On,
// optionally bold, optionally followed by an italic note; a range such as "S-O1–S-O6" is never a seam row (SDD-F51).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVC = 'spec/sdd-service.md';
const OPR = 'spec/sdd-operator.md';
const SDD_ID = /\b(G1|K1|W-JS\d+|W-CS\d+-(?:N|Δ\d+)|R-S\d+|NG-S\d+|S-S\d+|V-S\d+|E-S\d+|J-S\d+|C-S\d+|H-S\d+|OS-\d+)\b/g;
const OPR_ID = /\b(G2|K2|W-JO\d+|W-PRO\d+-(?:N|Δ\d+)|PR-O\d+|RV-O\d+|NP-O\d+|CV-O\d+|V-O\d+|E-O\d+|J-O\d+|H-O\d+|OO-\d+)\b/g;
const SEAM = /^\| (?:\*\*)?(S-O\d+)(?:\*\*)?(?: \*\([^)|]*\)\*)? \|(.*)$/;
const BEGIN = '<!-- reciprocity:begin -->';
const END = '<!-- reciprocity:end -->';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const expand = (t) => t.replace(/\b([A-Z]+-[A-Z]*?)(\d+)–\1(\d+)\b/g, (m, pre, a, z) =>
  Array.from({ length: Math.max(0, +z - +a + 1) }, (_, i) => pre + (+a + i)).join(' '));
const ids = (text, re) => [...new Set([...expand(text).matchAll(re)].map((m) => m[1]))];

function withoutTables(text) {
  const i = text.indexOf(BEGIN), j = text.indexOf(END);
  if (i < 0 || j < i) throw new Error('reciprocity markers missing');
  return text.slice(0, i) + text.slice(j + END.length);
}

function blocks(text) {
  const out = [];
  let cur = [], section = null;
  const flush = () => { if (cur.length) out.push({ text: cur.join('\n'), section }); cur = []; };
  for (const line of text.split('\n')) {
    const sec = /^## (SDD(?:-operator)? §\d+)/.exec(line);
    if (sec) { flush(); section = sec[1]; continue; }
    if (/^\s*$/.test(line) || /^#/.test(line)) { flush(); continue; }
    if (/^(- |\| )/.test(line)) flush();
    cur.push(line);
    if (/^\| /.test(line)) flush();
  }
  flush();
  return out;
}

function localId(block, localRe) {
  const chain = /(?:Chain example|Chain scene) \*\*(W-J[SO]\d+)\*\*/.exec(block);
  if (chain) return chain[1];
  for (const m of block.matchAll(/\*\*([^*]+)\*\*/g)) {
    const id = [...m[1].matchAll(new RegExp(localRe.source, 'g'))][0];
    if (id && m[1].trimStart().startsWith(id[1])) return id[1];
  }
  return null;
}

function edges() {
  const set = new Set();
  for (const [doc, localRe, otherRe, sddSide] of [[SVC, SDD_ID, OPR_ID, true], [OPR, OPR_ID, SDD_ID, false]]) {
    for (const b of blocks(withoutTables(read(doc)))) {
      if (SEAM.test(b.text)) continue; // mirrored seam rows are checked as seams, not as citations
      if (/^\| `/.test(b.text)) continue; // registry rows (first cell a file path) are a derived index, like the reciprocal tables
      const local = localId(b.text, localRe) || b.section;
      if (!local) continue;
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
  else if (a[k] !== b[k]) problems.push(`seam ${k}: cells differ between the documents\n    SDD:          ${a[k].slice(0, 100)}\n    SDD-operator: ${b[k].slice(0, 100)}`);
}
if (Object.keys(b).length === 0) problems.push('no seam rows found in SDD-operator §8');
if (problems.length) { for (const p of problems) console.log(p); process.exit(1); }
console.log(`ok: ${want.size} cross-document citations, recorded identically in both tables; ${Object.keys(a).length} mirrored seam rows identical`);
