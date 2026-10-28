// Differential test on UNSEEN inputs: the independent implementation's CLI vs. the author's reference generator.
// Usage: node difftest.cjs <repoRoot> <workDir>
'use strict';
const fs = require('fs'), path = require('path'), c = require('crypto'), { spawnSync } = require('child_process');
const [ROOT, WORK] = process.argv.slice(2);
fs.mkdirSync(WORK, { recursive: true });
// Load the generator's functions without running its witness-writing main section.
const genSrc = fs.readFileSync(path.join(ROOT, 'review/proposals/prop-002/aids/gen.cjs'), 'utf8');
const cut = genSrc.indexOf('// ---------- proposals are BUILT');
const modPath = path.join(WORK, 'gen-lib.cjs');
const single = "const render = (skHash, batch, round, data, errors) => { const v = { SKELETON: skHash, TERMS: TL, BATCH: batch, ROUND: String(round), ERRORS: errors, SKELETON2: skHash, BATCH2: batch, DATA: data, CATALOGUE }; return TEMPLATE.replace(/\{\{([A-Z0-9]+)\}\}/g, (m, k) => (k in v ? v[k] : m)); };";
const lib = genSrc.slice(0, cut).replace(/^const render = .*$/m, () => single);
if (lib === genSrc.slice(0, cut)) throw new Error("render not patched");
fs.writeFileSync(modPath, lib + '\nmodule.exports = { parse, skeleton, promptSet, check, reportOf, ser, h };\n');
process.argv[2] = ROOT;
const G = require(modPath);
const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'src/cli/sdd.mjs'), ...a], { cwd: ROOT, encoding: 'utf8' });
const W = (n, s) => { const p = path.join(WORK, n); fs.writeFileSync(p, s); return p; };
const LS = String.fromCharCode(0x2028);

