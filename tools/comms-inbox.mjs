// Session-start inbox check: alerts on the board addressed to SDD that our record does not hold yet.
// Clones or updates Skreen5hot/communications into the system temp directory, keeps PyYAML in a venv
// there, and runs its tools/inbox.py against our communications/. Run by the SessionStart hook in
// .claude/settings.json; safe to run by hand.
//
//   node tools/comms-inbox.mjs
//
// Always exits 0: a failed check is reported, never fatal to the session.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE = 'https://github.com/Skreen5hot/communications.git';
const CLONE = join(tmpdir(), 'skreen5hot-communications');
const VENV = join(tmpdir(), 'skreen5hot-communications-venv');
const ALERTS = 'https://github.com/Skreen5hot/communications/discussions/categories/alerts';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 120000, ...opts });
const say = (s) => console.log(`[comms] ${s}`);

function main() {
  const pull = existsSync(join(CLONE, '.git'))
    ? run('git', ['-C', CLONE, 'pull', '-q', '--ff-only'])
    : run('git', ['clone', '-q', REMOTE, CLONE]);
  if (pull.status !== 0 && !existsSync(join(CLONE, 'tools', 'inbox.py'))) {
    say(`could not fetch ${REMOTE}: ${(pull.stderr || pull.error || '').toString().trim()}`);
    say(`check the board by hand: ${ALERTS}`);
    return;
  }
  const head = run('git', ['-C', CLONE, 'rev-parse', '--short', 'HEAD']).stdout.trim();
  say(`Skreen5hot/communications at ${head}${pull.status !== 0 ? ' (update failed; using the existing copy)' : ''}`);

  // A newer protocol is news, not an error: a version takes effect only when this record adopts it.
  const adopted = /sha256 ([0-9a-f]{64})/.exec(readFileSync(join(ROOT, 'communications', 'README.md'), 'utf8'))?.[1];
  // Hash the committed blob: a Windows checkout may have rewritten line endings on disk.
  const blob = run('git', ['-C', CLONE, 'show', 'HEAD:PROTOCOL.md'], { encoding: 'buffer' }).stdout;
  const current = createHash('sha256').update(blob).digest('hex');
  if (adopted && current !== adopted) say('PROTOCOL.md on main differs from the version communications/README.md adopts; tell the registrar.');

  const bin = join(VENV, process.platform === 'win32' ? 'Scripts' : 'bin');
  const py = join(bin, process.platform === 'win32' ? 'python.exe' : 'python');
  if (!existsSync(py)) {
    const base = ['python3', 'python'].find((p) => run(p, ['--version']).status === 0);
    if (!base || run(base, ['-m', 'venv', VENV]).status !== 0) { say(`no Python to run inbox.py; check the board by hand: ${ALERTS}`); return; }
  }
  if (run(py, ['-c', 'import yaml']).status !== 0) {
    const pip = run(py, ['-m', 'pip', 'install', '-q', '-r', join(CLONE, 'requirements.txt')]);
    if (pip.status !== 0) { say(`could not install PyYAML: ${pip.stderr.trim()}`); return; }
  }

  const inbox = run(py, [join(CLONE, 'tools', 'inbox.py'), '--code', 'SDD', '--record', join(ROOT, 'communications')]);
  const out = `${inbox.stdout}${inbox.stderr}`.trim();
  if (inbox.status === 0 || inbox.status === 3) { for (const l of out.split('\n')) say(l); return; }
  if (/no GitHub token/.test(out)) {
    say('no GitHub token, so the board was not read. Read the Alerts category by hand and compare each');
    say(`alert's record.sha256 with source.sha256 in communications/*/incoming/: ${ALERTS}`);
    return;
  }
  say(`inbox.py failed (exit ${inbox.status}): ${out}`);
}

try { main(); } catch (e) { say(`inbox check failed: ${e.message}`); }
process.exit(0);
