// Witness runner for C-S1..C-S6 (and the W-JS1..W-JS4 chain steps using those capabilities).
// Runs the CLI as a subprocess and compares outputs byte for byte, or checks the stated expectation.
// Usage: node src/test/witnesses.mjs   (from the repository root). Writes only under src/.witness-tmp (removed).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'src', 'cli', 'sdd.mjs');
const TMP = path.join(ROOT, 'src', '.witness-tmp');
const W = (p) => path.join(ROOT, 'fixtures', 'witnesses', p);
const F = (p) => path.join(ROOT, 'fixtures', 'jira-assets', p);
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP);
let n = 0;
const tmp = (name) => path.join(TMP, `${n++}-${name}`);
const put = (name, content) => { const p = tmp(name); fs.writeFileSync(p, content); return p; };

function sdd(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'buffer' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr.toString('utf8') };
}
const json = (buf) => JSON.parse(buf.toString('utf8'));
const read = (p) => fs.readFileSync(p);
const same = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const results = [];
function witness(id, fn) {
  let ok, why;
  try {
    const r = fn();
    ok = r === true;
    why = r === true ? '' : String(r);
  } catch (e) {
    ok = false;
    why = e.stack || String(e);
  }
  results.push({ id, ok, why });
}
const expect = (cond, msg) => (cond ? true : msg);
const all = (...checks) => { for (const c of checks) if (c !== true) return c; return true; };

// ---------- C-S1 ----------
witness('W-CS1-N', () => {
  const r = sdd('parse', F('minimal-organization.json'));
  return all(expect(r.status === 0, `exit ${r.status}`), expect(same(r.stdout, read(W('minimal/inventory.jsonld'))), 'bytes differ'));
});
const errCase = (id, file, errors) => witness(id, () => {
  const r = sdd('parse', F(file));
  const v = json(r.stdout);
  return all(expect(r.status === 1, `exit ${r.status}`), expect(v.objectTypes.length === 0 && v.attributes.length === 0, 'non-empty'),
    expect(eq(v.errors, errors), `errors ${JSON.stringify(v.errors)}`));
});
errCase('W-CS1-Δ1', 'invalid/missing-attribute-type.json', [{ code: 'E-SRC-SHAPE', pointer: '/schema/objectSchema/objectTypes/0/attributes/1', keyword: 'required', detail: 'type' }]);
errCase('W-CS1-Δ2', 'invalid/unknown-reference-target.json', [{ code: 'E-SRC-REF-TARGET', key: 'at:Person/Manager', value: 'Employee' }]);
errCase('W-CS1-Δ3', 'invalid/mapping-unknown-attribute.json', [{ code: 'E-SRC-MAP-ATTR', key: 'ot:Organization', value: 'Budget' }]);
errCase('W-CS1-Δ4', 'invalid/duplicate-object-type-name.json', [{ code: 'E-SRC-DUP-TYPE', key: 'ot:Person' }]);
witness('W-CS1-Δ5', () => {
  const r = sdd('parse', F('synthetic-it-assets-externalids.json'));
  const v = json(r.stdout);
  const org = v.objectTypes.find((t) => t.name === 'Organization');
  const cc = v.attributes.find((a) => a.owner === org.key && a.name === 'Cost Center');
  return all(expect(r.status === 0, `exit ${r.status}`), expect(v.source.identification === 'externalId', 'identification'),
    expect(org.key === 'ot:object-type~1organization', org.key), expect(cc.key === 'at:object-type-attribute~1organization~1cost-center', cc.key),
    expect(same(r.stdout, read(W('full/inventory-externalids.jsonld'))), 'bytes differ from full/inventory-externalids.jsonld'));
});
witness('W-CS1-Δ6', () => {
  const r = sdd('parse', F('synthetic-it-assets.json'));
  const v = json(r.stdout);
  const got = v.flags.map((f) => [f.code, f.key, f.container ?? (f.attributes ? f.attributes.join(', ') : null)]);
  const want = [
    ['FL-CONTAINMENT', 'ot:Blade Server', 'ot:Server'], ['FL-CONTAINMENT', 'ot:Hard Drive', 'ot:Server'],
    ['FL-INHERITED-USE', 'ot:Blade Server', 'Asset Tag'], ['FL-INHERITED-USE', 'ot:Hard Drive', 'Serial Number'],
    ['FL-INHERITED-USE', 'ot:Laptop', 'Asset Tag, Owner, Purchase Cost, Purchase Date, Serial Number, Status'],
    ['FL-INHERITED-USE', 'ot:Server', 'Asset Tag, Location'], ['FL-NO-LABEL', 'ot:Scan Event', null],
    ['FL-SELECT-VALUES-UNKNOWN', 'at:Hardware/Status', null], ['FL-UNMAPPED-TYPE', 'ot:Hardware', null],
  ];
  return all(expect(r.status === 0, `exit ${r.status}`), expect(eq(got, want), JSON.stringify(got)),
    expect(v.attributes.some((a) => a.key === 'at:Server/Ports~1Protocols'), 'Ports key'),
    expect(same(r.stdout, read(W('full/inventory.jsonld'))), 'bytes differ from full/inventory.jsonld'));
});
errCase('W-CS1-Δ7', 'invalid/unknown-attribute-type.json', [{ code: 'E-SRC-SHAPE', pointer: '/schema/objectSchema/objectTypes/0/attributes/1/type', keyword: 'enum', detail: 'currency' }]);
errCase('W-CS1-Δ8', 'invalid/reference-without-target.json', [{ code: 'E-SRC-SHAPE', pointer: '/schema/objectSchema/objectTypes/1/attributes/6', keyword: 'required', detail: 'referenceObjectTypeName' }]);
errCase('W-CS1-Δ9', 'invalid/mapping-unknown-type.json', [{ code: 'E-SRC-MAP-TYPE', key: null, value: 'Printer' }]);
errCase('W-CS1-Δ10', 'invalid/duplicate-attribute-name.json', [{ code: 'E-SRC-DUP-ATTR', key: 'at:Organization/Cost Center' }]);
errCase('W-CS1-Δ11', 'invalid/key-collision.json', [{ code: 'E-SRC-KEY-COLLISION', key: 'ot:object-type~1organization' }]);
errCase('W-CS1-Δ13', 'invalid/two-containers.json', [{ code: 'E-SRC-KEY-COLLISION', key: 'ct:ot:Hard Drive' }]);
witness('W-CS1-Δ12', () => {
  const out = tmp('never.jsonld');
  const r = sdd('parse', path.join(TMP, 'missing.json'), '--out', out);
  return all(expect(r.status === 2, `exit ${r.status}`), expect(json(Buffer.from(r.stderr)).code === 'E-IO', r.stderr),
    expect(r.stdout.length === 0 && !fs.existsSync(out), 'something written'));
});

