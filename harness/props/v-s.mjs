// OS-3: properties V-S1 … V-S6 of spec/sdd-service.md §7, run against the product as a black box (the CLI through
// child processes; for V-S1's platform parity, the built page dist/index.html through Playwright/Chromium).
// Written from spec/ (§3, §4, §7), the fixtures, the term list, the proposal schema and harness/UI-CONTRACT.md only.
//
//   node harness/props/v-s.mjs [--out results.json] [--only V-S1,V-S3] [--scale 1] [--seed run-tag] [--jobs 4] [--keep]
//
// Seeds: every case's seed is `<run-tag>/<property>/<i>` and is recorded in the results. A failing case's working
// directory (its inputs and outputs) is kept and named in the failure record; passing ones are deleted.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir, cpus, totalmem, release, platform, arch } from 'node:os';
import { createServer } from 'node:http';
import { Rng } from './rng.mjs';
import { g1, render, toBytes, permute, editDescriptions, withDescriptions, editModel, expected, esc, unesc, validateAtlassian } from './g1.mjs';
import { K1, k1Description } from './k1.mjs';
import { Assignment, correctProposal, correctMappings, toPaste, parsePrompt, TERM_LIST, TERMS, isIceDescended, ICE_CLASSES, NON_ICE_CLASSES, CLASSES, OBJECT_PROPERTIES } from './proposal.mjs';
import { sdd, stderrCode, brief, ROOT, setParallelism, stats } from './run.mjs';
import { sha, canon, isCanonical, rd, rj, wr, CTX, AT_RE, dirFiles, sameDir, firstDiff, mkdirp, Prop, itemHashes } from './common.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SCALE = Number(arg('--scale', '1'));
const TAG = arg('--seed', `run-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}`);
const ONLY = (arg('--only', 'V-S1,V-S2,V-S3,V-S4,V-S5,V-S6')).split(',');
const KEEP = process.argv.includes('--keep');
setParallelism(Number(arg('--jobs', String(Math.max(2, cpus().length)))));
const N = (n) => Math.max(1, Math.ceil(n * SCALE));
const WORK = mkdtempSync(join(tmpdir(), 'sdd-props-'));
const F = (p) => join(ROOT, 'fixtures/jira-assets', p);
const W = (p) => join(ROOT, 'fixtures/witnesses', p);
const TERMS_SHA = TERM_LIST.terms_sha256;
const FORBIDDEN = /\b(correct|approved|accepted|verified)\b/i;
const escSep = (s) => s.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const caseDir = (prop, i) => mkdirp(join(WORK, prop, String(i)));
const finish = (P, c) => { P.end(c); if (c.ok && !KEEP && c.dir) try { rmSync(c.dir, { recursive: true, force: true }); } catch {} };
async function pool(items, n, fn) { let i = 0; const run = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }; await Promise.all(Array.from({ length: n }, run)); }
const netlogFor = (id) => join(WORK, `netguard-${id}.log`);
function netguardClause(P, id) {
  const f = netlogFor(id); const txt = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const c = P.begin(`${TAG}/${id}/netguard`); P.check(c, 'network guard log empty for every CLI call of this property (R-S16/NG-S4)', txt.length === 0 ? true : txt.slice(0, 500)); 
  P.extra.netguardLogBytes = txt.length;
}

// ---------- chain helpers ----------
async function parseSkel(dir, bytes, netlog, tag = '') {
  const S = join(dir, `schema${tag}.json`), I = join(dir, `inv${tag}.jsonld`), K = join(dir, `sk${tag}.jsonld`);
  wr(S, bytes);
  const p = await sdd(['parse', S, '--out', I], { netlog });
  if (p.code !== 0) return { p, S, I };
  const k = await sdd(['skeleton', I, '--out', K], { netlog });
  return { p, k, S, I, K, inv: rj(I), sk: k.code === 0 ? rj(K) : null };
}
const promptFiles = (d) => readdirSync(d).filter((f) => /^prompt-\d+-of-\d+\.txt$/.test(f)).sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
// A rejected variant of a correct proposal: drop one key, and (if any attribute) give one iceClass a non-ICE class.
function rejectedVariant(prop, rng, hostileKey = null) {
  const o = JSON.parse(JSON.stringify(prop));
  if (o.mappings.length > 1) o.mappings.splice(rng.int(0, o.mappings.length - 1), 1);
  const at = o.mappings.find((m) => 'iceClass' in m); if (at) at.iceClass = rng.pick(NON_ICE_CLASSES);
  if (hostileKey && o.mappings.length) { const m = rng.pick(o.mappings); m.key = m.key + hostileKey; }
  if (!at && o.mappings.length <= 0) o.mappings.push({ key: 'zz:unknown', recordClass: 'cco:ont00000958', referentClass: 'cco:ont00000958', rationale: 'x' });
  return o;
}

