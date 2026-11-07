// Checks the communications record against the protocol communications/README.md names
// (Skreen5hot/communications, PROTOCOL.md) and lists the threads still open. Zero dependencies.
// The board (alerts) is not read here: see tools/inbox.py in Skreen5hot/communications.
//
//   node tools/communications.mjs          findings, then open threads
//   node tools/communications.mjs --json   the same, as one JSON object
//
// Exit codes: 0 no findings; 1 findings (each names the file).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = 'communications';
const SELF = 'SDD';
const THIS_REPO = 'Skreen5hot/SemanticDataDictionary';

const TYPES = ['request', 'finding', 'answer', 'notice', 'acknowledgment'];
const OPENING = ['request', 'finding'];
const CLOSING = ['answer', 'acknowledgment'];
const REQUIRED = ['id', 'from', 'to', 'date', 'type', 'subject', 'in_reply_to', 'refs', 'author', 'requires_act'];
const REF_FIELDS = ['repo', 'commit', 'path', 'sha256'];
const FILENAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] });

// The header subset the protocol uses: scalars, `key:` followed by a list of flat maps (refs),
// or by a flat map (source). Inline `# comments` are stripped outside quotes.
// Plain (unquoted) YAML scalars may not contain ": ", start with an indicator character, or end with ":".
// Real YAML parsers (tools/alert.py) refuse such a header, so it is noted here (see yamlProblems below).
let plainProblems = [];
function scalar(raw) {
  let v = raw.trim();
  if (!v.startsWith('"') && !v.startsWith("'")) {
    v = v.replace(/\s+#.*$/, '').trim();
    if (/: /.test(v) || /^[-?:,\[\]{}#&*!|>%@`]/.test(v) && !/^(\[\]|-\s)/.test(v) || /:$/.test(v)) {
      plainProblems.push(`the unquoted value ${JSON.stringify(v)} is not valid YAML; quote it`);
    }
  }
  if (v === 'null' || v === '~' || v === '') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === '[]') return [];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function parseHeader(text) {
  const out = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^([A-Za-z_][\w]*):(.*)$/.exec(line);
    if (!m) throw new Error(`header line not understood: ${JSON.stringify(line)}`);
    const [, key, rest] = m;
    if (scalar(rest) !== null || rest.trim().startsWith('null')) { out[key] = scalar(rest); continue; }
    // Block value: a list of maps ("- k: v" items) or a single map ("  k: v").
    const block = [];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i]);
    if (block.length && block[0].trim().startsWith('- ')) {
      const list = [];
      for (const b of block) {
        const item = /^\s*-\s+([\w]+):(.*)$/.exec(b);
        const cont = /^\s+([\w]+):(.*)$/.exec(b);
        if (item) list.push({ [item[1]]: scalar(item[2]) });
        else if (cont && list.length) list[list.length - 1][cont[1]] = scalar(cont[2]);
        else throw new Error(`list line not understood: ${JSON.stringify(b)}`);
      }
      out[key] = list;
    } else {
      const map = {};
      for (const b of block) {
        const kv = /^\s+([\w]+):(.*)$/.exec(b);
        if (!kv) throw new Error(`map line not understood: ${JSON.stringify(b)}`);
        map[kv[1]] = scalar(kv[2]);
      }
      out[key] = block.length ? map : null;
    }
  }
  return out;
}

function split(bytes) {
  const s = bytes.toString('utf8');
  if (!s.startsWith('---\n')) return { problem: "does not start with a '---' header line" };
  const end = s.indexOf('\n---\n', 3);
  if (end < 0) return { problem: "has no closing '---' header line" };
  try {
    plainProblems = [];
    const header = parseHeader(s.slice(4, end + 1));
    const bodyStart = Buffer.byteLength(s.slice(0, end + 5), 'utf8');
    return { header, body: bytes.subarray(bodyStart), yamlProblems: plainProblems };
  } catch (e) {
    return { problem: `header is not readable: ${e.message}` };
  }
}

function checkRef(ref, where) {
  const p = [];
  if (!ref || typeof ref !== 'object') return [`${where}: a ref is not a mapping`];
  for (const f of REF_FIELDS) if (!ref[f]) p.push(`${where}: ref lacks ${f}`);
  if (ref.commit && !COMMIT.test(ref.commit)) p.push(`${where}: commit ${ref.commit} is not a full 40-hex SHA`);
  if (ref.sha256 && !SHA256.test(ref.sha256)) p.push(`${where}: sha256 ${ref.sha256} is not 64 lowercase hex`);
  if (!p.length && ref.repo === THIS_REPO) {
    try {
      const actual = sha256(git('show', `${ref.commit}:${ref.path}`));
      if (actual !== ref.sha256) p.push(`${where}: ref ${ref.path}@${ref.commit.slice(0, 7)} hashes to ${actual}, not ${ref.sha256}`);
    } catch {
      p.push(`${where}: ref ${ref.path}@${ref.commit.slice(0, 7)} does not exist in this repository`);
    }
  }
  return p;
}