// ---------- C-S2 ----------
witness('W-CS2-N', () => {
  const r = sdd('skeleton', W('minimal/inventory.jsonld'));
  return all(expect(r.status === 0, `exit ${r.status}`), expect(same(r.stdout, read(W('minimal/skeleton.jsonld'))), 'bytes differ'));
});
const VT = { text: ['xsd:string', 'cco:ont00001765'], textarea: ['xsd:string', 'cco:ont00001765'], email: ['xsd:string', 'cco:ont00001765'], select: ['xsd:string', 'cco:ont00001765'], ipaddress: ['xsd:string', 'cco:ont00001765'], url: ['xsd:anyURI', 'cco:ont00001768'], integer: ['xsd:integer', 'cco:ont00001773'], double: ['xsd:double', 'cco:ont00001770'], boolean: ['xsd:boolean', 'cco:ont00001772'], date: ['xsd:date', 'cco:ont00001771'], date_time: ['xsd:dateTime', 'cco:ont00001767'], time: ['xsd:string', 'cco:ont00001765'] };
witness('W-CS2-Δ1', () => {
  const r = sdd('skeleton', W('full/inventory.jsonld'));
  const v = json(r.stdout);
  const count = (k) => v.slots.filter((s) => s.kind === k).length;
  const cts = v.slots.filter((s) => s.kind === 'containment').map((s) => s.key);
  const attrs = v.slots.filter((s) => s.kind === 'attribute');
  return all(expect(r.status === 0, `exit ${r.status}`),
    expect(count('type') === 10 && count('attribute') === 35 && count('reference') === 5 && count('containment') === 2, 'counts'),
    expect(eq(cts, ['ct:ot:Blade Server', 'ct:ot:Hard Drive']), JSON.stringify(cts)),
    expect(attrs.every((s) => eq([s.datatype, s.valueProperty], VT[s.jiraType])), 'value table'),
    expect(new Set(attrs.map((s) => s.jiraType)).size === 12, 'not all 12 types'),
    expect(same(r.stdout, read(W('full/skeleton.jsonld'))), 'bytes differ from full/skeleton.jsonld'));
});
witness('W-CS2-Δ2', () => {
  const inv = json(read(W('minimal/inventory.jsonld')));
  inv['@context'] = 'https://example.org/ctx.jsonld';
  const p = put('foreign.jsonld', JSON.stringify(inv, null, 2) + '\n');
  const out = tmp('sk.jsonld');
  const r = sdd('skeleton', p, '--out', out);
  return all(expect(r.status === 1, `exit ${r.status}`), expect(json(Buffer.from(r.stderr)).code === 'E-CTX-EXTERNAL', r.stderr),
    expect(!fs.existsSync(out), 'skeleton written'));
});
witness('W-CS2-Δ3', () => {
  const inv = put('errored.jsonld', sdd('parse', F('invalid/unknown-reference-target.json')).stdout);
  const out = tmp('sk.jsonld');
  const r = sdd('skeleton', inv, '--out', out);
  return all(expect(r.status === 1, `exit ${r.status}`), expect(json(Buffer.from(r.stderr)).code === 'E-SKEL-ERRORED', r.stderr),
    expect(!fs.existsSync(out), 'skeleton written'));
});

