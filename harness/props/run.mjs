// Child-process driver for the SDD CLI (black box). Every invocation preloads the H-O2 network guard
// (harness/netguard.mjs) so any network attempt is logged (R-S16, V-S5). A global semaphore bounds parallelism.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLI = join(ROOT, 'src/cli/sdd.mjs');
const GUARD = pathToFileURL(join(ROOT, 'harness/netguard.mjs')).href;

let limit = 4, active = 0; const queue = [];
export const setParallelism = (n) => { limit = n; };
const acquire = () => new Promise((res) => { if (active < limit) { active++; res(); } else queue.push(res); });
const release = () => { const n = queue.shift(); if (n) n(); else active--; };

export const stats = { calls: 0, ms: 0 };
export async function sdd(args, { cwd = ROOT, netlog } = {}) {
  await acquire();
  const t0 = performance.now();
  try {
    return await new Promise((resolve) => {
      const p = spawn(process.execPath, ['--import', GUARD, CLI, ...args], { cwd, env: { ...process.env, NETGUARD_LOG: netlog || join(ROOT, 'harness/props/.netguard-default.log') }, windowsHide: true });
      const out = [], err = [];
      p.stdout.on('data', (d) => out.push(d)); p.stderr.on('data', (d) => err.push(d));
      p.on('close', (code) => {
        const ms = performance.now() - t0; stats.calls++; stats.ms += ms;
        resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8'), ms, argv: ['sdd', ...args] });
      });
    });
  } finally { release(); }
}
// The JSON object on stderr (R-S23: one line, a JSON object with `code`), or null.
export function stderrCode(r) {
  const line = r.stderr.split('\n').find((l) => l.trim().startsWith('{'));
  try { return line ? JSON.parse(line) : null; } catch { return null; }
}
export const brief = (r) => r ? { argv: r.argv, exit: r.code, stderr: r.stderr.slice(0, 600), stdout: r.stdout.toString('utf8').slice(0, 600) } : null;
