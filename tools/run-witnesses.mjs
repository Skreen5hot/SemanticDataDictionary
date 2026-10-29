// Witness runner for the core (C-S1 parse, C-S2 skeleton, C-S3 prompt, C-S4 check, C-S5 repair, C-S6 accept, C-S7 rerun). It executes an
// implementation's CLI against every C-S1–C-S7 witness in spec/sdd-service.md and judges the ACTUAL output: byte
// equality with the witness file where one exists, else the outcome the witness states (exit code, exact codes/keys).
// The runner is written from the spec text; it shares no code with the implementation under test.
//
//   node tools/run-witnesses.mjs [--impl <path to sdd.mjs>]     default: src/cli/sdd.mjs
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
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
// W-CS2-Δ1 judged from the spec text: slot counts, and R-S9's v0.5 table (datatype only; no slot carries valueProperty).
const RS9 = { text: 'xsd:string', textarea: 'xsd:string', email: 'xsd:string', select: 'xsd:string', ipaddress: 'xsd:string', url: 'xsd:anyURI', integer: 'xsd:integer', double: 'xsd:double', boolean: 'xsd:boolean', date: 'xsd:date', date_time: 'xsd:dateTime', time: 'xsd:string' };
check('W-CS2-Δ1 R-S9', () => {
  const slots = JSON.parse(sdd('skeleton', W('full/inventory.jsonld')).out).slots;
  const count = (k) => slots.filter((s) => s.kind === k).length;
  const attrs = slots.filter((s) => s.kind === 'attribute');
  return all(deq([count('type'), count('attribute'), count('reference'), count('containment')], [10, 35, 5, 2], 'slot counts'),
    deq(attrs.filter((s) => s.datatype !== RS9[s.jiraType]).map((s) => s.key), [], 'datatype off the R-S9 table'),
    deq(attrs.filter((s) => 'valueProperty' in s).map((s) => s.key), [], 'slots carrying valueProperty'),
    deq([...new Set(attrs.map((s) => s.jiraType))].sort(), Object.keys(RS9).sort(), 'all 12 non-reference types occur'));
});
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
// v0.5 (R-S5, R-S10, R-S13): a null iceClass is validated with no error and no warning; valueProperty is a shape error.
fileCheck('W-CS4-Δ19', 'minimal/skeleton.jsonld', 'minimal/prompt.txt', 'minimal/proposal-null.txt', 'minimal/check-report-null.jsonld', 0);
delta('W-CS4-Δ19 (from the N proposal)', variant((o) => { o.mappings.find((m) => m.key === 'at:Organization/Cost Center').iceClass = null; }), 0, [], []);
check('W-CS4-Δ19 literal', () => { const o = JSON.parse(rd(W('minimal/check-report-null.jsonld'))); const p = JSON.parse(rd(W('minimal/proposal-null.txt'))); return all(deq([o.status, o.errors, o.warnings], ['validated', [], []], 'status/errors/warnings'), deq(p.mappings.find((m) => m.key === 'at:Organization/Cost Center').iceClass, null, 'Cost Center iceClass in the paste')); });
chk('W-CS4-Δ20', 'minimal/skeleton.jsonld', 'minimal/prompt.txt', tmp('paste.txt', variant((o) => { name(o).valueProperty = 'cco:ont00001765'; })), (r) => {
  if (r.code !== 1) return exitIs(r, 1);
  return deq(JSON.parse(r.out).errors, [{ code: 'E-CHK-SHAPE', key: null, field: null, value: '/mappings/1', rule: 'R-S13', message: 'The reply does not match the proposal schema at /mappings/1 (additionalProperties).' }], 'errors');
});
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

