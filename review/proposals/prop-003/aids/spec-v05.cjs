// v0.5 (registrar-approved simplified attribute contract): SDD service spec edits. Run from the repository root.
const fs = require('fs');
function edit(P, pairs) {
  let t = fs.readFileSync(P, 'utf8');
  for (const [a, b] of pairs) {
    const n = t.split(a).length - 1;
    if (n !== 1) throw new Error(`${P}: ${n} matches for ${a.slice(0, 80)}`);
    t = t.replace(a, b);
  }
  fs.writeFileSync(P, t);
}

edit('spec/sdd-service.md', [
  // status
  ['| **Status** | v0.4.1 (targeted correction pass',
   '| **Status** | v0.5 (2026-10-29, registrar-approved contract change after the external ontological review: attribute mappings no longer carry `valueProperty`; `iceClass` is a permitted ICE class or `null`; `sddVersion` 2; release candidate v1.0.0-rc.2. Version-1 artifacts, release candidate v1.0.0-rc.1, are historical; review/register.md). v0.4.1 (targeted correction pass'],
  // C-S2 witness
  ["every attribute slot's (`datatype`, `valueProperty`) equals its Jira type's R-S9 row. No slot exists for any `children` edge.",
   "every attribute slot's `datatype` equals its Jira type's R-S9 row, and no slot carries `valueProperty`. No slot exists for any `children` edge."],
  // C-S4 witnesses
  ['- **W-CS4-Δ14 (one factor: shape):**',
   '- **W-CS4-Δ19 (one factor: no specific classification):** (skeleton, `minimal/prompt.txt`, `minimal/proposal-null.txt`: the N proposal with Cost Center\'s `iceClass` = `null`) → exit 0, → `minimal/check-report-null.jsonld`: `validated`, `errors: []`, `warnings: []`. A `null` `iceClass` runs no term, kind or category check and raises no warning (R-S5, R-S7).\n' +
   '- **W-CS4-Δ20 (one factor: retired field):** the N proposal plus `"valueProperty": "cco:ont00001765"` on Name → exactly one error, E-CHK-SHAPE (`value` `/mappings/1`, keyword `additionalProperties`); no other check runs (R-S10, R-S13).\n' +
   '- **W-CS4-Δ14 (one factor: shape):**'],
  // C-S6 witnesses
  ['- Determinism note: `acceptance.at` is masked, with the property: ISO-8601 UTC',
   '- **W-CS6-Δ11 (one factor: accepted without a specific classification):** W-CS4-Δ19\'s report and paste + S-O3\'s decisions → exit 0, → `minimal/sdd-null.jsonld`: Cost Center\'s mapping has `"iceClass": null`, `"datatype": "xsd:string"` and its own `acceptance` record, and `open` is `[]`. Contrast W-CS6-Δ2, where the same key is rejected and appears only in `open` (R-S5, R-S18).\n' +
   '- **W-CS6-Δ12 (one factor: version-1 previous SDD, R-S24):** W-JS3 step 6\'s inputs, with `--previous` = `minimal/sdd.jsonld` whose `sddVersion` is replaced by `1` → exit 2, `{"code": "E-USAGE"}`, nothing written. No mapping is carried or migrated.\n' +
   '- Determinism note: `acceptance.at` is masked, with the property: ISO-8601 UTC'],
  // C-S7 witness
  ['No silent carry across term lists.\n- Determinism note: fully deterministic.',
   'No silent carry across term lists.\n' +
   '- **W-CS7-Δ4 (one factor: version-1 previous SDD, R-S24):** `minimal-organization-v2.json` + `minimal/sdd.jsonld` with its `sddVersion` replaced by `1` → exit 2, `{"code": "E-USAGE"}`, nothing written.\n' +
   '- Determinism note: fully deterministic.'],
  // R-S5
  ['- **R-S5: Categories.** `recordClass` and `iceClass` MUST be `cco:ont00000958` (Information Content Entity) or ICE-descended (named ancestry, ADR-008), else E-CHK-CATEGORY.',
   '- **R-S5: Categories.** `recordClass` and `iceClass` MUST be `cco:ont00000958` (Information Content Entity) or ICE-descended (named ancestry, ADR-008), else E-CHK-CATEGORY. **`iceClass` MAY instead be JSON `null`** (v0.5): the mapping asserts no specific ICE classification. It does not deny that the value is information content or that it has a bearer, and it is not an absence of the mapping: an accepted mapping with a `null` `iceClass` is decided, while an undecided key is listed in `open`. A `null` `iceClass` is exempt from R-S7, from this rule\'s category check and from both warnings below. `recordClass`, `referentClass` and `relation` are never `null`.'],
  ['W-CS4-Δ10, W-CS4-Δ11, W-CS4-Δ17.\n- **R-S6: Coverage.**',
   'W-CS4-Δ10, W-CS4-Δ11, W-CS4-Δ17, W-CS4-Δ19, W-CS6-Δ11.\n- **R-S6: Coverage.**'],
  // R-S7
  ['object property for `relation`, or `sdd:NoRelation` in containment slots only (E-CHK-KIND). Witnesses: W-CS4-Δ3, W-CS4-Δ4; V-S6.',
   'object property for `relation`, or `sdd:NoRelation` in containment slots only (E-CHK-KIND). A `null` `iceClass` names no CURIE and is exempt (R-S5). Witnesses: W-CS4-Δ3, W-CS4-Δ4, W-CS4-Δ19; V-S6.'],
  // R-S9
  ['- **R-S9: Value table.** Datatype and value property are fixed by Jira type for the 12 non-reference types; the LLM never chooses them. `referenced_object` attributes become `reference` slots instead (R-S7).\n\n' +
   '  | Jira type | `datatype` | `valueProperty` |\n' +
   '  |---|---|---|\n' +
   '  | text, textarea, email, select, ipaddress | `xsd:string` | `cco:ont00001765` has text value |\n' +
   '  | url | `xsd:anyURI` | `cco:ont00001768` has URI value |\n' +
   '  | integer | `xsd:integer` | `cco:ont00001773` has integer value |\n' +
   '  | double | `xsd:double` | `cco:ont00001770` has double value |\n' +
   '  | boolean | `xsd:boolean` | `cco:ont00001772` has boolean value |\n' +
   '  | date | `xsd:date` | `cco:ont00001771` has date value |\n' +
   '  | date_time | `xsd:dateTime` | `cco:ont00001767` has datetime value |\n' +
   '  | time | `xsd:string` (lexical form of `xsd:time`) | `cco:ont00001765` has text value (the pin has no time-of-day value property; registrar Decision B keeps this fallback) |\n',
   '- **R-S9: Value table.** The datatype (a W3C XML Schema datatype describing how the value is represented) is fixed by Jira type for the 12 non-reference types; the LLM never chooses it. `referenced_object` attributes become `reference` slots instead (R-S7). **No artifact names a value property** (v0.5): how a value would be projected to RDF is outside v1 (NG-S1, NG-S6), and no universal property such as `rdf:value` stands in for one.\n\n' +
   '  | Jira type | `datatype` |\n' +
   '  |---|---|\n' +
   '  | text, textarea, email, select, ipaddress | `xsd:string` |\n' +
   '  | url | `xsd:anyURI` |\n' +
   '  | integer | `xsd:integer` |\n' +
   '  | double | `xsd:double` |\n' +
   '  | boolean | `xsd:boolean` |\n' +
   '  | date | `xsd:date` |\n' +
   '  | date_time | `xsd:dateTime` |\n' +
   '  | time | `xsd:string` (lexical form of `xsd:time`; registrar Decision B keeps this fallback) |\n'],
  // R-S10
  ['- **R-S10: Human-only fields.** A proposal MUST NOT contain `nullEquivalents`, `acceptance`, `decision`, `datatype` or `valueProperty` (E-CHK-HUMAN-FIELD). Witness: W-CS4-Δ6.',
   '- **R-S10: Human-only fields.** A proposal MUST NOT contain `nullEquivalents`, `acceptance`, `decision` or `datatype` (E-CHK-HUMAN-FIELD). `valueProperty` is no longer a field of any artifact (R-S9); a proposal carrying it fails the proposal schema (E-CHK-SHAPE, R-S13). Witnesses: W-CS4-Δ6, W-CS4-Δ20.'],
  // R-S11
  ['- **R-S11: Prompt construction.** A prompt MUST be `spec/prompt-template-v2.txt` with its placeholders filled',
   '- **R-S11: Prompt construction.** A prompt MUST be `spec/prompt-template-v3.txt` with its placeholders filled'],
  // R-S13
  ['against the pinned, versioned proposal schema `schemas/proposal-v1.schema.json` (§11 registry)',
   'against the pinned, versioned proposal schema `schemas/proposal-v2.schema.json` (§11 registry)'],
  ['Witnesses: W-CS4-N, W-CS4-Δ7, W-CS4-Δ9, W-CS4-Δ12, W-CS4-Δ14.',
   'Witnesses: W-CS4-N, W-CS4-Δ7, W-CS4-Δ9, W-CS4-Δ12, W-CS4-Δ14, W-CS4-Δ20.'],
  // R-S20
  ['then it checks the fields in the order `recordClass`, `referentClass`, `iceClass`, `relation`. Each field runs',
   'then it checks the fields in the order `recordClass`, `referentClass`, `iceClass`, `relation`, skipping a `null` `iceClass` (R-S5). Each field runs'],
  // R-S24 after R-S23
  ['Witnesses: W-CS6-Δ5, W-CS1-Δ12, W-CS4-Δ18; V-S5.\n',
   'Witnesses: W-CS6-Δ5, W-CS1-Δ12, W-CS4-Δ18; V-S5.\n' +
   '- **R-S24: Contract version (v0.5).** Every SDD MUST carry `"sddVersion": 2`: attribute mappings carry `datatype` and no `valueProperty`, and `iceClass` is a permitted ICE class or `null` (R-S5, R-S9). C-S6 (`--previous`) and C-S7 MUST refuse a previous SDD whose `sddVersion` is not `2`, with E-USAGE and the detail `the previous SDD has sddVersion {v}; this release reads only sddVersion 2` (`{v}` = the JSON of the value, `undefined` if absent), writing nothing; the operator page shows the same refusal (SDD-operator RV-O4). Version-1 SDDs (release candidate v1.0.0-rc.1) are historical records: they are not migrated or carried (NG-S11). Within version 2, R-S17\'s byte-identical carry is unchanged. Witnesses: W-CS6-Δ12, W-CS7-Δ4.\n'],
  // V-S6
  ['every `recordClass` and `iceClass` is ICE-descended;',
   'every `recordClass` and every non-null `iceClass` is ICE-descended, every attribute mapping has an `iceClass` member and none has `valueProperty` (R-S5, R-S9);'],
  // NG
  ['- **NG-S6, no specialised value properties.**',
   '- **NG-S6, no value properties.** Since v0.5 no artifact names a value property (R-S9); value representation is the `datatype` alone.'],
  ['- **NG-S10, no cardinality.**',
   '- **NG-S10, no cardinality.**\n- **NG-S11, no migration of version-1 SDDs (R-S24).** Release candidate v1.0.0-rc.1\'s artifacts are historical; no capability reads, converts or carries them.'],
  // OS-1 note
  ['- **OS-1:** *closed (2026-10-28, milestone 4).*',
   '- **OS-1:** *closed (2026-10-28, milestone 4); amended v0.5:* the SDD, Skeleton, CheckReport and proposal schemas and the SDD shapes are version 2 (`schemas/sdd-v2.schema.json`, `schemas/skeleton-v2.schema.json`, `schemas/check-report-v2.schema.json`, `schemas/proposal-v2.schema.json`, `shapes/sdd-v2.shacl.ttl`); the version-1 files are retained as historical. The context `context/sdd-v1.jsonld` and the term list are unchanged. *As closed:*'],
]);
console.log('sdd-service.md ok');