// ---------- C-S3 ----------
const promptDir = (sk, inv, ...extra) => { const d = tmp('prompts'); const r = sdd('prompt', sk, inv, ...extra, '--out-dir', d); return { r, d }; };
const dataLinesOf = (text) => { const L = text.split('\n'); const b = L.indexOf('-----BEGIN DATA (untrusted)-----'); const e = L.indexOf('-----END DATA-----', b + 1); return L.slice(b + 1, e); };
witness('W-CS3-N', () => {
  const { r, d } = promptDir(W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'));
  const files = fs.readdirSync(d).sort();
  return all(expect(r.status === 0, `exit ${r.status}`), expect(eq(files, ['prompt-1-of-1.txt', 'prompt-set.jsonld']), files.join()),
    expect(read(path.join(d, 'prompt-1-of-1.txt')).length === 63399, 'size'),
    expect(same(read(path.join(d, 'prompt-1-of-1.txt')), read(W('minimal/prompt.txt'))), 'prompt bytes differ'),
    expect(same(read(path.join(d, 'prompt-set.jsonld')), read(W('minimal/prompt-set.jsonld'))), 'prompt-set bytes differ'));
});
witness('W-CS3-Δ1', () => {
  const { r, d } = promptDir(W('full/skeleton.jsonld'), W('full/inventory.jsonld'));
  const text = read(path.join(d, 'prompt-1-of-1.txt')).toString('utf8');
  const desc = json(read(W('full/inventory.jsonld'))).attributes.find((a) => a.key === 'at:Software/Notes').description;
  const occurrences = text.split(desc).length - 1;
  const lines = text.split('\n');
  const notesLine = dataLinesOf(text).filter((l) => l.includes(desc));
  return all(expect(r.status === 0, `exit ${r.status}`), expect(occurrences === 1 && notesLine.length === 1, `occurrences ${occurrences}`),
    expect(JSON.parse(notesLine[0]).description === desc, 'not a JSON string value'),
    expect(lines.filter((l) => l === '-----END DATA-----').length === 1, 'END DATA count'),
    expect(same(read(path.join(d, 'prompt-1-of-1.txt')), read(W('full/prompt.txt'))), 'bytes differ from full/prompt.txt'));
});
witness('W-CS3-Δ2', () => {
  const { r, d } = promptDir(W('full/skeleton.jsonld'), W('full/inventory.jsonld'), '--budget', '69000');
  const p1 = read(path.join(d, 'prompt-1-of-2.txt')), p2 = read(path.join(d, 'prompt-2-of-2.txt'));
  const l1 = dataLinesOf(p1.toString('utf8')), l2 = dataLinesOf(p2.toString('utf8'));
  let range = true;
  for (const b of [66964, 66965, 70854, 70855]) {
    const x = promptDir(W('full/skeleton.jsonld'), W('full/inventory.jsonld'), '--budget', String(b));
    const nb = json(read(path.join(x.d, 'prompt-set.jsonld'))).prompts.length;
    const want = b >= 66965 && b <= 70854 ? 2 : nb; // outside the stated range: informational only
    if (nb !== want) range = `budget ${b}: ${nb} batches`;
  }
  return all(expect(r.status === 0, `exit ${r.status}`), expect(fs.readdirSync(d).length === 3, 'batch count'),
    expect(p1.length === 68803 && p2.length === 64979, `sizes ${p1.length} ${p2.length}`),
    expect(l1.length === 39 && l2.length === 13, `lines ${l1.length} ${l2.length}`),
    expect(same(p1, read(W('full/prompt-1-of-2.txt'))) && same(p2, read(W('full/prompt-2-of-2.txt'))), 'bytes differ'), range);
});
witness('W-CS3-Δ3', () => {
  const keys = put('keys.json', JSON.stringify(['at:Organization/Cost Center']));
  const { r, d } = promptDir(W('minimal/skeleton.jsonld'), W('minimal/inventory.jsonld'), '--keys', keys);
  const lines = dataLinesOf(read(path.join(d, 'prompt-1-of-1.txt')).toString('utf8'));
  return all(expect(r.status === 0, `exit ${r.status}`), expect(json(read(path.join(d, 'prompt-set.jsonld'))).prompts.length === 1, 'batches'),
    expect(lines.length === 1 && JSON.parse(lines[0]).key === 'at:Organization/Cost Center', JSON.stringify(lines)));
});
witness('W-CS3-Δ4', () => {
  const { r, d } = promptDir(W('full/skeleton.jsonld'), W('full/inventory.jsonld'), '--budget', '63700');
  const set = json(read(path.join(d, 'prompt-set.jsonld')));
  const wk = set.warnings.map((w) => [w.code, w.key]);
  return all(expect(r.status === 0, `exit ${r.status}`), expect(set.prompts.length === 10, `batches ${set.prompts.length}`),
    expect(eq(wk, ['ot:Person', 'ot:Location', 'ot:Hardware', 'ot:Server', 'ot:Software'].map((k) => ['W-PROMPT-OVERSIZE', k])), JSON.stringify(wk)));
});
witness('W-CS3-Δ5', () => {
  const { r, d } = promptDir(W('full/skeleton.jsonld'), W('full/inventory.jsonld'), '--budget', '50000');
  return all(expect(r.status === 1, `exit ${r.status}`), expect(json(Buffer.from(r.stderr)).code === 'E-PROMPT-BUDGET', r.stderr),
    expect(!fs.existsSync(d), 'output written'));
});
witness('W-CS3-Δ6', () => {
  const inv = put('inv.jsonld', sdd('parse', F('hostile-separators.json')).stdout);
  const sk = put('sk.jsonld', sdd('skeleton', inv).stdout);
  const { r, d } = promptDir(sk, inv);
  const buf = read(path.join(d, 'prompt-1-of-1.txt'));
  const text = buf.toString('utf8');
  return all(expect(r.status === 0, `exit ${r.status}`), expect(!/[\u2028\u2029]/.test(text), 'separator present'),
    expect(!buf.includes(0x0d), 'CR present'), expect(text.includes('\\u2028') && text.includes('\\u2029'), 'escapes missing'),
    expect(text.split('\n').filter((l) => l === '-----END DATA-----').length === 1, 'END DATA count'),
    expect(dataLinesOf(text).every((l) => { try { JSON.parse(l); return true; } catch { return false; } }), 'DATA not JSON'),
    expect(same(buf, read(W('hostile/prompt.txt'))), 'bytes differ from hostile/prompt.txt'));
});

// ---------- C-S4 ----------
const MSK = W('minimal/skeleton.jsonld'), MPR = W('minimal/prompt.txt');
const FSK = W('full/skeleton.jsonld'), FPR = W('full/prompt.txt');
const check = (sk, pr, pasteContent) => {
  const paste = Buffer.isBuffer(pasteContent) || typeof pasteContent === 'string' && !pasteContent.startsWith('{') && fs.existsSync(pasteContent)
    ? pasteContent : put('paste.txt', typeof pasteContent === 'string' ? pasteContent : JSON.stringify(pasteContent, null, 2));
  const r = sdd('check', sk, pr, paste);
  return { r, v: r.stdout.length ? json(r.stdout) : null };
};
const nProposal = () => {
  const t = read(W('minimal/proposal-pasted.txt')).toString('utf8');
  return JSON.parse(t.slice(t.indexOf('```json') + 7, t.lastIndexOf('```')));
};
const codes = (xs) => xs.map((e) => [e.code, e.key]);
const exact = (r, v, status, errs, warns) => all(expect(r.status === status, `exit ${r.status}`),
  expect(eq(codes(v.errors), errs), `errors ${JSON.stringify(codes(v.errors))}`),
  warns === undefined ? true : expect(eq(codes(v.warnings), warns), `warnings ${JSON.stringify(codes(v.warnings))}`));

witness('W-CS4-N', () => {
  const { r } = check(MSK, MPR, W('minimal/proposal-pasted.txt'));
  return all(expect(r.status === 0, `exit ${r.status}`), expect(same(r.stdout, read(W('minimal/check-report.jsonld'))), 'bytes differ'));
});
witness('W-CS4-Δ1', () => {
  const { r } = check(MSK, MPR, W('minimal/bad-proposal.txt'));
  return all(expect(r.status === 1, `exit ${r.status}`), expect(same(r.stdout, read(W('minimal/bad-check-report.jsonld'))), 'bytes differ'));
});
witness('W-CS4-Δ2', () => {
  const p = nProposal();
  p.mappings.splice(2, 0, { ...p.mappings[1] });
  p.mappings.push({ key: 'at:Organization/Budget', iceClass: 'cco:ont00000077', rationale: 'x' });
  const { r, v } = check(MSK, MPR, p);
  return exact(r, v, 1, [['E-CHK-DUPLICATE', 'at:Organization/Name'], ['E-CHK-UNKNOWN-KEY', 'at:Organization/Budget']]);
});
witness('W-CS4-Δ3', () => {
  const p = nProposal(); p.mappings[1].iceClass = 'cco:ont99999999';
  const { r, v } = check(MSK, MPR, p);
  return exact(r, v, 1, [['E-CHK-TERM', 'at:Organization/Name']]);
});
witness('W-CS4-Δ4', () => {
  const p = nProposal(); p.mappings[1].iceClass = 'cco:ont00001808';
  const { r, v } = check(MSK, MPR, p);
  return exact(r, v, 1, [['E-CHK-KIND', 'at:Organization/Name']]);
});
witness('W-CS4-Δ5', () => {
  const { r } = check(FSK, FPR, W('full/proposal-range.txt'));
  return all(expect(r.status === 1, `exit ${r.status}`), expect(same(r.stdout, read(W('full/check-report-range.jsonld'))), 'bytes differ'));
});
witness('W-CS4-Δ6', () => {
  const p = nProposal(); p.mappings[2].nullEquivalents = ['N/A'];
  const { r, v } = check(MSK, MPR, p);
  return exact(r, v, 1, [['E-CHK-HUMAN-FIELD', 'at:Organization/Cost Center']]);
});
witness('W-CS4-Δ7', () => {
  const o = JSON.stringify(nProposal(), null, 2);
  const { r, v } = check(MSK, MPR, o + '\n' + o + '\n');
  return exact(r, v, 1, [['E-CHK-JSON', null]]);
});
witness('W-CS4-Δ8', () => {
  const p = nProposal(); p.mappings[0].referentClass = 'bfo:BFO_0000001';
  const { r, v } = check(MSK, MPR, p);
  return all(expect(r.status === 0 && v.status === 'validated' && v.errors.length === 0, `exit ${r.status}`),
    expect(eq(v.warnings, [{ code: 'W-CHK-GENERIC', key: 'ot:Organization', field: 'referentClass', value: 'bfo:BFO_0000001', rule: 'R-S5', message: 'referentClass bfo:BFO_0000001 (entity) is a top-level class; check it is specific enough.' }]), JSON.stringify(v.warnings)));
});
witness('W-CS4-Δ9', () => {
  const p = nProposal(); p.skeletonSha256 = '0'.repeat(64);
  const { r, v } = check(MSK, MPR, p);
  return exact(r, v, 1, [['E-CHK-SKELETON', null]]);
});
witness('W-CS4-Δ10', () => {
  const sk = json(read(FSK));
  const fields = { type: ['recordClass', 'referentClass'], attribute: ['iceClass'], reference: ['relation'], containment: ['relation'] };
  const mappings = sk.slots.map((s) => {
    const m = { key: s.key };
    for (const f of fields[s.kind]) m[f] = 'bfo:BFO_0000001';
    m.rationale = 'Validation passed.';
    return m;
  });
  const { r, v } = check(FSK, FPR, { skeletonSha256: json(read(W('full/check-report-valid.jsonld'))).skeletonSha256, batch: '1/1', mappings });
  const tally = {};
  for (const e of v.errors) tally[`${e.code} ${e.field}`] = (tally[`${e.code} ${e.field}`] || 0) + 1;
  const wt = {};
  for (const w of v.warnings) wt[`${w.code} ${w.field}`] = (wt[`${w.code} ${w.field}`] || 0) + 1;
  // R-S20 order: errors follow skeleton order of their slots
  const order = sk.slots.map((s) => s.key);
  const sorted = v.errors.every((e, i) => i === 0 || order.indexOf(v.errors[i - 1].key) <= order.indexOf(e.key));
  return all(expect(r.status === 1 && v.status === 'rejected', `exit ${r.status}`), expect(v.errors.length === 52, `errors ${v.errors.length}`),
    expect(eq(tally, { 'E-CHK-CATEGORY recordClass': 10, 'E-CHK-CATEGORY iceClass': 35, 'E-CHK-KIND relation': 7 }), JSON.stringify(tally)),
    expect(v.warnings.length === 10 && eq(wt, { 'W-CHK-GENERIC referentClass': 10 }), JSON.stringify(wt)), expect(sorted, 'order'));
});
witness('W-CS4-Δ11', () => {
  const p = nProposal(); p.mappings[0].referentClass = 'cco:ont00000853';
  const { r, v } = check(MSK, MPR, p);
  return exact(r, v, 0, [], [['W-CHK-ICE-REFERENT', 'ot:Organization']]);
});
witness('W-CS4-Δ12', () => {
  const p = nProposal(); p.batch = '2/2';
  const { r, v } = check(MSK, MPR, p);
  return all(exact(r, v, 1, [['E-CHK-BATCH', null]]), expect(v.errors[0].message === 'The reply names batch 2/2; the prompt is batch 1/1.', v.errors[0].message));
});
witness('W-CS4-Δ13', () => {
  const p = nProposal(); p.mappings[1] = { key: 'at:Organization/Name', relation: p.mappings[1].iceClass, rationale: p.mappings[1].rationale };
  const { r, v } = check(MSK, MPR, p);
  return all(exact(r, v, 1, [['E-CHK-FIELDS', 'at:Organization/Name']]),
    expect(v.errors[0].message === 'at:Organization/Name must have exactly the fields key, iceClass, rationale.', v.errors[0].message));
});
witness('W-CS4-Δ14', () => {
  const p = nProposal(); p.mappings = {};
  const { r, v } = check(MSK, MPR, p);
  return all(expect(r.status === 1, `exit ${r.status}`), expect(eq(v.errors, [{ code: 'E-CHK-SHAPE', key: null, field: null, value: '/mappings', rule: 'R-S13', message: 'The reply does not match the proposal schema at /mappings (type).' }]), JSON.stringify(v.errors)));
});
witness('W-CS4-Δ15', () => {
  const { r } = check(FSK, FPR, W('full/proposal-valid.txt'));
  return all(expect(r.status === 0, `exit ${r.status}`), expect(same(r.stdout, read(W('full/check-report-valid.jsonld'))), 'bytes differ'));
});
witness('W-CS4-Δ16', () => {
  const { r } = check(FSK, W('full/prompt-2-of-2.txt'), W('full/proposal-batch2.txt'));
  return all(expect(r.status === 0, `exit ${r.status}`), expect(same(r.stdout, read(W('full/check-report-batch2.jsonld'))), 'bytes differ'));
});
witness('W-CS4-Δ17', () => {
  const p = nProposal(); p.mappings[0].referentClass = 'cco:ont00000958';
  const { r, v } = check(MSK, MPR, p);
  return exact(r, v, 0, [], [['W-CHK-GENERIC', 'ot:Organization'], ['W-CHK-ICE-REFERENT', 'ot:Organization']]);
});
witness('W-CS4-Δ18', () => {
  const r = sdd('check', MSK);
  return all(expect(r.status === 2, `exit ${r.status}`), expect(json(Buffer.from(r.stderr)).code === 'E-USAGE', r.stderr), expect(r.stdout.length === 0, 'stdout'));
});

// ---------- chains (C-S1..C-S4 steps only) ----------
witness('W-JS1 (steps 1-5)', () => {
  const inv = tmp('inventory.jsonld'), sk = tmp('skeleton.jsonld'), rep = tmp('check-report.jsonld');
  const s1 = sdd('parse', F('minimal-organization.json'), '--out', inv);
  const s2 = sdd('skeleton', inv, '--out', sk);
  const { r: s3, d } = promptDir(sk, inv);
  const s5 = sdd('check', sk, path.join(d, 'prompt-1-of-1.txt'), W('minimal/proposal-pasted.txt'), '--out', rep);
  return all(expect([s1, s2, s3, s5].every((x) => x.status === 0), 'exit codes'),
    expect(same(read(inv), read(W('minimal/inventory.jsonld'))), 'inventory'), expect(same(read(sk), read(W('minimal/skeleton.jsonld'))), 'skeleton'),
    expect(same(read(path.join(d, 'prompt-1-of-1.txt')), read(W('minimal/prompt.txt'))), 'prompt'),
    expect(same(read(rep), read(W('minimal/check-report.jsonld'))), 'report'));
});
witness('W-JS2 (steps 1-5, 8)', () => {
  const rep = sdd('check', MSK, MPR, W('minimal/bad-proposal.txt'));
  const rep2 = sdd('check', MSK, W('minimal/repair-prompt.txt'), W('minimal/proposal-pasted.txt'));
  return all(expect(rep.status === 1 && same(rep.stdout, read(W('minimal/bad-check-report.jsonld'))), 'round-1 report'),
    expect(rep2.status === 0 && same(rep2.stdout, read(W('minimal/check-report-round2.jsonld'))), 'round-2 report'));
});
// Extra: J-S3 / J-S4 steps that use only C-S2..C-S4.
witness('W-JS3 (steps 3-5)', () => {
  const s3 = sdd('skeleton', W('minimal/inventory-v2.jsonld'));
  const { r, d } = promptDir(W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), '--keys', W('minimal/keys-rerun.json'));
  const c = sdd('check', W('minimal/skeleton-v2.jsonld'), path.join(d, 'prompt-1-of-1.txt'), W('minimal/proposal-rerun.txt'));
  return all(expect(same(s3.stdout, read(W('minimal/skeleton-v2.jsonld'))), 'skeleton-v2'), expect(r.status === 0, 'prompt exit'),
    expect(same(read(path.join(d, 'prompt-1-of-1.txt')), read(W('minimal/prompt-rerun.txt'))), 'prompt-rerun'),
    expect(c.status === 0 && same(c.stdout, read(W('minimal/check-report-rerun.jsonld'))), 'check-report-rerun'));
});
witness('W-JS4 (prompt/check steps)', () => {
  const { r, d } = promptDir(MSK, W('minimal/inventory.jsonld'), '--keys', W('minimal/keys-open.json'));
  const c = sdd('check', MSK, path.join(d, 'prompt-1-of-1.txt'), W('minimal/proposal-open.txt'));
  return all(expect(r.status === 0, 'prompt exit'), expect(same(read(path.join(d, 'prompt-1-of-1.txt')), read(W('minimal/prompt-open.txt'))), 'prompt-open'),
    expect(c.status === 0 && same(c.stdout, read(W('minimal/check-report-open.jsonld'))), 'check-report-open'));
});
// ---------- C-S5 ----------
const MIN = W('minimal/inventory.jsonld');
const repair = (sk, inv, rep, pr, ...extra) => sdd('repair', sk, inv, rep, pr, ...extra);
const errOf = (r) => { try { return json(Buffer.from(r.stderr)).code; } catch { return `stderr ${JSON.stringify(r.stderr)}`; } };
const refused = (r, status, code, out) => all(expect(r.status === status, `exit ${r.status} ${r.stderr}`), expect(errOf(r) === code, `code ${errOf(r)}`),
  expect(r.stdout.length === 0 && (out === undefined || !fs.existsSync(out)), 'something written'),
  expect(r.stderr.trimEnd().split('\n').length === 1, 'stderr not one line'));