const problems = [];
const messages = [];
const base = join(ROOT, DIR);
if (!existsSync(join(base, 'README.md'))) problems.push(`${DIR}/README.md, naming the protocol version, is missing`);

for (const folder of existsSync(base) ? readdirSync(base).sort() : []) {
  const teamDir = join(base, folder);
  if (!statSync(teamDir).isDirectory()) continue;
  // One folder per team, named by the team's code in lowercase (PROTOCOL.md, The record).
  if (!/^[a-z][a-z0-9]*$/.test(folder)) { problems.push(`${DIR}/${folder}: a team folder is the team's code in lowercase`); continue; }
  const team = folder.toUpperCase();
  if (!existsSync(join(teamDir, 'README.md'))) { problems.push(`${DIR}/${folder} has no README.md saying who the team is`); continue; }
  for (const entry of readdirSync(teamDir).sort()) {
    if (!['README.md', 'incoming', 'outgoing'].includes(entry)) problems.push(`${DIR}/${folder}/${entry}: only README.md, incoming/ and outgoing/ belong here`);
  }
  for (const direction of ['incoming', 'outgoing']) {
    const d = join(teamDir, direction);
    if (!existsSync(d)) continue;
    for (const file of readdirSync(d).sort()) {
      const rel = `${DIR}/${folder}/${direction}/${file}`;
      const fm = FILENAME.exec(file);
      if (!fm) { problems.push(`${rel}: filename is not YYYY-MM-DD-<slug>.md`); continue; }
      // Rule 7: digests are of committed bytes. A committed message is read with `git show`;
      // one not yet committed is read from disk, and a committed one changed on disk is a change (Rule 1).
      const onDisk = readFileSync(join(d, file));
      let committed = null;
      try { committed = git('show', `HEAD:${rel}`); } catch { /* not committed yet */ }
      if (committed && !committed.equals(onDisk)) problems.push(`${rel}: differs on disk from its committed bytes; a committed message never changes`);
      const { header, body, problem, yamlProblems } = split(committed ?? onDisk);
      if (problem) { problems.push(`${rel} ${problem}`); continue; }
      const h = header;
      for (const f of REQUIRED) if (!(f in h)) problems.push(`${rel}: header lacks ${f}`);
      const [from, to] = direction === 'outgoing' ? [SELF, team] : [team, SELF];
      const expectedId = `${from}-${to}-${fm[1]}-${fm[2]}`;
      if (h.id !== expectedId) problems.push(`${rel}: id is ${h.id}; its path makes it ${expectedId}`);
      if (h.from !== from || h.to !== to) problems.push(`${rel}: from/to are ${h.from}/${h.to}; its path makes them ${from}/${to}`);
      if (h.date !== fm[1]) problems.push(`${rel}: date ${h.date} does not match the filename's ${fm[1]}`);
      if (!TYPES.includes(h.type)) problems.push(`${rel}: type ${h.type} is not one of ${TYPES.join(', ')}`);
      if (!h.subject) problems.push(`${rel}: subject is empty`);
      if (!h.author) problems.push(`${rel}: author is empty`);
      if (typeof h.requires_act !== 'boolean') problems.push(`${rel}: requires_act must be true or false`);
      if (CLOSING.includes(h.type) && !h.in_reply_to) problems.push(`${rel}: an ${h.type} replies to something; in_reply_to is null`);
      if (!Array.isArray(h.refs)) problems.push(`${rel}: refs must be a list (empty if there are none)`);
      else h.refs.forEach((r) => problems.push(...checkRef(r, rel)));
      if (direction === 'incoming') {
        if (!h.source) problems.push(`${rel}: an incoming message has no source: where the original lives`);
        else {
          problems.push(...checkRef(h.source, `${rel} (source)`).filter((x) => !x.includes('does not exist')));
          if (h.source.sha256 && sha256(body) !== h.source.sha256) problems.push(`${rel}: body hashes to ${sha256(body)}, not source.sha256 ${h.source.sha256}`);
        }
      } else if (h.source) problems.push(`${rel}: an outgoing message has a source; it is the original`);
      // Rule 1 (v1.1): follow renames, and count the byte versions the message has had. A move with
      // its bytes unchanged keeps the same blob; any commit that sets different bytes is a change.
      try {
        const raw = git('log', '--follow', '-M', '--raw', '--no-abbrev', '--format=', '--', rel).toString();
        const blobs = new Set();
        for (const line of raw.split('\n')) {
          const m = /^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) [A-Z]/.exec(line);
          if (m && !/^0+$/.test(m[1])) blobs.add(m[1]);
        }
        if (blobs.size > 1) problems.push(`${rel}: its bytes were set by more than one commit (${blobs.size} versions, following renames); a committed message never changes`);
      } catch { /* not in git yet */ }
      messages.push({ path: rel, direction, team, header: h, yamlProblems });
    }
  }
}

