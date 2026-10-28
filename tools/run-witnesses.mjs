// Witness runner for the built core (C-S1 parse, C-S2 skeleton, C-S3 prompt, C-S4 check, C-S5 repair). It executes an
// implementation's CLI against every C-S1–C-S5 witness in spec/sdd-service.md and judges the ACTUAL output: byte
// equality with the witness file where one exists, else the outcome the witness states (exit code, exact codes/keys).
// The runner is written from the spec text; it shares no code with the implementation under test.
//
//   node tools/run-witnesses.mjs [--impl <path to sdd.mjs>]     default: src/cli/sdd.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ia = process.argv.indexOf('--impl');
const IMPL = ia > 0 ? process.argv[ia + 1] : join(ROOT, 'src/cli/sdd.mjs');
const TMP = mkdtempSync(join(tmpdir(), 'sdd-witness-'));
const F = (p) => join(ROOT, 'fixtures', p);
const W = (p) => join(ROOT, 'fixtures/witnesses', p);
const rd = (p) => readFileSync(p, 'utf8');
let n = 0;
const tmp = (name, s) => { const p = join(TMP, `${n++}-${name}`); writeFileSync(p, s); return p; };
const sdd = (...args) => { const r = spawnSync(process.execPath, [IMPL, ...args], { cwd: ROOT, encoding: 'utf8' }); return { code: r.status, out: r.stdout, err: r.stderr }; };
const results = [];
const record = (id, ok, why) => results.push({ id, ok, why });
function check(id, fn) { try { const why = fn(); record(id, why === true, why === true ? '' : why); } catch (e) { record(id, false, 'runner/impl error: ' + e.message.split('\n')[0]); } }
const sameFile = (actual, expectedPath) => actual === rd(expectedPath) ? true : `differs from ${expectedPath.replace(ROOT, '').replace(/\\/g, '/')}` + firstDiff(actual, rd(expectedPath));
function firstDiff(a, b) { let i = 0; while (i < a.length && a[i] === b[i]) i++; return ` at byte ${i}: got ${JSON.stringify(a.slice(i, i + 40))}, want ${JSON.stringify(b.slice(i, i + 40))}`; }
const exitIs = (r, c) => r.code === c ? true : `exit ${r.code}, want ${c}${r.err ? ' (stderr: ' + r.err.trim().slice(0, 120) + ')' : ''}`;
const all = (...xs) => { for (const x of xs) if (x !== true) return x; return true; };
const errs = (out) => JSON.parse(out).errors;
const deq = (a, b, what) => JSON.stringify(a) === JSON.stringify(b) ? true : `${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`;
const codeIn = (r, code) => (r.out + r.err).includes(code) ? true : `output does not name ${code}`;