witness('W-CS5-N', () => {
  const out = tmp('repair-prompt.txt');
  const r = repair(MSK, MIN, W('minimal/bad-check-report.jsonld'), MPR, '--out', out);
  const text = read(out).toString('utf8');
  return all(expect(r.status === 0, `exit ${r.status} ${r.stderr}`), expect(same(read(out), read(W('minimal/repair-prompt.txt'))), 'bytes differ'),
    expect(text.split('\n')[4] === 'round: 2', 'round'), expect(eq(dataLinesOf(text), dataLinesOf(read(MPR).toString('utf8'))), 'DATA lines differ'),
    expect(same(repair(MSK, MIN, W('minimal/bad-check-report.jsonld'), MPR).stdout, read(out)), 'stdout differs from --out'));
});
witness('W-CS5-Δ1', () => {
  const out = tmp('never.txt');
  return refused(repair(MSK, MIN, W('minimal/check-report.jsonld'), MPR, '--out', out), 1, 'E-REPAIR-NOTHING', out);
});
// R-S23: readable inputs that do not belong together are E-USAGE (exit 2); nothing written.
witness('C-S5 mismatch: report/prompt', () => {
  const out = tmp('never.txt');
  return refused(repair(MSK, MIN, W('minimal/bad-check-report.jsonld'), W('minimal/prompt-open.txt'), '--out', out), 2, 'E-USAGE', out);
});
witness('C-S5 mismatch: prompt/skeleton', () => {
  const out = tmp('never.txt');
  return refused(repair(W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), W('minimal/bad-check-report.jsonld'), MPR, '--out', out), 2, 'E-USAGE', out);
});
witness('C-S5 mismatch: skeleton/inventory', () => {
  const out = tmp('never.txt');
  return refused(repair(MSK, W('minimal/inventory-v2.jsonld'), W('minimal/bad-check-report.jsonld'), MPR, '--out', out), 2, 'E-USAGE', out);
});
witness('C-S5 mismatch: tampered report', () => {
  const rep = json(read(W('minimal/bad-check-report.jsonld'))); rep.round = 2;
  return refused(repair(MSK, MIN, put('rep.jsonld', JSON.stringify(rep, null, 2) + '\n'), MPR), 2, 'E-USAGE');
});
witness('C-S5 wrong kinds (report as skeleton; prompt as report)', () => all(
  refused(repair(W('minimal/bad-check-report.jsonld'), MIN, W('minimal/bad-check-report.jsonld'), MPR), 2, 'E-USAGE'),
  refused(repair(MSK, MIN, MPR, MPR), 2, 'E-IO')));
