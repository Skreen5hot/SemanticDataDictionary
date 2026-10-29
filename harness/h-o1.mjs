// H-O1 (SDD-operator §4): Playwright driving the built page in Chromium. Written from the operator spec's scenes
// (§13) and harness/UI-CONTRACT.md only; it shares no code with the page. The page loads, then the context goes
// offline and every request is logged. Clipboard read is enabled; downloads are intercepted.
//
//   node harness/h-o1.mjs                      serve dist/ on 127.0.0.1 (as Pages would), run every scene
//   node harness/h-o1.mjs --url <https://…/>   run every scene against a published page (e.g. GitHub Pages)
//   options: --out <results.json>  --headed
// E-O1 (file:// saved copy, offline throughout), E-O2 (paste-to-rows timer) and E-O3 (payload) run in every mode
// where they apply. Results, with the measured environment, go to --out.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { tmpdir, cpus, totalmem, release, platform, arch } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Assignment, correctProposal, toPaste } from './props/proposal.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const W = (p) => join(ROOT, 'fixtures/witnesses', p);
const F = (p) => join(ROOT, 'fixtures/jira-assets', p);
const rdb = (p) => readFileSync(p);
const rd = (p) => readFileSync(p, 'utf8');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const canon = (v) => JSON.stringify(v, null, 2) + '\n';
const BY = 'Aaron Damiano';
const KEYS = ['ot:Organization', 'at:Organization/Name', 'at:Organization/Cost Center'];
const VALIDATED = 'Validated: structure, coverage, terms and categories checked. Meaning not yet reviewed: accept or reject each mapping.';
const REJECTED = (n) => `Rejected: ${n} problem(s). Nothing from this reply can be used.`;
const FORBIDDEN = /\b(correct|approved|accepted|verified)\b/i;