// ---------------- C-S1 parse ----------------
check('W-CS1-N', () => { const r = sdd('parse', F('jira-assets/minimal-organization.json')); return all(exitIs(r, 0), sameFile(r.out, W('minimal/inventory.jsonld'))); });
const src = (id, file, want) => check(id, () => { const r = sdd('parse', F('jira-assets/invalid/' + file)); if (r.code !== 1) return exitIs(r, 1); const o = JSON.parse(r.out); return all(deq(o.errors, want, 'errors'), deq([o.objectTypes, o.attributes], [[], []], 'objectTypes/attributes')); });
src('W-CS1-Δ1', 'missing-attribute-type.json', [{ code: 'E-SRC-SHAPE', pointer: '/schema/objectSchema/objectTypes/0/attributes/1', keyword: 'required', detail: 'type' }]);
src('W-CS1-Δ2', 'unknown-reference-target.json', [{ code: 'E-SRC-REF-TARGET', key: 'at:Person/Manager', value: 'Employee' }]);
src('W-CS1-Δ3', 'mapping-unknown-attribute.json', [{ code: 'E-SRC-MAP-ATTR', key: 'ot:Organization', value: 'Budget' }]);
src('W-CS1-Δ4', 'duplicate-object-type-name.json', [{ code: 'E-SRC-DUP-TYPE', key: 'ot:Person' }]);
check('W-CS1-Δ5', () => { const r = sdd('parse', F('jira-assets/synthetic-it-assets-externalids.json')); return all(exitIs(r, 0), sameFile(r.out, W('full/inventory-externalids.jsonld'))); });
check('W-CS1-Δ6', () => { const r = sdd('parse', F('jira-assets/synthetic-it-assets.json')); return all(exitIs(r, 0), sameFile(r.out, W('full/inventory.jsonld'))); });
src('W-CS1-Δ7', 'unknown-attribute-type.json', [{ code: 'E-SRC-SHAPE', pointer: '/schema/objectSchema/objectTypes/0/attributes/1/type', keyword: 'enum', detail: 'currency' }]);
src('W-CS1-Δ8', 'reference-without-target.json', [{ code: 'E-SRC-SHAPE', pointer: '/schema/objectSchema/objectTypes/1/attributes/6', keyword: 'required', detail: 'referenceObjectTypeName' }]);
src('W-CS1-Δ9', 'mapping-unknown-type.json', [{ code: 'E-SRC-MAP-TYPE', key: null, value: 'Printer' }]);
src('W-CS1-Δ10', 'duplicate-attribute-name.json', [{ code: 'E-SRC-DUP-ATTR', key: 'at:Organization/Cost Center' }]);
src('W-CS1-Δ11', 'key-collision.json', [{ code: 'E-SRC-KEY-COLLISION', key: 'ot:object-type~1organization' }]);
check('W-CS1-Δ13', () => { const r = sdd('parse', F('jira-assets/invalid/two-containers.json')); if (r.code !== 1) return exitIs(r, 1); const o = JSON.parse(r.out); return all(deq(o.errors, [{ code: 'E-SRC-KEY-COLLISION', key: 'ct:ot:Hard Drive' }], 'errors'), deq([o.objectTypes, o.attributes], [[], []], 'objectTypes/attributes')); });
check('W-CS1-Δ12',() => { const r = sdd('parse', join(TMP, 'missing.json')); return all(exitIs(r, 2), codeIn(r, 'E-IO'), r.out === '' ? true : 'wrote output'); });
for (const [id, fx, w] of [['inventory (W-JS3 v2)', 'minimal-organization-v2.json', 'minimal/inventory-v2.jsonld'], ['inventory (W-CS7-Δ1 v3)', 'minimal-organization-v3-removed.json', 'minimal/inventory-v3.jsonld'], ['inventory (W-CS3-Δ6 hostile)', 'hostile-separators.json', 'hostile/inventory.jsonld']])
  check('C-S1 ' + id, () => { const r = sdd('parse', F('jira-assets/' + fx)); return all(exitIs(r, 0), sameFile(r.out, W(w))); });

// ---------------- C-S2 skeleton ----------------
for (const [id, inv, sk] of [['W-CS2-N', 'minimal/inventory.jsonld', 'minimal/skeleton.jsonld'], ['W-CS2-Δ1', 'full/inventory.jsonld', 'full/skeleton.jsonld'], ['C-S2 skeleton (W-JS3 v2)', 'minimal/inventory-v2.jsonld', 'minimal/skeleton-v2.jsonld'], ['C-S2 skeleton (hostile)', 'hostile/inventory.jsonld', 'hostile/skeleton.jsonld']])
  check(id, () => { const r = sdd('skeleton', W(inv)); return all(exitIs(r, 0), sameFile(r.out, W(sk))); });
check('W-CS2-Δ2', () => { const p = tmp('foreign.jsonld', rd(W('minimal/inventory.jsonld')).replace('https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld', 'https://example.org/ctx.jsonld')); const r = sdd('skeleton', p); return all(exitIs(r, 1), codeIn(r, 'E-CTX-EXTERNAL')); });
check('W-CS2-Δ3', () => { const inv = sdd('parse', F('jira-assets/invalid/unknown-reference-target.json')); const r = sdd('skeleton', tmp('errored.jsonld', inv.out)); return all(exitIs(r, 1), codeIn(r, 'E-SKEL-ERRORED')); });