witness('C-S5 E-CTX-EXTERNAL (R-S16)', () => {
  const rep = json(read(W('minimal/bad-check-report.jsonld'))); rep['@context'] = 'https://example.org/ctx.jsonld';
  return refused(repair(MSK, MIN, put('foreign.jsonld', JSON.stringify(rep, null, 2) + '\n'), MPR), 1, 'E-CTX-EXTERNAL');
});
witness('C-S5 E-IO / E-USAGE / E-OUT-EXISTS', () => {
  const existing = put('exists.txt', 'keep');
  return all(refused(repair(MSK, MIN, path.join(TMP, 'missing.jsonld'), MPR), 2, 'E-IO'),
    refused(sdd('repair', MSK, MIN, W('minimal/bad-check-report.jsonld')), 2, 'E-USAGE'),
    refused(repair(MSK, MIN, W('minimal/bad-check-report.jsonld'), MPR, '--out', existing), 2, 'E-OUT-EXISTS'),
    expect(read(existing).toString() === 'keep', 'file changed'));
});
witness('C-S5 round 3 (repair of a repair prompt)', () => {
  const rp = W('minimal/repair-prompt.txt');
  const c = sdd('check', MSK, rp, W('minimal/bad-proposal.txt'));
  const r = repair(MSK, MIN, put('rep2.jsonld', c.stdout), rp);
  const text = r.stdout.toString('utf8');
  const c3 = sdd('check', MSK, put('rp3.txt', r.stdout), W('minimal/proposal-pasted.txt'));
  return all(expect(c.status === 1 && json(c.stdout).round === 2, 'round-2 rejection'), expect(r.status === 0, `exit ${r.status} ${r.stderr}`),
    expect(text.split('\n')[4] === 'round: 3', 'round'), expect(eq(dataLinesOf(text), dataLinesOf(read(MPR).toString('utf8'))), 'DATA'),
    expect(text.split('ERRORS IN YOUR PREVIOUS REPLY').length === 2, 'ERRORS block count'),
    expect(c3.status === 0 && json(c3.stdout).round === 3 && json(c3.stdout).status === 'validated', 'round-3 check'));
});
witness('C-S5 placeholder text in an error stays inert (R-S11 single pass)', () => {
  const p = nProposal(); p.mappings[1].iceClass = '{{CATALOGUE}}';
  const { r: c } = check(MSK, MPR, p);
  const r = repair(MSK, MIN, put('rep.jsonld', c.stdout), MPR);
  const text = r.stdout.toString('utf8');
  return all(expect(c.status === 1, 'check'), expect(r.status === 0, `exit ${r.status} ${r.stderr}`),
    expect(text.split('\n').filter((l) => l === '-----BEGIN CATALOGUE-----').length === 1, 'catalogue count'),
    expect(text.includes('"value":"{{CATALOGUE}}"'), 'placeholder not verbatim'));
});
witness('W-JS2 (full chain through the CLI)', () => {
  const inv = tmp('inventory.jsonld'), sk = tmp('skeleton.jsonld'), rep1 = tmp('bad-check-report.jsonld');
  const rp = tmp('repair-prompt.txt'), rep2 = tmp('check-report-round2.jsonld');
  const s1 = sdd('parse', F('minimal-organization.json'), '--out', inv);
  const s2 = sdd('skeleton', inv, '--out', sk);
  const { r: s3, d } = promptDir(sk, inv);
  const pr = path.join(d, 'prompt-1-of-1.txt');
  const s5 = sdd('check', sk, pr, W('minimal/bad-proposal.txt'), '--out', rep1);
  const s6 = sdd('repair', sk, inv, rep1, pr, '--out', rp);
  const s8 = sdd('check', sk, rp, W('minimal/proposal-pasted.txt'), '--out', rep2);
  return all(expect([s1, s2, s3, s6, s8].every((x) => x.status === 0) && s5.status === 1, `exit codes ${[s1, s2, s3, s5, s6, s8].map((x) => x.status)}`),
    expect(same(read(pr), read(W('minimal/prompt.txt'))), 'prompt'),
    expect(same(read(rep1), read(W('minimal/bad-check-report.jsonld'))), 'round-1 report'),
    expect(same(read(rp), read(W('minimal/repair-prompt.txt'))), 'repair prompt'),
    expect(same(read(rep2), read(W('minimal/check-report-round2.jsonld'))), 'round-2 report'));
});

