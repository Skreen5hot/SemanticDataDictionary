// Shared reading of the spec pair under the SDD §11 citation rule (SDD-F70). Used by tools/citations.mjs (reciprocity)
// and tools/registry-check.mjs (registry "Cited by"), so both apply one rule.
//
// (1) Identifiers: each document's declared ids. Codes (E-*, W-CHK-*, FL-*), section references (§n) and wildcards
//     (X\*) are not identifiers; the shared seam ids S-O* are governed by mirroring, not by citation.
// (2) Blocks: a paragraph, a list item, or a table row; headings are not blocks.
// (3) Citing artifact: the chain witness the block defines, else (table row) the id forming its whole first cell, else
//     the identifier leading its first bold span, else its
//     section ("SDD §n" / "SDD-operator §n"), or "<doc> header" before the first section.
// (4) Citations: every identifier of the other document the block names; ranges "X1–X4" and "X1-Δ1–Δ4" are expanded.
// (5) Excluded regions are decided by the callers (reciprocal tables, §11 registry tables, mirrored seam rows).
export const SDD_ID = /\b(G1|K1|W-JS\d+|W-CS\d+-(?:N|Δ\d+)|R-S\d+|NG-S\d+|S-S\d+|V-S\d+|E-S\d+|J-S\d+|C-S\d+|H-S\d+|OS-\d+)\b/g;
export const OPR_ID = /\b(G2|K2|WV-1|W-JO\d+|W-PRO\d+-(?:N|Δ\d+)|PR-O\d+|RV-O\d+|NP-O\d+|CV-O\d+|V-O\d+|E-O\d+|J-O\d+|H-O\d+|OO-\d+)\b/g;
export const SEAM = /^\| (?:\*\*)?(S-O\d+)(?:\*\*)?(?: \*\([^)|]*\)\*)? \|(.*)$/;

export function expand(t) {
  return t
    .replace(/\b((?:W-[A-Z]+\d+)-Δ)(\d+)–Δ(\d+)\b/g, (m, pre, a, z) => Array.from({ length: Math.max(0, +z - +a + 1) }, (_, i) => pre + (+a + i)).join(' '))
    .replace(/\b([A-Z]+-[A-Z]*?)(\d+)–\1(\d+)\b/g, (m, pre, a, z) => Array.from({ length: Math.max(0, +z - +a + 1) }, (_, i) => pre + (+a + i)).join(' '));
}
export const ids = (text, re) => [...new Set([...expand(text).matchAll(re)].map((m) => m[1]))];

export function blocks(text, docName) {
  const out = [];
  let cur = [], section = `${docName} header`;
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

export function citingArtifact(block, localRe) {
  const chain = /(?:Chain example|Chain scene) \*\*(W-J[SO]\d+)\*\*/.exec(block.text);
  if (chain) return chain[1];
  const cell = /^\| (?:\*\*)?([^|*]+?)(?:\*\*)? \|/.exec(block.text);
  if (cell && new RegExp(`^(?:${localRe.source})$`).test(cell[1])) return cell[1];
  for (const m of block.text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const id = [...m[1].matchAll(new RegExp(localRe.source, 'g'))][0];
    if (id && m[1].trimStart().startsWith(id[1])) return id[1];
  }
  return block.section;
}

// A row of the §11 witness-registry tables (current or superseded): first cell is a backticked repository path.
export const isRegistryRow = (block) => block.section === 'SDD §11' && /^\| `[^`]+` \|/.test(block.text);