// =====================================================================================================
// V-S1: determinism and platform parity
// =====================================================================================================
async function VS1(results, env) {
  const P = new Prop('V-S1', 'Two runs give identical bytes, and the Node CLI and the browser build give identical bytes (C-S1–C-S5, C-S7; C-S6 except acceptance.at). Generator: all fixtures + G1, n ≥ 200.');
  const nl = netlogFor('V-S1');
  const fixtures = ['minimal-organization.json', 'minimal-organization-v2.json', 'minimal-organization-v3-removed.json', 'synthetic-it-assets.json', 'synthetic-it-assets-externalids.json', 'hostile-separators.json', 'hostile-placeholders.json', ...readdirSync(F('invalid')).map((f) => 'invalid/' + f)];
  const cases = [
    ...fixtures.map((f, i) => ({ i, seed: `fixture:${f}`, fixture: f, bytes: rd(F(f)) })),
    ...Array.from({ length: N(200) }, (_, k) => ({ i: fixtures.length + k, seed: `${TAG}/V-S1/${k}` })),
  ];
  const parity = [];
  await pool(cases, 6, async (cs) => {
    const c = P.begin(cs.seed); c.dir = caseDir('V-S1', cs.i);
    const rng = new Rng(cs.seed + '/run');
    let model = null, bytes = cs.bytes, rerunBytes;
    if (!cs.fixture) { const g = g1(cs.seed); model = g.model; bytes = g.bytes; rerunBytes = toBytes(render(editModel(model, rng.fork('edit')).model)); }
    else if (cs.fixture === 'minimal-organization.json') rerunBytes = rd(F('minimal-organization-v2.json'));
    else { try { rerunBytes = Buffer.from(JSON.stringify(editDescriptions(JSON.parse(bytes.toString('utf8')), rng.fork('edit')), null, 2) + '\n'); } catch { rerunBytes = bytes; } }
    const S = join(c.dir, 'schema.json'); wr(S, bytes); const S2 = join(c.dir, 'schema-v2.json'); wr(S2, rerunBytes);
    const o = (n) => join(c.dir, n);
    // run a command twice (two output paths), compare exit, stderr and every output byte
    const twice = async (step, mk, { dir = false, mask = null, json = true } = {}) => {
      const A = mk('a'), B = mk('b');
      const tA0 = Date.now(); const ra = await sdd(A.args, { netlog: nl }); const tA1 = Date.now(); const rb = await sdd(B.args, { netlog: nl });
      let ba = A.out ? (dir ? dirFiles(A.out) : existsSync(A.out) ? rd(A.out) : null) : ra.stdout;
      let bb = B.out ? (dir ? dirFiles(B.out) : existsSync(B.out) ? rd(B.out) : null) : rb.stdout;
      let ok = ra.code === rb.code ? true : `exit ${ra.code} vs ${rb.code}`;
      if (ok === true && ra.stderr !== rb.stderr) ok = `stderr differs: ${ra.stderr.slice(0, 200)} | ${rb.stderr.slice(0, 200)}`;
      if (ok === true) {
        if (dir) ok = sameDir(ba, bb);
        else if ((ba == null) !== (bb == null)) ok = 'one run wrote output, the other did not';
        else if (ba && bb) { const ma = mask ? mask(ba) : ba, mb = mask ? mask(bb) : bb; ok = Buffer.compare(ma, mb) === 0 ? true : firstDiff(ma, mb); }
      }
      P.check(c, `two runs identical: ${step}`, ok, { input: c.dir, command: [A.args, B.args], output: [brief(ra), brief(rb)] });
      // R-S1 canonical bytes for JSON-LD outputs
      if (json && ra.code !== 2) { const files = dir ? Object.entries(ba || {}).filter(([k]) => k.endsWith('.jsonld')).map(([, v]) => v) : ba && ba.length ? [ba] : []; for (const f of files) P.check(c, 'R-S1 canonical bytes (JSON.stringify(v,null,2)+LF)', isCanonical(f), { input: c.dir, command: A.args }); }
      return { r: ra, out: A.out, bytes: ba, tA0, tA1 };
    };
    try {
      const parse = await twice('parse', (t) => ({ args: ['parse', S, '--out', o(`inv.${t}.jsonld`)], out: o(`inv.${t}.jsonld`) }));
      if (cs.fixture === 'minimal-organization.json') P.check(c, 'pinned W-CS1-N', parse.bytes && Buffer.compare(parse.bytes, rd(W('minimal/inventory.jsonld'))) === 0 ? true : 'inventory differs from minimal/inventory.jsonld', { command: parse.r.argv });
      if (parse.r.code !== 0) return; // invalid fixture: determinism of the error inventory only
      const I = o('inv.a.jsonld');
      const skel = await twice('skeleton', (t) => ({ args: ['skeleton', I, '--out', o(`sk.${t}.jsonld`)], out: o(`sk.${t}.jsonld`) }));
      const K = o('sk.a.jsonld');
      if (cs.fixture === 'minimal-organization.json') P.check(c, 'pinned W-CS2-N', Buffer.compare(skel.bytes, rd(W('minimal/skeleton.jsonld'))) === 0 ? true : 'skeleton differs', {});
      const pd = await twice('prompt (default budget)', (t) => ({ args: ['prompt', K, I, '--out-dir', o(`pd.${t}`)], out: o(`pd.${t}`) }), { dir: true });
      await twice('prompt (budget 69000)', (t) => ({ args: ['prompt', K, I, '--budget', '69000', '--out-dir', o(`pb.${t}`)], out: o(`pb.${t}`) }), { dir: true });
      if (pd.r.code !== 0) { P.check(c, 'prompt succeeds on a parsed schema', false, { command: pd.r.argv, output: brief(pd.r) }); return; }
      if (cs.fixture === 'minimal-organization.json') {
        P.check(c, 'pinned W-CS3-N', Buffer.compare(pd.bytes['prompt-1-of-1.txt'] || Buffer.alloc(0), rd(W('minimal/prompt.txt'))) === 0 && Buffer.compare(pd.bytes['prompt-set.jsonld'], rd(W('minimal/prompt-set.jsonld'))) === 0 ? true : 'prompt or prompt-set differs', {});
        const pin = await sdd(['check', K, join(o('pd.a'), 'prompt-1-of-1.txt'), W('minimal/proposal-pasted.txt')], { netlog: nl });
        P.check(c, 'pinned W-CS4-N', Buffer.compare(pin.stdout, rd(W('minimal/check-report.jsonld'))) === 0 ? true : firstDiff(pin.stdout, rd(W('minimal/check-report.jsonld'))), { command: pin.argv });
      }
      const pfiles = promptFiles(o('pd.a'));
      const P1 = join(o('pd.a'), pfiles[0]); const ptext = readFileSync(P1, 'utf8');
      const asg = new Assignment(cs.seed + '/asg');
      const prop = correctProposal(ptext, asg); const paste = toPaste(prop, rng.pick(['fenced', 'bare'])); wr(o('paste.txt'), paste);
      const ck = await twice('check (valid paste)', (t) => ({ args: ['check', K, P1, o('paste.txt'), '--out', o(`rep.${t}.jsonld`)], out: o(`rep.${t}.jsonld`) }));
      const bad = rejectedVariant(prop, rng.fork('bad')); const badPaste = toPaste(bad); wr(o('bad.txt'), badPaste);
      const ckb = await twice('check (rejected paste)', (t) => ({ args: ['check', K, P1, o('bad.txt'), '--out', o(`bad.${t}.jsonld`)], out: o(`bad.${t}.jsonld`) }));
      let rep2 = null;
      if (ckb.bytes && rj(o('bad.a.jsonld')).status === 'rejected') {
        await twice('repair', (t) => ({ args: ['repair', K, I, o('bad.a.jsonld'), P1, '--out', o(`repair.${t}.txt`)], out: o(`repair.${t}.txt`) }), { json: false });
        if (existsSync(o('repair.a.txt'))) {
          const prop2 = correctProposal(readFileSync(o('repair.a.txt'), 'utf8'), asg); wr(o('paste2.txt'), toPaste(prop2));
          const c2 = await twice('check (round 2)', (t) => ({ args: ['check', K, o('repair.a.txt'), o('paste2.txt'), '--out', o(`rep2.${t}.jsonld`)], out: o(`rep2.${t}.jsonld`) }));
          if (c2.bytes && rj(o('rep2.a.jsonld')).status === 'validated') rep2 = o('rep2.a.jsonld');
        }
      }
      const repOk = ck.bytes && rj(o('rep.a.jsonld')).status === 'validated';
      P.check(c, 'harness: correct proposal validates', repOk ? true : `correct proposal rejected: ${ck.bytes ? JSON.stringify(rj(o('rep.a.jsonld')).errors.slice(0, 3)) : 'no report'}`, { command: ck.r.argv, input: c.dir });
      if (!repOk) return;
      const maskAt = (buf) => { const j = JSON.parse(buf.toString('utf8')); for (const m of j.mappings || []) if (m.acceptance) { if (!AT_RE.test(m.acceptance.at)) m.acceptance.at = 'MALFORMED:' + m.acceptance.at; else m.acceptance.at = 'MASKED'; } return Buffer.from(canon(j)); };
      const keys = prop.mappings.map((m) => m.key);
      const dec = { by: rng.pick(['Aaron Damiano', 'Dét Ermin \u{1F600}', 'Tester "Q"']), decisions: keys.map((k) => ({ key: k, decision: rng.bool(0.8) ? 'accept' : 'reject' })), nullEquivalents: {} };
      for (const m of prop.mappings) if ('iceClass' in m && rng.bool(0.3)) dec.nullEquivalents[m.key] = rng.sample(['N/A', '-', 'none', 'Ø'], rng.int(1, 3));
      wr(o('dec.json'), JSON.stringify(dec));
      const checked = ['--checked', o('rep.a.jsonld'), o('paste.txt'), ...(rep2 ? ['--checked', rep2, o('paste2.txt')] : [])];
      const acc = await twice('accept (acceptance.at masked)', (t) => ({ args: ['accept', K, I, o('dec.json'), ...checked, '--out', o(`sdd.${t}.jsonld`)], out: o(`sdd.${t}.jsonld`) }), { mask: maskAt });
      if (acc.bytes) { const s = JSON.parse(acc.bytes.toString()); for (const m of s.mappings || []) if (m.acceptance) P.check(c, 'acceptance.at is ISO-8601 UTC within ±5 s of the act', AT_RE.test(m.acceptance.at) && Date.parse(m.acceptance.at) >= acc.tA0 - 5000 && Date.parse(m.acceptance.at) <= acc.tA1 + 5000 ? true : `at=${m.acceptance.at}`, {}); }
      if (acc.r.code === 0) await twice('rerun', (t) => ({ args: ['rerun', S2, o('sdd.a.jsonld'), '--out-dir', o(`rr.${t}`)], out: o(`rr.${t}`) }), { dir: true });
      // browser parity material
      const item = { c, cs, schemaBytes: bytes, cliPrompts: pfiles.map((f) => pd.bytes[f]), dir: c.dir };
      if (pfiles.length === 1 && (cs.fixture || cs.i % 4 === 0)) {
        const decAll = { by: 'Parity Tester', decisions: keys.map((k) => ({ key: k, decision: 'accept' })), nullEquivalents: {} }; wr(o('decall.json'), JSON.stringify(decAll));
        const aa = await sdd(['accept', K, I, o('decall.json'), '--checked', o('rep.a.jsonld'), o('paste.txt'), '--out', o('sddall.jsonld')], { netlog: nl });
        if (aa.code === 0 && existsSync(o('repair.a.txt'))) Object.assign(item, { paste, badPaste, cliSdd: rd(o('sddall.jsonld')), cliRepair: rd(o('repair.a.txt')), maskAt });
      }
      parity.push(item);
    } catch (e) { P.check(c, 'harness exception', 'exception: ' + e.stack.slice(0, 500), { input: c.dir }); }
    finally { if (!parity.find((x) => x.c === c)) finish(P, c); }
  });
  log(`V-S1 CLI part done: ${P.cases} cases finished early, ${parity.length} for browser parity`);
  await browserParity(P, parity, env);
  netguardClause(P, 'V-S1');
  P.notChecked.push(
    'Browser parity of Inventory, Skeleton, PromptSet, CheckReport and RerunPlan bytes: the page exposes no control that yields these artifacts as bytes (UI-CONTRACT.md lists only Copy prompt / Copy repair prompt / Save SDD); their browser counterparts are observable only as rendered text, so only prompt, repair-prompt and SDD bytes are compared.',
    'Browser parity of multi-batch accept: the page has one paste box; the SDD subset is restricted to single-batch schemas.',
    'Browser parity of C-S7 (rerun): not compared bytewise; the page shows the plan as lists, not bytes.',
  );
  results['V-S1'] = P.json();
}

