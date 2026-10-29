// OO-2: properties V-O1, V-O2, V-O3 of spec/sdd-operator.md §9 over G2 sessions (g2.mjs, k2.mjs), driving the built
// page (dist/index.html) as a black box through Playwright/Chromium, located only through harness/UI-CONTRACT.md.
// The reliance set (§9) is reconstructed by running the same core steps through the CLI (src/cli/sdd.mjs) as a black
// box, under the H-O2 network guard (run.mjs).
//
//   node harness/props/v-o.mjs --n 300 --seed <tag> --out <file> [--jobs k] [--from i] [--shots <dir>] [--headed]
//
// Seeds: session i has seed `<tag>/V-O/<i>`; G2's sequence, the G1 schema and every runtime choice derive from it.
// Per session the harness keeps a model of the state only CV-O2 acts may change (decisions{key → accept|reject, by},
// acceptorName, nullEquivalents{key → typed text}; decisions held per skeleton, RV-O2 / D1) plus what file loads legitimately bring (carried mappings, R-S17),
// and after every action checks:
//   V-O1  the item rows' decision texts, the name field, the null-equivalents fields and (on save) the SDD against the
//         model; changes only on CV-O2 acts and only for the keys the act names; after a rejected paste the next save
//         equals the save just before it byte for byte (PR-O3(a)).
//   V-O2  the request log after load (every request except blob:/data:) is empty; the CLI reconstruction's
//         netguard.log is empty too (reported separately, not part of the browser property).
//   V-O3  every visible text node is RV-O1 vocabulary, a fixed UI label, or a substring of a reliance-set artifact;
//         no element is created from paste text; PR-O4(b) words outside data-quoted elements only in per-item act
//         texts after a CV-O2 act.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, dirname } from 'node:path';
import { tmpdir, cpus, totalmem, release, platform, arch } from 'node:os';
import { Rng } from './rng.mjs';
import { g2, sessionSchemas, concretePaste, NAMES } from './g2.mjs';
import { Assignment, parsePrompt, TERM_LIST } from './proposal.mjs';
import { sdd, stderrCode, ROOT, setParallelism, stats } from './run.mjs';
import { sha, canon, Prop } from './common.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('--n', '300'));
const FROM = Number(arg('--from', '0'));
const TAG = arg('--seed', `vo-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}`);
const OUT = arg('--out', null);
const JOBS = Number(arg('--jobs', String(Math.max(1, Math.min(6, Math.floor(cpus().length / 2))))));
const SHOTS = arg('--shots', OUT ? join(dirname(OUT), 'v-o-shots') : join(tmpdir(), 'v-o-shots'));
const KEEP = process.argv.includes('--keep');
// --inject-faults: harness self-test. At the first step where an item row exists, the harness itself tampers with
// the page (sets the name field, rewrites one decision text, adds a marker element and an approval word outside any
// quoted element). Every V-O1/V-O3 clause concerned must then FAIL; a run with this flag is not a property run.
const INJECT = process.argv.includes('--inject-faults');
setParallelism(Math.max(2, JOBS * 2));
mkdirSync(SHOTS, { recursive: true });
const DIST = join(ROOT, 'dist');
const W = (p) => join(ROOT, 'fixtures/witnesses', p);
const WORK = mkdtempSync(join(tmpdir(), 'sdd-v-o-'));
const NETLOG = join(WORK, 'netguard.log');
const CTX = 'https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld';
const FORBIDDEN = /\b(correct|approved|accepted|verified)\b/i;
const VALIDATED = 'Validated: structure, coverage, terms and categories checked. Meaning not yet reviewed: accept or reject each mapping.';
const rejectedText = (n) => `Rejected: ${n} problem(s). Nothing from this reply can be used.`;
const rowText = (e) => `${e.code} · ${e.key ?? '—'} · ${e.field ?? '—'} · ${e.value ?? '—'} · ${e.rule} — ${e.message}`;
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

// ---------- properties ----------
const P1 = new Prop('V-O1', 'decisions, acceptorName and nullEquivalents change only on CV-O2 acts, and decisions only for the keys those acts name; after every rejected paste, an SDD saved next is byte-identical to one saved just before it (PR-O3(a)).');
const P2 = new Prop('V-O2', 'the request log after load is empty (and netguard.log is empty).');
const P3 = new Prop('V-O3', 'every text node is RV-O1 vocabulary, a fixed UI label, or a substring of a reliance-set artifact; no paste content is interpreted as markup; PR-O4(b) words occur outside quoted elements only in per-item act texts after a CV-O2 act.');
P1.notChecked.push(
  { clause: 'acceptorName / nullEquivalents for keys whose rows are not on screen', reason: 'observable only through the SDD; checked there on every save (nullEquivalents of in-session accepted attribute mappings), not between saves' },
  { clause: 'decisions for keys with no row on screen between saves', reason: 'the page shows decisions only in item rows; such keys are checked through the next saved SDD only' },
);
P2.notChecked.push({ clause: 'netguard.log of H-O2 runs', reason: 'H-O2 is harness/h-o2.mjs; here only the CLI reconstruction runs under the guard and its log is reported as an extra' });
P3.notChecked.push(
  { clause: 'text inside <textarea>, <input> values, attributes (title, placeholder, aria-label)', reason: 'not text nodes; the paste box echoes the person\'s own paste' },
  { clause: 'text nodes hidden by CSS (display:none / visibility:hidden)', reason: '"every visible text node": hidden nodes skipped' },
  { clause: 'the reliance set is reconstructed with the CLI, not taken from the page\'s own core log', reason: 'the page exposes no harness log; a screen text the page grounds on an artifact the CLI does not produce counts as a failure' },
);

