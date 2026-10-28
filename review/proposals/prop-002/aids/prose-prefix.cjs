// Update backticked 8-hex prose prefixes from each governed file's main-branch hash to its proposed hash.
'use strict';
const fs = require('fs'), path = require('path'), c = require('crypto'), { execFileSync } = require('child_process');
const [WT, MAIN] = process.argv.slice(2);
const sha = (b) => c.createHash('sha256').update(b).digest('hex');
const svc = fs.readFileSync(path.join(WT, 'spec/sdd-service.md'), 'utf8');
const map = new Map();
for (const m of svc.matchAll(/^\| `([^`]+)` \| [^|]+ \| `([0-9a-f]{64})` \|/gm)) {
  if (m[1].includes('/superseded/')) continue;
  let old; try { old = sha(execFileSync('git', ['show', 'HEAD:' + m[1]], { cwd: MAIN, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 })); } catch { continue; }
  if (old !== m[2]) map.set(old.slice(0, 8), m[2].slice(0, 8));
}
for (const doc of ['spec/sdd-service.md', 'spec/sdd-operator.md']) {
  const p = path.join(WT, doc); let t = fs.readFileSync(p, 'utf8'); let n = 0;
  t = t.replace(/`([0-9a-f]{8})`/g, (m, x) => (map.has(x) ? (n++, '`' + map.get(x) + '`') : m));
  fs.writeFileSync(p, t); console.log(doc, 'prefixes updated:', n);
}
console.log('mapping:', [...map].map(([a, b]) => a + '->' + b).join(' '));
