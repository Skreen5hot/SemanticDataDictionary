// Independent verifier for SDD citation rule (SDD-F70). Written from the rule text only.
import fs from 'node:fs';
const SPEC = 'C:/Users/aaron/OneDrive/Documents/SemanticDataDictionary/spec/';
const docs = {
  SDD: fs.readFileSync(SPEC + 'sdd-service.md', 'utf8').replace(/\r\n/g, '\n'),
  OP: fs.readFileSync(SPEC + 'sdd-operator.md', 'utf8').replace(/\r\n/g, '\n'),
};
const READING = process.argv[2] || 'A'; // A: first bold span only; B: first bold span beginning with any id; B2: ... with own-doc id
const SO_EXCL = process.argv[3] !== 'noexcl'; // for item 7

// (1) identifiers
const B = '(?<![A-Za-z0-9_-])';
const E = '(?![A-Za-z0-9_])';
const pat = {
  SDD: ['J-S\\d+', 'C-S\\d+', 'W-CS\\d+-(?:N|Δ\\d+)', 'W-JS\\d+', 'R-S\\d+', 'S-S\\d+', 'V-S\\d+', 'E-S\\d+', 'H-S1', 'NG-S\\d+', 'OS-\\d+', 'G1', 'K1'],
  OP: ['PR-O\\d+', 'J-O\\d+', 'CV-O\\d+', 'RV-O\\d+', 'W-PRO\\d+-(?:N|Δ\\d+)', 'W-JO\\d+', 'V-O\\d+', 'E-O\\d+', 'NP-O\\d+', 'H-O\\d+', 'OO-\\d+', 'G2', 'K2', 'WV-1'],
};
const SO = 'S-O\\d+';
const all = [...pat.SDD, ...pat.OP, SO];
const idRe = new RegExp(B + '(' + all.join('|') + ')' + E, 'g');
const docOf = id => new RegExp('^(' + pat.SDD.join('|') + ')$').test(id) ? 'SDD' : new RegExp('^(' + pat.OP.join('|') + ')$').test(id) ? 'OP' : (new RegExp('^' + SO + '$').test(id) ? 'SO' : null);

function idsIn(text) {
  const out = new Set();
  let m; idRe.lastIndex = 0;
  while ((m = idRe.exec(text))) {
    const id = m[1]; out.add(id);
    const rest = text.slice(m.index + id.length);
    // range: "X1–X4" (same prefix) or "W-…-Δ1–Δ4"
    let r;
    if ((r = /^–(Δ)(\d+)/.exec(rest)) && /Δ\d+$/.test(id)) {
      const pre = id.replace(/\d+$/, ''); const a = +id.match(/(\d+)$/)[1];
      for (let i = a; i <= +r[2]; i++) out.add(pre + i);
    } else if ((r = new RegExp('^–(' + all.join('|') + ')' + E).exec(rest))) {
      const b = r[1];
      const pa = id.replace(/\d+$/, ''), pb = b.replace(/\d+$/, '');
      if (pa === pb) { const a = +id.match(/(\d+)$/)[1], z = +b.match(/(\d+)$/)[1]; for (let i = a; i <= z; i++) out.add(pa + i); }
      else console.error('RANGE?', id, b);
    }
  }
  return out;
}

// (2) blocks
function blocks(docKey) {
  const lines = docs[docKey].split('\n');
  const label = docKey === 'SDD' ? 'SDD' : 'SDD-operator';
  let section = label + ' header';
  let inRecip = false, cur = null, tableHeader = null;
  const res = [];
  const flush = () => { if (cur) res.push(cur); cur = null; };
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/<!-- reciprocity:begin -->/.test(L)) { flush(); inRecip = true; continue; }
    if (/<!-- reciprocity:end -->/.test(L)) { inRecip = false; continue; }
    if (inRecip) continue;
    let h;
    if ((h = /^#{1,6}\s+(.*)$/.exec(L))) { flush(); tableHeader = null; const s = /^(SDD(?:-operator)? §\d+)/.exec(h[1]); if (s) section = s[1]; continue; }
    if (/^\s*$/.test(L)) { flush(); tableHeader = null; continue; }
    if (/^\s*\|/.test(L)) {
      flush();
      if (/^\s*\|[\s\-:|]+\|\s*$/.test(L)) continue;
      const cells = L.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      if (tableHeader === null) tableHeader = cells[0];
      res.push({ kind: 'row', text: L, cells, section, line: i + 1, tableHeader });
      continue;
    }
    if (/^\s*(?:- |\d+\. )/.test(L)) { flush(); cur = { kind: 'item', text: L, section, line: i + 1 }; continue; }
    if (cur) { cur.text += '\n' + L; continue; }
    cur = { kind: 'para', text: L, section, line: i + 1 };
  }
  flush();
  return res;
}