// ---------- browser ----------
async function browserParity(P, items, env) {
  let chromium;
  try { ({ chromium } = await import(new URL('../node_modules/playwright/index.mjs', import.meta.url).href)); } catch (e) { P.notes.push('Playwright unavailable: ' + e.message); for (const it of items) finish(P, it.c); return; }
  const DIST = join(ROOT, 'dist');
  const server = await new Promise((res) => { const s = createServer((req, rsp) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); rsp.end(readFileSync(f)); }).listen(0, '127.0.0.1', () => res(s)); });
  const BASE = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true });
  env.chromium = browser.version(); env.pageSha256 = sha(rd(join(DIST, 'index.html')));
  let done = 0;
  await pool(items, 1, async (it) => { // one at a time: the system clipboard is shared by every browser context
    const { c } = it; let context;
    try {
      context = await browser.newContext({ acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage(); page.on('dialog', (d) => d.dismiss());
      const reqs = []; let loaded = false; page.on('request', (r) => { if (loaded && !/^(blob|data):/.test(r.url())) reqs.push(r.url()); });
      await page.goto(BASE, { waitUntil: 'load' }); await context.setOffline(true); loaded = true;
      const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
      await page.setInputFiles('input[aria-label="Open schema"]', { name: 'schema.json', mimeType: 'application/json', buffer: it.schemaBytes }); await settle();
      await page.getByRole('button', { name: 'Build prompt', exact: true }).click(); await settle();
      const batches = page.locator('[data-testid="batch"]');
      const copy = async (i, name = 'Copy prompt') => { await page.evaluate(() => navigator.clipboard.writeText('')); await batches.nth(i).getByRole('button', { name, exact: true }).click(); await page.waitForFunction(() => navigator.clipboard.readText().then((t) => t.length > 0), null, { timeout: 30000 }); return Buffer.from(await page.evaluate(() => navigator.clipboard.readText()), 'utf8'); };
      const nb = await batches.count();
      P.check(c, 'browser = CLI: batch count', nb === it.cliPrompts.length ? true : `page ${nb} vs CLI ${it.cliPrompts.length}`, { input: it.dir });
      for (let i = 0; i < Math.min(nb, it.cliPrompts.length); i++) { const b = await copy(i); P.check(c, 'browser = CLI: prompt bytes (Copy prompt)', Buffer.compare(b, it.cliPrompts[i]) === 0 ? true : `batch ${i + 1}: ${firstDiff(b, it.cliPrompts[i])}`, { input: it.dir }); }
      if (it.cliSdd) {
        await page.getByLabel('Paste reply').fill(it.paste); await page.getByRole('button', { name: 'Check reply', exact: true }).click(); await settle(); await page.locator('[data-testid="status"]').waitFor();
        await page.getByLabel('Your name').fill('Parity Tester');
        await page.getByRole('button', { name: /^Accept all \d+ validated$/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click(); await settle();
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save SDD', exact: true }).click()]);
        const saved = readFileSync(await dl.path()); wr(join(it.dir, 'browser-sdd.jsonld'), saved);
        const a = it.maskAt(saved), b = it.maskAt(it.cliSdd);
        P.check(c, 'browser = CLI: saved SDD bytes (acceptance.at masked)', Buffer.compare(a, b) === 0 ? true : firstDiff(a, b), { input: it.dir });
        P.check(c, 'browser SDD is canonical (R-S1)', isCanonical(saved), { input: it.dir });
        await page.getByLabel('Paste reply').fill(it.badPaste); await page.getByRole('button', { name: 'Check reply', exact: true }).click(); await settle();
        await page.getByRole('button', { name: 'Build repair prompt', exact: true }).click(); await settle();
        const n2 = await batches.count(); const rp = await copy(n2 - 1, 'Copy repair prompt');
        P.check(c, 'browser = CLI: repair prompt bytes', Buffer.compare(rp, it.cliRepair) === 0 ? true : firstDiff(rp, it.cliRepair), { input: it.dir });
        P.extra.browserSddCompared = (P.extra.browserSddCompared || 0) + 1;
      }
      P.check(c, 'browser: no request after load', reqs.length === 0 ? true : reqs.join(', '), {});
      P.extra.browserSchemas = (P.extra.browserSchemas || 0) + 1;
    } catch (e) { P.check(c, 'browser parity harness exception', 'exception: ' + e.message.split('\n')[0], { input: it.dir }); }
    finally { if (context) await context.close().catch(() => {}); finish(P, c); if (++done % 25 === 0) log(`V-S1 browser ${done}/${items.length}`); }
  });
  await browser.close(); server.close();
}

// =====================================================================================================
// V-S2: key soundness
// =====================================================================================================
async function VS2(results) {
  const P = new Prop('V-S2', 'Keys unique or E-SRC-KEY-COLLISION naming every colliding key; key set invariant under permutation and description edits; keys unescape to source identifiers; flags sorted and shaped (R-S19); no slot from a children edge; one containment slot per nested selector. G1, n ≥ 200.');
  const nl = netlogFor('V-S2');
  const SHAPES = { 'FL-CONTAINMENT': ['code', 'key', 'container', 'selector'], 'FL-INHERITED-USE': ['code', 'key', 'attributes'], 'FL-NO-LABEL': ['code', 'key'], 'FL-SELECT-VALUES-UNKNOWN': ['code', 'key'], 'FL-UNMAPPED-TYPE': ['code', 'key'] };
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  let collisionCases = 0;
  await pool(Array.from({ length: N(200) }, (_, i) => i), 6, async (i) => {
    const seed = `${TAG}/V-S2/${i}`; const c = P.begin(seed); c.dir = caseDir('V-S2', i);
    try {
      const g = g1(seed, { collisionRate: 0.15 }); const rng = new Rng(seed + '/t');
      if (g.exp.colliding.length) collisionCases++;
      const perm = permute(g.schema, rng.fork('p')); const ed = editDescriptions(g.schema, rng.fork('e')); const pe = editDescriptions(perm, rng.fork('pe'));
      for (const v of [perm, ed, pe]) { const e = validateAtlassian(v); if (e.length) throw new Error('variant invalid vs Atlassian schema'); }
      const variants = [['original', g.bytes], ['permuted', toBytes(perm)], ['descriptions edited', toBytes(ed)], ['permuted + edited', toBytes(pe)]];
      const keySets = [];
      for (const [name, bytes] of variants) {
        const S = join(c.dir, `${name.replace(/\W+/g, '-')}.json`); wr(S, bytes);
        const r = await sdd(['parse', S], { netlog: nl }); const info = { input: S, command: r.argv, output: brief(r) };
        let inv; try { inv = JSON.parse(r.stdout.toString('utf8')); } catch { P.check(c, 'parse output is JSON', false, info); continue; }
        if (g.exp.colliding.length === 0) {
          const keys = [...inv.objectTypes.map((o) => o.key), ...inv.attributes.map((a) => a.key)];
          P.check(c, 'keys unique or E-SRC-KEY-COLLISION names every colliding key', r.code === 0 && new Set(keys).size === keys.length ? true : `exit ${r.code}, ${keys.length - new Set(keys).size} duplicate keys, errors ${JSON.stringify(inv.errors).slice(0, 300)}`, info);
          keySets.push([name, JSON.stringify([...keys].sort())]);
          P.check(c, 'oracle: key set equals the R-S2 keys computed from the generator model', JSON.stringify([...keys].sort()) === JSON.stringify(g.exp.keys.filter((k) => !k.startsWith('ct:')).sort()) ? true : 'key sets differ', info);
          // unescape to source identifier, from the inventory's own fields
          const tname = new Map(inv.objectTypes.map((o) => [o.key, o.name]));
          let bad = [];
          for (const o of inv.objectTypes) if (unesc(o.key.slice(3)) !== (o.externalId ?? o.name) || !o.key.startsWith('ot:')) bad.push(o.key);
          for (const a of inv.attributes) {
            if (a.externalId != null) { if (unesc(a.key.slice(3)) !== a.externalId) bad.push(a.key); }
            else { const parts = a.key.slice(3).split('/'); if (parts.length !== 2 || unesc(parts[0]) !== tname.get(a.owner) || unesc(parts[1]) !== a.name) bad.push(a.key); }
          }
          // and against the model's identifiers (names/externalIds of the generator)
          for (const s of g.exp.sourceIds) { if (!keys.includes(s.key)) bad.push('missing ' + s.key); }
          P.check(c, 'every key unescapes (RFC 6901) to its source identifier', bad.length ? bad.slice(0, 5).join(' | ') : true, info);
          P.check(c, 'source.identification per R-S2', inv.source.identification === g.exp.identification ? true : `${inv.source.identification} vs ${g.exp.identification}`, info);
          // flags
          const fl = inv.flags || [];
          let shape = true;
          for (let k = 1; k < fl.length; k++) if ((cmp(fl[k - 1].code, fl[k].code) || cmp(fl[k - 1].key, fl[k].key)) > 0) { shape = `not sorted at ${k}: ${fl[k - 1].code} ${fl[k - 1].key} > ${fl[k].code} ${fl[k].key}`; break; }
          for (const f of fl) { const s = SHAPES[f.code]; if (!s) { shape = `unexpected code ${f.code}`; break; } if (Object.keys(f).join(',') !== s.join(',')) { shape = `${f.code} ${f.key} fields ${Object.keys(f)} want ${s}`; break; } if (f.attributes && JSON.stringify(f.attributes) !== JSON.stringify([...f.attributes].sort())) { shape = `FL-INHERITED-USE attributes not sorted ${f.key}`; break; } }
          P.check(c, 'flags sorted and shaped per R-S19', shape, info);
          P.check(c, 'oracle: flags equal the R-S19 set computed from the generator model', JSON.stringify(fl) === JSON.stringify(g.exp.flags) ? true : `got ${JSON.stringify(fl).slice(0, 400)} want ${JSON.stringify(g.exp.flags).slice(0, 400)}`, info);
          if (name === 'original' || name === 'permuted + edited') {
            const I = join(c.dir, `${name.replace(/\W+/g, '-')}.inv.jsonld`); wr(I, r.stdout);
            const k = await sdd(['skeleton', I], { netlog: nl });
            let sk; try { sk = JSON.parse(k.stdout.toString()); } catch { P.check(c, 'skeleton succeeds', false, { command: k.argv, output: brief(k) }); continue; }
            const by = (kind) => sk.slots.filter((s) => s.kind === kind).map((s) => s.key).sort();
            const want = g.exp.slots;
            const ok = ['type', 'attribute', 'reference'].every((kd) => JSON.stringify(by(kd)) === JSON.stringify([...want[kd]].sort())) && sk.slots.every((s) => ['type', 'attribute', 'reference', 'containment'].includes(s.kind));
            P.check(c, 'no slot is derived from a children edge (slots = items + nested selectors)', ok ? true : `slot keys differ: ${JSON.stringify(sk.slots.map((s) => s.key)).slice(0, 300)}`, { command: k.argv });
            const ct = sk.slots.filter((s) => s.kind === 'containment');
            const ctOk = ct.length === g.exp.containment.length && g.exp.containment.every((e) => ct.filter((s) => s.key === e.key && s.child === e.child && s.container === e.container).length === 1);
            P.check(c, 'every nested selector yields exactly one containment slot (R-S4)', ctOk ? true : `got ${JSON.stringify(ct)} want ${JSON.stringify(g.exp.containment)}`, { command: k.argv });
          }
        } else {
          const coll = (inv.errors || []).filter((e) => e.code === 'E-SRC-KEY-COLLISION').map((e) => e.key);
          const ok = r.code === 1 && g.exp.colliding.every((k) => coll.includes(k)) && coll.every((k) => g.exp.colliding.includes(k));
          P.check(c, 'keys unique or E-SRC-KEY-COLLISION names every colliding key', ok ? true : `exit ${r.code}; colliding ${JSON.stringify(g.exp.colliding)}; errors ${JSON.stringify(inv.errors).slice(0, 400)}`, info);
          P.check(c, 'R-S3: errored inventory has empty objectTypes and attributes', inv.objectTypes?.length === 0 && inv.attributes?.length === 0 ? true : 'non-empty', info);
          keySets.push([name, JSON.stringify([...coll].sort())]);
        }
      }
      P.check(c, 'key set invariant under permutation and description edits', keySets.every(([, k]) => k === keySets[0][1]) ? true : keySets.map(([n, k]) => `${n}: ${k.slice(0, 120)}`).join(' | '), { input: c.dir });
    } catch (e) { P.check(c, 'harness exception', e.stack.slice(0, 400), { input: c.dir }); }
    finally { finish(P, c); }
  });
  P.extra.collisionCases = collisionCases;
  netguardClause(P, 'V-S2');
  results['V-S2'] = P.json();
}

// =====================================================================================================
// V-S3: coverage closure
// =====================================================================================================
async function VS3(results) {
  const P = new Prop('V-S3', 'validated ⇒ mapping keys = DATA keys; every mutation caught with its code; batches partition the slot keys; every boundary forced (R-S12); budget 50,000 ⇒ E-PROMPT-BUDGET. G1 × budgets {69,000, 200,000} × proposals with 0–3 dropped/duplicated/renamed keys, n ≥ 200 triples; budget 50,000 on every schema.');
  const nl = netlogFor('V-S3');
  let triples = 0; const mutStats = { drop: 0, dup: 0, rename: 0, zero: 0 };
  await pool(Array.from({ length: N(100) }, (_, i) => i), 6, async (i) => {
    const seed = `${TAG}/V-S3/${i}`; const c = P.begin(seed); c.dir = caseDir('V-S3', i);
    try {
      const g = g1(seed); const rng = new Rng(seed + '/m'); const asg = new Assignment(seed + '/asg');
      const ps = await parseSkel(c.dir, g.bytes, nl);
      if (!ps.sk) { P.check(c, 'parse+skeleton succeed on G1', false, { command: ps.p.argv, output: brief(ps.k || ps.p) }); return; }
      const slotKeys = ps.sk.slots.map((s) => s.key);
      const p50 = join(c.dir, 'p50'); const r50 = await sdd(['prompt', ps.K, ps.I, '--budget', '50000', '--out-dir', p50], { netlog: nl });
      P.check(c, 'budget 50,000 ⇒ E-PROMPT-BUDGET (exit 1, nothing written)', r50.code === 1 && stderrCode(r50)?.code === 'E-PROMPT-BUDGET' && (!existsSync(p50) || readdirSync(p50).length === 0) ? true : `exit ${r50.code} stderr ${r50.stderr.slice(0, 200)} dirExists ${existsSync(p50)}`, { command: r50.argv, output: brief(r50) });
      for (const budget of [69000, 200000]) {
        const D = join(c.dir, `p${budget}`); const r = await sdd(['prompt', ps.K, ps.I, '--budget', String(budget), '--out-dir', D], { netlog: nl });
        const info = { input: c.dir, command: r.argv, output: brief(r) };
        if (r.code !== 0) { P.check(c, 'prompt succeeds', false, info); continue; }
        const files = promptFiles(D); const texts = files.map((f) => readFileSync(join(D, f), 'utf8')); const pp = texts.map(parsePrompt);
        const set = rj(join(D, 'prompt-set.jsonld'));
        const all = pp.flatMap((p) => p.data.map((d) => d.key));
        P.check(c, "the batches' DATA keys partition the skeleton's slot keys", JSON.stringify(all) === JSON.stringify(slotKeys) ? true : `concat of DATA keys (${all.length}) ≠ slot keys (${slotKeys.length})`, info);
        P.check(c, 'R-S12: every batch is whole groups (starts with a type slot)', pp.every((p) => p.data.length && p.data[0].kind === 'type') ? true : 'a batch does not start at a group', info);
        // label-independent size: bytes of the prompt rendered with label 1/1 (the label occurs twice: header and example)
        const size1 = texts.map((t, k) => Buffer.byteLength(t) - 2 * (Buffer.byteLength(pp[k].batch) - 3));
        const groups = (p) => { const gs = []; for (const d of p.dataLines) { if (JSON.parse(d).kind === 'type') gs.push([]); gs[gs.length - 1].push(d); } return gs; };
        const gb = (g) => g.reduce((a, l) => a + Buffer.byteLength(l) + 1, 0);
        let forced = true, oversize = [];
        for (let k = 0; k < pp.length; k++) {
          const gs = groups(pp[k]);
          if (size1[k] > budget) { if (gs.length !== 1) { forced = `batch ${k + 1} has ${gs.length} groups and ${size1[k]} > budget bytes`; break; } oversize.push({ key: pp[k].data[0].key, bytes: size1[k] }); }
          if (k + 1 < pp.length) { const next = groups(pp[k + 1])[0]; if (!(size1[k] + gb(next) > budget)) { forced = `boundary after batch ${k + 1} not forced: ${size1[k]} + ${gb(next)} ≤ ${budget}`; break; } }
        }
        P.check(c, 'every batch boundary is forced (greedy fill, R-S12)', forced, info);
        const wantW = oversize.map((o) => ({ code: 'W-PROMPT-OVERSIZE', key: o.key, bytes: o.bytes, budget }));
        P.check(c, 'R-S12: W-PROMPT-OVERSIZE exactly for oversize groups (extra)', JSON.stringify(set.warnings) === JSON.stringify(wantW) ? true : `got ${JSON.stringify(set.warnings).slice(0, 300)} want ${JSON.stringify(wantW).slice(0, 300)}`, info);
        // the triple
        triples++;
        const bi = rng.int(0, pp.length - 1); const P1 = join(D, files[bi]);
        const prop = correctProposal(texts[bi], asg); const keys = prop.mappings.map((m) => m.key);
        const nm = rng.int(0, 3); const victims = rng.sample(keys, nm); const expectErr = []; const muts = [];
        let maps = prop.mappings.slice();
        for (const k of victims) {
          const op = rng.pick(['drop', 'dup', 'rename']); muts.push(`${op} ${k}`); mutStats[op]++;
          const idx = maps.findIndex((m) => m.key === k);
          if (op === 'drop') { maps.splice(idx, 1); expectErr.push(['E-CHK-MISSING', k]); }
          else if (op === 'dup') { maps.splice(idx + 1, 0, { ...maps[idx] }); expectErr.push(['E-CHK-DUPLICATE', k]); }
          else { const nk = k + ' (renamed)'; maps[idx] = { ...maps[idx], key: nk }; expectErr.push(['E-CHK-MISSING', k], ['E-CHK-UNKNOWN-KEY', nk]); }
        }
        if (!nm) mutStats.zero++;
        const pasteP = join(c.dir, `paste-${budget}.txt`); wr(pasteP, toPaste({ ...prop, mappings: maps }, rng.pick(['fenced', 'bare'])));
        const ck = await sdd(['check', ps.K, P1, pasteP], { netlog: nl }); let rep; try { rep = JSON.parse(ck.stdout.toString()); } catch { P.check(c, 'check produces a report', false, { command: ck.argv, output: brief(ck) }); continue; }
        const ci = { input: pasteP, command: ck.argv, output: { exit: ck.code, errors: rep.errors?.slice(0, 8) }, mutations: muts };
        if (rep.status === 'validated') P.check(c, 'validated ⇒ mapping keys = the DATA keys exactly', JSON.stringify(maps.map((m) => m.key)) === JSON.stringify(pp[bi].data.map((d) => d.key)) ? true : 'validated with keys ≠ DATA keys', ci);
        const got = (rep.errors || []).map((e) => [e.code, e.key]);
        const caught = expectErr.every(([cd, k]) => got.some(([gc, gk]) => gc === cd && gk === k));
        P.check(c, 'every mutation is caught with its code', caught && (nm === 0) === (rep.status === 'validated') ? true : `mutations ${muts.join('; ')}; status ${rep.status}; errors ${JSON.stringify(got).slice(0, 300)}`, ci);
        const exact = got.length === expectErr.length && caught;
        P.check(c, 'no error beyond the mutations (extra: the base proposal is correct)', exact ? true : `expected ${JSON.stringify(expectErr)} got ${JSON.stringify(got).slice(0, 300)}`, ci);
      }
    } catch (e) { P.check(c, 'harness exception', e.stack.slice(0, 400), { input: c.dir }); }
    finally { finish(P, c); }
  });
  P.extra.triples = triples; P.extra.mutations = mutStats; P.extra.schemas = P.cases;
  P.notes.push(`n counts schemas; each schema yields 2 triples (budgets 69,000 and 200,000) plus the 50,000 run: ${triples} triples.`);
  netguardClause(P, 'V-S3');
  results['V-S3'] = P.json();
}

// =====================================================================================================
// V-S4: untrusted text containment
// =====================================================================================================
async function VS4(results) {
  const P = new Prop('V-S4', '(i) DATA lines parse as JSON; source strings only as JSON-escaped values inside DATA; (ii) exactly one END DATA line, no CR/U+2028/U+2029; (iii) description-only pairs in one batch differ only inside DATA and in the 2 skeleton-hash occurrences. Every prompt and repair prompt, G1 with K1, n ≥ 200.');
  const nl = netlogFor('V-S4');
  const FIELDS = { type: ['key', 'kind', 'name', 'description', 'parent', 'selectors'], attribute: ['key', 'kind', 'name', 'description', 'owner', 'jiraType'], reference: ['key', 'kind', 'name', 'description', 'owner', 'target'], containment: ['key', 'kind', 'child', 'container', 'selector'] };
  let promptsChecked = 0, repairChecked = 0, pairs = 0;
  const normOutside = (p) => p.lines.filter((_, k) => k < p.dataStart || k >= p.dataEnd).map((l) => l.replace(/[0-9a-f]{64}/g, 'H').replace(/^batch: .*/, 'batch: L').replace(/^round: .*/, 'round: R').replace(/"batch": "[^"]*"/, '"batch": "L"')).join('\n');
  const contain = (c, text, what, info, descMap, baseline) => {
    const ii = !text.includes('\r') && !/[\u2028\u2029]/.test(text);
    const endLines = text.split('\n').filter((l) => l === '-----END DATA-----').length;
    P.check(c, '(ii) exactly one LF-delimited line equals -----END DATA-----', endLines === 1 ? true : `${endLines} END DATA lines in ${what}`, info);
    P.check(c, '(ii) no CR, U+2028 or U+2029 in the prompt', ii ? true : `${what}: CR ${text.includes('\r')} U+2028 ${text.includes('\u2028')} U+2029 ${text.includes('\u2029')}`, info);
    let p; try { p = parsePrompt(text); } catch (e) { P.check(c, '(i) every DATA line parses as JSON', `${what}: ${e.message}`, info); return null; }
    let bad = null;
    for (const l of p.dataLines) { let o; try { o = JSON.parse(l); } catch { bad = `unparsable DATA line ${l.slice(0, 80)}`; break; } if (escSep(JSON.stringify(o)) !== l) { bad = `DATA line is not JSON.stringify(+U+2028/9 escapes): ${l.slice(0, 80)}`; break; } const f = FIELDS[o.kind]; if (!f || Object.keys(o).join() !== f.join()) { bad = `DATA fields ${Object.keys(o)} for ${o.kind}`; break; } if ('description' in o && descMap.has(o.key) && descMap.get(o.key) !== o.description) { bad = `description of ${o.key} not carried verbatim`; break; } }
    P.check(c, '(i) every DATA line parses as JSON (R-S11 field set, verbatim JSON-escaped source text)', bad ?? true, info);
    const out = normOutside(p);
    let leak = null;
    for (const d of descMap.values()) if (d.length >= 6 && out.includes(d) && !baseline.includes(d)) { leak = d; break; }
    if (!leak && baseline && out.split('\n').filter((l) => !l.startsWith('{"code":') && l !== '' && !/^ERRORS IN YOUR PREVIOUS REPLY|^Your previous reply/.test(l)).join('\n') !== baseline.split('\n').filter((l) => l !== '').join('\n')) leak = 'text outside DATA differs from the plain-description baseline';
    P.check(c, '(i) source strings occur only inside DATA (outside-DATA text independent of descriptions)', leak ? `${what}: ${JSON.stringify(leak).slice(0, 200)}` : true, info);
    return p;
  };
  await pool(Array.from({ length: N(200) }, (_, i) => i), 6, async (i) => {
    const seed = `${TAG}/V-S4/${i}`; const c = P.begin(seed); c.dir = caseDir('V-S4', i);
    try {
      const g = g1(seed); const rng = new Rng(seed + '/v'); const asg = new Assignment(seed + '/asg');
      const descMap = new Map(g.exp.sourceIds.map((s, k) => [s.key, g.exp.descriptions[k]]));
      // plain-description baseline
      const plain = JSON.parse(JSON.stringify(g.model)); for (const t of plain.types) { t.desc = 'plain'; for (const a of t.attrs) a.desc = 'plain'; }
      const b0 = await parseSkel(mkdirp(join(c.dir, 'plain')), toBytes(render(plain)), nl);
      const ps = await parseSkel(c.dir, g.bytes, nl);
      if (!ps.sk || !b0.sk) { P.check(c, 'parse+skeleton succeed', false, { command: ps.p.argv, output: brief(ps.p) }); return; }
      const D0 = join(c.dir, 'plain', 'p'); await sdd(['prompt', b0.K, b0.I, '--out-dir', D0], { netlog: nl });
      const baseline = normOutside(parsePrompt(readFileSync(join(D0, promptFiles(D0)[0]), 'utf8')));
      const D = join(c.dir, 'p'); const r = await sdd(['prompt', ps.K, ps.I, '--out-dir', D], { netlog: nl });
      if (r.code !== 0) { P.check(c, 'prompt succeeds', false, { command: r.argv, output: brief(r) }); return; }
      const files = promptFiles(D);
      let p1 = null;
      for (const f of files) { const t = readFileSync(join(D, f), 'utf8'); const p = contain(c, t, f, { input: join(D, f), command: r.argv }, descMap, baseline); promptsChecked++; if (!p1) p1 = { p, t, f }; }
      // repair prompt; half the time a renamed key carrying K1 text (it reaches the ERRORS block)
      const hostile = rng.bool(0.5) ? ' ' + rng.pick(K1.filter((k) => ['u2028', 'u2029', 'end-data', 'newline', 'crlf', 'mixed', 'begin-catalogue'].includes(k.cls))).text : null;
      const prop = correctProposal(p1.t, asg); const bad = rejectedVariant(prop, rng.fork('bad'), hostile);
      const bp = join(c.dir, 'bad.txt'); wr(bp, toPaste(bad)); const R = join(c.dir, 'bad.jsonld');
      const ck = await sdd(['check', ps.K, join(D, p1.f), bp, '--out', R], { netlog: nl });
      if (ck.code === 1 && existsSync(R)) {
        const RP = join(c.dir, 'repair.txt'); const rr = await sdd(['repair', ps.K, ps.I, R, join(D, p1.f), '--out', RP], { netlog: nl });
        const info = { input: c.dir, command: rr.argv, output: brief(rr), hostileKey: hostile };
        if (rr.code === 0) {
          const t = readFileSync(RP, 'utf8'); const p = contain(c, t, 'repair prompt', info, descMap, baseline); repairChecked++;
          if (p) {
            P.check(c, 'repair: same DATA lines as the checked prompt (R-S22, extra)', JSON.stringify(p.dataLines) === JSON.stringify(p1.p.dataLines) ? true : 'DATA lines differ', info);
            const errLines = p.lines.filter((l) => l.startsWith('{"code":'));
            P.check(c, 'repair: every ERRORS line parses as JSON (copied text JSON-escaped)', errLines.length && errLines.every((l) => { try { JSON.parse(l); return true; } catch { return false; } }) ? true : `ERRORS lines ${errLines.length}`, info);
          }
        } else P.check(c, 'repair succeeds on a rejected report', false, info);
      } else P.check(c, 'harness: rejected variant is rejected', false, { command: ck.argv, output: brief(ck) });
      // (iii) pair: same schema, every description replaced; one batch (large budget)
      const g2 = withDescriptions(g.model, rng.fork('pair'));
      const pa = await parseSkel(mkdirp(join(c.dir, 'pairA')), g.bytes, nl), pb = await parseSkel(mkdirp(join(c.dir, 'pairB')), toBytes(render(g2)), nl);
      const DA = join(c.dir, 'pairA', 'p'), DB = join(c.dir, 'pairB', 'p');
      const ra = await sdd(['prompt', pa.K, pa.I, '--budget', '100000000', '--out-dir', DA], { netlog: nl }), rb = await sdd(['prompt', pb.K, pb.I, '--budget', '100000000', '--out-dir', DB], { netlog: nl });
      if (ra.code === 0 && rb.code === 0 && promptFiles(DA).length === 1 && promptFiles(DB).length === 1) {
        pairs++;
        const ta = readFileSync(join(DA, 'prompt-1-of-1.txt'), 'utf8'), tb = readFileSync(join(DB, 'prompt-1-of-1.txt'), 'utf8');
        const A = parsePrompt(ta), B = parsePrompt(tb); const ha = A.skeleton, hb = B.skeleton;
        let res = true;
        if (A.lines.length !== B.lines.length || A.dataStart !== B.dataStart || A.dataEnd !== B.dataEnd) res = 'line structure differs';
        else {
          const diff = []; for (let k = 0; k < A.lines.length; k++) { if (k >= A.dataStart && k < A.dataEnd) continue; if (A.lines[k] !== B.lines[k]) diff.push(k); }
          const occ = (t, h) => t.split(h).length - 1;
          if (diff.some((k) => A.lines[k].split(ha).join(hb) !== B.lines[k])) res = `outside-DATA line differs beyond the skeleton hash: ${JSON.stringify(A.lines[diff.find((k) => A.lines[k].split(ha).join(hb) !== B.lines[k])]).slice(0, 120)}`;
          else if (occ(A.lines.filter((_, k) => k < A.dataStart || k >= A.dataEnd).join('\n'), ha) !== 2) res = `skeleton hash occurs ${occ(ta, ha)} times outside DATA, want 2`;
          else if (ha === hb && diff.length) res = 'same hash but lines differ';
          contain(c, ta, 'pair A', { input: c.dir }, descMap, baseline);
        }
        P.check(c, '(iii) description-only pair: prompts differ only inside DATA and in the 2 skeleton-hash occurrences', res, { input: c.dir, command: [ra.argv, rb.argv] });
      }
    } catch (e) { P.check(c, 'harness exception', e.stack.slice(0, 400), { input: c.dir }); }
    finally { finish(P, c); }
  });
  P.extra = { promptsChecked, repairPromptsChecked: repairChecked, descriptionPairs: pairs };
  netguardClause(P, 'V-S4');
  results['V-S4'] = P.json();
}

// =====================================================================================================
// V-S5: acceptance monotonicity (+ R-S14, R-S23 E-OUT-EXISTS, R-S16 in the same runs); collects SDDs for V-S6
// =====================================================================================================
const SDDS = [];
async function VS5(results) {
  const P = new Prop('V-S5', 'Accepted set changes only at C-S6, only for decided keys or keys moved by R-S17; carried mappings byte-identical; C-S3/C-S4/C-S5 never change it. Same runs: no CLI-composed message contains an R-S14 word; existing --out/--out-dir ⇒ exit 2 E-OUT-EXISTS, unchanged; foreign @context ⇒ exit 1 E-CTX-EXTERNAL, no network attempt. n ≥ 100 sequences, length ≤ 30.');
  const nl = netlogFor('V-S5');
  const opCount = {}; let msgScanned = 0;
  const NAMES = ['Aaron Damiano', 'Approved Verifier', 'Ж. Тестер \u{1F600}', 'Name "quoted" \\ back', 'Correct Accepted'];
  const scan = (c, r, outBytes) => {
    const objs = [];
    const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (typeof v.message === 'string') objs.push(v); Object.values(v).forEach(walk); } };
    for (const l of r.stderr.split('\n')) { try { walk(JSON.parse(l)); } catch {} }
    for (const b of outBytes) { try { walk(JSON.parse(b.toString('utf8'))); } catch {} }
    for (const o of objs) {
      let m = o.message; msgScanned++;
      const copied = Object.entries(o).filter(([k, v]) => k !== 'message' && typeof v === 'string').map(([, v]) => v);
      if (typeof o.value === 'string' && TERMS.get(o.value)) copied.push(TERMS.get(o.value).label);
      for (const s of copied.sort((a, b) => b.length - a.length)) if (s) m = m.split(s).join(' ');
      P.check(c, 'R-S14: no message the CLI composes contains correct/approved/accepted/verified', FORBIDDEN.test(m) ? `message ${JSON.stringify(o.message).slice(0, 200)}` : true, { command: r.argv });
    }
  };
  await pool(Array.from({ length: N(100) }, (_, i) => i), 4, async (i) => {
    const seed = `${TAG}/V-S5/${i}`; const c = P.begin(seed); c.dir = caseDir('V-S5', i);
    const rng = new Rng(seed + '/ops'); const asg = new Assignment(seed + '/asg');
    let fileNo = 0; const fp = (n) => join(c.dir, `${String(fileNo++).padStart(3, '0')}-${n}`);
    const ops = [];
    const run = async (args) => { const r = await sdd(args, { netlog: nl }); ops.push({ argv: args.map((a) => a.replace(c.dir, '<case>')), exit: r.code }); return r; };
    try {
      const g = g1(seed); let model = g.model;
      const st = { prompts: [], reports: [], sdd: null, sddHistory: [] };
      const load = async (bytes) => {
        const S = fp('schema.json'); wr(S, bytes);
        const I = fp('inv.jsonld'); const p = await run(['parse', S, '--out', I]); if (p.code) throw new Error('parse failed ' + p.stderr);
        const K = fp('sk.jsonld'); const k = await run(['skeleton', I, '--out', K]); if (k.code) throw new Error('skeleton failed ' + k.stderr);
        Object.assign(st, { S, I, K, inv: rj(I), sk: rj(K), prompts: [], reports: [] });
      };
      await load(g.bytes);
      const L = rng.int(12, 28); let accepts = 0;
      const accepted = () => new Map((st.sdd?.obj.mappings || []).filter((m) => m.acceptance?.decision === 'accepted').map((m) => [m.key, canon(m)]));
      const verifyHistory = (op) => { for (const h of st.sddHistory) P.check(c, 'C-S3/C-S4/C-S5/C-S7 never change an SDD (files unchanged)', Buffer.compare(rd(h.path), h.bytes) === 0 ? true : `${basename(h.path)} changed after ${op}`, { command: ops.at(-1) }); };
      const doPrompt = async () => {
        const args = ['prompt', st.K, st.I]; const b = rng.pick([null, '69000', '120000']); if (b) args.push('--budget', b);
        if (rng.bool(0.3)) { const ks = rng.sample(st.sk.slots.map((s) => s.key), rng.int(1, 6)); const KF = fp('keys.json'); wr(KF, JSON.stringify(ks)); args.push('--keys', KF); }
        const D = fp('prompts'); args.push('--out-dir', D); const r = await run(args);
        P.check(c, 'harness: prompt succeeds', r.code === 0 ? true : r.stderr.slice(0, 200), { command: r.argv }); scan(c, r, []);
        if (r.code === 0) for (const f of promptFiles(D)) st.prompts.push({ path: join(D, f), text: readFileSync(join(D, f), 'utf8') });
      };
      const doCheck = async (kind) => {
        if (!st.prompts.length) return doPrompt();
        const pr = rng.pick(st.prompts); const prop = correctProposal(pr.text, asg); let obj = prop, text;
        if (kind === 'invalid') {
          obj = JSON.parse(JSON.stringify(prop)); const m = rng.pick(obj.mappings); const how = rng.pick(['drop', 'dup', 'rename', 'category', 'term', 'kind', 'human', 'fields', 'skeleton', 'batch']);
          if (how === 'drop') obj.mappings = obj.mappings.filter((x) => x !== m); else if (how === 'dup') obj.mappings.push({ ...m }); else if (how === 'rename') m.key += '#x';
          else if (how === 'category') { if (m.iceClass) m.iceClass = rng.pick(NON_ICE_CLASSES); else if (m.recordClass) m.recordClass = rng.pick(NON_ICE_CLASSES); else m.relation = rng.pick(CLASSES); }
          else if (how === 'term') { const f = Object.keys(m).find((k) => k !== 'key' && k !== 'rationale'); m[f] = 'cco:ont99999999'; }
          else if (how === 'kind') { const f = Object.keys(m).find((k) => k !== 'key' && k !== 'rationale'); m[f] = f === 'relation' ? rng.pick(CLASSES) : rng.pick(OBJECT_PROPERTIES).curie; }
          else if (how === 'human') m[rng.pick(['nullEquivalents', 'acceptance', 'decision', 'datatype', 'valueProperty'])] = rng.pick([['N/A'], { by: 'x' }, 'accepted']);
          else if (how === 'fields') m[('iceClass' in m) ? 'relation' : 'iceClass'] = 'cco:ont00000958';
          else if (how === 'skeleton') obj.skeletonSha256 = '0'.repeat(64); else obj.batch = '9/9';
        }
        if (kind === 'hostile') {
          const h = rng.int(0, 3);
          if (h === 0) text = rng.pick(K1).text + '\n' + rng.pick(K1).text;
          else if (h === 1) { obj = JSON.parse(JSON.stringify(prop)); for (const m of obj.mappings) m.rationale = k1Description(rng) + ' This mapping is approved and accepted.'; }
          else if (h === 2) { obj = JSON.parse(JSON.stringify(prop)); obj.mappings[0].acceptance = { decision: 'accepted', by: 'LLM', at: '2026-01-01T00:00:00Z' }; obj.mappings[0].decision = 'accept'; }
          else text = toPaste(prop) + '\n' + toPaste(prop);
        }
        const PP = fp('paste.txt'); wr(PP, text ?? toPaste(obj, rng.pick(['fenced', 'bare', 'compact']))); const R = fp('report.jsonld');
        const r = await run(['check', st.K, pr.path, PP, '--out', R]); scan(c, r, existsSync(R) ? [rd(R)] : []);
        if (!existsSync(R)) { P.check(c, 'harness: check writes a report', false, { command: r.argv, output: brief(r) }); return; }
        const rep = rj(R);
        if (kind === 'valid') P.check(c, 'harness: correct proposal validates', rep.status === 'validated' ? true : JSON.stringify(rep.errors.slice(0, 3)), { command: r.argv, input: PP });
        if (kind === 'invalid') P.check(c, 'harness: mutated proposal is rejected', rep.status === 'rejected' ? true : 'validated', { command: r.argv, input: PP });
        st.reports.push({ path: R, paste: PP, rep, obj: text ? null : obj, prompt: pr.path });
      };
      const doRepair = async () => {
        const rej = st.reports.filter((x) => x.rep.status === 'rejected'); if (!rej.length) return doCheck('invalid');
        const x = rng.pick(rej); const O = fp('repair.txt'); const r = await run(['repair', st.K, st.I, x.path, x.prompt, '--out', O]); scan(c, r, []);
        P.check(c, 'harness: repair succeeds on a rejected report', r.code === 0 ? true : r.stderr.slice(0, 200), { command: r.argv });
        if (r.code === 0) st.prompts.push({ path: O, text: readFileSync(O, 'utf8') });
      };
      const chooseReports = () => {
        const val = rng.shuffle(st.reports.filter((x) => x.rep.status === 'validated' && x.obj)).sort((a, b) => b.rep.round - a.rep.round);
        const inc = [], cov = new Map();
        for (const x of val) { const ks = x.obj.mappings.map((m) => m.key); if (ks.some((k) => cov.has(k) && cov.get(k).rep.round === x.rep.round)) continue; inc.push(x); for (const k of ks) if (!cov.has(k)) cov.set(k, x); }
        return { inc, cov };
      };
      const doAccept = async () => {
        const { inc, cov } = chooseReports(); if (!inc.length) return doCheck('valid');
        const keys = rng.sample([...cov.keys()], rng.int(1, cov.size));
        const by = rng.pick(NAMES); const decisions = keys.map((k) => ({ key: k, decision: rng.bool(0.75) ? 'accept' : 'reject' })); const ne = {};
        for (const d of decisions) if (d.decision === 'accept' && st.sk.slots.find((s) => s.key === d.key)?.kind === 'attribute' && rng.bool(0.3)) ne[d.key] = rng.sample(['N/A', '-', 'none', 'Ø', 'null', ''], rng.int(1, 3));
        const DF = fp('decisions.json'); wr(DF, JSON.stringify({ by, decisions, nullEquivalents: ne }));
        let prev = st.sdd, prevPath = st.sdd?.path, tampered = false;
        if (prev && rng.bool(0.1)) { tampered = true; const t = JSON.parse(JSON.stringify(prev.obj)); t.environment.termListSha256 = '0'.repeat(64); prevPath = fp('prev-tampered.jsonld'); wr(prevPath, canon(t)); prev = { obj: t }; }
        const O = fp('sdd.jsonld');
        const args = ['accept', st.K, st.I, DF, ...inc.flatMap((x) => ['--checked', x.path, x.paste]), ...(prevPath ? ['--previous', prevPath] : []), '--out', O];
        const before = accepted(); const t0 = Date.now(); const r = await run(args); const t1 = Date.now(); scan(c, r, existsSync(O) ? [rd(O)] : []);
        const info = { command: r.argv, output: brief(r), input: c.dir };
        if (r.code !== 0 || !existsSync(O)) { P.check(c, 'harness: accept succeeds on validated inputs', false, info); return; }
        const N_ = rj(O); const bytes = rd(O); accepts++;
        // expectations (R-S17, R-S18)
        const hashes = itemHashes(st.inv); const slots = new Set(st.sk.slots.map((s) => s.key));
        const dmap = new Map(decisions.map((d) => [d.key, d.decision]));
        const nm = new Map((N_.mappings || []).map((m) => [m.key, m])); const open = new Set(N_.open || []); const retired = new Map((N_.retired || []).map((m) => [m.key, m]));
        const tlSame = prev ? prev.obj.environment.termListSha256 === TERMS_SHA : true;
        let res = [];
        for (const [k, d] of dmap) {
          const x = cov.get(k); const pm = x.obj.mappings.find((m) => m.key === k); const m = nm.get(k);
          if (d === 'reject') { if (m) res.push(`rejected ${k} is mapped`); if (!open.has(k)) res.push(`rejected ${k} not open`); continue; }
          if (!m) { res.push(`accepted ${k} missing`); continue; }
          for (const f of ['recordClass', 'referentClass', 'iceClass', 'relation', 'rationale']) if ((f in pm) && m[f] !== pm[f]) res.push(`${k}.${f} ${m[f]} ≠ paste ${pm[f]}`);
          const pv = m.provenance || {}; const wantPv = { round: x.rep.round, batch: x.rep.batch, promptSha256: x.rep.promptSha256, proposalSha256: x.rep.proposalSha256, checkReportSha256: sha(rd(x.path)) };
          if (JSON.stringify(pv) !== JSON.stringify(wantPv)) res.push(`${k} provenance ${JSON.stringify(pv)} ≠ highest-round covering report ${JSON.stringify(wantPv)}`);
          const a = m.acceptance || {}; if (a.decision !== 'accepted' || a.by !== by || !AT_RE.test(a.at || '') || Date.parse(a.at) < t0 - 5000 || Date.parse(a.at) > t1 + 5000) res.push(`${k} acceptance ${JSON.stringify(a)}`);
          if (m.source?.itemSha256 !== hashes.get(k)) res.push(`${k} source.itemSha256 ≠ R-S1 item hash`);
          if (m.kind === 'attribute') { const want = [...new Set(ne[k] || [])].sort(); if (JSON.stringify(m.nullEquivalents) !== JSON.stringify(want)) res.push(`${k} nullEquivalents ${JSON.stringify(m.nullEquivalents)} ≠ ${JSON.stringify(want)}`); }
        }
        const prevAcc = new Map((prev?.obj.mappings || []).map((m) => [m.key, m]));
        for (const [k, pm] of prevAcc) {
          if (dmap.has(k)) continue;
          const m = nm.get(k);
          if (!slots.has(k)) { const rt = retired.get(k); if (m) res.push(`removed ${k} still mapped`); if (!rt) res.push(`removed ${k} not retired`); else if (JSON.stringify(rt.acceptance) !== JSON.stringify(pm.acceptance)) res.push(`retired ${k} lost its acceptance record`); continue; }
          if (!tlSame) { if (m) res.push(`${k} carried across a term-list change`); if (!open.has(k)) res.push(`${k} not open after term-list change`); continue; }
          if (hashes.get(k) === pm.source?.itemSha256) { if (!m || canon(m) !== canon(pm)) res.push(`unchanged ${k} not carried byte-identical`); }
          else { if (m) res.push(`changed ${k} carried`); if (!open.has(k)) res.push(`changed ${k} not open`); }
        }
        for (const [k] of nm) if (!(dmap.get(k) === 'accept') && !prevAcc.has(k)) res.push(`${k} mapped but neither decided nor previously mapped`);
        // monotonicity in terms of the accepted set
        const after = new Map((N_.mappings || []).filter((m) => m.acceptance?.decision === 'accepted').map((m) => [m.key, canon(m)]));
        for (const k of new Set([...before.keys(), ...after.keys()])) {
          if (before.get(k) === after.get(k)) continue;
          const moved = !slots.has(k) || !tlSame || (prevAcc.has(k) && hashes.get(k) !== prevAcc.get(k).source?.itemSha256);
          if (!dmap.has(k) && !moved) res.push(`accepted set changed for ${k}, neither decided nor moved by R-S17`);
        }
        if (prevPath === st.sdd?.path || !st.sdd || tampered) { /* before = state SDD */ }
        P.check(c, 'accepted set changes only for decided keys or keys moved by R-S17; carried mappings byte-identical', res.length ? res.slice(0, 6).join(' | ') : true, info);
        st.sdd = { path: O, obj: N_ }; st.sddHistory.push({ path: O, bytes }); SDDS.push({ seed, path: O, bytes, obj: N_ });
      };
      const doAcceptNeg = async () => {
        const { inc, cov } = chooseReports(); const rej = st.reports.find((x) => x.rep.status === 'rejected');
        const how = rng.pick(['unvalidated', 'mismatch', 'uncovered']);
        const DF = fp('decisions.json'); const O = fp('sdd-refused.jsonld'); let args, want;
        if (how === 'unvalidated' && rej) { wr(DF, JSON.stringify({ by: 'X', decisions: [{ key: st.sk.slots[0].key, decision: 'accept' }], nullEquivalents: {} })); args = ['accept', st.K, st.I, DF, '--checked', rej.path, rej.paste, '--out', O]; want = 'E-ACC-UNVALIDATED'; }
        else if (how === 'mismatch' && inc.length) { const x = inc[0]; const PP = fp('paste-altered.txt'); wr(PP, rd(x.paste).toString() + ' '); wr(DF, JSON.stringify({ by: 'X', decisions: [{ key: x.obj.mappings[0].key, decision: 'accept' }], nullEquivalents: {} })); args = ['accept', st.K, st.I, DF, '--checked', x.path, PP, '--out', O]; want = 'E-ACC-MISMATCH'; }
        else if (inc.length) { const unc = st.sk.slots.map((s) => s.key).find((k) => !cov.has(k)); if (!unc) return doCheck('valid'); wr(DF, JSON.stringify({ by: 'X', decisions: [{ key: unc, decision: 'accept' }], nullEquivalents: {} })); args = ['accept', st.K, st.I, DF, ...inc.flatMap((x) => ['--checked', x.path, x.paste]), '--out', O]; want = 'E-ACC-UNCOVERED'; }
        else return doCheck('valid');
        const r = await run(args); scan(c, r, []);
        P.check(c, 'refused accept: exit 1, its code, no SDD written (state unchanged)', r.code === 1 && stderrCode(r)?.code === want && !existsSync(O) ? true : `want ${want}; exit ${r.code} ${r.stderr.slice(0, 200)} written ${existsSync(O)}`, { command: r.argv, output: brief(r) });
      };
      const doRerun = async () => {
        if (!st.sdd) return doPrompt();
        const e = editModel(model, rng.fork('edit' + fileNo)); const bytes = toBytes(render(e.model));
        if (validateAtlassian(JSON.parse(bytes)).length) throw new Error('edited schema invalid');
        const S = fp('schema-edited.json'); wr(S, bytes); const D = fp('rerun');
        const r = await run(['rerun', S, st.sdd.path, '--out-dir', D]); scan(c, r, existsSync(D) ? Object.values(dirFiles(D)) : []);
        const info = { command: r.argv, output: brief(r), edits: e.log };
        if (r.code !== 0) { P.check(c, 'harness: rerun succeeds on an edited G1 schema', false, info); return; }
        const inv = rj(join(D, 'inventory.jsonld')), plan = rj(join(D, 'rerun-plan.jsonld'));
        // R-S17 plan for previously mapped keys
        const h = itemHashes(inv); const res = [];
        for (const m of st.sdd.obj.mappings) {
          const where = !h.has(m.key) ? 'removed' : h.get(m.key) === m.source.itemSha256 ? 'unchanged' : 'changed';
          if (!(plan[where] || []).includes(m.key)) res.push(`${m.key} expected in ${where}`);
        }
        for (const k of h.keys()) if (!st.sdd.obj.mappings.some((m) => m.key === k) && !(st.sdd.obj.open || []).includes(k) && !(plan.added || []).includes(k)) res.push(`new ${k} not in added`);
        for (const f of ['unchanged', 'changed', 'added', 'removed']) if (JSON.stringify(plan[f]) !== JSON.stringify([...(plan[f] || [])].sort())) res.push(`${f} not sorted`);
        const prevId = st.sdd.obj.source.identification, curId = inv.source.identification;
        if (prevId !== curId && !(plan.flags || []).some((f) => f.code === 'FL-KEY-SCHEME-CHANGED')) res.push('identification switched without FL-KEY-SCHEME-CHANGED');
        P.check(c, 'R-S17: rerun plan classifies previously mapped keys by item hash (sorted)', res.length ? res.slice(0, 5).join(' | ') : true, info);
        const K = fp('sk.jsonld'); const k = await run(['skeleton', join(D, 'inventory.jsonld'), '--out', K]);
        if (k.code) { P.check(c, 'harness: skeleton on the rerun inventory', false, { command: k.argv, output: brief(k) }); return; }
        model = e.model; Object.assign(st, { S, I: join(D, 'inventory.jsonld'), K, inv, sk: rj(K), prompts: [], reports: [] });
      };
      const doOutExists = async () => {
        const F1 = fp('existing.txt'); const sentinel = Buffer.from('SENTINEL ' + rng.int(0, 1e9)); wr(F1, sentinel);
        const Dx = fp('existing-dir'); mkdirp(Dx); wr(join(Dx, 'sentinel.txt'), sentinel);
        const val = st.reports.find((x) => x.rep.status === 'validated' && x.obj); const rej = st.reports.find((x) => x.rep.status === 'rejected');
        const cmds = [['parse', st.S, '--out', F1], ['skeleton', st.I, '--out', F1], ['prompt', st.K, st.I, '--out-dir', Dx]];
        if (st.prompts.length) { const PP = fp('p.txt'); wr(PP, toPaste(correctProposal(st.prompts[0].text, asg))); cmds.push(['check', st.K, st.prompts[0].path, PP, '--out', F1]); }
        if (rej) cmds.push(['repair', st.K, st.I, rej.path, rej.prompt, '--out', F1]);
        if (val) { const DF = fp('d.json'); wr(DF, JSON.stringify({ by: 'X', decisions: [{ key: val.obj.mappings[0].key, decision: 'accept' }], nullEquivalents: {} })); cmds.push(['accept', st.K, st.I, DF, '--checked', val.path, val.paste, '--out', F1]); }
        if (st.sdd) cmds.push(['rerun', st.S, st.sdd.path, '--out-dir', Dx]);
        const args = rng.pick(cmds); const r = await run(args); scan(c, r, []);
        const unchanged = Buffer.compare(rd(F1), sentinel) === 0 && readdirSync(Dx).join() === 'sentinel.txt' && Buffer.compare(rd(join(Dx, 'sentinel.txt')), sentinel) === 0;
        P.check(c, 'R-S23: existing --out/--out-dir ⇒ exit 2, E-OUT-EXISTS, target unchanged', r.code === 2 && stderrCode(r)?.code === 'E-OUT-EXISTS' && unchanged ? true : `${args[0]}: exit ${r.code} ${r.stderr.slice(0, 200)} unchanged ${unchanged}`, { command: r.argv, output: brief(r) });
        P.extra.outExistsByCommand = P.extra.outExistsByCommand || {}; P.extra.outExistsByCommand[args[0]] = (P.extra.outExistsByCommand[args[0]] || 0) + 1;
      };
      const doForeign = async () => {
        const foreign = (p) => { const q = fp('foreign-' + basename(p)); wr(q, readFileSync(p, 'utf8').split(CTX).join('https://example.org/ctx.jsonld')); return q; };
        const O = fp('out-foreign'); const cands = [];
        cands.push(['skeleton', [st.I], (x) => ['skeleton', x[0], '--out', O]]);
        cands.push(['prompt', [st.K, st.I], (x) => ['prompt', x[0], x[1], '--out-dir', O]]);
        if (st.prompts.length) { const PP = fp('p.txt'); wr(PP, toPaste(correctProposal(st.prompts[0].text, asg))); cands.push(['check', [st.K], (x) => ['check', x[0], st.prompts[0].path, PP, '--out', O]]); }
        const rej = st.reports.find((x) => x.rep.status === 'rejected'); if (rej) cands.push(['repair', [st.K, st.I, rej.path], (x) => ['repair', x[0], x[1], x[2], rej.prompt, '--out', O]]);
        const val = st.reports.find((x) => x.rep.status === 'validated' && x.obj);
        if (val) { const DF = fp('d.json'); wr(DF, JSON.stringify({ by: 'X', decisions: [{ key: val.obj.mappings[0].key, decision: 'accept' }], nullEquivalents: {} })); cands.push(['accept', [st.K, st.I, val.path, ...(st.sdd ? [st.sdd.path] : [])], (x) => ['accept', x[0], x[1], DF, '--checked', x[2], val.paste, ...(x[3] ? ['--previous', x[3]] : []), '--out', O]]); }
        if (st.sdd) cands.push(['rerun', [st.sdd.path], (x) => ['rerun', st.S, x[0], '--out-dir', O]]);
        const [name, inputs, mk] = rng.pick(cands); const which = rng.int(0, inputs.length - 1);
        const x = inputs.slice(); x[which] = foreign(inputs[which]);
        const before = existsSync(nl) ? readFileSync(nl).length : 0;
        const r = await run(mk(x)); scan(c, r, []);
        const after = existsSync(nl) ? readFileSync(nl).length : 0;
        P.check(c, 'R-S16: foreign @context ⇒ exit 1, E-CTX-EXTERNAL, nothing written, no network attempt', r.code === 1 && stderrCode(r)?.code === 'E-CTX-EXTERNAL' && !existsSync(O) && after === before ? true : `${name} (foreign input #${which} ${basename(inputs[which])}): exit ${r.code} ${r.stderr.slice(0, 200)} written ${existsSync(O)} netlog +${after - before}`, { command: r.argv, output: brief(r) });
        P.extra.foreignByCommand = P.extra.foreignByCommand || {}; P.extra.foreignByCommand[name] = (P.extra.foreignByCommand[name] || 0) + 1;
      };
      const table = [['prompt', 3, doPrompt], ['check-valid', 5, () => doCheck('valid')], ['check-invalid', 2, () => doCheck('invalid')], ['check-hostile', 1.5, () => doCheck('hostile')], ['repair', 2, doRepair], ['accept', 4, doAccept], ['accept-refused', 1, doAcceptNeg], ['rerun', 1.5, doRerun], ['out-exists', 1, doOutExists], ['foreign-context', 1, doForeign]];
      const tot = table.reduce((a, t) => a + t[1], 0);
      await doPrompt();
      for (let k = 1; k < L; k++) {
        let x = rng.next() * tot, op; for (const t of table) { x -= t[1]; if (x < 0) { op = t; break; } } op ||= table[0];
        if (k >= L - 3 && accepts === 0) op = table.find((t) => t[0] === (st.reports.some((r) => r.rep.status === 'validated') ? 'accept' : 'check-valid'));
        opCount[op[0]] = (opCount[op[0]] || 0) + 1;
        const prevAccepted = JSON.stringify([...accepted()]);
        await op[2]();
        if (op[0] !== 'accept') P.check(c, 'the accepted set changes only at C-S6 steps', JSON.stringify([...accepted()]) === prevAccepted ? true : `changed during ${op[0]}`, {});
        verifyHistory(op[0]);
      }
      if (!accepts) { await doCheck('valid'); await doAccept(); }
      P.extra.sequenceLengths = P.extra.sequenceLengths || []; P.extra.sequenceLengths.push(ops.length);
    } catch (e) { P.check(c, 'harness exception', e.stack.slice(0, 500), { input: c.dir }); }
    finally { if (!c.ok) writeFileSync(join(c.dir, 'ops.json'), JSON.stringify(ops, null, 1)); finish(P, c); }
  });
  P.extra.opCount = opCount; P.extra.messagesScanned = msgScanned; P.extra.sdds = SDDS.length;
  P.notes.push('Length counts harness operations (each 1–3 CLI calls); the initial parse+skeleton are setup. A sequence that reaches its last ops without an accept is steered to one, so every sequence yields ≥ 1 SDD for V-S6.');
  P.notes.push('R-S14 scan: every `message` member in stderr JSON and in every JSON artifact written by the call, with the strings it copies (its other string members and the term label of `value`) removed first.');
  P.notes.push('Containment item hash for R-S17 is taken as the sha256 of the FL-CONTAINMENT flag (witness full/sdd.jsonld shows this; R-S1 defines item hashes only for objectTypes/attributes entries).');
  P.notChecked.push('SDD `open` is not asserted to be complete (spec does not say whether never-decided slots are listed); only rejected / changed / term-list-superseded keys are required to be in it.');
  netguardClause(P, 'V-S5');
  results['V-S5'] = P.json();
}

// =====================================================================================================
// V-S6: term closure (on V-S5's SDDs)
// =====================================================================================================
function VS6(results) {
  const P = new Prop('V-S6', 'Every CURIE in the recorded term list, permitted, of its field kind; recordClass/iceClass ICE-descended; absenceKinds present; nullEquivalents sorted; no ISO-8601 date/time except acceptance.at and copied text. Every SDD of V-S5 (≥ 100).');
  const KIND = { recordClass: 'class', referentClass: 'class', iceClass: 'class', relation: 'object_property', valueProperty: 'datatype_property' };
  const DATE = /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}|T\d{2}:\d{2}/;
  const EXEMPT = new Set(['at', 'by', 'rationale', 'name', 'key', 'owner', 'target', 'child', 'container', 'externalId', 'selector']);
  for (const s of SDDS) {
    const c = P.begin(`${s.seed}:${basename(s.path)}`); const info = { input: s.path };
    const o = s.obj;
    P.check(c, 'SDD records the bundled term list', o.environment?.termListSha256 === TERMS_SHA ? true : o.environment?.termListSha256, info);
    const bad = [];
    for (const m of [...(o.mappings || []), ...(o.retired || [])]) {
      for (const [f, kind] of Object.entries(KIND)) {
        if (!(f in m)) continue; const v = m[f];
        if (f === 'relation' && v === 'sdd:NoRelation') { if (m.kind !== 'containment') bad.push(`${m.key} sdd:NoRelation outside containment`); continue; }
        const t = TERMS.get(v); if (!t) { bad.push(`${m.key}.${f} ${v} not in term list`); continue; }
        if (!t.permitted) bad.push(`${m.key}.${f} ${v} not permitted`); if (t.kind !== kind) bad.push(`${m.key}.${f} ${v} kind ${t.kind}`);
      }
    }
    P.check(c, 'every CURIE is in the term list, permitted, and of its field kind', bad.length ? bad.slice(0, 5).join(' | ') : true, info);
    const ice = (o.mappings || []).flatMap((m) => ['recordClass', 'iceClass'].filter((f) => f in m && !isIceDescended(m[f])).map((f) => `${m.key}.${f} ${m[f]}`));
    P.check(c, 'every recordClass and iceClass is ICE-descended', ice.length ? ice.join(' | ') : true, info);
    P.check(c, 'absenceKinds present (R-S15)', JSON.stringify(o.absenceKinds) === JSON.stringify(['missing', 'explicit_null', 'empty_string', 'indistinguishable']) ? true : JSON.stringify(o.absenceKinds), info);
    const ne = (o.mappings || []).filter((m) => m.kind === 'attribute').filter((m) => !Array.isArray(m.nullEquivalents) || JSON.stringify(m.nullEquivalents) !== JSON.stringify([...m.nullEquivalents].sort()));
    P.check(c, 'every attribute mapping carries nullEquivalents, sorted (R-S15)', ne.length ? ne.map((m) => `${m.key} ${JSON.stringify(m.nullEquivalents)}`).join(' | ') : true, info);
    const dates = []; const walk = (v, k) => { if (typeof v === 'string') { if (!EXEMPT.has(k) && DATE.test(v)) dates.push(`${k}=${v}`); } else if (Array.isArray(v)) v.forEach((x) => walk(x, k)); else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk); };
    walk(o, '');
    P.check(c, 'no ISO-8601 date/time value except acceptance.at and copied text (R-S9)', dates.length ? dates.slice(0, 5).join(' | ') : true, info);
    P.end(c);
  }
  P.notes.push('Copied text exempt from the date scan: members at, by, rationale, name, key, owner, target, child, container, externalId, selector (source names/keys, the acceptor name and the LLM rationale).');
  P.notes.push('datatype values (xsd:*) are not term-list CURIEs and are not checked against it; valueProperty is checked as a datatype property.');
  results['V-S6'] = P.json();
}