// R-S23 refusals for these four commands.
witness('R-S23 E-OUT-EXISTS', () => {
  const existing = put('exists.txt', 'keep');
  const rs = [sdd('parse', F('minimal-organization.json'), '--out', existing), sdd('skeleton', W('minimal/inventory.jsonld'), '--out', existing),
    sdd('prompt', MSK, W('minimal/inventory.jsonld'), '--out-dir', TMP), sdd('check', MSK, MPR, W('minimal/proposal-pasted.txt'), '--out', existing)];
  return all(expect(rs.every((r) => r.status === 2 && json(Buffer.from(r.stderr)).code === 'E-OUT-EXISTS'), rs.map((r) => r.stderr).join()),
    expect(read(existing).toString() === 'keep', 'file changed'));
});

// ---------- C-S6 ----------
// Mask: every acceptance.at the act wrote must be YYYY-MM-DDTHH:MM:SSZ within ±5 s of the act; carried records keep
// their own value. With every `at` set to the witness value, the bytes must equal the witness file.
const AT_RE = /"at": "([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)"/g;
const WITNESS_AT = '2026-10-27T18:00:00Z';
const DEC = (decisions, nullEquivalents = {}) => put('decisions.json', JSON.stringify({ by: 'Aaron Damiano', decisions, nullEquivalents }));
const ACC3 = [{ key: 'ot:Organization', decision: 'accept' }, { key: 'at:Organization/Name', decision: 'accept' }, { key: 'at:Organization/Cost Center', decision: 'accept' }];
const PART3 = [{ key: 'ot:Organization', decision: 'accept' }, { key: 'at:Organization/Name', decision: 'accept' }, { key: 'at:Organization/Cost Center', decision: 'reject' }];
const ALL3 = () => DEC(ACC3);
const accept = (sk, inv, dec, pairs, ...extra) => {
  const t0 = Date.now();
  const r = sdd('accept', sk, inv, dec, ...pairs.flatMap(([rep, paste]) => ['--checked', rep, paste]), ...extra);
  r.t0 = t0; r.t1 = Date.now();
  return r;
};
const sddMatches = (r, bytes, witnessFile, carriedAts = 0) => {
  const text = Buffer.from(bytes).toString('utf8');
  const ats = [...text.matchAll(AT_RE)].map((m) => m[1]);
  const fresh = ats.filter((a) => a !== WITNESS_AT);
  const inWindow = fresh.every((a) => { const t = Date.parse(a); return t >= r.t0 - 6000 && t <= r.t1 + 5000; });
  const masked = text.replace(AT_RE, `"at": "${WITNESS_AT}"`);
  return all(expect(r.status === 0, `exit ${r.status} ${r.stderr}`), expect(ats.length > 0, 'no acceptance.at'),
    expect(fresh.length === ats.length - carriedAts, `at values ${ats}`),
    expect(inWindow, `at outside ±5 s: ${fresh}`), expect(masked === read(W(witnessFile)).toString('utf8'), `bytes differ from ${witnessFile} (masked)`));
};
const MPASTE = W('minimal/proposal-pasted.txt'), MREP = W('minimal/check-report.jsonld');
const N_PAIR = [MREP, MPASTE];
const R2_PAIR = [W('minimal/check-report-round2.jsonld'), MPASTE];
const OPEN_PAIR = [W('minimal/check-report-open.jsonld'), W('minimal/proposal-open.txt')];