// ---------------- C-S3 prompt ----------------
function prompt(id, sk, inv, extra, expect) {
  check(id, () => {
    const dir = join(TMP, `${n++}-out`);
    const r = sdd('prompt', W(sk), W(inv), ...extra, '--out-dir', dir);
    return expect(r, dir);
  });
}
prompt('W-CS3-N', 'minimal/skeleton.jsonld', 'minimal/inventory.jsonld', [], (r, d) => all(exitIs(r, 0), sameFile(rd(join(d, 'prompt-1-of-1.txt')), W('minimal/prompt.txt')), sameFile(rd(join(d, 'prompt-set.jsonld')), W('minimal/prompt-set.jsonld'))));
prompt('W-CS3-Δ1 / E-S3', 'full/skeleton.jsonld', 'full/inventory.jsonld', [], (r, d) => all(exitIs(r, 0), sameFile(rd(join(d, 'prompt-1-of-1.txt')), W('full/prompt.txt'))));
prompt('W-CS3-Δ2', 'full/skeleton.jsonld', 'full/inventory.jsonld', ['--budget', '69000'], (r, d) => all(exitIs(r, 0), sameFile(rd(join(d, 'prompt-1-of-2.txt')), W('full/prompt-1-of-2.txt')), sameFile(rd(join(d, 'prompt-2-of-2.txt')), W('full/prompt-2-of-2.txt'))));
prompt('W-CS3-Δ3', 'minimal/skeleton.jsonld', 'minimal/inventory.jsonld', ['--keys', W('minimal/keys-open.json')], (r, d) => all(exitIs(r, 0), sameFile(rd(join(d, 'prompt-1-of-1.txt')), W('minimal/prompt-open.txt'))));
prompt('W-CS3-Δ4', 'full/skeleton.jsonld', 'full/inventory.jsonld', ['--budget', '63700'], (r, d) => { if (r.code !== 0) return exitIs(r, 0); const ps = JSON.parse(rd(join(d, 'prompt-set.jsonld'))); return all(deq(ps.prompts.length, 10, 'batches'), deq(ps.warnings.map((w) => [w.code, w.key]), ['ot:Person', 'ot:Location', 'ot:Hardware', 'ot:Server', 'ot:Software'].map((k) => ['W-PROMPT-OVERSIZE', k]), 'warnings')); });
prompt('W-CS3-Δ5', 'minimal/skeleton.jsonld', 'minimal/inventory.jsonld', ['--budget', '50000'], (r, d) => all(exitIs(r, 1), codeIn(r, 'E-PROMPT-BUDGET'), existsSync(d) && readdirSync(d).some((f) => f.startsWith('prompt-') && f.endsWith('.txt')) ? 'a prompt was written' : true));
prompt('W-CS3-Δ6', 'hostile/skeleton.jsonld', 'hostile/inventory.jsonld', [], (r, d) => all(exitIs(r, 0), sameFile(rd(join(d, 'prompt-1-of-1.txt')), W('hostile/prompt.txt'))));
// W-CS3-Δ7 (SDD-F69): the whole chain from the hostile-placeholders fixture, then R-S11's single-pass property judged
// from the spec text itself, not only by byte equality with a witness the implementation produced.
check('W-CS3-Δ7 parse', () => { const r = sdd('parse', F('jira-assets/hostile-placeholders.json')); return all(exitIs(r, 0), sameFile(r.out, W('hostile/placeholders-inventory.jsonld'))); });
check('W-CS3-Δ7 skeleton', () => { const r = sdd('skeleton', W('hostile/placeholders-inventory.jsonld')); return all(exitIs(r, 0), sameFile(r.out, W('hostile/placeholders-skeleton.jsonld'))); });
prompt('W-CS3-Δ7', 'hostile/placeholders-skeleton.jsonld', 'hostile/placeholders-inventory.jsonld', [], (r, d) => {
  if (r.code !== 0) return exitIs(r, 0);
  const text = rd(join(d, 'prompt-1-of-1.txt')), lines = text.split('\n');
  const count = (s) => lines.filter((l) => l.startsWith(s)).length;
  const b = lines.findIndex((l) => l.startsWith('-----BEGIN DATA')), e = lines.indexOf('-----END DATA-----');
  const descs = JSON.parse(rd(F('jira-assets/hostile-placeholders.json'))).schema.objectSchema.objectTypes.flatMap((t) => [t.description, ...(t.attributes || []).map((a) => a.description)]).filter((s) => s && s.includes('{{'));
  const data = lines.slice(b + 1, e).map((l) => JSON.parse(l));
  return all(
    descs.length === 2 ? true : `fixture has ${descs.length} placeholder descriptions, want 2`,
    deq([count('-----BEGIN DATA'), count('-----END DATA-----'), count('-----BEGIN CATALOGUE'), count('-----END CATALOGUE-----')], [1, 1, 1, 1], 'section delimiters'),
    lines.some((l, i) => (i <= b || i >= e) && l.includes('{{')) ? 'a {{ placeholder survives outside DATA' : true,
    deq(descs.map((s) => data.some((o) => o.description === s)), descs.map(() => true), 'source descriptions verbatim in DATA'),
    sameFile(text, W('hostile/placeholders-prompt.txt')));
});
prompt('C-S3 prompt (W-JS3 rerun subset)', 'minimal/skeleton-v2.jsonld', 'minimal/inventory-v2.jsonld', ['--keys', W('minimal/keys-rerun.json')], (r, d) => all(exitIs(r, 0), sameFile(rd(join(d, 'prompt-1-of-1.txt')), W('minimal/prompt-rerun.txt'))));