// ---------------- C-S6 accept ----------------
// Decisions files are written from the spec text (S-O3's literal decisions; the witnesses' one-factor variants).
const BY = 'Aaron Damiano';
const KEYS = ['ot:Organization', 'at:Organization/Name', 'at:Organization/Cost Center'];
const decisions = (list, nullEquivalents = {}) => tmp('decisions.json', JSON.stringify({ by: BY, decisions: list.map(([key, decision]) => ({ key, decision })), nullEquivalents }));
const ACCEPT3 = KEYS.map((k) => [k, 'accept']);
const canon = (v) => JSON.stringify(v, null, 2) + '\n';
// Run accept and judge the SDD: canonical bytes (R-S1); `acceptance.at` of each key decided in THIS run is ISO-8601
// UTC within ±5 s of the act (then set to the witness's fixed value); every other byte, including the acceptance
// records of carried mappings, must equal the expected SDD. Only keys decided `accept` here may gain an acceptance.
function accept(args, decided, expected, edit) {
  const t0 = Date.now(); const r = sdd('accept', ...args); const t1 = Date.now();
  if (r.code !== 0) return exitIs(r, 0);
  const o = JSON.parse(r.out);
  if (canon(o) !== r.out) return 'output is not canonical JSON (R-S1)';
  const want = JSON.parse(rd(W(expected))); if (edit) edit(want);
  for (const m of o.mappings || []) {
    if (!decided.includes(m.key)) continue;
    const at = m.acceptance?.at;
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(at || '')) return `${m.key}: acceptance.at ${at} is not YYYY-MM-DDTHH:MM:SSZ`;
    const ms = Date.parse(at); if (ms < t0 - 5000 || ms > t1 + 5000) return `${m.key}: acceptance.at ${at} is not within ±5 s of the act`;
    const w = want.mappings.find((x) => x.key === m.key); if (w?.acceptance) m.acceptance.at = w.acceptance.at;
  }
  return canon(o) === canon(want) ? true : 'SDD differs from ' + expected + firstDiff(canon(o), canon(want));
}
const SK = W('minimal/skeleton.jsonld'), INV = W('minimal/inventory.jsonld');
const R1 = ['--checked', W('minimal/check-report.jsonld'), W('minimal/proposal-pasted.txt')];
const R2 = ['--checked', W('minimal/check-report-round2.jsonld'), W('minimal/proposal-pasted.txt')];
check('W-CS6-N', () => accept([SK, INV, decisions(ACCEPT3), ...R1], KEYS, 'minimal/sdd.jsonld'));
check('W-CS6-Δ2', () => accept([SK, INV, decisions([[KEYS[0], 'accept'], [KEYS[1], 'accept'], [KEYS[2], 'reject']]), ...R1], KEYS.slice(0, 2), 'minimal/sdd-partial.jsonld'));
check('W-CS6-Δ4', () => accept([SK, INV, decisions(ACCEPT3, { 'at:Organization/Cost Center': ['N/A', '-'] }), ...R1], KEYS, 'minimal/sdd.jsonld', (w) => { w.mappings.find((m) => m.key === 'at:Organization/Cost Center').nullEquivalents = ['-', 'N/A']; }));
check('W-CS6-Δ7', () => accept([SK, INV, decisions(ACCEPT3), ...R2], KEYS, 'minimal/sdd-round2.jsonld'));
check('W-CS6-Δ9', () => accept([SK, INV, decisions(ACCEPT3), ...R1, ...R2], KEYS, 'minimal/sdd-round2.jsonld'));
check('W-CS6-Δ9 (reports in the other order)', () => accept([SK, INV, decisions(ACCEPT3), ...R2, ...R1], KEYS, 'minimal/sdd-round2.jsonld'));
// W-CS6-Δ11 (R-S5): an accepted mapping with a null iceClass is decided (own acceptance record), not open.
check('W-CS6-Δ11', () => accept([SK, INV, decisions(ACCEPT3), '--checked', W('minimal/check-report-null.jsonld'), W('minimal/proposal-null.txt')], KEYS, 'minimal/sdd-null.jsonld'));
check('W-CS6-Δ11 literal', () => { const o = JSON.parse(rd(W('minimal/sdd-null.jsonld'))); const m = o.mappings.find((x) => x.key === KEYS[2]); return all(deq(o.sddVersion, 2, 'sddVersion'), deq([m.iceClass, m.datatype, m.acceptance?.decision, m.acceptance?.by], [null, 'xsd:string', 'accepted', BY], 'Cost Center'), 'valueProperty' in m ? 'mapping carries valueProperty' : true, deq(o.open, [], 'open')); });
check('W-JS3 step 6 (--previous, rerun subset)', () => accept([W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), decisions([[KEYS[2], 'accept']]), '--checked', W('minimal/check-report-rerun.jsonld'), W('minimal/proposal-rerun.txt'), '--previous', W('minimal/sdd.jsonld')], [KEYS[2]], 'minimal/sdd-v2.jsonld'));
check('W-JS4 step 2 (--previous, open key)', () => accept([SK, INV, decisions([[KEYS[2], 'accept']]), '--checked', W('minimal/check-report-open.jsonld'), W('minimal/proposal-open.txt'), '--previous', W('minimal/sdd-partial.jsonld')], [KEYS[2]], 'minimal/sdd-j4.jsonld'));
// Refusals (R-S18, R-S23): exit code and code as the witness states, nothing on stdout, the --out path never created.
for (const [id, args, code, exit] of [
  ['W-CS6-Δ1', [SK, INV, decisions(ACCEPT3), '--checked', W('minimal/bad-check-report.jsonld'), W('minimal/bad-proposal.txt')], 'E-ACC-UNVALIDATED', 1],
  ['W-CS6-Δ1 (one unvalidated among validated)', [SK, INV, decisions(ACCEPT3), ...R1, '--checked', W('minimal/bad-check-report.jsonld'), W('minimal/bad-proposal.txt')], 'E-ACC-UNVALIDATED', 1],
  ['W-CS6-Δ3', [SK, INV, decisions(ACCEPT3), '--checked', W('minimal/check-report.jsonld'), W('minimal/bad-proposal.txt')], 'E-ACC-MISMATCH', 1],
  ['W-CS6-Δ6', [SK, INV, decisions([[KEYS[0], 'accept']]), '--checked', W('minimal/check-report-open.jsonld'), W('minimal/proposal-open.txt')], 'E-ACC-UNCOVERED', 1],
  ['W-CS6-Δ8', [W('minimal/skeleton-v2.jsonld'), INV, decisions(ACCEPT3), ...R1], 'E-ACC-MISMATCH', 1],
  // R-S24: a version-1 previous SDD is refused; also the release candidate v1.0.0-rc.1 SDD itself (retained bytes).
  ['W-CS6-Δ12', [W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), decisions([[KEYS[2], 'accept']]), '--checked', W('minimal/check-report-rerun.jsonld'), W('minimal/proposal-rerun.txt'), '--previous', tmp('prev-v1.jsonld', rd(W('minimal/sdd.jsonld')).replace('"sddVersion": 2', '"sddVersion": 1'))], 'sddVersion 1; this release reads only sddVersion 2', 2],
  ['C-S6 refusal (R-S24): the rc.1 SDD', [W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), decisions([[KEYS[2], 'accept']]), '--checked', W('minimal/check-report-rerun.jsonld'), W('minimal/proposal-rerun.txt'), '--previous', W('superseded/v4/minimal/sdd.jsonld')], 'E-USAGE', 2],
  ['C-S6 no --checked pair (R-S23)', [SK, INV, decisions(ACCEPT3)], 'E-USAGE', 2],
  ['C-S6 unreadable decisions (R-S23)', [SK, INV, join(TMP, 'missing.json'), ...R1], 'E-IO', 2],
  ['C-S6 foreign @context report (R-S16)', [SK, INV, decisions(ACCEPT3), '--checked', tmp('foreign.jsonld', rd(W('minimal/check-report.jsonld')).replace('https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld', 'https://example.org/ctx.jsonld')), W('minimal/proposal-pasted.txt')], 'E-CTX-EXTERNAL', 1],
]) check(`${id.startsWith('W-') ? '' : ''}${id}`, () => { const out = join(TMP, `${n++}-never.jsonld`); const r = sdd('accept', ...args, '--out', out); return all(exitIs(r, exit), codeIn(r, code), r.out === '' ? true : 'wrote to stdout', nothingAt(out)); });
check('W-CS6-Δ6 names the key', () => { const r = sdd('accept', SK, INV, decisions([[KEYS[0], 'accept']]), '--checked', W('minimal/check-report-open.jsonld'), W('minimal/proposal-open.txt')); return codeIn(r, '"ot:Organization"'); });
check('W-CS6-Δ5', () => { const out = tmp('exists.jsonld', 'KEEP'); const r = sdd('accept', SK, INV, decisions(ACCEPT3), ...R1, '--out', out); return all(exitIs(r, 2), codeIn(r, 'E-OUT-EXISTS'), rd(out) === 'KEEP' ? true : 'existing file was changed'); });
// Validation is not acceptance (R-S14): a validated report with NO decisions must not yield any accepted mapping.
check('C-S6 validated but undecided → nothing accepted', () => {
  const r = sdd('accept', SK, INV, decisions([]), ...R1);
  if (r.code !== 0) return r.out === '' ? true : 'refused but wrote output';
  const o = JSON.parse(r.out);
  return all(deq((o.mappings || []).filter((m) => m.acceptance).length, 0, 'accepted mappings'), deq([...(o.open || [])].sort(), [...KEYS].sort(), 'open keys'));
});