witness('W-CS6-N', () => {
  const out = tmp('sdd.jsonld');
  const r = accept(MSK, MIN, ALL3(), [N_PAIR], '--out', out);
  return all(sddMatches(r, read(out), 'minimal/sdd.jsonld'), expect(r.stdout.length === 0, 'stdout with --out'));
});
witness('W-CS6-N (by is the input string verbatim)', () => {
  const by = '  Ä. Damiano "x" ';
  const r = accept(MSK, MIN, put('d.json', JSON.stringify({ by, decisions: [ACC3[0]], nullEquivalents: {} })), [N_PAIR]);
  return all(expect(r.status === 0, r.stderr), expect(json(r.stdout).mappings[0].acceptance.by === by, 'by not verbatim'));
});
witness('W-CS6-Δ1', () => {
  const out = tmp('never.jsonld');
  return refused(accept(MSK, MIN, ALL3(), [[W('minimal/bad-check-report.jsonld'), W('minimal/bad-proposal.txt')]], '--out', out), 1, 'E-ACC-UNVALIDATED', out);
});
witness('W-CS6-Δ2', () => {
  const r = accept(MSK, MIN, DEC(PART3), [N_PAIR]);
  return all(sddMatches(r, r.stdout, 'minimal/sdd-partial.jsonld'), expect(eq(json(r.stdout).open, ['at:Organization/Cost Center']), 'open'));
});
witness('C-S6 property 1: undecided keys stay open; a validated report accepts nothing by itself', () => {
  const r1 = accept(MSK, MIN, DEC(ACC3.slice(0, 2)), [N_PAIR]);
  const r0 = accept(MSK, MIN, DEC([]), [N_PAIR]);
  const v0 = json(r0.stdout);
  return all(sddMatches(r1, r1.stdout, 'minimal/sdd-partial.jsonld'),
    expect(r0.status === 0 && v0.mappings.length === 0 && eq(v0.open, ['at:Organization/Cost Center', 'at:Organization/Name', 'ot:Organization']), 'zero decisions'));
});
witness('W-CS6-Δ3', () => {
  const out = tmp('never.jsonld');
  const paste = put('paste.txt', Buffer.concat([read(MPASTE), Buffer.from(' ')]));
  return refused(accept(MSK, MIN, ALL3(), [[MREP, paste]], '--out', out), 1, 'E-ACC-MISMATCH', out);
});
witness('W-CS6-Δ4', () => {
  const r = accept(MSK, MIN, DEC(ACC3, { 'at:Organization/Cost Center': ['N/A', '-'] }), [N_PAIR]);
  const v = json(r.stdout), base = json(read(W('minimal/sdd.jsonld')));
  const ne = v.mappings[2].nullEquivalents;
  v.mappings[2].nullEquivalents = [];
  for (const m of v.mappings) m.acceptance.at = WITNESS_AT;
  return all(expect(r.status === 0, r.stderr), expect(eq(ne, ['-', 'N/A']), `nullEquivalents ${JSON.stringify(ne)}`), expect(eq(v, base), 'something else changed'));
});
witness('W-CS6-Δ5', () => {
  const existing = put('exists.jsonld', 'keep');
  const r = accept(MSK, MIN, ALL3(), [N_PAIR], '--out', existing);
  return all(refused(r, 2, 'E-OUT-EXISTS'), expect(read(existing).toString() === 'keep', 'file changed'));
});
witness('W-CS6-Δ6', () => {
  const out = tmp('never.jsonld');
  const r = accept(MSK, MIN, DEC([ACC3[2], ACC3[0]]), [OPEN_PAIR], '--out', out);
  return all(refused(r, 1, 'E-ACC-UNCOVERED', out), expect(json(Buffer.from(r.stderr)).key === 'ot:Organization', r.stderr));
});
witness('W-CS6-Δ6 (an uncovered reject is refused too)', () =>
  refused(accept(MSK, MIN, DEC([{ key: 'ot:Organization', decision: 'reject' }]), [OPEN_PAIR]), 1, 'E-ACC-UNCOVERED'));
witness('W-CS6-Δ7', () => {
  const r = accept(MSK, MIN, ALL3(), [R2_PAIR]);
  return sddMatches(r, r.stdout, 'minimal/sdd-round2.jsonld');
});
witness('W-CS6-Δ8', () => {
  const out = tmp('never.jsonld');
  return refused(accept(W('minimal/skeleton-v2.jsonld'), MIN, ALL3(), [N_PAIR], '--out', out), 1, 'E-ACC-MISMATCH', out);
});
witness('W-CS6-Δ9 (both argument orders)', () => {
  const r1 = accept(MSK, MIN, ALL3(), [N_PAIR, R2_PAIR]);
  const r2 = accept(MSK, MIN, ALL3(), [R2_PAIR, N_PAIR]);
  return all(sddMatches(r1, r1.stdout, 'minimal/sdd-round2.jsonld'), sddMatches(r2, r2.stdout, 'minimal/sdd-round2.jsonld'));
});
witness('C-S6 R-S9/R-S10: datatype, valueProperty from the value table; nullEquivalents default []', () => {
  const r = accept(MSK, MIN, ALL3(), [N_PAIR]);
  const v = json(r.stdout), sk = json(read(MSK));
  return all(expect(r.status === 0, r.stderr), ...v.mappings.filter((m) => m.kind === 'attribute').map((m) => {
    const s = sk.slots.find((x) => x.key === m.key);
    return expect(m.datatype === s.datatype && m.valueProperty === s.valueProperty && eq(m.nullEquivalents, []), m.key);
  }));
});
witness('C-S6 full fixture: all 52 accepted → full/sdd.jsonld (masked; reference and containment shapes)', () => {
  const dec = DEC(json(read(FSK)).slots.map((s) => ({ key: s.key, decision: 'accept' })));
  const r = accept(FSK, W('full/inventory.jsonld'), dec, [[W('full/check-report-valid.jsonld'), W('full/proposal-valid.txt')]]);
  return sddMatches(r, r.stdout, 'full/sdd.jsonld');
});
witness('C-S6 refusals: usage, I/O, context, kinds (nothing written)', () => {
  const foreign = json(read(MREP)); foreign['@context'] = 'https://example.org/ctx.jsonld';
  return all(
    refused(sdd('accept', MSK, MIN, ALL3()), 2, 'E-USAGE'),
    refused(sdd('accept', MSK, MIN, ALL3(), '--checked', MREP), 2, 'E-USAGE'),
    refused(accept(MSK, MIN, path.join(TMP, 'missing.json'), [N_PAIR]), 2, 'E-IO'),
    refused(accept(MSK, MIN, put('d.json', 'not json'), [N_PAIR]), 2, 'E-USAGE'),
    refused(accept(MSK, MIN, DEC([{ key: 'ot:Organization', decision: 'approve' }]), [N_PAIR]), 2, 'E-USAGE'),
    refused(accept(MSK, MIN, DEC([ACC3[0], { key: 'ot:Organization', decision: 'reject' }]), [N_PAIR]), 2, 'E-USAGE'),
    refused(accept(MSK, MIN, DEC([ACC3[0]], { 'ot:Organization': ['N/A'] }), [N_PAIR]), 2, 'E-USAGE'),
    refused(accept(MSK, MIN, DEC([{ key: 'at:Organization/Name', decision: 'reject' }], { 'at:Organization/Name': ['N/A'] }), [N_PAIR]), 2, 'E-USAGE'),
    refused(accept(MSK, W('minimal/inventory-v2.jsonld'), ALL3(), [N_PAIR]), 2, 'E-USAGE'),
    refused(accept(MSK, MIN, ALL3(), [[put('f.jsonld', JSON.stringify(foreign, null, 2) + '\n'), MPASTE]]), 1, 'E-CTX-EXTERNAL'),
    refused(accept(MSK, MIN, ALL3(), [N_PAIR], '--previous', MREP), 2, 'E-USAGE'));
});