// ---------------- C-S4 check ----------------
const chk = (id, sk, pr, paste, expect) => check(id, () => expect(sdd('check', W(sk), W(pr), paste)));
const fileCheck = (id, sk, pr, pa, rep, code) => chk(id, sk, pr, W(pa), (r) => all(exitIs(r, code), sameFile(r.out, W(rep))));
fileCheck('W-CS4-N', 'minimal/skeleton.jsonld', 'minimal/prompt.txt', 'minimal/proposal-pasted.txt', 'minimal/check-report.jsonld', 0);
fileCheck('W-CS4-Δ1', 'minimal/skeleton.jsonld', 'minimal/prompt.txt', 'minimal/bad-proposal.txt', 'minimal/bad-check-report.jsonld', 1);
fileCheck('C-S4 check (W-JS2 round 2)', 'minimal/skeleton.jsonld', 'minimal/repair-prompt.txt', 'minimal/proposal-pasted.txt', 'minimal/check-report-round2.jsonld', 0);
fileCheck('C-S4 check (W-JS4 open)', 'minimal/skeleton.jsonld', 'minimal/prompt-open.txt', 'minimal/proposal-open.txt', 'minimal/check-report-open.jsonld', 0);
fileCheck('C-S4 check (W-JS3 rerun)', 'minimal/skeleton-v2.jsonld', 'minimal/prompt-rerun.txt', 'minimal/proposal-rerun.txt', 'minimal/check-report-rerun.jsonld', 0);
fileCheck('W-CS4-Δ15', 'full/skeleton.jsonld', 'full/prompt.txt', 'full/proposal-valid.txt', 'full/check-report-valid.jsonld', 0);
fileCheck('W-CS4-Δ5', 'full/skeleton.jsonld', 'full/prompt.txt', 'full/proposal-range.txt', 'full/check-report-range.jsonld', 1);
fileCheck('W-CS4-Δ16', 'full/skeleton.jsonld', 'full/prompt-2-of-2.txt', 'full/proposal-batch2.txt', 'full/check-report-batch2.jsonld', 0);
// Deltas built from the N proposal
const P = rd(W('minimal/proposal-pasted.txt'));
const N = JSON.parse(P.slice(P.indexOf('```json\n') + 8, P.lastIndexOf('```')));
const variant = (fn) => { const o = JSON.parse(JSON.stringify(N)); fn(o); return JSON.stringify(o, null, 2) + '\n'; };
const delta = (id, text, code, wantErrs, wantWarns) => chk(id, 'minimal/skeleton.jsonld', 'minimal/prompt.txt', tmp('paste.txt', text), (r) => {
  if (r.code !== code) return exitIs(r, code);
  const o = JSON.parse(r.out);
  return all(deq(o.errors.map((e) => [e.code, e.key]), wantErrs, 'errors'), wantWarns ? deq(o.warnings.map((e) => [e.code, e.key]), wantWarns, 'warnings') : true);
});
const name = (o) => o.mappings.find((m) => m.key === 'at:Organization/Name');
const org = (o) => o.mappings.find((m) => m.key === 'ot:Organization');
delta('W-CS4-Δ2', variant((o) => { o.mappings.push(JSON.parse(JSON.stringify(name(o)))); o.mappings.push({ key: 'at:Organization/Budget', iceClass: 'cco:ont00000077', rationale: 'x' }); }), 1, [['E-CHK-DUPLICATE', 'at:Organization/Name'], ['E-CHK-UNKNOWN-KEY', 'at:Organization/Budget']]);
delta('W-CS4-Δ3', variant((o) => { name(o).iceClass = 'cco:ont99999999'; }), 1, [['E-CHK-TERM', 'at:Organization/Name']]);
delta('W-CS4-Δ4', variant((o) => { name(o).iceClass = 'cco:ont00001808'; }), 1, [['E-CHK-KIND', 'at:Organization/Name']]);
delta('W-CS4-Δ6', variant((o) => { o.mappings.find((m) => m.key === 'at:Organization/Cost Center').nullEquivalents = ['N/A']; }), 1, [['E-CHK-HUMAN-FIELD', 'at:Organization/Cost Center']]);
delta('W-CS4-Δ7', JSON.stringify(N) + '\n' + JSON.stringify(N) + '\n', 1, [['E-CHK-JSON', null]]);
delta('W-CS4-Δ8', variant((o) => { org(o).referentClass = 'bfo:BFO_0000001'; }), 0, [], [['W-CHK-GENERIC', 'ot:Organization']]);
delta('W-CS4-Δ9', variant((o) => { o.skeletonSha256 = (o.skeletonSha256[0] === '0' ? '1' : '0') + o.skeletonSha256.slice(1); }), 1, [['E-CHK-SKELETON', null]]);
delta('W-CS4-Δ11', variant((o) => { org(o).referentClass = 'cco:ont00000853'; }), 0, [], [['W-CHK-ICE-REFERENT', 'ot:Organization']]);
delta('W-CS4-Δ12', variant((o) => { o.batch = '2/2'; }), 1, [['E-CHK-BATCH', null]]);
delta('W-CS4-Δ13', variant((o) => { const m = name(o); delete m.iceClass; m.relation = 'bfo:BFO_0000176'; }), 1, [['E-CHK-FIELDS', 'at:Organization/Name']]);
delta('W-CS4-Δ14', variant((o) => { o.mappings = {}; }), 1, [['E-CHK-SHAPE', null]]);
delta('W-CS4-Δ17', variant((o) => { org(o).referentClass = 'cco:ont00000958'; }), 0, [], [['W-CHK-GENERIC', 'ot:Organization'], ['W-CHK-ICE-REFERENT', 'ot:Organization']]);
check('W-CS4-Δ13 message', () => { const r = sdd('check', W('minimal/skeleton.jsonld'), W('minimal/prompt.txt'), tmp('p13.txt', variant((o) => { const m = name(o); delete m.iceClass; m.relation = 'bfo:BFO_0000176'; }))); return deq(errs(r.out)[0]?.message, 'at:Organization/Name must have exactly the fields key, iceClass, rationale.', 'message'); });
check('W-CS4-Δ10', () => {
  const sk = JSON.parse(rd(W('full/skeleton.jsonld')));
  const FIELDS = { type: ['recordClass', 'referentClass'], attribute: ['iceClass'], reference: ['relation'], containment: ['relation'] };
  const inj = { skeletonSha256: JSON.parse(rd(W('full/check-report-valid.jsonld'))).skeletonSha256, batch: '1/1', mappings: sk.slots.map((s) => { const m = { key: s.key }; for (const f of FIELDS[s.kind]) m[f] = 'bfo:BFO_0000001'; m.rationale = 'x'; return m; }) };
  const r = sdd('check', W('full/skeleton.jsonld'), W('full/prompt.txt'), tmp('inj.txt', JSON.stringify(inj, null, 2)));
  if (r.code !== 1) return exitIs(r, 1);
  const o = JSON.parse(r.out); const tally = (xs) => xs.reduce((a, e) => ((a[e.code + ':' + e.field] = (a[e.code + ':' + e.field] || 0) + 1), a), {});
  return all(deq(o.errors.length, 52, 'error count'), deq(tally(o.errors), { 'E-CHK-CATEGORY:recordClass': 10, 'E-CHK-CATEGORY:iceClass': 35, 'E-CHK-KIND:relation': 7 }, 'errors'), deq(tally(o.warnings), { 'W-CHK-GENERIC:referentClass': 10 }, 'warnings'));
});
check('W-CS4-Δ18', () => { const r = sdd('check', W('minimal/skeleton.jsonld')); return all(exitIs(r, 2), codeIn(r, 'E-USAGE'), r.out === '' ? true : 'wrote output'); });
check('R-S23 E-OUT-EXISTS (check --out)', () => { const out = tmp('exists.jsonld', 'KEEP'); const r = sdd('check', W('minimal/skeleton.jsonld'), W('minimal/prompt.txt'), W('minimal/proposal-pasted.txt'), '--out', out); return all(exitIs(r, 2), codeIn(r, 'E-OUT-EXISTS'), rd(out) === 'KEEP' ? true : 'existing file was changed'); });

