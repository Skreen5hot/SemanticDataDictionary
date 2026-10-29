// v0.5: derive the version-2 schemas from the version-1 copies. Run from the repository root.
const fs = require('fs');
function edit(P, pairs, regexes = []) {
  let t = fs.readFileSync(P, 'utf8');
  for (const [a, b] of pairs) {
    const n = t.split(a).length - 1;
    if (n !== 1) throw new Error(`${P}: ${n} matches for ${a.slice(0, 90)}`);
    t = t.replace(a, b);
  }
  for (const [re, b, want] of regexes) {
    const n = (t.match(re) || []).length;
    if (n !== want) throw new Error(`${P}: ${n} (want ${want}) matches for ${re}`);
    t = t.replace(re, b);
  }
  if (/valueProperty/.test(t) && !P.includes('check-report') && !P.includes('proposal')) throw new Error(`${P}: valueProperty remains`);
  fs.writeFileSync(P, t);
  JSON.parse(t);
}
const VP_CONST = /, "valueProperty": \{ "const": "cco:ont[0-9]{8}" \}/g;
const VP_ENUM = /\n *"valueProperty": \{ "enum": \[[^\]]*\] \},/g;

edit('schemas/sdd-v2.schema.json', [
  ['sdd-v1.schema.json', 'sdd-v2.schema.json'],
  ['"title": "SDD SemanticDataDictionary, version 1"', '"title": "SDD SemanticDataDictionary, version 2"'],
  ['(SDD R-S1, R-S2, R-S5, R-S7, R-S9, R-S14, R-S15, R-S17, R-S18; OS-1)', '(SDD R-S1, R-S2, R-S5, R-S7, R-S9, R-S14, R-S15, R-S17, R-S18, R-S24; OS-1)'],
  ['attribute datatype and valueProperty follow the R-S9 table;', 'an attribute mapping carries the R-S9 datatype and no value property, and its iceClass is a CURIE or null (null: no specific classification asserted, R-S5);'],
  ['shapes/sdd-v1.shacl.ttl', 'shapes/sdd-v2.shacl.ttl'],
  ['"sddVersion": { "const": 1 }', '"sddVersion": { "const": 2 }'],
  ['"iceClass", "datatype", "valueProperty", "nullEquivalents"', '"iceClass", "datatype", "nullEquivalents"'],
  ['"iceClass": { "$ref": "#/$defs/curie" },', '"iceClass": { "type": ["string", "null"], "pattern": "^(bfo:BFO_[0-9]{7}|cco:ont[0-9]{8})$" },'],
  ['"description": "R-S9: datatype and valueProperty are fixed by the source Jira type."', '"description": "R-S9: the datatype is fixed by the source Jira type."'],
], [[VP_CONST, '', 7], [VP_ENUM, '', 1]]);

edit('schemas/skeleton-v2.schema.json', [
  ['skeleton-v1.schema.json', 'skeleton-v2.schema.json'],
  ['"required": ["key", "kind", "jiraType", "datatype", "valueProperty", "iceClass"]', '"required": ["key", "kind", "jiraType", "datatype", "iceClass"]'],
  ['"description": "R-S9: datatype and valueProperty are fixed by the Jira type."', '"description": "R-S9: the datatype is fixed by the Jira type."'],
], [[VP_CONST, '', 7], [VP_ENUM, '', 1], [/version 1/g, 'version 2', 1]]);

edit('schemas/proposal-v2.schema.json', [
  ['proposal-v1.schema.json', 'proposal-v2.schema.json'],
  ['"title": "SDD proposal (LLM reply), version 1"', '"title": "SDD proposal (LLM reply), version 2"'],
  ['"iceClass": { "type": "string" },', '"iceClass": { "type": ["string", "null"] },'],
  [',\n          "valueProperty": true', ''],
  ['so that R-S10 reports them as E-CHK-HUMAN-FIELD rather than as a shape error.', 'so that R-S10 reports them as E-CHK-HUMAN-FIELD rather than as a shape error. Version 2 (SDD v0.5): iceClass may be null (R-S5); valueProperty is no longer a field of any artifact and fails this schema (additionalProperties, R-S10).'],
]);

edit('schemas/check-report-v2.schema.json', [
  ['check-report-v1.schema.json', 'check-report-v2.schema.json'],
  ['"field": { "enum": ["nullEquivalents", "acceptance", "decision", "datatype", "valueProperty"] },', '"field": { "enum": ["nullEquivalents", "acceptance", "decision", "datatype"] },'],
  ['"^(nullEquivalents|acceptance|decision|datatype|valueProperty) can only be set by a person at acceptance\\\\.$"', '"^(nullEquivalents|acceptance|decision|datatype) can only be set by a person at acceptance\\\\.$"'],
], [[/version 1/g, 'version 2', 1]]);
if (/valueProperty/.test(fs.readFileSync('schemas/check-report-v2.schema.json', 'utf8'))) throw new Error('check-report: valueProperty remains');
console.log('schemas v2 ok');