// ---------- chains: C-S6 steps ----------
witness('W-JS1 (step 6)', () => {
  const r = accept(MSK, MIN, ALL3(), [N_PAIR]);
  return sddMatches(r, r.stdout, 'minimal/sdd.jsonld');
});
witness('W-JS2 (step 9)', () => {
  const r = accept(MSK, MIN, ALL3(), [R2_PAIR]);
  return sddMatches(r, r.stdout, 'minimal/sdd-round2.jsonld');
});
const RERUN_PAIR = [W('minimal/check-report-rerun.jsonld'), W('minimal/proposal-rerun.txt')];
witness('W-JS3 (step 6, --previous)', () => {
  const r = accept(W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), DEC([ACC3[2]]), [RERUN_PAIR], '--previous', W('minimal/sdd.jsonld'));
  return all(sddMatches(r, r.stdout, 'minimal/sdd-v2.jsonld', 2),
    expect(eq(json(r.stdout).mappings.slice(0, 2), json(read(W('minimal/sdd.jsonld'))).mappings.slice(0, 2)), 'carried mappings differ'));
});
witness('W-JS3 (no decision: the changed key is open, never silently re-accepted)', () => {
  const r = accept(W('minimal/skeleton-v2.jsonld'), W('minimal/inventory-v2.jsonld'), DEC([]), [RERUN_PAIR], '--previous', W('minimal/sdd.jsonld'));
  const v = json(r.stdout);
  return all(expect(r.status === 0, r.stderr), expect(eq(v.open, ['at:Organization/Cost Center']), 'open'),
    expect(eq(v.mappings, json(read(W('minimal/sdd.jsonld'))).mappings.slice(0, 2)), 'carried'));
});
witness('W-JS4 (both C-S6 steps, --previous)', () => {
  const partial = tmp('sdd-partial.jsonld'), j4 = tmp('sdd-j4.jsonld');
  const r1 = accept(MSK, MIN, DEC(PART3), [N_PAIR], '--out', partial);
  const r2 = accept(MSK, MIN, DEC([ACC3[2]]), [OPEN_PAIR], '--previous', W('minimal/sdd-partial.jsonld'), '--out', j4);
  const r3 = accept(MSK, MIN, DEC([ACC3[2]]), [OPEN_PAIR], '--previous', partial); // chained from our own step output
  return all(sddMatches(r1, read(partial), 'minimal/sdd-partial.jsonld'), sddMatches(r2, read(j4), 'minimal/sdd-j4.jsonld', 2),
    expect(eq(json(read(j4)).mappings.slice(0, 2), json(read(W('minimal/sdd-partial.jsonld'))).mappings), 'carried'),
    expect(r3.status === 0 && eq(json(r3.stdout).mappings.slice(0, 2), json(read(partial)).mappings), 'carried from own output'));
});
witness('C-S6 merge after W-CS7-Δ1 (removed key → retired with its acceptance record)', () => {
  const inv3 = W('minimal/inventory-v3.jsonld');
  const sk3 = put('skeleton-v3.jsonld', sdd('skeleton', inv3).stdout);
  const { d } = promptDir(sk3, inv3);
  const pr = path.join(d, 'prompt-1-of-1.txt');
  const skHash = read(pr).toString('utf8').split('\n').find((l) => l.startsWith('skeleton: ')).slice('skeleton: '.length);
  const paste = put('p3.txt', JSON.stringify({ skeletonSha256: skHash, batch: '1/1', mappings: nProposal().mappings.slice(0, 2) }));
  const rep = put('r3.jsonld', sdd('check', sk3, pr, paste).stdout);
  const r = accept(sk3, inv3, DEC([]), [[rep, paste]], '--previous', W('minimal/sdd.jsonld'));
  const v = json(r.stdout), prev = json(read(W('minimal/sdd.jsonld')));
  return all(expect(r.status === 0, r.stderr), expect(eq(v.retired, [prev.mappings[2]]), 'retired'),
    expect(eq(v.mappings, prev.mappings.slice(0, 2)), 'carried'), expect(eq(v.open, []), 'open'));
});

// ---------- end-to-end through the CLI: schema → parse → skeleton → prompt → check → accept ----------
const e2e = (decisions) => {
  const inv = tmp('inventory.jsonld'), sk = tmp('skeleton.jsonld'), rep = tmp('check-report.jsonld'), out = tmp('sdd.jsonld');
  const s1 = sdd('parse', F('minimal-organization.json'), '--out', inv);
  const s2 = sdd('skeleton', inv, '--out', sk);
  const { r: s3, d } = promptDir(sk, inv);
  const s4 = sdd('check', sk, path.join(d, 'prompt-1-of-1.txt'), MPASTE, '--out', rep);
  const s6 = accept(sk, inv, DEC(decisions), [[rep, MPASTE]], '--out', out);
  return { codes: [s1, s2, s3, s4].map((x) => x.status), s6, out };
};
witness('E2E schema→…→accept ×3 = minimal/sdd.jsonld', () => {
  const { codes: c, s6, out } = e2e(ACC3);
  return all(expect(c.every((x) => x === 0), `exit codes ${c}`), sddMatches(s6, read(out), 'minimal/sdd.jsonld'));
});
witness('E2E schema→…→accept, accept, reject = minimal/sdd-partial.jsonld', () => {
  const { codes: c, s6, out } = e2e(PART3);
  return all(expect(c.every((x) => x === 0), `exit codes ${c}`), sddMatches(s6, read(out), 'minimal/sdd-partial.jsonld'));
});

fs.rmSync(TMP, { recursive: true, force: true });
let fails = 0;
for (const { id, ok, why } of results) {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${ok ? '' : '  -- ' + why}`);
}
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exitCode = fails ? 1 : 0;