// ---------------- C-S5 repair ----------------
// R-S22, judged from the spec text: removing the ERRORS block (its fixed lead text, then one JSON.stringify line per
// report error joined by LF, then LF) and restoring the round must give back the checked prompt byte for byte, so the
// DATA lines, catalogue, skeleton and batch are all preserved.
const ERR_HEAD = '\nERRORS IN YOUR PREVIOUS REPLY\nYour previous reply for this batch was rejected for the reasons below. Return the complete corrected mapping set for every DATA line, not only the lines named here.\n';
function repairOf(prompt, report, repair) {
  const block = ERR_HEAD + report.errors.map((e) => JSON.stringify(e)).join('\n') + '\n';
  const i = repair.indexOf(block);
  if (i < 0) return 'ERRORS block (R-S22) not found with exactly the report\'s errors in report order';
  if (!new RegExp(`^round: ${report.round + 1}$`, 'm').test(repair)) return `round is not ${report.round + 1}`;
  const back = (repair.slice(0, i) + repair.slice(i + block.length)).replace(new RegExp(`^round: ${report.round + 1}$`, 'm'), `round: ${report.round}`);
  return back === prompt ? true : 'without its ERRORS block and round, the repair prompt is not the checked prompt' + firstDiff(back, prompt);
}
const repair = (...a) => sdd('repair', ...a);
const nothingAt = (p) => existsSync(p) ? `wrote ${p}` : true;
check('W-CS5-N', () => {
  const r = repair(W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), W('minimal/bad-check-report.jsonld'), W('minimal/prompt.txt'));
  return all(exitIs(r, 0), repairOf(rd(W('minimal/prompt.txt')), JSON.parse(rd(W('minimal/bad-check-report.jsonld'))), r.out), sameFile(r.out, W('minimal/repair-prompt.txt')));
});
check('W-CS5-Δ1', () => {
  const out = join(TMP, `${n++}-never.txt`);
  const r = repair(W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), W('minimal/check-report.jsonld'), W('minimal/prompt.txt'), '--out', out);
  return all(exitIs(r, 1), codeIn(r, 'E-REPAIR-NOTHING'), r.out === '' ? true : 'wrote to stdout', nothingAt(out));
});
for (const [id, args, code, exit] of [
  ['report does not answer the prompt', [W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), W('minimal/bad-check-report.jsonld'), W('minimal/prompt-open.txt')], 'E-USAGE', 2],
  ['skeleton not built from the inventory', [W('full/skeleton.jsonld'), W('minimal/inventory.jsonld'), W('minimal/bad-check-report.jsonld'), W('minimal/prompt.txt')], 'E-USAGE', 2],
  ['report for another skeleton', [W('full/skeleton.jsonld'), W('full/inventory.jsonld'), W('minimal/bad-check-report.jsonld'), W('minimal/prompt.txt')], 'E-USAGE', 2],
  ['missing argument', [W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), W('minimal/bad-check-report.jsonld')], 'E-USAGE', 2],
  ['unreadable report', [W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), join(TMP, 'missing.jsonld'), W('minimal/prompt.txt')], 'E-IO', 2],
  ['foreign @context', [W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), tmp('foreign-report.jsonld', rd(W('minimal/bad-check-report.jsonld')).replace('https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld', 'https://example.org/ctx.jsonld')), W('minimal/prompt.txt')], 'E-CTX-EXTERNAL', 1],
]) check(`C-S5 refusal (R-S23): ${id}`, () => { const out = join(TMP, `${n++}-never.txt`); const r = repair(...args, '--out', out); return all(exitIs(r, exit), codeIn(r, code), r.out === '' ? true : 'wrote to stdout', nothingAt(out)); });
check('C-S5 E-OUT-EXISTS (R-S23)', () => { const out = tmp('exists.txt', 'KEEP'); const r = repair(W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), W('minimal/bad-check-report.jsonld'), W('minimal/prompt.txt'), '--out', out); return all(exitIs(r, 2), codeIn(r, 'E-OUT-EXISTS'), rd(out) === 'KEEP' ? true : 'existing file was changed'); });