// Rule 1 (v1.1): a message is never deleted. A file deleted from incoming/ or outgoing/ (a move
// shows as a rename, not a deletion) is a finding if it was a message: it had a header with an id.
// A file that was never a message may be removed. That includes another team's original placed
// here without our header: if its bytes are the source of a message still in the record, the
// message was never this file, and nothing was lost (d21b25f removed one such upload).
const recordedOriginals = new Set(messages.map((m) => m.header.source?.sha256).filter(Boolean));
try {
  const log = git('log', '-M', '--diff-filter=D', '--name-only', '--format=@%H', '--', `${DIR}/`).toString();
  let commit = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) { commit = line.slice(1); continue; }
    if (!/^communications\/[^/]+\/(incoming|outgoing)\/[^/]+$/i.test(line)) continue;
    let bytes = null;
    try { bytes = git('show', `${commit}^:${line}`); } catch { continue; }
    if (recordedOriginals.has(sha256(bytes))) continue;
    const was = split(bytes);
    if (!was.problem && was.header?.id) problems.push(`${line}: message ${was.header.id} was deleted in ${commit.slice(0, 7)}; a message is never deleted`);
  }
} catch { /* no history */ }

const ids = new Map(messages.map((m) => [m.header.id, m]));

// A header other tools cannot parse is a finding, unless a later message corrects it (Rule 1: a correction is a
// new message whose in_reply_to names the message it corrects; the committed bytes never change).
for (const m of messages) {
  if (!m.yamlProblems?.length) continue;
  const corrected = messages.some((c) => c.header.in_reply_to === m.header.id && c.header.from === m.header.from);
  if (!corrected) for (const y of new Set(m.yamlProblems)) problems.push(`${m.path}: ${y}`);
}
for (const m of messages) {
  const r = m.header.in_reply_to;
  if (!r) continue;
  if (!ids.has(r)) problems.push(`${m.path}: replies to ${r}, which is not in the record`);
  else if (ids.get(r).header.date > m.header.date) problems.push(`${m.path}: replies to ${r}, which is dated later`);
}

const closed = new Set(messages.filter((m) => CLOSING.includes(m.header.type)).map((m) => m.header.in_reply_to));
const today = new Date().toISOString().slice(0, 10);
const days = (d) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
const open = messages
  .filter((m) => OPENING.includes(m.header.type) && !closed.has(m.header.id))
  .sort((a, b) => (a.header.date < b.header.date ? -1 : a.header.date > b.header.date ? 1 : 0))
  .map((m) => ({ id: m.header.id, direction: m.direction, team: m.team, date: m.header.date, days_open: days(m.header.date), requires_act: m.header.requires_act, subject: m.header.subject, path: m.path }));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings: problems, open_threads: open }, null, 2));
} else {
  if (problems.length) { console.log('FINDINGS'); for (const p of problems) console.log(`  ${p}`); console.log(); }
  else console.log(`ok: ${messages.length} message(s), no findings\n`);
  if (!open.length) console.log('No open threads.');
  else {
    console.log(`OPEN THREADS (${open.length}): awaiting an answer or acknowledgment`);
    for (const o of open) {
      const who = o.direction === 'outgoing' ? `we asked ${o.team}` : `${o.team} asked us`;
      console.log(`  ${o.date}  (${o.days_open}d)  ${o.id}\n      ${who}: ${o.subject}${o.requires_act ? '  [requires act]' : ''}`);
      if (o.direction === 'outgoing') console.log('      Announced? The record cannot say (Rule 6). If not yet: run tools/alert.py from Skreen5hot/communications on the message file.');
    }
  }
}
process.exit(problems.length ? 1 : 0);