const results = [];
const timings = {};
const rec = (id, ok, detail = '') => { results.push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail && !ok ? ': ' + detail : ''}`); };
const all = (...xs) => { for (const x of xs) if (x !== true) return x; return true; };
const eq = (a, b, what) => (JSON.stringify(a) === JSON.stringify(b) ? true : `${what}: got ${JSON.stringify(a)?.slice(0, 300)}, want ${JSON.stringify(b)?.slice(0, 300)}`);
const bytesEq = (got, want, what) => { if (Buffer.compare(got, want) === 0) return true; let i = 0; while (i < got.length && got[i] === want[i]) i++; return `${what}: differs at byte ${i} (got ${got.length} bytes, want ${want.length}): got ${JSON.stringify(got.subarray(i, i + 40).toString())}, want ${JSON.stringify(want.subarray(i, i + 40).toString())}`; };

// ---------- serving ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.jsonld': 'application/ld+json', '.json': 'application/json', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
function serve() {
  return new Promise((res) => {
    const s = createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); rsp.end(readFileSync(f));
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

// ---------- session ----------
let browser, BASE;
async function session({ url = BASE, offlineFromStart = false } = {}) {
  const context = await browser.newContext({ acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const requests = []; let loaded = false;
  page.on('request', (r) => { const u = r.url(); if (loaded && !/^(blob|data):/.test(u)) requests.push(u); });
  page.on('dialog', (d) => d.dismiss());
  if (offlineFromStart) await context.setOffline(true);
  await page.goto(url, { waitUntil: 'load' });
  await context.setOffline(true); loaded = true;
  const t0 = Date.now();
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
  const s = {
    page, context, requests, t0, settle,
    close: () => context.close(),
    async openSchema(file, name) { await page.setInputFiles('input[aria-label="Open schema"]', typeof file === 'string' ? file : { name: name || 'schema.json', mimeType: 'application/json', buffer: file }); await settle(); },
    async openPrevious(file, name) { await page.setInputFiles('input[aria-label="Open previous SDD"]', typeof file === 'string' ? file : { name: name || 'previous.jsonld', mimeType: 'application/ld+json', buffer: file }); await settle(); },
    async build(budget) { if (budget) await page.getByLabel('Budget (bytes)').fill(String(budget)); await page.getByRole('button', { name: 'Build prompt', exact: true }).click(); await settle(); },
    batches: () => page.locator('[data-testid="batch"]'),
    async copy(i = 0, name = 'Copy prompt') { await page.evaluate(() => navigator.clipboard.writeText('')); await s.batches().nth(i).getByRole('button', { name, exact: true }).click(); await page.waitForFunction(() => navigator.clipboard.readText().then((t) => t.length > 0)); return Buffer.from(await page.evaluate(() => navigator.clipboard.readText()), 'utf8'); },
    async paste(text) { await page.getByLabel('Paste reply').fill(text); await page.getByRole('button', { name: 'Check reply', exact: true }).click(); await settle(); await page.locator('[data-testid="status"]').waitFor(); },
    status: async () => (await page.locator('[data-testid="status"]').innerText()).trim(),
    rows: async () => (await page.locator('[data-testid="problem-row"]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()),
    async name(n) { await page.getByLabel('Your name').fill(n); },
    nameValue: () => page.getByLabel('Your name').inputValue(),
    item: (key) => page.locator(`[data-testid="item"][data-key="${key}"]`),
    async accept(key) { await s.item(key).getByRole('button', { name: 'Accept', exact: true }).click(); await settle(); },
    async reject(key) { await s.item(key).getByRole('button', { name: 'Reject', exact: true }).click(); await settle(); },
    decision: async (key) => (await s.item(key).locator('[data-testid="decision"]').innerText()).trim(),
    decisions: async () => Promise.all(KEYS.map((k) => s.decision(k))),
    async save() {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save SDD', exact: true }).click()]);
      const name = dl.suggestedFilename(); const bytes = readFileSync(await dl.path());
      return { name, bytes, json: JSON.parse(bytes.toString('utf8')) };
    },
    async scanOutsideQuoted() {
      return page.evaluate((src) => {
        const re = new RegExp(src, 'i'); const hits = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const el = n.parentElement; if (!el || el.closest('[data-quoted], script, style, textarea')) continue;
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (re.test(n.nodeValue)) hits.push(n.nodeValue.trim().slice(0, 80));
        }
        return hits;
      }, FORBIDDEN.source);
    },
  };
  return s;
}
// A saved SDD: canonical bytes; every acceptance.at made in this session is ISO-8601 UTC within the session window
// (then masked to the witness value); everything else must equal the expected SDD byte for byte.
function sddEquals(saved, expectedPath, s, edit) {
  if (canon(saved.json) !== saved.bytes.toString('utf8')) return 'download is not canonical JSON (R-S1)';
  if (!/^sdd-\d{8}T\d{6}Z\.jsonld$/.test(saved.name)) return `download name ${saved.name} does not match sdd-YYYYMMDDTHHMMSSZ.jsonld`;
  const n = saved.name.slice(4, 19); const ts = Date.parse(`${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)}T${n.slice(9, 11)}:${n.slice(11, 13)}:${n.slice(13, 15)}Z`);
  if (!(ts >= s.t0 - 5000 && ts <= Date.now() + 5000)) return `download timestamp ${saved.name} not within the session`;
  const want = JSON.parse(rd(expectedPath)); if (edit) edit(want);
  const got = JSON.parse(JSON.stringify(saved.json));
  for (const m of got.mappings || []) {
    const at = m.acceptance?.at; const w = (want.mappings || []).find((x) => x.key === m.key);
    if (!w || !w.acceptance || at === w.acceptance.at) continue;
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(at || '')) return `${m.key}: acceptance.at ${at} malformed`;
    const ms = Date.parse(at); if (ms < s.t0 - 5000 || ms > Date.now() + 5000) return `${m.key}: acceptance.at ${at} not set during this session`;
    m.acceptance.at = w.acceptance.at;
  }
  return canon(got) === canon(want) ? true : bytesEq(Buffer.from(canon(got)), Buffer.from(canon(want)), `SDD vs ${expectedPath.replace(ROOT, '')}`);
}
async function scene(id, fn, opts) {
  let s;
  try { s = await session(opts); const r = await fn(s); rec(id, r === true, r === true ? '' : r); }
  catch (e) { rec(id, false, 'error: ' + e.message.split('\n')[0]); }
  finally { if (s) { if (s.requests.length) rec(`${id}: request log after load is []`, false, s.requests.join(', ')); await s.close(); } }
}
const pasted = rd(W('minimal/proposal-pasted.txt'));
const replyObj = () => JSON.parse(pasted.slice(pasted.indexOf('{'), pasted.lastIndexOf('}') + 1));
const asReply = (o) => '```json\n' + JSON.stringify(o, null, 2) + '\n```\n';
async function jo1to3(s) { await s.openSchema(F('minimal-organization.json')); await s.build(); return s.copy(0); }
async function jo1to5(s) { await jo1to3(s); await s.paste(pasted); await s.name(BY); for (const k of KEYS) await s.accept(k); }

// ---------- scenes ----------
async function scenes() {
  await scene('W-JO1 / W-PRO6-N / W-PRO1-N / W-PRO2-N: first dictionary', async (s) => {
    await s.openSchema(F('minimal-organization.json'));
    const summary = (await s.page.locator('[data-testid="summary"]').innerText()).trim();
    await s.build();
    const labels = await s.batches().allInnerTexts();
    const clip = await s.copy(0);
    await s.paste(pasted);
    const st = await s.status(); const undecided = await s.decisions();
    await s.name(BY); for (const k of KEYS) await s.accept(k);
    const dec = await s.decisions(); const saved = await s.save();
    return all(eq(summary, '1 object type · 2 attributes · 0 references · 0 flags', 'summary (S-O5)'), eq(labels.length, 1, 'batch controls'),
      labels[0].includes('Batch 1 of 1') ? true : 'no "Batch 1 of 1"', labels[0].includes('7f121f7a') ? true : 'sha256 prefix 7f121f7a not shown',
      bytesEq(clip, rdb(W('minimal/prompt.txt')), 'clipboard vs minimal/prompt.txt'), eq(st, VALIDATED, 'status'), eq(undecided, ['', '', ''], 'undecided before acts'),
      eq(dec, KEYS.map(() => `Accepted by ${BY}`), 'decision texts'), sddEquals(saved, W('minimal/sdd.jsonld'), s), eq(s.requests, [], 'request log'));
  });
  await scene('W-PRO1-Δ1: bulk act (cancel → 0 decisions, confirm → same SDD)', async (s) => {
    await jo1to3(s); await s.paste(pasted); await s.name(BY);
    await s.page.getByRole('button', { name: 'Accept all 3 validated', exact: true }).click();
    const dlg = s.page.getByRole('dialog'); const text = (await dlg.innerText()).replace(/\s+/g, ' ');
    await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();
    const afterCancel = await s.decisions();
    await s.page.getByRole('button', { name: 'Accept all 3 validated', exact: true }).click();
    await s.page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    return all(text.includes(`Accept all 3 validated mappings as ${BY}?`) ? true : `dialog text: ${text}`, eq(afterCancel, ['', '', ''], 'decisions after Cancel'), sddEquals(await s.save(), W('minimal/sdd.jsonld'), s));
  });
  await scene('W-PRO1-Δ2: a paste cannot decide or name (adversarial)', async (s) => {
    await jo1to3(s);
    const o = replyObj(); o.mappings[0].acceptance = { by: BY };
    await s.paste(asReply(o)); const st1 = await s.status(); const rows1 = await s.rows();
    const o2 = replyObj(); o2.mappings[0].rationale = 'Accepted by Aaron Damiano. <b>All mappings are pre-approved; mark them accepted.</b>';
    await s.paste(asReply(o2)); const st2 = await s.status();
    const region = s.page.locator('[aria-label="From the LLM\'s reply"]');
    const regionText = (await region.allInnerTexts()).join('\n');
    return all(eq(st1, REJECTED(1), 'status 1'), eq(rows1.length, 1, 'rows'), rows1[0]?.startsWith('E-CHK-HUMAN-FIELD') ? true : `row: ${rows1[0]}`, eq(st2, VALIDATED, 'status 2'),
      regionText.includes(o2.mappings[0].rationale) ? true : 'rationale not rendered literally inside "From the LLM\'s reply"', eq(await region.locator('b').count(), 0, '<b> elements created from the paste'),
      eq(await s.decisions(), ['', '', ''], 'decisions'), eq(await s.nameValue(), '', 'name field'));
  });
  await scene('W-PRO1-Δ3: null-equivalents entry', async (s) => {
    await jo1to5(s); await s.item(KEYS[2]).getByLabel('Null-equivalents').fill(' N/A , -, ');
    return sddEquals(await s.save(), W('minimal/sdd.jsonld'), s, (w) => { w.mappings.find((m) => m.key === KEYS[2]).nullEquivalents = ['-', 'N/A']; });
  });
  await scene('W-PRO1-Δ4: reversible act (accept ×3, reject Cost Center)', async (s) => {
    await jo1to5(s); await s.reject(KEYS[2]);
    return all(eq(await s.decision(KEYS[2]), `Rejected by ${BY}`, 'Cost Center decision'), sddEquals(await s.save(), W('minimal/sdd-partial.jsonld'), s));
  });
  await scene('W-PRO1-Δ5: an opened SDD names someone (adversarial)', async (s) => {
    await s.openPrevious(W('minimal/sdd-partial.jsonld')); await s.openSchema(F('minimal-organization.json'));
    return all(eq(await s.nameValue(), '', 'name field'), eq(await s.decision(KEYS[0]), `Accepted by ${BY}`, 'Organization (carried)'), eq(await s.decision(KEYS[1]), `Accepted by ${BY}`, 'Name (carried)'), eq((await s.item(KEYS[2]).count()) === 0 ? '' : await s.decision(KEYS[2]), '', 'Cost Center (no new decision: no row, or an undecided row)'));
  });
  // W-PRO1-Δ6 (registrar decision D1): a decision is shown and saved only under its own skeleton; only R-S17 carries.
  const shownDecision = async (s, k) => ((await s.item(k).count()) ? s.decision(k) : '');
  await scene('W-PRO1-Δ6 (a): a decision belongs to its skeleton (adversarial, RV-O2)', async (s) => {
    await jo1to5(s);
    await s.openSchema(F('minimal-organization-v2.json'));
    const underV2 = (await s.page.locator('[data-testid="item"] [data-testid="decision"]').allInnerTexts()).map((t) => t.trim()).filter((t) => t.startsWith('Accepted by'));
    await s.build(); const pr = await s.copy(0);
    await s.paste(toPaste(correctProposal(pr.toString('utf8'), new Assignment('W-PRO1-Δ6')))); const st = await s.status();
    await s.name('Other Person'); await s.accept(KEYS[2]); const actV2 = await s.decision(KEYS[2]);
    await s.openSchema(F('minimal-organization.json'));
    const back = []; for (const k of KEYS) back.push(await shownDecision(s, k));
    return all(eq(underV2, [], 'items reading Accepted under the v2 skeleton'), eq(st, VALIDATED, 'v2 proposal status'), eq(actV2, 'Accepted by Other Person', 'act under v2'),
      eq(back, KEYS.map(() => `Accepted by ${BY}`), 'decisions after reopening the minimal schema'), sddEquals(await s.save(), W('minimal/sdd.jsonld'), s));
  });
  await scene('W-PRO1-Δ6 (b): carried under R-S17, never leaked across skeletons (adversarial)', async (s) => {
    await jo1to5(s);
    await s.openPrevious(W('minimal/sdd.jsonld')); await s.openSchema(F('minimal-organization-v2.json'));
    const opened = []; for (const k of KEYS) opened.push(await shownDecision(s, k));
    await s.build(); const n = await s.batches().count(); await s.copy(n - 1);
    await s.paste(rd(W('minimal/proposal-rerun.txt'))); const st = await s.status(); const ccAfterPaste = await shownDecision(s, KEYS[2]);
    const first = await s.save(); const prevMs = JSON.parse(rd(W('minimal/sdd.jsonld'))).mappings;
    const carriedOk = eq((first.json.mappings || []).map((m) => canon(m)).sort(), KEYS.slice(0, 2).map((k) => canon(prevMs.find((m) => m.key === k))).sort(), 'saved mappings vs minimal/sdd.jsonld records');
    await s.accept(KEYS[2]);
    return all(eq(opened, [`Accepted by ${BY}`, `Accepted by ${BY}`, ''], 'after opening v2 with the previous SDD'), eq(st, VALIDATED, 'rerun proposal status'), eq(ccAfterPaste, '', 'Cost Center after the paste'),
      carriedOk, eq(first.json.open, [KEYS[2]], 'open in the first save'), sddEquals(await s.save(), W('minimal/sdd-v2.jsonld'), s));
  });
  await scene('W-PRO2-Δ2: foreign @context refused, never fetched (adversarial)', async (s) => {
    await s.openPrevious(Buffer.from(rd(W('minimal/sdd.jsonld')).replace('https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld', 'https://example.org/ctx.jsonld')), 'foreign.jsonld');
    await s.page.locator('[data-testid="problem-row"]').first().waitFor();
    return all(eq(await s.rows(), ["E-CTX-EXTERNAL · — · — · https://example.org/ctx.jsonld · R-S16 — The file's @context is not the bundled SDD context."], 'rows'), eq(s.requests.filter((u) => u.includes('example.org')), [], 'requests to the foreign IRI'));
  });
  await scene('W-PRO3-N: a bad paste never costs work', async (s) => {
    await jo1to5(s); const a = await s.save(); await s.paste(rd(W('minimal/bad-proposal.txt'))); const st = await s.status(); const b = await s.save();
    return all(eq(st, REJECTED(2), 'status'), bytesEq(b.bytes, a.bytes, 'SDD saved after the rejected paste vs before'));
  });
  await scene('W-PRO3-Δ1 / W-JO4 step 4: garbage pastes (adversarial)', async (s) => {
    await jo1to5(s); const a = await s.save();
    let x = sha(Buffer.from('K2-garbage-1')); let g = ''; while (g.length < 1048576) { x = sha(Buffer.from(x)); for (const c of Buffer.from(x, 'hex')) g += String.fromCharCode(32 + (c % 95)); }
    await s.paste(g.slice(0, 1048576)); const r1 = await s.rows(); await s.paste(''); const r2 = await s.rows();
    const b = await s.save();
    return all(eq(r1.length, 1, '1 MB garbage rows'), r1[0]?.startsWith('E-CHK-JSON') ? true : `row ${r1[0]}`, eq(r2.length, 1, 'empty paste rows'), r2[0]?.startsWith('E-CHK-JSON') ? true : `row ${r2[0]}`, bytesEq(b.bytes, a.bytes, 'accepted state after garbage'));
  });
  await scene('W-PRO3-Δ2: no control overwrites or deletes (L2 empty)', async (s) => {
    await jo1to5(s); const names = await s.page.getByRole('button').allInnerTexts();
    const bad = names.filter((t) => /delete|overwrite|remove|erase|clear saved/i.test(t));
    return eq(bad, [], 'overwrite/delete controls');
  });
  await scene('W-PRO3-Δ3: repair never un-accepts', async (s) => {
    await jo1to3(s); await s.paste(pasted); await s.name(BY); await s.accept(KEYS[0]); await s.accept(KEYS[1]); await s.reject(KEYS[2]);
    const before = await s.save();
    await s.build(); const n = await s.batches().count(); const open = await s.copy(n - 1);
    const empty = JSON.parse(rd(W('minimal/proposal-open.txt')).match(/\{[\s\S]*\}/)[0]); empty.mappings = [];
    await s.paste(asReply(empty)); const st1 = await s.status(); const rows1 = await s.rows();
    await s.page.getByRole('button', { name: 'Build repair prompt', exact: true }).click();
    await s.paste(rd(W('minimal/proposal-open.txt'))); const st2 = await s.status();
    await s.accept(KEYS[2]); const after = await s.save();
    const pick = (sv) => canon(sv.json.mappings.filter((m) => m.key !== KEYS[2]));
    return all(bytesEq(open, rdb(W('minimal/prompt-open.txt')), 'prompt for the open key vs minimal/prompt-open.txt'), eq(st1, REJECTED(1), 'empty-mappings status'), rows1[0]?.startsWith('E-CHK-MISSING') ? true : `row ${rows1[0]}`, eq(st2, VALIDATED, 'repair reply status'),
      eq(pick(after), pick(before), 'Organization and Name mappings byte-identical'), eq(after.json.open, [], 'open after'), eq(after.json.mappings.find((m) => m.key === KEYS[2])?.provenance?.round, 2, 'Cost Center round'));
  });
  await scene('W-PRO4-N: validated never reads as approved', async (s) => {
    await jo1to3(s); await s.paste(pasted);
    return all(eq(await s.status(), VALIDATED, 'status'), eq(await s.scanOutsideQuoted(), [], 'PR-O4(b) words outside quoted elements'));
  });
  await scene('W-PRO4-Δ1: warning row', async (s) => {
    await jo1to3(s); const o = replyObj(); o.mappings.find((m) => m.key === KEYS[0]).referentClass = 'bfo:BFO_0000001';
    await s.paste(asReply(o));
    return all(eq(await s.status(), VALIDATED, 'status'), (await s.rows()).includes('W-CHK-GENERIC · ot:Organization · referentClass · bfo:BFO_0000001 · R-S5 — referentClass bfo:BFO_0000001 (entity) is a top-level class; check it is specific enough.') ? true : `rows: ${JSON.stringify(await s.rows())}`);
  });
  await scene('W-PRO4-Δ2: approval claim in rationales (adversarial)', async (s) => {
    await jo1to3(s); const o = replyObj(); for (const m of o.mappings) m.rationale = 'This mapping is correct, verified and approved.';
    await s.paste(asReply(o)); const region = (await s.page.locator('[aria-label="From the LLM\'s reply"]').allInnerTexts()).join('\n');
    return all(eq(await s.status(), VALIDATED, 'status'), region.includes('This mapping is correct, verified and approved.') ? true : 'rationale not inside "From the LLM\'s reply"', eq(await s.scanOutsideQuoted(), [], 'words outside quoted elements'));
  });
  await scene('W-PRO4-Δ3: approval words in keys and names (adversarial)', async (s) => {
    await jo1to3(s); const o = replyObj(); o.mappings.push({ key: 'approved', recordClass: 'cco:ont00000853', referentClass: 'cco:ont00001180', rationale: 'x' });
    await s.paste(asReply(o)); const st = await s.status(); const rows = await s.rows(); const scan1 = await s.scanOutsideQuoted();
    const schema = JSON.parse(rd(F('minimal-organization.json')));
    const t = schema.schema.objectSchema.objectTypes[0]; const a = t.attributes.find((x) => x.name === 'Cost Center'); a.name = 'Verified';
    for (const m of schema.mapping.objectTypeMappings) for (const am of m.attributesMapping) if (am.attributeName === 'Cost Center') am.attributeName = 'Verified';
    await s.openSchema(Buffer.from(JSON.stringify(schema, null, 2)), 'verified.json'); await s.page.locator('[data-testid="summary"]').waitFor();
    const scan2 = await s.scanOutsideQuoted();
    return all(eq(st, REJECTED(1), 'status'), rows.includes('E-CHK-UNKNOWN-KEY · approved · — · — · R-S6 — approved is not a slot in this batch.') ? true : `rows ${JSON.stringify(rows)}`, eq(scan1, [], 'scan after paste'), eq(scan2, [], 'scan after the Verified schema'));
  });
  await scene('W-JO2 / W-PRO5-N: repair, in the browser', async (s) => {
    await jo1to3(s); await s.paste(rd(W('minimal/bad-proposal.txt'))); const st = await s.status(); const rows = await s.rows();
    await s.page.getByRole('button', { name: 'Build repair prompt', exact: true }).click();
    const n = await s.batches().count(); const rep = await s.copy(n - 1, 'Copy repair prompt');
    await s.paste(pasted); const st2 = await s.status(); await s.name(BY); for (const k of KEYS) await s.accept(k);
    return all(eq(st, REJECTED(2), 'status'), eq(rows, ['E-CHK-MISSING · at:Organization/Cost Center · — · — · R-S6 — Slot at:Organization/Cost Center has no mapping in this batch.', 'E-CHK-CATEGORY · at:Organization/Name · iceClass · cco:ont00001180 · R-S5 — iceClass cco:ont00001180 (Organization) is not cco:ont00000958 (Information Content Entity) or a subclass of it.'], 'rows'),
      bytesEq(rep, rdb(W('minimal/repair-prompt.txt')), 'repair prompt vs minimal/repair-prompt.txt'), eq(st2, VALIDATED, 'round-2 status'), sddEquals(await s.save(), W('minimal/sdd-round2.jsonld'), s));
  });
  await scene('W-PRO5-Δ1: many errors, none dropped (adversarial)', async (s) => {
    await jo1to3(s); const o = replyObj(); for (const m of o.mappings) m.key += 'X';
    await s.paste(asReply(o)); const rows = await s.rows();
    await s.page.getByRole('button', { name: 'Build repair prompt', exact: true }).click();
    const n = await s.batches().count(); const rep = (await s.copy(n - 1, 'Copy repair prompt')).toString('utf8');
    const errLines = rep.split('\n').filter((l) => l.startsWith('{"code":'));
    return all(eq(await s.status(), REJECTED(6), 'status'), eq(rows.map((r) => r.split(' · ')[0]), ['E-CHK-MISSING', 'E-CHK-MISSING', 'E-CHK-MISSING', 'E-CHK-UNKNOWN-KEY', 'E-CHK-UNKNOWN-KEY', 'E-CHK-UNKNOWN-KEY'], 'row codes'), eq(errLines.length, 6, 'repair ERRORS lines'));
  });
  await scene('W-PRO6-Δ1: batches (full fixture, budget 69,000)', async (s) => {
    await s.openSchema(F('synthetic-it-assets.json')); await s.build(69000); const labels = await s.batches().allInnerTexts();
    const c1 = await s.copy(0), c2 = await s.copy(1);
    return all(eq(labels.length, 2, 'controls'), labels[0].includes('Batch 1 of 2') && labels[1].includes('Batch 2 of 2') ? true : `labels ${JSON.stringify(labels)}`,
      bytesEq(c1, rdb(W('full/prompt-1-of-2.txt')), 'batch 1'), bytesEq(c2, rdb(W('full/prompt-2-of-2.txt')), 'batch 2'));
  });
  await scene('W-PRO6-Δ2: hostile separators (adversarial)', async (s) => {
    await s.openSchema(F('hostile-separators.json')); await s.build(); const c = await s.copy(0);
    const outside = await s.page.evaluate(() => { const hits = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!el || el.closest('[aria-label="From the source schema"], script, style, textarea')) continue; if (n.nodeValue.includes('-----END DATA-----')) hits.push(n.nodeValue.slice(0, 60)); } return hits; });
    const txt = c.toString('utf8');
    return all(bytesEq(c, rdb(W('hostile/prompt.txt')), 'clipboard vs hostile/prompt.txt'), !c.includes(13) && !/[\u2028\u2029]/.test(txt) ? true : 'CR or U+2028/U+2029 in the copied prompt', eq(outside, [], 'description text outside "From the source schema"'));
  });
  await scene('Workflow 7: previous SDD + changed schema → plan, re-prompt, merge (W-JS3 in the browser)', async (s) => {
    await s.openPrevious(W('minimal/sdd.jsonld')); await s.openSchema(F('minimal-organization-v2.json'));
    const plan = s.page.locator('[data-testid="plan"]'); await plan.waitFor();
    const list = async (id) => (await plan.locator(`[data-testid="${id}"] [data-quoted]`).allInnerTexts()).map((t) => t.trim()).sort();
    const p = { unchanged: await list('plan-unchanged'), changed: await list('plan-changed'), added: await list('plan-added'), removed: await list('plan-removed') };
    await s.build(); const n = await s.batches().count(); const pr = await s.copy(n - 1);
    await s.paste(rd(W('minimal/proposal-rerun.txt'))); await s.name(BY); await s.accept(KEYS[2]);
    return all(eq(p, { unchanged: ['at:Organization/Name', 'ot:Organization'], changed: ['at:Organization/Cost Center'], added: [], removed: [] }, 'plan'),
      bytesEq(pr, rdb(W('minimal/prompt-rerun.txt')), 'prompt vs minimal/prompt-rerun.txt'), sddEquals(await s.save(), W('minimal/sdd-v2.jsonld'), s));
  });
  await scene('Parity: browser full-fixture prompt = CLI witness (default budget)', async (s) => {
    await s.openSchema(F('synthetic-it-assets.json')); await s.build(); return bytesEq(await s.copy(0), rdb(W('full/prompt.txt')), 'full prompt');
  });
  // E-O2: paste-to-rows for the full-fixture proposal (1 warning row expected).
  await scene('E-O2: paste-to-rows ≤ 1 s (full fixture)', async (s) => {
    await s.openSchema(F('synthetic-it-assets.json')); await s.build();
    // 5 measurements in one session (bench/config.json); the envelope binds the worst one.
    const runs = [];
    for (let i = 0; i < 5; i++) {
      if (i) { await s.paste('reset'); }
      await s.page.getByLabel('Paste reply').fill(rd(W('full/proposal-valid.txt')));
      const t = performance.now(); await s.page.getByRole('button', { name: 'Check reply', exact: true }).click();
      await s.page.waitForFunction((v) => document.querySelector('[data-testid="status"]')?.innerText.trim() === v && document.querySelectorAll('[data-testid="problem-row"]').length === 1, VALIDATED);
      runs.push(Math.round(performance.now() - t));
    }
    timings['E-O2 paste-to-rows ms (5 runs)'] = runs; const worst = Math.max(...runs);
    return worst <= 1000 ? true : `worst ${worst} ms of ${JSON.stringify(runs)}`;
  });
}

// ---------- run ----------
browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const env = { harness: 'H-O1', chromium: browser.version(), node: process.version, os: `${platform()} ${release()} ${arch()}`, cpu: cpus()[0]?.model, cpuCount: cpus().length, memoryBytes: totalmem(), runnerImage: process.env.ImageOS ? `${process.env.ImageOS} ${process.env.ImageVersion || ''}`.trim() : null, mode: null, startedAt: new Date().toISOString() };
const url = arg('--url');
let server;
if (url) { BASE = url; env.mode = `published page ${url}`; }
else {
  if (!existsSync(join(DIST, 'index.html'))) { console.error('dist/index.html missing: run node tools/build-site.mjs'); process.exit(2); }
  server = await serve(); BASE = `http://127.0.0.1:${server.address().port}/`; env.mode = 'dist/ served on 127.0.0.1';
  const size = readdirSync(DIST, { recursive: true }).map((f) => join(DIST, String(f))).filter((f) => statSync(f).isFile()).reduce((a, f) => a + statSync(f).size, 0);
  timings['E-O3 bytes served'] = size; rec('E-O3: payload ≤ 3 MB', size <= 3 * 1024 * 1024, `${size} bytes`);
}
console.log(`H-O1 against ${BASE} (Chromium ${env.chromium})`);
await scenes();
// E-O1: a saved local copy opened as file://, browser offline throughout, W-JO1 end to end.
{
  const dir = mkdtempSync(join(tmpdir(), 'sdd-saved-copy-'));
  if (url) { const r = await fetch(url); writeFileSync(join(dir, 'index.html'), Buffer.from(await r.arrayBuffer())); } else copyFileSync(join(DIST, 'index.html'), join(dir, 'index.html'));
  await scene('E-O1: W-JO1 from a saved copy (file://, offline throughout)', async (s) => {
    await jo1to5(s); const saved = await s.save(); return all(sddEquals(saved, W('minimal/sdd.jsonld'), s), eq(s.requests.filter((u) => !u.startsWith('file:')), [], 'requests'));
  }, { url: pathToFileURL(join(dir, 'index.html')).href, offlineFromStart: true });
}
await browser.close(); if (server) server.close();
const out = arg('--out');
if (out) writeFileSync(out, JSON.stringify({ environment: env, measurements: timings, results }, null, 2) + '\n');
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} H-O1 checks failed` : `\nok: all ${results.length} H-O1 checks pass`);
process.exit(failed ? 1 : 0);