// (3) attribution
function attribute(b, docKey) {
  let m;
  if ((m = /Chain (?:example|scene) \*\*(W-J[SO]\d+)\*\*/.exec(b.text))) return m[1];
  if (b.kind === 'row') {
    const c = b.cells[0].replace(/^\*\*(.*)\*\*$/, '$1').trim();
    if (docOf(c)) return c;
  }
  const spans = [...b.text.matchAll(/\*\*(.+?)\*\*/g)].map(x => x[1]);
  const lead = s => { const mm = new RegExp('^(' + all.join('|') + ')' + E).exec(s); return mm ? mm[1] : null; };
  if (READING === 'A') { if (spans.length && lead(spans[0])) return lead(spans[0]); }
  else for (const s of spans) { const l = lead(s); if (l && (READING === 'B' || docOf(l) === docKey)) return l; }
  return b.section;
}

const pairs = new Set(); const why = {};
const blk = { SDD: blocks('SDD'), OP: blocks('OP') };
for (const dk of ['SDD', 'OP']) {
  const other = dk === 'SDD' ? 'OP' : 'SDD';
  for (const b of blk[dk]) {
    // (5) excluded: registry tables (SDD §11, header "File"), mirrored S-O rows
    if (b.kind === 'row' && dk === 'SDD' && b.section === 'SDD §11' && b.tableHeader === 'File') continue;
    if (b.kind === 'row' && /^\*{0,2}S-O\d+\*{0,2}(\s|$)/.test(b.cells[0])) continue;
    const a = attribute(b, dk);
    for (const id of idsIn(b.text)) {
      if (docOf(id) !== other) continue;
      const p = dk === 'SDD' ? `${a} | ${id}` : `${id} | ${a}`;
      pairs.add(p); (why[p] ||= []).push(`${dk}:${b.line}`);
    }
  }
}
// tables
function table(dk) {
  const t = docs[dk].split('<!-- reciprocity:begin -->')[1].split('<!-- reciprocity:end -->')[0];
  const s = new Set();
  for (const L of t.split('\n')) {
    if (!/^\|/.test(L) || /^\|---/.test(L) || /SDD artifact/.test(L)) continue;
    const [l, r] = L.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(x => x.trim());
    for (const x of r.split(',').map(y => y.trim())) s.add(`${l} | ${x}`);
  }
  return s;
}
const tS = table('SDD'), tO = table('OP');
const eq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
console.log('READING', READING, 'derived', pairs.size, 'tableSDD', tS.size, 'tableOP', tO.size, 'tables identical', eq(tS, tO));
console.log('MISSING from table:'); for (const p of [...pairs].sort()) if (!tS.has(p)) console.log('  ', p, why[p]);
console.log('EXTRA in table:'); for (const p of [...tS].sort()) if (!pairs.has(p)) console.log('  ', p);
if (process.argv[4] === 'dump') for (const p of [...pairs].sort()) console.log('PAIR', p, why[p].join(','));

// Gate 1
const soRows = dk => Object.fromEntries(blk[dk].filter(b => b.kind === 'row' && /^\*{0,2}S-O\d+\*{0,2}(\s|$)/.test(b.cells[0])).map(b => [b.cells[0].match(/S-O\d+/)[0], b.cells.slice(1)]));
const s1 = soRows('SDD'), s2 = soRows('OP');
for (const k of ['S-O1', 'S-O2', 'S-O3', 'S-O4', 'S-O5', 'S-O6']) {
  console.log('GATE1', k, !!s1[k], !!s2[k], s1[k] && s2[k] && JSON.stringify(s1[k]) === JSON.stringify(s2[k]), s1[k] && s1[k][3]);
}
console.log('GATE1 rows SDD', Object.keys(s1), 'OP', Object.keys(s2));

// (7) Cited by
if (process.argv[4] === 'reg') {
  const regRows = blk.SDD.filter(b => b.kind === 'row' && b.section === 'SDD §11' && b.tableHeader === 'File' && /^`/.test(b.cells[0]));
  for (const r of regRows) {
    const path = r.cells[0].replace(/`/g, '');
    const names = [path];
    for (const pre of ['fixtures/witnesses/', 'fixtures/jira-assets/']) if (path.startsWith(pre)) names.push(path.slice(pre.length));
    const citers = new Set();
    for (const dk of ['SDD', 'OP']) for (const b of blk[dk]) {
      if (b.kind === 'row' && dk === 'SDD' && b.section === 'SDD §11' && b.tableHeader === 'File') continue;
      if (SO_EXCL && b.kind === 'row' && /^\*{0,2}S-O\d+\*{0,2}(\s|$)/.test(b.cells[0])) continue;
      const hit = names.some(n => { const re = new RegExp('(?<![A-Za-z0-9_./-])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_./-])'); return re.test(b.text); });
      if (hit) citers.add(attribute(b, dk));
    }
    const listed = r.cells[3].split(',').map(x => x.trim()).filter(Boolean);
    const got = [...citers].sort();
    const same = listed.length === got.length && listed.every(x => citers.has(x));
    console.log(same ? 'OK ' : 'DIFF', path, '| listed:', listed.join(', '), same ? '' : '| derived: ' + got.join(', '));
  }
}