// Adversarial (R-S10, R-S18): a forged "validated" report whose hash matches a paste smuggling human-only fields.
// No SDD may result in which those fields came from the paste.
check('C-S6 forged report smuggling human-only fields', () => {
  const paste = rd(W('minimal/proposal-pasted.txt')).replace('"key": "at:Organization/Cost Center",', '"key": "at:Organization/Cost Center", "nullEquivalents": ["X"], "acceptance": {"decision": "accepted", "by": "LLM", "at": "2020-01-01T00:00:00Z"}, "datatype": "xsd:integer",');
  const rep = JSON.parse(rd(W('minimal/check-report.jsonld'))); rep.proposalSha256 = createHash('sha256').update(Buffer.from(paste, 'utf8')).digest('hex');
  const out = join(TMP, `${n++}-never.jsonld`);
  const r = sdd('accept', SK, INV, decisions(ACCEPT3), '--checked', tmp('forged.jsonld', canon(rep)), tmp('smuggled.txt', paste), '--out', out);
  if (r.code !== 0) return all(r.code === 1 || r.code === 2 ? true : exitIs(r, 1), nothingAt(out));
  const m = JSON.parse(rd(out)).mappings.find((x) => x.key === 'at:Organization/Cost Center');
  return all(deq(m.nullEquivalents, [], 'nullEquivalents'), deq(m.acceptance.by, BY, 'acceptance.by'), deq(m.datatype, 'xsd:string', 'datatype'));
});