// =====================================================================================================
const results = {}; const t0 = Date.now();
const env = { node: process.version, os: `${platform()} ${release()} ${arch()}`, cpu: cpus()[0]?.model, cpuCount: cpus().length, memoryBytes: totalmem(), chromium: null, jobs: Number(arg('--jobs', String(Math.max(2, cpus().length)))), scale: SCALE, runTag: TAG, workDir: WORK, startedAt: new Date().toISOString(), termsSha256: TERMS_SHA, cliSha256: sha(rd(join(ROOT, 'src/cli/sdd.mjs'))) };
log(`OS-3 property run ${TAG}, work dir ${WORK}`);
for (const [id, fn] of [['V-S1', VS1], ['V-S2', VS2], ['V-S3', VS3], ['V-S4', VS4], ['V-S5', VS5]]) {
  if (!ONLY.includes(id) && !(id === 'V-S5' && ONLY.includes('V-S6'))) continue;
  log(`${id} start`); await fn(results, env); const r = results[id]; log(`${id}: n=${r.n} pass=${r.pass} fail=${r.fail} (${Math.round(r.ms / 1000)} s)`);
}
if (ONLY.includes('V-S6')) { VS6(results); const r = results['V-S6']; log(`V-S6: n=${r.n} pass=${r.pass} fail=${r.fail}`); }
env.finishedAt = new Date().toISOString(); env.totalMs = Date.now() - t0; env.cliCalls = stats.calls; env.cliMsSum = Math.round(stats.ms);
const out = arg('--out');
const doc = { harness: 'OS-3 (harness/props/v-s.mjs)', spec: 'spec/sdd-service.md §7', environment: env, properties: results };
if (out) writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
for (const [id, r] of Object.entries(results)) { console.log(`\n${id}: n=${r.n} pass=${r.pass} fail=${r.fail}`); for (const [k, v] of Object.entries(r.clauses)) console.log(`  ${v.fail ? 'FAIL' : 'ok  '} ${k}: ${v.pass} pass, ${v.fail} fail`); }
process.exit(Object.values(results).some((r) => r.fail) ? 1 : 0);
