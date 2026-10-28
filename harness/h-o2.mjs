// H-O2 (SDD-operator §4): the CLI under the network guard. Every `node` process, children included, runs with
// `--import harness/netguard.mjs` (through NODE_OPTIONS). In CI this runs inside a container with networking
// disabled (`docker run --network none`), as H-O2 specifies; locally the guard alone applies.
//
// Scenes: W-PRO2-Δ1 (SDD W-JS1–W-JS4 via the CLI; netguard.log empty), W-JO3 (W-JS3's commands; unchanged mappings
// byte-identical; netguard.log empty), W-PRO3-Δ2 (SDD W-CS6-Δ5: E-OUT-EXISTS, bytes unchanged). The CLI chains are
// executed by the independent judge tools/run-witnesses.mjs, which covers all of them.
// A positive control proves the guard is live: a deliberate attempt must be blocked AND logged.
//
//   node harness/h-o2.mjs [--out <results.json>]
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = pathToFileURL(join(ROOT, 'harness/netguard.mjs')).href;
const T = mkdtempSync(join(tmpdir(), 'sdd-h-o2-'));
const results = [];
const rec = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? ': ' + detail : ''}`); };
const guarded = (log, args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: `--import=${GUARD}`, NETGUARD_LOG: log } });
const lines = (log) => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : []);

// Positive control.
{
  const log = join(T, 'control.log'); const probe = join(T, 'probe.mjs');
  writeFileSync(probe, "try { await fetch('https://example.org/'); console.log('NOT BLOCKED'); } catch (e) { console.log(e.code); }\n");
  const r = guarded(log, [probe]);
  rec('control: guard blocks and logs a deliberate fetch', r.stdout.trim() === 'ENETGUARD' && lines(log).length === 1, `stdout=${r.stdout.trim()}, log lines=${lines(log).length}`);
}
// W-PRO2-Δ1, W-JO3, W-PRO3-Δ2: the whole independent CLI judge under the guard.
{
  const log = join(T, 'netguard.log');
  const r = guarded(log, [join(ROOT, 'tools/run-witnesses.mjs')]);
  const tail = r.stdout.trim().split('\n').pop();
  const ok = r.status === 0;
  rec('W-PRO2-Δ1 / W-JO3 / W-PRO3-Δ2: every CLI witness and chain (W-JS1–W-JS4, W-CS6-Δ5) passes under the guard', ok, tail);
  for (const id of ['W-JS3', 'W-CS6-Δ5', 'end-to-end']) if (!r.stdout.includes(id) && !/ok: all \d+ witnesses pass/.test(tail)) rec(`includes ${id}`, false, 'not run');
  rec('netguard.log is empty (V-O2, PR-O2(b))', lines(log).length === 0, `${lines(log).length} attempts${lines(log).length ? ': ' + lines(log)[0] : ''}`);
}
rmSync(T, { recursive: true, force: true });
const oi = process.argv.indexOf('--out');
if (oi > 0) writeFileSync(process.argv[oi + 1], JSON.stringify({ harness: 'H-O2', node: process.version, platform: `${process.platform}-${process.arch}`, results }, null, 2) + '\n');
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} H-O2 check(s) failed` : `\nok: all ${results.length} H-O2 checks pass`);
process.exit(failed ? 1 : 0);