// End to end, every step through the CLI from the source schema, explicit decisions only.
function e2e(list, decided, expected) {
  const inv = tmp('inv.jsonld', sdd('parse', F('jira-assets/minimal-organization.json')).out);
  const sk = tmp('sk.jsonld', sdd('skeleton', inv).out);
  const dir = join(TMP, `${n++}-e2e`); const p = sdd('prompt', sk, inv, '--out-dir', dir); if (p.code !== 0) return exitIs(p, 0);
  const prompt = join(dir, 'prompt-1-of-1.txt');
  const c = sdd('check', sk, prompt, W('minimal/proposal-pasted.txt')); if (c.code !== 0) return 'check: ' + exitIs(c, 0);
  if (JSON.parse(c.out).status !== 'validated') return 'proposal not validated';
  return accept([sk, inv, decisions(list), '--checked', tmp('report.jsonld', c.out), W('minimal/proposal-pasted.txt')], decided, expected);
}
check('C-S6 end-to-end: schema → validated → accept ×3 → SDD', () => e2e(ACCEPT3, KEYS, 'minimal/sdd.jsonld'));
check('C-S6 end-to-end: partial rejection stays open', () => e2e([[KEYS[0], 'accept'], [KEYS[1], 'accept'], [KEYS[2], 'reject']], KEYS.slice(0, 2), 'minimal/sdd-partial.jsonld'));