// ---------- serving ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.jsonld': 'application/ld+json', '.json': 'application/json' };
function serve() {
  return new Promise((res) => {
    const s = createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); rsp.end(readFileSync(f));
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

// ---------- reliance corpus ----------
// Each artifact contributes its raw text and every decoded JSON string (a field of the artifact) and number.
class Corpus {
  constructor() { this.parts = []; this.big = ''; this.cache = new Map(); this.names = []; }
  addText(name, text) { this.names.push(name); this.parts.push(String(text)); this.big += '\u0000' + String(text); this.cache.clear(); }
  addJson(name, text) {
    this.addText(name, text);
    let v; try { v = JSON.parse(text); } catch { return; }
    const strs = []; const walk = (x) => { if (typeof x === 'string') strs.push(x); else if (typeof x === 'number') strs.push(String(x)); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) { strs.push(k); walk(y); } };
    walk(v); this.big += '\u0000' + strs.join('\u0000'); this.cache.clear();
  }
  addPaste(name, text) { // the pasted bytes and the strings of any JSON object it carries (whole, or fenced)
    this.addText(name, text);
    const cands = [text.trim()]; const re = /```json\s*\n([\s\S]*?)```/g; let m; while ((m = re.exec(text))) cands.push(m[1]);
    for (const c of cands) { try { const v = JSON.parse(c); this.addJson(name + ' (json)', JSON.stringify(v)); } catch { /* not JSON */ } }
    for (const l of text.split('\n')) { try { const v = JSON.parse(l); if (v && typeof v === 'object') this.addJson(name + ' (line)', l); } catch { } }
  }
  has(t) { if (this.cache.has(t)) return this.cache.get(t); const r = this.big.includes(t); this.cache.set(t, r); return r; }
}
const TERM_TEXT = readFileSync(join(ROOT, 'ontology/term-list.json'), 'utf8');

// ---------- fixed UI labels ----------
// (1) every text node of the page as loaded, before any action (captured per session); (2) the labels the spec and
// UI-CONTRACT name; (3) label templates whose filled part is checked against session data (CV-O3 filename, batch
// label, the 8-hex prefix and byte count of a prompt, the 8-hex prefix of a saved file).
const CONTRACT_LABELS = new Set(['Accept', 'Reject', 'Copy prompt', 'Copy repair prompt', 'Build repair prompt', 'Build prompt', 'Check reply', 'Save SDD', 'Confirm', 'Cancel', 'Null-equivalents', "From the LLM's reply", 'From the source schema', 'Your name', 'Budget (bytes)', '·', '—', '→']);
// Page messages observed in the role=status message area that carry no data. They are not RV-O1 vocabulary; they
// are counted as fixed UI labels (constant strings) and listed in the results so a reader can disagree.
const PAGE_MESSAGES = new Set(['Open a schema first.', 'Build a prompt first.', 'Type your name first.', 'Copied to the clipboard.', 'Check a reply that validates before saving.', 'The file was refused; nothing changed.', 'No open slots: there is nothing to put in a prompt.']);
const CONSTANT_LABELS = new Set(['Previous SDD open:', 'Rerun plan']);
// RV-O1 count templates (registrar decision D2): accepted only when every count equals the length of the list it
// names in the open previous SDD or the current RerunPlan (the CLI's, reconstructed independently of the page).
const PREV_COUNTS = /^(\d+) mapping\(s\), (\d+) open, (\d+) retired\.$/;
const PLAN_HEADING = /^(Unchanged|Changed|Added|Removed) \((\d+)\)$/;
// RV-O4 fixed messages for the two refusals R-S21 has no template for (registrar decision D3); accepted only inside a
// problem row of that code.
const RVO4_FIXED = { 'E-PROMPT-BUDGET': 'The budget is smaller than a prompt with no DATA lines.', 'E-SKEL-ERRORED': 'The schema has source errors, so no skeleton can be made.' };

// ---------- session ----------
let CLIP_LOCK = Promise.resolve();
const SHOT_COUNT = {}; // screenshots: at most 3 per session and 25 per clause over the run
let browser, BASE;
async function runSession(i) {
  const seed = `${TAG}/V-O/${i}`;
  const seq = g2(seed); const schemas = sessionSchemas(seed); const asg = new Assignment(`${seed}/asg`);
  const dir = join(WORK, String(i)); mkdirSync(dir, { recursive: true });
  const c1 = P1.begin(seed), c2 = P2.begin(seed), c3 = P3.begin(seed);
  const trace = []; let shotN = 0; const extras = { pastes: {}, unknownTexts: {}, notes: [] };
  const context = await browser.newContext({ acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const requests = []; let loaded = false;
  context.on('request', (r) => { const u = r.url(); if (loaded && !/^(blob|data):/.test(u)) requests.push(u); });
  page.on('dialog', (d) => { extras.notes.push(`native dialog: ${d.message().slice(0, 100)}`); d.dismiss().catch(() => {}); });
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
  const t0 = Date.now();
  async function load(reload) {
    loaded = false; await context.setOffline(false);
    if (reload) await page.reload({ waitUntil: 'load' }); else await page.goto(BASE, { waitUntil: 'load' });
    await context.setOffline(true); loaded = true;
  }
  await load(false);
  const staticTexts = new Set(await page.evaluate(() => { const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); if (t) o.push(t); } return o; }));

  // model: what only CV-O2 acts may change, plus legitimately loaded state
  const fresh = () => ({ decBySkel: new Map(), name: '', nullEq: new Map(), schema: null, schemaEpoch: 0, prev: null, prevFile: null, plan: null, inv: null, invText: null, skel: null, skelText: null, budget: '', prompts: [], allPrompts: [], corpus: new Corpus(), lastReport: null, pendingSave: null });
  let M = fresh();
  // decisions held under the current skeleton (RV-O2, registrar decision D1), keyed by the CLI skeleton bytes of the open schema
  const dec = () => { const k = M.skelText ?? ''; if (!M.decBySkel.has(k)) M.decBySkel.set(k, new Map()); return M.decBySkel.get(k); };
  const seedCorpus = () => { M.corpus.addJson('input: term list (bundled, C-S3/C-S4 input)', TERM_TEXT); };
  seedCorpus();
  const saved = []; // every file this session saved (survives reloads: they are files on disk)
  let step = -1;
  const fail = async (P, c, clause, detail, observed, expected) => {
    let shot = null;
    SHOT_COUNT[clause] = (SHOT_COUNT[clause] || 0) + 1;
    if (shotN < 3 && SHOT_COUNT[clause] <= 25) { shot = join(SHOTS, `${seed.replace(/[^\w.-]+/g, '_')}-${step}-${P.id}.png`); shotN++; try { await page.screenshot({ path: shot, fullPage: true }); } catch { shot = null; } }
    P.check(c, clause, typeof detail === 'string' ? detail : JSON.stringify(detail), { step, trace: trace.slice(0, step + 1), observed, expected, screenshot: shot });
  };
  const pass = (P, c, clause) => P.check(c, clause, true);

  // ---------- CLI reconstruction ----------
  let fileN = 0; const f = (name) => join(dir, `${fileN++}-${name}`);
  async function cliOpen() { // inventory, skeleton and (with a previous SDD) the rerun plan for the open schema
    M.inv = M.invText = M.skel = M.skelText = M.plan = null;
    if (!M.schema) return;
    const S = f('schema.json'); writeFileSync(S, M.schema.bytes);
    const p = await sdd(['parse', S], { netlog: NETLOG }); M.invText = p.stdout.toString('utf8');
    try { M.inv = JSON.parse(M.invText); M.corpus.addJson('inventory (C-S1)', M.invText); } catch { M.inv = null; }
    if (p.code === 0) {
      const I = f('inventory.jsonld'); writeFileSync(I, M.invText);
      const k = await sdd(['skeleton', I], { netlog: NETLOG });
      if (k.code === 0) { M.skelText = k.stdout.toString('utf8'); M.skel = JSON.parse(M.skelText); M.corpus.addJson('skeleton (C-S2)', M.skelText); M.skelPath = f('skeleton.jsonld'); writeFileSync(M.skelPath, M.skelText); M.invPath = I; }
      else M.corpus.addJson('skeleton refusal', k.stderr.trim());
    } else if (p.stderr) M.corpus.addText('parse refusal', p.stderr);
    if (M.prevFile) {
      const D = f('rerun'); const r = await sdd(['rerun', S, M.prevFile.path, '--out-dir', D], { netlog: NETLOG });
      if (r.code === 0 || existsSync(join(D, 'rerun-plan.jsonld'))) {
        for (const x of ['inventory.jsonld', 'rerun-plan.jsonld']) if (existsSync(join(D, x))) M.corpus.addJson(`rerun ${x} (C-S7)`, readFileSync(join(D, x), 'utf8'));
        try { M.plan = JSON.parse(readFileSync(join(D, 'rerun-plan.jsonld'), 'utf8')); } catch { M.plan = null; }
      } else M.corpus.addText('rerun refusal', r.stderr);
    }
  }
  async function cliPrompts(keys) { // → { shas[], texts[], set } or { refusal }
    if (!M.skelPath) return null;
    const D = f('prompts'); const args = ['prompt', M.skelPath, M.invPath, '--out-dir', D];
    if (keys) { const K = f('keys.json'); writeFileSync(K, JSON.stringify(keys)); args.push('--keys', K); }
    if (M.budget) args.push('--budget', String(M.budget));
    const r = await sdd(args, { netlog: NETLOG });
    if (r.code !== 0) return { refusal: r.stderr, code: stderrCode(r)?.code };
    const setText = readFileSync(join(D, 'prompt-set.jsonld'), 'utf8'); const set = JSON.parse(setText);
    const texts = set.prompts.map((p) => readFileSync(join(D, p.file), 'utf8'));
    return { set, setText, texts, shas: set.prompts.map((p) => p.sha256), paths: set.prompts.map((p) => join(D, p.file)) };
  }
  async function cliCheck(prompt, pasteText) {
    const PP = f('paste.txt'); writeFileSync(PP, pasteText);
    const r = await sdd(['check', prompt.skelPath, prompt.path, PP], { netlog: NETLOG });
    try { return { text: r.stdout.toString('utf8'), report: JSON.parse(r.stdout.toString('utf8')), code: r.code }; } catch { return { refusal: r.stderr, code: r.code }; }
  }

  // ---------- page observation ----------
  async function observe() {
    return page.evaluate(() => {
      const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
      const texts = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement; if (!el || el.closest('script, style, textarea')) continue;
        const t = n.nodeValue; if (!t.trim()) continue; if (!vis(el)) continue;
        const quoted = !!el.closest('[data-quoted]');
        const host = el.closest('[data-testid="decision"], [data-testid="problem-row"], [data-testid="summary"], [data-testid="status"], [role="dialog"], [data-testid="batch"], button, label, [data-testid="message"]');
        const dec = el.closest('[data-testid="decision"]'); const item = el.closest('[data-testid="item"]');
        texts.push({ t, quoted, hostTag: host ? (host.getAttribute('data-testid') || host.getAttribute('role') || host.tagName.toLowerCase()) : null, hostText: host ? host.textContent : null, inDecision: !!dec, itemKey: item ? item.getAttribute('data-key') : null });
      }
      const items = [...document.querySelectorAll('[data-testid="item"]')].map((it) => { const ne = it.querySelector('input[aria-label="Null-equivalents"]'); const d = it.querySelector('[data-testid="decision"]'); const btn = (n) => [...it.querySelectorAll('button')].some((b) => b.textContent.trim() === n && !b.disabled); return { key: it.getAttribute('data-key'), dec: d ? d.textContent : null, ne: ne ? ne.value : null, acts: { accept: btn('Accept'), reject: btn('Reject') } }; });
      const nameEl = document.querySelector('input[aria-label="Your name"]');
      const marks = document.querySelectorAll('[data-k2mark]').length, srcMarks = document.querySelectorAll('[data-k2src]').length;
      const handlers = [...document.querySelectorAll('[onerror], [onload], a[href^="javascript:"]')].length;
      const batches = [...document.querySelectorAll('[data-testid="batch"]')].map((b) => ({ text: b.textContent, sha8: (b.textContent.match(/\b[0-9a-f]{8}\b/) || [null])[0], label: (b.textContent.match(/Batch \d+ of \d+/) || [null])[0], repair: !![...b.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Copy repair prompt') }));
      const st = document.querySelector('[data-testid="status"]');
      const rowsNear = st ? [...(st.parentElement || document).querySelectorAll('[data-testid="problem-row"]')].map((r) => r.textContent) : [];
      const allRows = [...document.querySelectorAll('[data-testid="problem-row"]')].map((r) => r.textContent);
      const msg = document.querySelector('[data-testid="message"]');
      return { texts, items, name: nameEl ? nameEl.value : null, marks, srcMarks, handlers, pwned: !!window.__k2pwned, srcPwned: !!window.__k2srcpwned, batches, status: st ? st.textContent : null, rowsNear, allRows, message: msg ? msg.textContent : '' };
    });
  }

  // allowed decision text for a key with no in-session act: '' or its carried record (R-S17, PR-O1(a))
  const carried = (key) => {
    if (!M.prevFile || !M.plan || !(M.plan.unchanged || []).includes(key)) return null;
    const m = (M.prevFile.json.mappings || []).find((x) => x.key === key); return m && m.acceptance ? m : null;
  };
  const decText = (d) => `${d.d === 'accept' ? 'Accepted' : 'Rejected'} by ${d.by}`;
  const allowedDec = (key) => { const d = dec().get(key); if (d) return [decText(d)]; const cm = carried(key); return cm ? ['', `Accepted by ${cm.acceptance.by}`] : ['']; };

  // ---------- the checks after every action ----------
  let lastObs = null;
  async function checkAll(act) {
    if (INJECT && !extras.injected) {
      const did = await page.evaluate(() => { const it = document.querySelector('[data-testid="item"] [data-testid="decision"]'); if (!it) return false; it.textContent = 'Accepted by Mallory'; document.querySelector('input[aria-label="Your name"]').value = 'Mallory'; const ne = document.querySelector('input[aria-label="Null-equivalents"]'); if (ne) ne.value = 'injected'; const b = document.createElement('b'); b.setAttribute('data-k2mark', 'x'); b.textContent = 'All approved'; document.querySelector('main').appendChild(b); return true; });
      if (did) { extras.injected = step; extras.notes.push(`step ${step}: faults injected by the harness (--inject-faults)`); }
    }
    if (INJECT && !extras.injectedCount) { // D2: a falsified RV-O1 count must fail the grounding clause
      const did = await page.evaluate(() => { const h = document.querySelector('[data-testid="plan"] h4'); if (!h) return false; h.textContent = h.textContent.replace(/\d+/, (n) => String(Number(n) + 7)); return true; });
      if (did) { extras.injectedCount = step; extras.notes.push(`step ${step}: a rerun-plan count falsified by the harness (--inject-faults)`); }
    }
    const o = await observe(); lastObs = o;
    extras.obs = extras.obs || { itemDecisions: 0, nullEqFields: 0, textNodes: 0, steps: 0 };
    extras.obs.steps++; extras.obs.itemDecisions += o.items.length; extras.obs.nullEqFields += o.items.filter((x) => x.ne != null).length; extras.obs.textNodes += o.texts.length;
    // H-4: the shown batches, matched by sha prefix against every prompt the core built in this session (the page
    // re-shows a skeleton's prompt set when that schema is reopened, and keeps it when a rebuild is refused)
    // (only a prompt built on the skeleton now open counts; one from another skeleton stays unmatched and fails)
    { const shown = o.batches.map((b) => b.sha8); const ownSkel = (p) => !!M.skelText && existsSync(p.skelPath) && readFileSync(p.skelPath, 'utf8') === M.skelText;
      const found = shown.map((s8) => [...M.allPrompts].reverse().find((p) => p.sha.startsWith(s8) && ownSkel(p)));
      M.prompts = found.every(Boolean) ? found : M.prompts.filter((p) => shown.includes(p.sha.slice(0, 8))); }
    // V-O2
    if (requests.length) { await fail(P2, c2, 'request log after load is empty', `requests: ${requests.join(', ').slice(0, 500)}`, requests.slice(), []); requests.length = 0; } else pass(P2, c2, 'request log after load is empty');
    // V-O1: decision texts, name field, null-equivalents fields
    let decOk = true;
    for (const it of o.items) {
      const allowed = allowedDec(it.key);
      if (!allowed.includes(it.dec ?? '')) { decOk = false; await fail(P1, c1, 'decision texts change only on CV-O2 acts, only for named keys', `key ${it.key}: shows ${JSON.stringify(it.dec)} after ${act.t}`, it.dec, allowed); }
    }
    if (decOk) pass(P1, c1, 'decision texts change only on CV-O2 acts, only for named keys');
    if (o.name !== M.name) await fail(P1, c1, 'acceptorName changes only on CV-O2 acts', `name field ${JSON.stringify(o.name)} after ${act.t}`, o.name, M.name); else pass(P1, c1, 'acceptorName changes only on CV-O2 acts');
    let neOk = true;
    for (const it of o.items) {
      if (it.ne == null) continue;
      const want = M.nullEq.has(it.key) ? [M.nullEq.get(it.key)] : [''];
      const cm = !M.nullEq.has(it.key) && carried(it.key); if (cm && cm.nullEquivalents?.length) want.push(cm.nullEquivalents.join(', '), cm.nullEquivalents.join(','));
      if (!want.includes(it.ne)) { neOk = false; await fail(P1, c1, 'nullEquivalents change only on CV-O2 acts', `key ${it.key}: field ${JSON.stringify(it.ne)} after ${act.t}`, it.ne, want); }
    }
    if (neOk) pass(P1, c1, 'nullEquivalents change only on CV-O2 acts');
    // V-O3 (b): no element from paste text
    if (o.marks || o.handlers || o.pwned) await fail(P3, c3, 'no paste content is interpreted as markup', `marker elements ${o.marks}, handler attributes ${o.handlers}, script ran ${o.pwned}`, o.marks, 0); else pass(P3, c3, 'no paste content is interpreted as markup');
    if (o.srcMarks || o.srcPwned) { extras.notes.push(`step ${step}: markup from source schema text interpreted (${o.srcMarks} elements, script ran ${o.srcPwned})`); await fail(P3, c3, 'no artifact text interpreted as markup (source schema; RV-O3, beyond the paste clause)', `marker elements ${o.srcMarks}, script ran ${o.srcPwned}`, o.srcMarks, 0); }
    // V-O3 (a) grounded texts and (c) PR-O4(b) words
    const bad = []; const words = [];
    for (const x of o.texts) {
      const t = x.t.trim();
      if (!classify(t, x, o)) bad.push({ t: t.slice(0, 160), host: x.hostTag, quoted: x.quoted });
      if (!x.quoted && FORBIDDEN.test(t)) {
        const okAct = x.inDecision && x.itemKey && /^Accepted by\b/.test(norm(x.hostText || '')) && ((dec().get(x.itemKey)?.d === 'accept') || carried(x.itemKey));
        if (!okAct) words.push({ t: t.slice(0, 120), host: x.hostTag, key: x.itemKey });
      }
    }
    if (bad.length) { for (const b of bad) { const k = b.t.replace(/\d+/g, '#').slice(0, 80); extras.unknownTexts[k] = (extras.unknownTexts[k] || 0) + 1; } await fail(P3, c3, 'every text node is RV-O1 vocabulary, a fixed UI label, or a reliance-set substring', `${bad.length} ungrounded text node(s) after ${act.t}: ${JSON.stringify(bad.slice(0, 5))}`, bad.slice(0, 20), 'vocabulary | label | artifact substring'); }
    else pass(P3, c3, 'every text node is RV-O1 vocabulary, a fixed UI label, or a reliance-set substring');
    if (words.length) await fail(P3, c3, 'PR-O4(b) words outside quoted elements only in act texts after a CV-O2 act', `after ${act.t}: ${JSON.stringify(words.slice(0, 5))}`, words, []); else pass(P3, c3, 'PR-O4(b) words outside quoted elements only in act texts after a CV-O2 act');
    return o;
  }
  const RV_O1 = [
    (s) => s === VALIDATED, (s) => /^Rejected: \d+ problem\(s\)\. Nothing from this reply can be used\.$/.test(s),
    (s) => /^\d+ object types? · \d+ attributes? · \d+ references? · \d+ flags?$/.test(s) && summaryPlural(s),
  ];
  function summaryPlural(s) { const m = s.match(/^(\d+) object type(s?) · (\d+) attribute(s?) · (\d+) reference(s?) · (\d+) flag(s?)$/); if (!m) return false; for (let k = 1; k < 9; k += 2) if ((m[k] === '1') !== (m[k + 1] === '')) return false; return true; }
  function classify(t, x, o) {
    if (x.hostTag === 'problem-row') { const code = norm(x.hostText || '').split(' ')[0]; if (RVO4_FIXED[code] === t) return true; }
    if (!x.quoted) {
      { const m = t.match(PREV_COUNTS); if (m) { const j = M.prevFile?.json; return !!j && [j.mappings, j.open, j.retired].every((l, i) => (l || []).length === Number(m[i + 1])); } }
      { const m = t.match(PLAN_HEADING); if (m) return !!M.plan && (M.plan[m[1].toLowerCase()] || []).length === Number(m[2]); }
      if (RV_O1.some((fn) => fn(t))) return true;
      const h = norm(x.hostText || '');
      // act texts: "Accepted by {name}" / "Rejected by {name}" with the name in a quoted element
      if (x.hostTag === 'decision' && /^(Accepted|Rejected) by$/.test(t) && /^(Accepted|Rejected) by /.test(h)) return true;
      // bulk confirmation: "Accept all {N} validated mappings as {name}?" (name quoted)
      if ((x.hostTag === 'dialog' || x.hostTag === 'p') && /^Accept all \d+ validated mappings as\b/.test(t)) return true;
      if (x.hostTag === 'dialog' && t === '?' && /Accept all \d+ validated mappings as .*\?/.test(h)) return true;
      // RV-O4 separators inside a row
      if (x.hostTag === 'problem-row' && (t === '·' || t === '—')) return true;
      if (staticTexts.has(t) || CONTRACT_LABELS.has(t) || PAGE_MESSAGES.has(t) || CONSTANT_LABELS.has(t) || /^Unchanged mappings are carried with their original records\./.test(t)) return true;
      if (/^Batch \d+ of \d+$/.test(t)) { const [, a, b] = t.match(/(\d+) of (\d+)/); return Number(a) >= 1 && Number(a) <= Number(b) && o.batches.length === Number(b); }
      if (/^Accept all \d+ validated$/.test(t)) return true; // UI-CONTRACT button label
      if (/^[0-9a-f]{8}$/.test(t)) return M.corpus.has(t) || saved.some((s) => s.sha.startsWith(t)); // prompt sha prefix (PromptSet) or saved file prefix
      if (/^\d+ bytes$/.test(t)) return M.allPrompts.some((p) => Buffer.byteLength(p.text, 'utf8') === Number(t.split(' ')[0])); // prompt byte count (PromptSet "bytes")
      if (/^sdd-\d{8}T\d{6}Z\.jsonld$/.test(t)) return saved.some((s) => s.name === t); // CV-O3 filename
      if (/^Saved as a new download: sdd-\d{8}T\d{6}Z\.jsonld$/.test(t)) return saved.some((s) => t.endsWith(s.name));
    }
    return M.corpus.has(t) || M.corpus.has(x.t);
  }

  // ---------- actions ----------
  async function fileInput(label, buf, name) { await page.setInputFiles(`input[aria-label="${label}"]`, { name, mimeType: 'application/json', buffer: buf }); await settle(); }
  // H-3: an act is attempted only on an item showing that control, enabled; items without one are not decidable
  const visibleKeys = (act) => (lastObs ? lastObs.items.filter((x) => x.acts[act]).map((x) => x.key) : []);
  const markCV = () => { M.pendingSave = null; };
  async function doSave(entry) {
    const btn = page.getByRole('button', { name: 'Save SDD', exact: true });
    let dl = null;
    try { [dl] = await Promise.all([page.waitForEvent('download', { timeout: 4000 }), btn.click()]); } catch { dl = null; }
    await settle();
    if (!dl) { entry.result = 'no download'; return null; }
    const bytes = readFileSync(await dl.path()); const name = dl.suggestedFilename(); const p = f('saved.jsonld'); writeFileSync(p, bytes);
    let json = null; try { json = JSON.parse(bytes.toString('utf8')); } catch { }
    const s = { name, bytes, json, sha: sha(bytes), path: p, step }; saved.push(s); entry.result = `saved ${name} ${s.sha.slice(0, 8)}`;
    M.corpus.addJson(`saved SDD ${name} (C-S6, page)`, bytes.toString('utf8'));
    await checkSdd(s);
    // PR-O3(a)
    if (M.pendingSave && M.pendingSave.rejected > 0) {
      const a = M.pendingSave.before;
      if (Buffer.compare(a.bytes, bytes) !== 0) await fail(P1, c1, 'PR-O3(a): after a rejected paste the next save equals the save before it', `save at step ${a.step} vs step ${step} differ (${M.pendingSave.rejected} rejected paste(s) between)`, s.sha, a.sha);
      else pass(P1, c1, 'PR-O3(a): after a rejected paste the next save equals the save before it');
      extras.pr3 = (extras.pr3 || 0) + 1;
    }
    M.pendingSave = { before: s, rejected: 0 };
    return s;
  }
  async function checkSdd(s) {
    const clause = 'saved SDD: mappings only from acts (or carried), decisions as acted, nullEquivalents as typed';
    if (!s.json) { await fail(P1, c1, clause, 'download is not JSON', s.bytes.toString('utf8').slice(0, 100), 'SDD'); return; }
    const problems = [];
    const ms = s.json.mappings || []; const open = s.json.open || [];
    extras.sddMappings = (extras.sddMappings || 0) + ms.length;
    for (const m of ms) {
      const d = dec().get(m.key);
      if (d && d.d === 'accept') {
        if (m.acceptance?.by !== d.by) problems.push(`${m.key}: acceptance.by ${JSON.stringify(m.acceptance?.by)} ≠ acted name ${JSON.stringify(d.by)}`);
        const at = Date.parse(m.acceptance?.at || ''); if (!(at >= t0 - 5000 && at <= Date.now() + 5000)) problems.push(`${m.key}: acceptance.at ${m.acceptance?.at} not within the session`);
        if (m.kind === 'attribute') {
          const want = (M.nullEq.get(m.key) || '').split(',').map((x) => x.trim()).filter(Boolean).sort();
          const got = m.nullEquivalents || [];
          if (JSON.stringify(got) !== JSON.stringify(want) && JSON.stringify(got) !== JSON.stringify([...new Set(want)])) problems.push(`${m.key}: nullEquivalents ${JSON.stringify(got)} ≠ typed ${JSON.stringify(want)}`);
        }
      } else if (d && d.d === 'reject') problems.push(`${m.key}: rejected by act but present as a mapping`);
      else {
        const cm = carried(m.key);
        if (!cm) problems.push(`${m.key}: mapping present with no act in this session and not carried (plan unchanged) from the previous SDD`);
        else if (canon(cm) !== canon(m)) problems.push(`${m.key}: carried mapping not byte-identical to the previous SDD's`);
        else extras.carriedVerified = (extras.carriedVerified || 0) + 1;
      }
    }
    for (const [k, d] of dec()) {
      const slot = M.skel?.slots?.some((x) => x.key === k); if (!slot) continue;
      if (d.d === 'accept' && !ms.some((m) => m.key === k)) problems.push(`${k}: accepted by act (step ${d.step}) but missing from the SDD`);
      if (d.d === 'reject' && !open.includes(k)) problems.push(`${k}: rejected by act but not in open`);
    }
    if (problems.length) await fail(P1, c1, clause, problems.slice(0, 6).join(' | '), problems, 'model'); else pass(P1, c1, clause);
  }
  async function doReport(pasteText) { // match the page's report to a CLI check of the paste against a built prompt
    const o = await observe();
    if (o.status == null || PAGE_MESSAGES.has(norm(o.message))) return { none: true, message: o.message };
    const status = norm(o.status); const rows = o.rowsNear.map(norm).filter((x) => /^E-/.test(x)); const all = o.allRows.map(norm);
    const tried = [];
    for (const pool of [M.prompts, M.allPrompts.filter((p) => !M.prompts.includes(p))]) {
      for (const p of pool) {
        const r = await cliCheck(p, pasteText); if (!r.report) continue;
        const rep = r.report; const wantStatus = rep.status === 'validated' ? VALIDATED : rejectedText(rep.errors.length);
        const wantRows = rep.errors.map((e) => norm(rowText(e))); const wantWarn = rep.warnings.map((e) => norm(rowText(e)));
        tried.push({ batch: rep.batch, round: rep.round, status: rep.status, errors: wantRows.length, warnings: wantWarn.length });
        const pool = all.slice(); const warnOk = wantWarn.every((w) => { const k = pool.indexOf(w); if (k < 0) return false; pool.splice(k, 1); return true; });
        if (wantStatus === status && JSON.stringify(wantRows) === JSON.stringify(rows) && warnOk) { M.corpus.addJson('check report (C-S4)', r.text); return { report: rep, prompt: p }; }
      }
    }
    await fail(P3, c3, 'every text node is RV-O1 vocabulary, a fixed UI label, or a reliance-set substring', `the page's report (status ${JSON.stringify(status.slice(0, 80))}, ${rows.length} error rows, ${all.length} rows on page) equals no CLI check of the paste against a built prompt`, { status, rows: rows.slice(0, 5) }, tried);
    return { unmatched: true, status };
  }

  for (step = 0; step < seq.actions.length; step++) {
    const a = seq.actions[step]; const r = new Rng(`${seed}/a${step}`); const entry = { i: step, t: a.t }; trace.push(entry);
    try {
      switch (a.t) {
        case 'openSchema': {
          const v = schemas.variants.find((x) => x.tag === a.variant); entry.variant = a.variant;
          M.schema = v; M.schemaEpoch++; M.corpus.addJson(`input: schema ${a.variant}`, v.bytes.toString('utf8'));
          await fileInput('Open schema', v.bytes, `${a.variant}.json`); await cliOpen(); M.pendingSave = null; break;
        }
        case 'build': {
          if (a.budget) { await page.getByLabel('Budget (bytes)').fill(String(a.budget)); M.budget = String(a.budget); } entry.budget = M.budget || 'default';
          await page.getByRole('button', { name: 'Build prompt', exact: true }).click(); await settle();
          const o = await observe(); const shown = o.batches.map((b) => b.sha8);
          entry.batches = shown.length;
          if (!shown.length) { M.prompts = []; entry.result = o.message ? `message: ${o.message}` : 'no batch'; if (M.skelPath) { const ref = await cliPrompts(null); if (ref?.refusal) { for (const l of ref.refusal.split('\n').filter((x) => x.trim().startsWith('{'))) M.corpus.addJson('prompt refusal (C-S3)', l); } } break; }
          if (M.skelPath) { const ref = await cliPrompts(null); if (ref?.refusal) { for (const l of ref.refusal.split('\n').filter((x) => x.trim().startsWith('{'))) M.corpus.addJson('prompt refusal (C-S3)', l); } }
          const unchanged = M.prompts.length && JSON.stringify(M.prompts.map((p) => p.sha.slice(0, 8))) === JSON.stringify(shown);
          // which key set did the page prompt for? candidates; matched by the 8-hex prefixes shown
          const slotKeys = (M.skel?.slots || []).map((x) => x.key);
          const accepted = (k) => dec().get(k)?.d === 'accept' || (!dec().has(k) && carried(k));
          const cands = [null, slotKeys.filter((k) => !accepted(k)), slotKeys.filter((k) => !dec().has(k) && !carried(k)), M.plan ? slotKeys.filter((k) => [...(M.plan.changed || []), ...(M.plan.added || [])].includes(k)) : null, M.plan ? slotKeys.filter((k) => [...(M.plan.changed || []), ...(M.plan.added || [])].includes(k) && !accepted(k)) : null, slotKeys.filter((k) => dec().get(k)?.d !== 'accept')];
          const seen = new Set(); let match = null;
          for (const ks of cands) {
            if (ks && !ks.length) continue;
            const id = ks && ks.length !== slotKeys.length ? JSON.stringify(ks) : 'all'; if (seen.has(id)) continue; seen.add(id);
            const cp = await cliPrompts(id === 'all' ? null : ks); if (!cp || cp.refusal) continue;
            if (JSON.stringify(cp.shas.map((x) => x.slice(0, 8))) === JSON.stringify(shown)) { match = { cp, keys: id }; break; }
          }
          if (match) {
            M.corpus.addJson('prompt set (C-S3)', match.cp.setText);
            M.prompts = match.cp.texts.map((t, j) => ({ text: t, path: match.cp.paths[j], sha: match.cp.shas[j], skelPath: M.skelPath }));
            for (const p of M.prompts) M.corpus.addText('prompt (C-S3)', p.text);
            M.allPrompts.push(...M.prompts); entry.keys = match.keys === 'all' ? 'all' : `${JSON.parse(match.keys).length} keys`;
          } else if (unchanged) { entry.keys = 'unchanged batches (no CLI prompt for this build: page kept the shown ones)';
          } else {
            await fail(P3, c3, 'every text node is RV-O1 vocabulary, a fixed UI label, or a reliance-set substring', `built prompt(s) ${JSON.stringify(shown)} match no CLI prompt for any candidate key set`, shown, [...seen]);
            // fall back: read the page's prompts through the clipboard (recorded) so the session can continue
            M.prompts = [];
            for (let j = 0; j < shown.length; j++) { const txt = await copyBatch(j); const p = f('page-prompt.txt'); writeFileSync(p, txt); M.prompts.push({ text: txt, path: p, sha: sha(Buffer.from(txt)), skelPath: M.skelPath }); }
            M.allPrompts.push(...M.prompts); entry.keys = 'unmatched (prompts read from clipboard)';
          }
          break;
        }
        case 'copy': {
          const n = lastObs?.batches.length || 0; if (!n) { entry.result = 'no batch'; break; }
          const j = r.int(0, n - 1); const txt = await copyBatch(j); entry.batch = j;
          const want = M.prompts[j]?.text; entry.result = want == null ? 'copied (no model prompt)' : txt === want ? 'copied = prompt' : 'copied ≠ prompt';
          if (want != null && txt !== want) extras.notes.push(`step ${step}: clipboard differs from the built prompt ${j} (PR-O6, not a V-O property)`);
          break;
        }
        case 'paste': {
          const j = M.prompts.length ? r.int(0, M.prompts.length - 1) : -1;
          const cp = concretePaste(r.fork('paste'), a.kind, j >= 0 ? M.prompts[j].text : null, asg);
          Object.assign(entry, { kind: cp.kind, id: cp.id, cls: cp.cls, batch: j, bytes: Buffer.byteLength(cp.text) });
          extras.pastes[cp.id] = (extras.pastes[cp.id] || 0) + 1;
          M.corpus.addPaste('input: paste', cp.text);
          await page.getByLabel('Paste reply').fill(cp.text); await page.getByRole('button', { name: 'Check reply', exact: true }).click(); await settle();
          const rep = await doReport(cp.text);
          if (rep.none) { entry.result = `no report (${rep.message})`; break; }
          if (rep.report) {
            entry.result = rep.report.status; if (cp.expect !== 'either' && cp.expect !== rep.report.status) extras.notes.push(`step ${step}: ${cp.id} expected ${cp.expect} under the spec, CLI and page both ${rep.report.status}`);
            if (rep.report.status === 'rejected') { if (M.pendingSave) M.pendingSave.rejected++; } else M.pendingSave = null;
          } else { entry.result = `unmatched: ${rep.status?.slice(0, 40)}`; if (/^Rejected:/.test(rep.status || '')) { if (M.pendingSave) M.pendingSave.rejected++; } else M.pendingSave = null; }
          break;
        }
        case 'accept': case 'reject': {
          const keys = visibleKeys(a.t); if (!keys.length) { entry.result = 'no decidable item'; break; }
          const key = r.pick(keys); entry.key = key; markCV();
          const before = dec().get(key);
          await page.locator(`[data-testid="item"][data-key="${CSS_escape(key)}"]`).first().getByRole('button', { name: a.t === 'accept' ? 'Accept' : 'Reject', exact: true }).click(); await settle();
          const now = (await observe()).items.find((x) => x.key === key)?.dec ?? '';
          const want = { d: a.t, by: M.name, step, epoch: M.schemaEpoch };
          const variants = [decText(want), decText({ ...want, by: M.name.trim() })];
          if (variants.includes(now)) { dec().set(key, now === variants[0] ? want : { ...want, by: M.name.trim() }); entry.result = now; }
          else entry.result = `no change (${JSON.stringify(now)})`;
          break;
        }
        case 'acceptAll': {
          markCV();
          const btn = page.getByRole('button', { name: /^Accept all \d+ validated$/ });
          if (!(await btn.count())) { entry.result = 'no bulk button'; break; }
          const label = (await btn.first().textContent()).trim(); const N = Number(label.match(/\d+/)[0]); entry.N = N;
          await btn.first().click(); await settle();
          const dlg = page.getByRole('dialog');
          if (!(await dlg.count())) { entry.result = 'no dialog'; break; }
          const dtext = norm(await dlg.first().textContent()); entry.dialog = dtext.slice(0, 80);
          await checkAll({ t: 'acceptAll (dialog open)' }); // the open confirmation is a screen state too
          const beforeItems = lastObs.items;
          await dlg.first().getByRole('button', { name: a.confirm ? 'Confirm' : 'Cancel', exact: true }).click(); await settle();
          entry.confirm = a.confirm;
          if (!a.confirm) break;
          const after = (await observe()).items; const changed = [];
          for (const it of after) { const b = beforeItems.find((x) => x.key === it.key); if ((b?.dec ?? '') !== (it.dec ?? '')) changed.push(it); }
          const want = `Accepted by ${M.name}`, wantT = `Accepted by ${M.name.trim()}`;
          const okAll = changed.every((it) => it.dec === want || it.dec === wantT);
          if (!okAll || changed.length > N) await fail(P1, c1, 'decision texts change only on CV-O2 acts, only for named keys', `Accept all ${N}: ${changed.length} row(s) changed: ${JSON.stringify(changed.slice(0, 4))}`, changed.map((x) => [x.key, x.dec]), `≤ ${N} rows → ${want}`);
          for (const it of changed) if (it.dec === want || it.dec === wantT) dec().set(it.key, { d: 'accept', by: it.dec === want ? M.name : M.name.trim(), step, epoch: M.schemaEpoch });
          entry.result = `${changed.length} accepted`;
          break;
        }
        case 'name': markCV(); M.corpus.addText('input: typed name', a.value); await page.getByLabel('Your name').fill(a.value); M.name = a.value; entry.value = a.value; break;
        case 'nullEq': {
          const its = (lastObs?.items || []).filter((x) => x.ne != null); if (!its.length) { entry.result = 'no attribute item'; break; }
          markCV(); const it = r.pick(its); entry.key = it.key; entry.text = a.text;
          await page.locator(`[data-testid="item"][data-key="${CSS_escape(it.key)}"]`).first().getByLabel('Null-equivalents').fill(a.text); await settle();
          M.nullEq.set(it.key, a.text); M.corpus.addText('input: typed null-equivalents', a.text); break;
        }
        case 'save': await doSave(entry); break;
        case 'reloadFromSaved': {
          await load(true); const keepSaved = saved.length;
          M = fresh(); seedCorpus(); entry.result = 'reloaded';
          if (keepSaved) { const s = r.pick(saved); entry.file = s.name; await openPrev(s.bytes, s.name, s.json, s.path); }
          else entry.result = 'reloaded (no saved file yet)';
          break;
        }
        case 'openPrevious': {
          let bytes, name, json, path;
          if (a.source === 'saved' && saved.length) { const s = r.pick(saved); ({ bytes, name, json, path } = s); }
          else if (a.source === 'foreign-context') { const base = saved.length ? r.pick(saved).bytes.toString('utf8') : readFileSync(W('minimal/sdd.jsonld'), 'utf8'); bytes = Buffer.from(base.replace(CTX, 'https://example.org/ctx.jsonld')); name = 'foreign.jsonld'; path = f('foreign.jsonld'); writeFileSync(path, bytes); json = JSON.parse(bytes); }
          else { bytes = readFileSync(W('minimal/sdd.jsonld')); name = 'witness-sdd.jsonld'; path = W('minimal/sdd.jsonld'); json = JSON.parse(bytes); }
          entry.source = a.source === 'saved' && !saved.length ? 'witness (no saved file)' : a.source; entry.file = name;
          await openPrev(bytes, name, json, path); break;
        }
      }
    } catch (e) { entry.error = e.message.split('\n')[0].slice(0, 200); extras.notes.push(`step ${step} ${a.t}: harness error ${entry.error}`); }
    try { await checkAll(a); } catch (e) { extras.notes.push(`step ${step}: observe error ${e.message.split('\n')[0].slice(0, 160)}`); }
  }
  async function openPrev(bytes, name, json, path) {
    M.corpus.addJson('input: previous SDD', bytes.toString('utf8'));
    await fileInput('Open previous SDD', bytes, name); M.pendingSave = null;
    if (json && json['@context'] === CTX) { M.prevFile = { json, path }; if (M.schema) await cliOpen(); }
    else { // refusal: the CLI's rerun gives the R-S16 refusal (E-CTX-EXTERNAL); its record is the artifact
      if (M.schema) { const S = f('schema.json'); writeFileSync(S, M.schema.bytes); const rr = await sdd(['rerun', S, path, '--out-dir', f('rerun-x')], { netlog: NETLOG }); M.corpus.addText('rerun refusal (C-S7)', rr.stderr); }
      else { const rr = await sdd(['skeleton', path], { netlog: NETLOG }); M.corpus.addText('context refusal', rr.stderr); }
      M.corpus.addText('R-S21 message', "The file's @context is not the bundled SDD context."); // R-S21's template text for a refusal outside a report (RV-O4)
    }
  }
  async function copyBatch(j) { // the clipboard is shared by the parallel browser contexts: serialise copies
    const prev = CLIP_LOCK; let release; CLIP_LOCK = new Promise((r) => { release = r; }); await prev;
    try { return await copyBatchLocked(j); } finally { release(); }
  }
  async function copyBatchLocked(j) {
    await page.evaluate(() => navigator.clipboard.writeText(''));
    const b = page.locator('[data-testid="batch"]').nth(j);
    await b.getByRole('button', { name: /^Copy (repair )?prompt$/ }).click();
    await page.waitForFunction(() => navigator.clipboard.readText().then((t) => t.length > 0), null, { timeout: 5000 });
    return page.evaluate(() => navigator.clipboard.readText());
  }
  await context.close();
  P1.end(c1); P2.end(c2); P3.end(c3);
  if (!KEEP && c1.ok && c2.ok && c3.ok) rmSync(dir, { recursive: true, force: true });
  return { seed, len: seq.len, schemaMaxTypes: schemas.maxTypes, ok: { 'V-O1': c1.ok, 'V-O2': c2.ok, 'V-O3': c3.ok }, trace, extras, saves: saved.length };
}
const CSS_escape = (s) => s.replace(/["\\]/g, '\\$&');

// ---------- run ----------
const t0 = Date.now();
if (!existsSync(join(DIST, 'index.html'))) { console.error('dist/index.html missing: run node tools/build-site.mjs'); process.exit(2); }
const server = await serve(); BASE = `http://127.0.0.1:${server.address().port}/`;
browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const env = { node: process.version, os: `${platform()} ${release()} ${arch()}`, cpu: cpus()[0]?.model, cpuCount: cpus().length, memoryBytes: totalmem(), chromium: browser.version(), playwright: '1.56.1', runnerImage: process.env.ImageOS ? `${process.env.ImageOS} ${process.env.ImageVersion || ''}`.trim() : null, page: 'dist/ served on 127.0.0.1', distSha256: sha(readFileSync(join(DIST, 'index.html'))), jobs: JOBS, startedAt: new Date().toISOString() };
console.log(`V-O1–V-O3: n=${N} seed=${TAG} jobs=${JOBS} Chromium ${env.chromium}`);
const sessions = []; let next = FROM; let done = 0;
async function worker() {
  while (next < FROM + N) {
    const i = next++;
    let res;
    try { res = await runSession(i); } catch (e) { res = { seed: `${TAG}/V-O/${i}`, crashed: e.message.split('\n')[0] }; console.log(`session ${i} crashed: ${res.crashed}`); }
    sessions.push(res); done++;
    if (done % 10 === 0 || done === N) console.log(`${done}/${N} sessions  ${Math.round((Date.now() - t0) / 1000)} s  fails V-O1 ${P1.caseFail} V-O2 ${P2.caseFail} V-O3 ${P3.caseFail}`);
    if (OUT && done % 25 === 0) write(false);
  }
}
function write(final) {
  const netlog = existsSync(NETLOG) ? readFileSync(NETLOG, 'utf8').split('\n').filter(Boolean) : [];
  const out = {
    environment: { ...env, finishedAt: new Date().toISOString(), runtimeSeconds: Math.round((Date.now() - t0) / 1000) },
    command: `node harness/props/v-o.mjs ${process.argv.slice(2).join(' ')}`, seedTag: TAG, nRequested: N, nCompleted: done, final,
    cli: { calls: stats.calls, ms: Math.round(stats.ms), netguardLogLines: netlog.length, netguardLog: netlog.slice(0, 20) },
    fixedLabelsBeyondRvO1: { pageMessages: [...PAGE_MESSAGES], contractLabels: [...CONTRACT_LABELS], rvO1CountTemplates: 'checked against the previous SDD and RerunPlan list lengths (D2)', rvO4FixedMessages: RVO4_FIXED, templates: ['Batch {i} of {n}', 'Accept all {N} validated', '{8 hex} (prompt or saved-file sha256 prefix)', '{n} bytes (prompt byte count)', 'sdd-YYYYMMDDTHHMMSSZ.jsonld', 'Saved as a new download: {filename}'], staticPage: 'every text node of the page as loaded' },
    properties: [P1.json(), P2.json(), P3.json()],
    unknownTexts: sessions.reduce((acc, s) => { for (const [k, v] of Object.entries(s.extras?.unknownTexts || {})) acc[k] = (acc[k] || 0) + v; return acc; }, {}),
    pasteMix: sessions.reduce((acc, s) => { for (const [k, v] of Object.entries(s.extras?.pastes || {})) acc[k] = (acc[k] || 0) + v; return acc; }, {}),
    actionMix: sessions.reduce((acc, s) => { for (const e of s.trace || []) acc[e.t] = (acc[e.t] || 0) + 1; return acc; }, {}),
    pr3Comparisons: sessions.reduce((a, s) => a + (s.extras?.pr3 || 0), 0),
    observationCounts: sessions.reduce((acc, s) => { const o = s.extras?.obs || {}; for (const k of Object.keys(o)) acc[k] = (acc[k] || 0) + o[k]; acc.sddMappingsChecked = (acc.sddMappingsChecked || 0) + (s.extras?.sddMappings || 0); acc.carriedMappingsVerified = (acc.carriedMappingsVerified || 0) + (s.extras?.carriedVerified || 0); return acc; }, {}),
    outcomes: sessions.reduce((acc, s) => { for (const e of s.trace || []) if (e.t === 'paste' || e.t === 'save' || e.t === 'accept' || e.t === 'reject') { const k = `${e.t}: ${String(e.result || e.error || '').replace(/sdd-\d+T\d+Z\.jsonld [0-9a-f]+/, 'file').replace(/by .*/, 'by …').slice(0, 40)}`; acc[k] = (acc[k] || 0) + 1; } return acc; }, {}),
    injectFaults: INJECT,
    sessions: sessions.map((s) => ({ seed: s.seed, len: s.len, schemaMaxTypes: s.schemaMaxTypes, ok: s.ok, crashed: s.crashed, saves: s.saves, notes: s.extras?.notes?.slice(0, 20), trace: s.trace })),
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
}
await Promise.all(Array.from({ length: JOBS }, worker));
await browser.close(); server.closeAllConnections(); server.close();
if (OUT) write(true);
const crashed = sessions.filter((s) => s.crashed).length;
console.log(`\nV-O1 ${P1.casePass}/${P1.cases} · V-O2 ${P2.casePass}/${P2.cases} · V-O3 ${P3.casePass}/${P3.cases} · crashed ${crashed} · ${Math.round((Date.now() - t0) / 1000)} s · CLI calls ${stats.calls}`);
for (const P of [P1, P2, P3]) for (const [k, v] of Object.entries(P.clauses)) console.log(`  ${P.id}  ${v.fail ? 'FAIL' : 'pass'}  ${k}: ${v.pass} pass, ${v.fail} fail`);
process.exit(P1.caseFail + P2.caseFail + P3.caseFail + crashed ? 1 : 0);
