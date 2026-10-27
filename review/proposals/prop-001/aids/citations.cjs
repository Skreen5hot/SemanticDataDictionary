// One-off drafting aid: extract every SDD artifact that each SDD-operator artifact cites.
const fs = require('fs');
const op = fs.readFileSync(process.argv[2], 'utf8');
const SDD_ID = /\b(W-JS\d|W-CS\d-(?:N|Δ\d+)|R-S\d+|NG-S\d+)\b/g;
const blocks = [];
let cur = null;
for (const line of op.split('\n')) {
  const m = /^(?:- )?\*\*(W-PRO\d-(?:N|Δ\d+)(?: \([^)]*\))?|PR-O\d|RV-O\d|NP-O\d)[:*]/.exec(line)
    || /Chain scene \*\*(W-JO\d)\*\*/.exec(line);
  if (m) { cur = { id: m[1].replace(/ \(.*$/, ''), text: '' }; blocks.push(cur); }
  else if (/^(## |\| )/.test(line) || line.trim() === '') { cur = null; }
  if (cur) cur.text += line + '\n';
}
const rows = {};
for (const b of blocks) {
  // expand "W-JS1–W-JS4" ranges
  const t = b.text.replace(/W-JS(\d)–W-JS(\d)/g, (_, a, z) => Array.from({ length: z - a + 1 }, (_, i) => 'W-JS' + (+a + i)).join(' '));
  const ids = [...new Set([...t.matchAll(SDD_ID)].map((m) => m[1]))].sort();
  if (ids.length) rows[b.id] = [...new Set([...(rows[b.id] || []), ...ids])].sort();
}
const reverse = {};
for (const [k, ids] of Object.entries(rows)) for (const i of ids) (reverse[i] = reverse[i] || []).push(k);
console.log('OPERATOR -> SDD');
for (const k of Object.keys(rows).sort()) console.log(k.padEnd(12), rows[k].join(', '));
console.log('\nSDD <- OPERATOR');
for (const k of Object.keys(reverse).sort()) console.log(k.padEnd(12), reverse[k].sort().join(', '));