// End-to-end repair loops, every step through the CLI from the source schema: rejected proposal → repair prompt →
// complete corrected proposal → validated report; then a repair of that validated report is refused.
function loop(fixture, rejected, corrected, files) {
  const inv = tmp('inv.jsonld', sdd('parse', F('jira-assets/' + fixture)).out);
  const sk = tmp('sk.jsonld', sdd('skeleton', inv).out);
  const dir = join(TMP, `${n++}-loop`); const p = sdd('prompt', sk, inv, '--out-dir', dir);
  if (p.code !== 0) return exitIs(p, 0);
  const prompt = join(dir, 'prompt-1-of-1.txt');
  const c1 = sdd('check', sk, prompt, W(rejected)); if (c1.code !== 1) return 'round 1: ' + exitIs(c1, 1);
  const rep1 = JSON.parse(c1.out); if (rep1.status !== 'rejected' || rep1.round !== 1) return 'round 1 report is not rejected/round 1';
  const r = repair(sk, inv, tmp('rep1.jsonld', c1.out), prompt); if (r.code !== 0) return 'repair: ' + exitIs(r, 0);
  const prop = repairOf(rd(prompt), rep1, r.out); if (prop !== true) return prop;
  const rp = tmp('repair.txt', r.out);
  const c2 = sdd('check', sk, rp, W(corrected)); if (c2.code !== 0) return 'round 2: ' + exitIs(c2, 0);
  const rep2 = JSON.parse(c2.out);
  const none = repair(sk, inv, tmp('rep2.jsonld', c2.out), rp);
  return all(deq([rep2.status, rep2.round, rep2.errors.length], ['validated', 2, 0], 'round 2 status/round/errors'),
    deq(rep2.promptSha256, createHash('sha256').update(Buffer.from(r.out, 'utf8')).digest('hex'), 'round 2 report names the repair prompt'),
    ...(files ? [sameFile(c1.out, W(files[0])), sameFile(r.out, W(files[1])), sameFile(c2.out, W(files[2]))] : []),
    exitIs(none, 1), codeIn(none, 'E-REPAIR-NOTHING'));
}
check('C-S5 end-to-end (W-JS2, minimal)', () => loop('minimal-organization.json', 'minimal/bad-proposal.txt', 'minimal/proposal-pasted.txt', ['minimal/bad-check-report.jsonld', 'minimal/repair-prompt.txt', 'minimal/check-report-round2.jsonld']));
check('C-S5 end-to-end (full fixture, no witness file)', () => loop('synthetic-it-assets.json', 'full/proposal-range.txt', 'full/proposal-valid.txt', null));

rmSync(TMP, { recursive: true, force: true });
const caps = { 'C-S1': [], 'C-S2': [], 'C-S3': [], 'C-S4': [], 'C-S5': [], other: [] };
for (const r of results) (caps[(/W-CS(\d)/.exec(r.id) ? 'C-S' + /W-CS(\d)/.exec(r.id)[1] : /^C-S\d/.exec(r.id)?.[0]) || 'other'] || caps.other).push(r);
for (const [cap, rs] of Object.entries(caps)) {
  if (!rs.length) continue;
  console.log(`${cap}: ${rs.filter((r) => r.ok).length}/${rs.length} pass`);
  for (const r of rs) if (!r.ok) console.log(`   FAIL ${r.id}: ${r.why}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} witnesses failed` : `\nok: all ${results.length} witnesses pass`);
process.exit(failed ? 1 : 0);