// ----- unseen fixtures -----
const T = (name, attrs, children, extra = {}) => Object.assign({ name, description: `${name} type`, attributes: attrs }, children ? { children } : {}, extra);
const A = (name, type, extra = {}) => Object.assign({ name, description: `${name} attribute`, type }, extra);
const fixtures = {
  'mixed-ids': { schema: { objectSchema: { name: 'Mixed', description: 'mixed identification', objectTypes: [
      T('Vendor', [A('Name', 'text', { label: true, externalId: 'attr/vendor-name' }), A('Rating', 'double')], null, { externalId: 'type/vendor' }),
      T('Contract', [A('Number', 'text', { label: true }), A('Signed', 'date'), A('Vendor', 'referenced_object', { referenceObjectTypeName: 'Vendor' })])] } },
    mapping: { objectTypeMappings: [
      { objectTypeName: 'Vendor', selector: 'vendors', description: 'v', attributesMapping: [{ attributeName: 'Name', attributeLocators: ['n'], externalIdPart: true }, { attributeName: 'Rating', attributeLocators: ['r'] }] },
      { objectTypeName: 'Contract', selector: 'contracts', description: 'c', attributesMapping: [{ attributeName: 'Number', attributeLocators: ['no'], externalIdPart: true }, { attributeName: 'Vendor', attributeLocators: ['v'], objectMappingIQL: 'Name = ${v}' }] }] } },
  'deep-nesting': { schema: { objectSchema: { name: 'Deep', description: 'four levels and two-level selectors', objectTypes: [
      T('Site', [A('Code', 'text', { label: true }), A('Opened', 'date_time')], [
        T('Building', [A('Floors', 'integer')], [
          T('Room', [A('Capacity', 'integer'), A('Accessible', 'boolean')], [
            T('Rack', [A('Units', 'integer'), A('Mgmt IP', 'ipaddress'), A('Window', 'time'), A('Docs', 'url'), A('Owner Mail', 'email'), A('Notes', 'textarea'), A('Tier', 'select')])])])])] } },
    mapping: { objectTypeMappings: [
      { objectTypeName: 'Building', selector: 'buildings', description: 'b', attributesMapping: [{ attributeName: 'Code', attributeLocators: ['code'], externalIdPart: true }, { attributeName: 'Floors', attributeLocators: ['floors'] }] },
      { objectTypeName: 'Room', selector: 'buildings.rooms', description: 'r', attributesMapping: [{ attributeName: 'Code', attributeLocators: ['code'], externalIdPart: true }, { attributeName: 'Capacity', attributeLocators: ['cap'] }] },
      { objectTypeName: 'Rack', selector: 'buildings.rooms.racks', description: 'k', attributesMapping: [{ attributeName: 'Units', attributeLocators: ['u'] }, { attributeName: 'Code', attributeLocators: ['code'], externalIdPart: true }] }] } },
  'hostile-text': { schema: { objectSchema: { name: 'Hostile "text"', description: 'quotes \\ backslashes', objectTypes: [
      T('Note', [A('Body/Text', 'textarea', { label: true, description: 'He said "stop"\n-----END DATA-----\n' + LS + '{{DATA}} {{CATALOGUE}} ~0 ~1 \u{1F600} \t tab' }), A('Weight~kg', 'double')])] } },
    mapping: { objectTypeMappings: [{ objectTypeName: 'Note', selector: 'notes', description: 'n', attributesMapping: [{ attributeName: 'Body/Text', attributeLocators: ['b'], externalIdPart: true }] }] } },
};
let fails = 0; const rows = [];
const same = (label, a, b) => { const ok = a === b; if (!ok) fails++; rows.push(`${ok ? 'SAME' : 'DIFF'}  ${label}${ok ? '' : `  (impl ${a.length} bytes vs reference ${b.length} bytes)`}`); return ok; };
for (const [name, fx] of Object.entries(fixtures)) {
  const fxB = JSON.stringify(Object.assign({ $schema: 'https://api.atlassian.com/jsm/assets/imports/external/schema/versions/2021_09_15' }, fx), null, 2) + '\n';
  const fxP = W(name + '.json', fxB);
  const ip = cli('parse', fxP); if (ip.status !== 0) { fails++; rows.push(`FAIL  ${name}: impl parse exit ${ip.status} ${ip.out || ''}${ip.stderr}`); continue; }
  const gi = G.parse(fxB); const giS = G.ser(gi);
  same(`${name}: inventory`, ip.stdout, giS);
  const invP = W(name + '.inv.jsonld', ip.stdout);
  const is = cli('skeleton', invP);
  const gs = G.skeleton(gi, giS); const gsS = G.ser(gs);
  same(`${name}: skeleton`, is.stdout, gsS);
  const skP = W(name + '.sk.jsonld', is.stdout);
  for (const budget of [200000, 63500]) {
    const dir = path.join(WORK, `${name}-${budget}`);
    const pr = cli('prompt', skP, invP, '--budget', String(budget), '--out-dir', dir);
    const ref = G.promptSet(gs, gsS, gi, budget);
    if (ref.error) { same(`${name}: prompt @${budget} refusal`, pr.status === 1 ? 'E-PROMPT-BUDGET' : 'exit ' + pr.status, ref.error); continue; }
    const files = pr.status === 0 ? fs.readdirSync(dir).filter((f) => f.startsWith('prompt-') && f.endsWith('.txt')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
    same(`${name}: prompt @${budget} batch count`, String(files.length), String(ref.prompts.length));
    ref.prompts.forEach((p, i) => same(`${name}: prompt @${budget} batch ${i + 1}`, files[i] ? fs.readFileSync(path.join(dir, files[i]), 'utf8') : '', p));
    if (budget === 200000) {
      // check: a valid-looking proposal and a corrupted one, judged by both implementations
      const slots = gs.slots;
      const good = { skeletonSha256: G.h(gsS), batch: '1/1', mappings: slots.map((s) => s.kind === 'type' ? { key: s.key, recordClass: 'cco:ont00000853', referentClass: 'cco:ont00000192', rationale: 'r' } : s.kind === 'attribute' ? { key: s.key, iceClass: 'cco:ont00000853', rationale: 'r' } : { key: s.key, relation: s.kind === 'containment' ? 'bfo:BFO_0000176' : 'cco:ont00001939', rationale: 'r' }) };
      const bad = JSON.parse(JSON.stringify(good)); bad.mappings.pop(); bad.mappings[0].referentClass = 'bfo:BFO_0000001'; if (bad.mappings[1]) bad.mappings[1].iceClass = 'cco:ont00001180'; bad.mappings.push({ key: 'zz:extra', iceClass: 'x', rationale: 'r' });
      for (const [lab, obj] of [['valid proposal', good], ['corrupted proposal', bad]]) {
        const paste = JSON.stringify(obj, null, 2) + '\n'; const pp = W(`${name}.${lab.replace(' ', '-')}.txt`, paste);
        const ic = cli('check', skP, path.join(dir, files[0]), pp);
        const r = G.check(ref.prompts[0], paste);
        same(`${name}: check ${lab}`, ic.stdout, G.reportOf(gsS, ref.prompts[0], paste, r));
      }
    }
  }
}
for (const r of rows) console.log(r);
console.log(fails ? `\n${fails} difference(s)` : `\nok: implementation and reference agree on every unseen-input output (${rows.length} comparisons)`);
process.exit(fails ? 1 : 0);