// ---------------- C-S7 rerun ----------------
const OTHER_TERMS = (s) => s.replace(/("termListSha256": ")[0-9a-f]{64}/, '$1' + '0'.repeat(64));
const TERMS = JSON.parse(rd(join(ROOT, 'ontology/term-list.json'))).terms_sha256;
function rerun(schema, prev) { const dir = join(TMP, `${n++}-rerun`); const r = sdd('rerun', schema, prev, '--out-dir', dir); return { r, dir, inv: () => rd(join(dir, 'inventory.jsonld')), plan: () => JSON.parse(rd(join(dir, 'rerun-plan.jsonld'))), planText: () => rd(join(dir, 'rerun-plan.jsonld')) }; }
for (const [id, schema, prev, inv, plan] of [
  ['W-CS7-N', 'minimal-organization-v2.json', 'minimal/sdd.jsonld', 'minimal/inventory-v2.jsonld', 'minimal/rerun-plan.jsonld'],
  ['W-CS7-Δ1', 'minimal-organization-v3-removed.json', 'minimal/sdd.jsonld', 'minimal/inventory-v3.jsonld', 'minimal/rerun-plan-removed.jsonld'],
  ['W-CS7-Δ2', 'synthetic-it-assets-externalids.json', 'full/sdd.jsonld', 'full/inventory-externalids.jsonld', 'full/rerun-plan-switch.jsonld'],
]) check(id, () => {
  const x = rerun(F('jira-assets/' + schema), W(prev)); if (x.r.code !== 0) return exitIs(x.r, 0);
  const parsed = sdd('parse', F('jira-assets/' + schema)).out;
  return all(sameFile(x.inv(), W(inv)), sameFile(x.planText(), W(plan)), x.inv() === parsed ? true : 'rerun inventory differs from sdd parse of the same schema');
});
check('W-CS7-Δ2 no silent re-keying', () => { const p = JSON.parse(rd(W('full/rerun-plan-switch.jsonld'))); const prev = JSON.parse(rd(W('full/sdd.jsonld'))); return all(deq([p.unchanged, p.changed], [[], []], 'unchanged/changed'), deq([...p.removed].sort(), prev.mappings.map((m) => m.key).sort(), 'every previous key removed')); });
check('W-CS7-Δ3', () => {
  const x = rerun(F('jira-assets/minimal-organization-v2.json'), tmp('prev-other-terms.jsonld', OTHER_TERMS(rd(W('minimal/sdd.jsonld'))))); if (x.r.code !== 0) return exitIs(x.r, 0);
  const p = x.plan();
  return all(sameFile(x.inv(), W('minimal/inventory-v2.jsonld')), deq([p.unchanged, p.changed, p.added, p.removed], [[], ['at:Organization/Cost Center', 'at:Organization/Name', 'ot:Organization'], [], []], 'unchanged/changed/added/removed'),
    deq(p.flags, [{ code: 'FL-TERMS-CHANGED', key: null, previous: '0'.repeat(64), current: TERMS }], 'flags'));
});
for (const [id, args, code, exit] of [
  ['foreign @context previous SDD', [F('jira-assets/minimal-organization-v2.json'), tmp('foreign-sdd.jsonld', rd(W('minimal/sdd.jsonld')).replace('https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld', 'https://example.org/ctx.jsonld'))], 'E-CTX-EXTERNAL', 1],
  ['previous is not an SDD', [F('jira-assets/minimal-organization-v2.json'), W('minimal/check-report.jsonld')], 'E-USAGE', 2],
  ['W-CS7-Δ4 (R-S24)', [F('jira-assets/minimal-organization-v2.json'), tmp('prev-v1.jsonld', rd(W('minimal/sdd.jsonld')).replace('"sddVersion": 2', '"sddVersion": 1'))], 'sddVersion 1; this release reads only sddVersion 2', 2],
  ['the rc.1 SDD (R-S24)', [F('jira-assets/minimal-organization-v2.json'), W('superseded/v4/minimal/sdd.jsonld')], 'E-USAGE', 2],
  ['unreadable schema', [join(TMP, 'missing.json'), W('minimal/sdd.jsonld')], 'E-IO', 2],
  ['missing argument', [F('jira-assets/minimal-organization-v2.json')], 'E-USAGE', 2],
]) check(`C-S7 refusal (R-S23): ${id}`, () => { const dir = join(TMP, `${n++}-never`); const r = sdd('rerun', ...args, '--out-dir', dir); return all(exitIs(r, exit), codeIn(r, code), r.out === '' ? true : 'wrote to stdout', nothingAt(dir)); });
check('C-S7 E-OUT-EXISTS (R-S23)', () => { const dir = join(TMP, `${n++}-exists`); mkdirSync(dir); writeFileSync(join(dir, 'keep.txt'), 'KEEP'); const r = sdd('rerun', F('jira-assets/minimal-organization-v2.json'), W('minimal/sdd.jsonld'), '--out-dir', dir); return all(exitIs(r, 2), codeIn(r, 'E-OUT-EXISTS'), deq(readdirSync(dir), ['keep.txt'], 'directory contents')); });

// SDD-F72 on the C-S6 side: nothing is carried from a previous SDD built on another term list.
check('W-CS6-Δ10', () => accept([W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), decisions([[KEYS[2], 'accept']]), '--checked', W('minimal/check-report-rerun.jsonld'), W('minimal/proposal-rerun.txt'), '--previous', tmp('prev-other.jsonld', OTHER_TERMS(rd(W('minimal/sdd.jsonld'))))], [KEYS[2]], 'minimal/sdd-v2.jsonld',
  (w) => { w.mappings = w.mappings.filter((m) => m.key === KEYS[2]); w.open = ['at:Organization/Name', 'ot:Organization']; }));

// End to end, W-JS3: changed schema → rerun → re-prompt only changed ∪ added → relay → check → accept with --previous.
check('C-S7 end-to-end (W-JS3)', () => {
  const x = rerun(F('jira-assets/minimal-organization-v2.json'), W('minimal/sdd.jsonld')); if (x.r.code !== 0) return 'rerun: ' + exitIs(x.r, 0);
  const inv = join(x.dir, 'inventory.jsonld'), plan = x.plan();
  const sk = tmp('sk2.jsonld', sdd('skeleton', inv).out);
  const keys = tmp('keys.json', JSON.stringify([...plan.changed, ...plan.added].sort()));
  const dir = join(TMP, `${n++}-p`); const p = sdd('prompt', sk, inv, '--keys', keys, '--out-dir', dir); if (p.code !== 0) return 'prompt: ' + exitIs(p, 0);
  const prompt = join(dir, 'prompt-1-of-1.txt');
  const c = sdd('check', sk, prompt, W('minimal/proposal-rerun.txt')); if (c.code !== 0) return 'check: ' + exitIs(c, 0);
  return all(sameFile(rd(sk), W('minimal/skeleton-v2.jsonld')), sameFile(rd(prompt), W('minimal/prompt-rerun.txt')), sameFile(c.out, W('minimal/check-report-rerun.jsonld')),
    accept([sk, inv, decisions([[KEYS[2], 'accept']]), '--checked', tmp('rr.jsonld', c.out), W('minimal/proposal-rerun.txt'), '--previous', W('minimal/sdd.jsonld')], [KEYS[2]], 'minimal/sdd-v2.jsonld'));
});
// End to end, W-CS7-Δ1 continuation: removal → the next C-S6 merge retires Cost Center with its last acceptance
// record; the unchanged mappings are carried byte-identical; nothing is re-accepted. (A merge needs one validated
// pair, so the remaining slots are re-proposed and left undecided.)
check('C-S7 end-to-end (W-CS7-Δ1 removal → retired)', () => {
  const x = rerun(F('jira-assets/minimal-organization-v3-removed.json'), W('minimal/sdd.jsonld')); if (x.r.code !== 0) return 'rerun: ' + exitIs(x.r, 0);
  const inv = join(x.dir, 'inventory.jsonld'); const sk = tmp('sk3.jsonld', sdd('skeleton', inv).out);
  const dir = join(TMP, `${n++}-p3`); const p = sdd('prompt', sk, inv, '--out-dir', dir); if (p.code !== 0) return 'prompt: ' + exitIs(p, 0);
  const prompt = join(dir, 'prompt-1-of-1.txt');
  const o = JSON.parse(rd(W('minimal/proposal-pasted.txt')).match(/\{[\s\S]*\}/)[0]);
  o.skeletonSha256 = createHash('sha256').update(readFileSync(sk)).digest('hex'); o.mappings = o.mappings.filter((m) => m.key !== KEYS[2]);
  const paste = tmp('p3.txt', JSON.stringify(o, null, 2));
  const c = sdd('check', sk, prompt, paste); if (c.code !== 0) return 'check: ' + exitIs(c, 0) + ' ' + c.out.slice(0, 200);
  const r = sdd('accept', sk, inv, decisions([]), '--checked', tmp('r3.jsonld', c.out), paste, '--previous', W('minimal/sdd.jsonld'));
  if (r.code !== 0) return 'accept with no new decisions: ' + exitIs(r, 0);
  const out = JSON.parse(r.out), prev = JSON.parse(rd(W('minimal/sdd.jsonld')));
  const pm = (k) => prev.mappings.find((m) => m.key === k);
  return all(deq(out.mappings, [pm(KEYS[0]), pm(KEYS[1])], 'carried mappings byte-identical'), deq(out.open, [], 'open'), deq(out.retired, [pm(KEYS[2])], 'retired = the removed mapping with its acceptance record'));
});

rmSync(TMP, { recursive: true, force: true });
const caps = { 'C-S1': [], 'C-S2': [], 'C-S3': [], 'C-S4': [], 'C-S5': [], 'C-S6': [], 'C-S7': [], other: [] };
for (const r of results) (caps[(/W-CS(\d)/.exec(r.id) ? 'C-S' + /W-CS(\d)/.exec(r.id)[1] : /^C-S\d/.exec(r.id)?.[0]) || 'other'] || caps.other).push(r);
for (const [cap, rs] of Object.entries(caps)) {
  if (!rs.length) continue;
  console.log(`${cap}: ${rs.filter((r) => r.ok).length}/${rs.length} pass`);
  for (const r of rs) if (!r.ok) console.log(`   FAIL ${r.id}: ${r.why}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} witnesses failed` : `\nok: all ${results.length} witnesses pass`);
process.exit(failed ? 1 : 0);
