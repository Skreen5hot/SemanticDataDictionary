# SDD Service: substrate specification

| | |
|---|---|
| **Conformance** | Authored under *The Falsifiable Spec, Method Specification v0.4* (Specification-Refinement-System). Document pair: this file (`SDD`, substrate, method §4 form) and [`sdd-operator.md`](sdd-operator.md) (`SDD-operator`, experience companion, method §4A form), federated by weave record **WV-1** (housed in SDD-operator §15). |
| **Status** | v0.2, proposed by prop-001 (2026-10-27); supersedes v0.1 @ `b4aab5b`, graded joint D-1 in cycle 2. Nothing built; no witness executed. |
| **Governing decisions** | [`../project/DECISIONS.md`](../project/DECISIONS.md) ADR-001 to ADR-008. SDD v2.0 ([`../SDD-V2.0-SPEC.md`](../SDD-V2.0-SPEC.md)) is rationale only. Findings and dispositions are in `../review/register.md`. |
| **Registrar / authority** | Aaron Damiano (author of record). |
| **Normative language** | BCP 14 keywords (MUST, MUST NOT, SHOULD, MAY …) per RFC 2119 / RFC 8174, uppercase only. |
| **Hash citation convention** | Prose cites a governed file's sha256 by its **first 8 hex characters only**. The full value appears once, in the §11 registry, which is authoritative. |
| **Stable identifiers** | Journeys J-S\*; capabilities C-S\*; witnesses W-\*; rules R-S\*; seams S-S\* and cross-document S-O\*; invariants V-S\*; envelopes E-S\*; harness H-S1; absences NG-S\*; codes E-\* (errors), W-\* (warnings), FL-\* (flags); open items OS-\*. Minted, never renumbered. |

**What this system is, in one paragraph.** A person holding a Jira Assets import schema wants a **Semantic Data
Dictionary**: a JSON-LD file saying, for every object type, attribute and reference, which BFO/CCO classes and
relations its records and referents will be typed with. The service parses the schema into an inventory (C-S1),
lays out an empty skeleton of every decision to be made (C-S2), and writes prompts (C-S3) the person carries to
their enterprise LLM by hand. The LLM's pasted reply is checked deterministically against the prompt it answers
(C-S4); failures produce a repair prompt for the same batch (C-S5). Validated proposals are accepted or rejected
item by item by a named person (C-S6), and a changed schema re-enters at C-S7 so that only changed items go back to
the LLM. **Validated is not accepted:** the checks establish structure, coverage, term existence and BFO category,
and only the person establishes meaning (ADR-004). The service makes no network calls and creates no RDF
individuals (ADR-007).

---

## SDD §1: Purpose & user

For the data engineer or ontologist who owns a Jira Assets schema inside an enterprise, may not export it, and must
hand an ontology mapping to others. The need, in their words: *"Show me every decision the schema forces, let my
enterprise LLM draft them, catch every draft that is malformed, incomplete, invented or category-wrong before I see
it, and record exactly which ones I approved, so that anyone can trace each mapping back to the schema element it
came from."*

## SDD §2: Journeys

Fixtures: [`fixtures/jira-assets/minimal-organization.json`](../fixtures/jira-assets/minimal-organization.json)
(`3239b1f0`) and its successor `minimal-organization-v2.json` (`e86ef883`). Literal artifacts:
[`fixtures/witnesses/minimal/`](../fixtures/witnesses/minimal/). Carried state in **bold**. Harness **H-S1**: a
shell runner executing the CLI chain in a clean container with networking disabled and the network guard of
SDD-operator H-O2 preloaded. Owner: this document's acceptance runner. Relay steps (the person and the LLM) are
supplied by fixture files under H-S1 and exercised for real by SDD-operator W-JO1–W-JO4 under H-O1.

**J-S1: first dictionary.** Chain example **W-JS1**: (1) C-S1 on the fixture → `inventory.jsonld` **`902ab965`**
(W-CS1-N). (2) C-S2 → `skeleton.jsonld` **`a250c034`** (W-CS2-N). (3) C-S3 with the inventory → one batch,
`prompt.txt` **`14320bfb`**, round **1** (W-CS3-N). (4) *Relay:* the paste is `proposal-pasted.txt` **`6eb7f5af`**.
(5) C-S4 on (skeleton, prompt, paste) → `check-report.jsonld` **`d6882951`**, `status: validated` (W-CS4-N).
(6) C-S6 with decisions *accept ×3* by "Aaron Damiano" → `sdd.jsonld` **`14cb509d`** (`acceptance.at` masked)
(W-CS6-N). **Whole-journey outcome:** an SDD whose 3 mappings each carry their source element, its item hash, and
the prompt, proposal and report hashes of steps 3–5.

**J-S2: repair.** Chain example **W-JS2**: steps (1)–(3) of W-JS1. (4) The paste is `bad-proposal.txt` **`68704680`**.
(5) C-S4 → `bad-check-report.jsonld` **`4c6d7245`**: `rejected`, round 1, exactly E-CHK-CATEGORY
(`at:Organization/Name`) then E-CHK-MISSING (`at:Organization/Cost Center`) (W-CS4-Δ1). (6) C-S5 on that report and
its prompt → `repair-prompt.txt` **`d439c251`**, round **2**, the same 3 DATA lines plus an ERRORS block holding
those 2 errors (W-CS5-N). (7) The relay returns the complete corrected set, `proposal-pasted.txt`. (8) C-S4 on
(skeleton, repair prompt, paste) → `check-report-round2.jsonld` **`89e955ce`**, validated, round 2. (9) C-S6 →
`sdd-round2.jsonld` **`ef49006a`**. Outcome: identical to W-JS1's SDD except, in every mapping's `provenance`,
`round` (2), `promptSha256` and `checkReportSha256`. `proposalSha256` is the same (the same paste). The round-1
failure leaves no trace in the mappings.

**J-S3: schema changed.** Chain example **W-JS3**: (1) inputs: **`sdd.jsonld`** (W-JS1) and
`minimal-organization-v2.json`, where Cost Center's description reads "Finance code". (2) C-S7 →
`inventory-v2.jsonld` **`0ea0045b`** and `rerun-plan.jsonld` **`aa4dc216`**: unchanged
`["at:Organization/Name", "ot:Organization"]`, changed `["at:Organization/Cost Center"]`, added `[]`, removed `[]`
(W-CS7-N). (3) C-S2 on `inventory-v2.jsonld` → skeleton₂. (4) C-S3 with skeleton₂, inventory₂ and
`--keys` = the plan's changed ∪ added → one batch whose DATA block holds exactly 1 line. (5) Relay; C-S4 →
validated. (6) C-S6 with the previous SDD → 3 mappings: 2 carried from **`sdd.jsonld`** byte-identical (acceptance
records included), 1 newly accepted. Outcome: unchanged decisions are never re-sent or silently re-accepted.

**J-S4: partial acceptance.** Chain example **W-JS4**: W-JS1 through step 5, then C-S6 with decisions *accept,
accept, reject* (the reject on `at:Organization/Cost Center`) → SDD₁ with 2 mappings and
`open: ["at:Organization/Cost Center"]` (W-CS6-Δ2). Then C-S3 `--keys` = SDD₁'s `open` → a 1-line prompt; relay;
C-S4; C-S6 with SDD₁ as the previous SDD → `open: []`, and the 2 earlier mappings byte-identical to SDD₁'s.

Coverage map (bidirectional): J-S1 → {C-S1, C-S2, C-S3, C-S4, C-S6} · J-S2 → {C-S1–C-S6} · J-S3 → {C-S7, C-S2,
C-S3, C-S4, C-S6} · J-S4 → {C-S6, C-S3, C-S4}. Every capability serves ≥ 1 journey. Every step is homed; the relay
steps are cross-document (SDD-operator J-O1–J-O4 via S-O1–S-O3, WV-1).

## SDD §3: Capabilities

**Surface.** The core library (pure functions over bytes and values, no I/O) and a CLI over it:

| Command | Inputs | Output |
|---|---|---|
| `sdd parse <schema>` | schema bytes | Inventory |
| `sdd skeleton <inventory>` | Inventory | Skeleton |
| `sdd prompt <skeleton> <inventory> [--keys <file>] [--budget <bytes>] --out-dir <dir>` | Skeleton, Inventory, optional key list | prompt files `prompt-<i>-of-<n>.txt` + PromptSet on stdout |
| `sdd check <skeleton> <prompt> <paste>` | Skeleton, the prompt the reply answers, pasted bytes | CheckReport |
| `sdd repair <skeleton> <inventory> <report> <prompt>` | Skeleton, Inventory, rejected CheckReport, the prompt it checked | repair prompt |
| `sdd accept <skeleton> <inventory> <decisions> --checked <report> <paste> [--checked …] [--previous <sdd>]` | as listed; ≥ 1 validated (report, paste) pair | SemanticDataDictionary |
| `sdd rerun <schema> <previous-sdd>` | schema bytes, SDD | RerunPlan + Inventory |

**Exit-code contract (R-S23):** **0** success; **1** the output is a domain report of errors (still written);
**2** usage or I/O failure (`E-IO`, `E-USAGE`, `E-OUT-EXISTS`), with nothing written. Every artifact is canonical
bytes (R-S1). "→ `file`" means the output MUST equal that witness file byte for byte.

**C-S1: parse.** Jira Assets import schema (bytes) → Inventory.
- **W-CS1-N:** `minimal-organization.json` → exit 0, → `minimal/inventory.jsonld`.
- **W-CS1-Δ1 (one factor: missing type):** `invalid/missing-attribute-type.json` → exit 1; `objectTypes: []`, `attributes: []`, `errors` = exactly `[{"code": "E-SRC-SHAPE", "pointer": "/schema/objectSchema/objectTypes/0/attributes/1", "keyword": "required", "detail": "type"}]`.
- **W-CS1-Δ2 (one factor: dangling reference):** `invalid/unknown-reference-target.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-REF-TARGET", "key": "at:Person/Manager", "value": "Employee"}]`.
- **W-CS1-Δ3 (one factor: unknown mapped attribute):** `invalid/mapping-unknown-attribute.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-MAP-ATTR", "key": "ot:Organization", "value": "Budget"}]`.
- **W-CS1-Δ4 (one factor: duplicate type):** `invalid/duplicate-object-type-name.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-DUP-TYPE", "key": "ot:Person"}]`.
- **W-CS1-Δ5 (one factor: externalId identification):** `synthetic-it-assets-externalids.json` → exit 0; `source.identification` = `"externalId"`; Organization's key = `ot:object-type~1organization`; its Cost Center's key = `at:object-type-attribute~1organization~1cost-center`.
- **W-CS1-Δ6 (one factor: the full fixture's ambiguities):** `synthetic-it-assets.json` → exit 0; `flags` = exactly these 9, in R-S19 order: `FL-CONTAINMENT ot:Blade Server` (container `ot:Server`) · `FL-CONTAINMENT ot:Hard Drive` (container `ot:Server`) · `FL-INHERITED-USE ot:Blade Server` (`Asset Tag`) · `FL-INHERITED-USE ot:Hard Drive` (`Serial Number`) · `FL-INHERITED-USE ot:Laptop` (`Asset Tag, Owner, Purchase Cost, Purchase Date, Serial Number, Status`) · `FL-INHERITED-USE ot:Server` (`Asset Tag, Location`) · `FL-NO-LABEL ot:Scan Event` · `FL-SELECT-VALUES-UNKNOWN at:Hardware/Status` · `FL-UNMAPPED-TYPE ot:Hardware`. The key `at:Server/Ports~1Protocols` is present.
- **W-CS1-Δ7 (one factor: enum):** `invalid/unknown-attribute-type.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-SHAPE", "pointer": "/schema/objectSchema/objectTypes/0/attributes/1/type", "keyword": "enum", "detail": "currency"}]`.
- **W-CS1-Δ8 (one factor: conditional requirement):** `invalid/reference-without-target.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-SHAPE", "pointer": "/schema/objectSchema/objectTypes/1/attributes/6", "keyword": "required", "detail": "referenceObjectTypeName"}]` (the umbrella `if`/`then` error is not reported, R-S3).
- **W-CS1-Δ9 (one factor: unknown mapped type):** `invalid/mapping-unknown-type.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-MAP-TYPE", "key": null, "value": "Printer"}]`.
- **W-CS1-Δ10 (one factor: duplicate attribute):** `invalid/duplicate-attribute-name.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-DUP-ATTR", "key": "at:Organization/Cost Center"}]`.
- **W-CS1-Δ11 (one factor: key collision):** `invalid/key-collision.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-KEY-COLLISION", "key": "ot:object-type~1organization"}]`.
- **W-CS1-Δ12 (one factor: unreadable input):** `sdd parse missing.json` (no such file) → exit 2, `{"code": "E-IO"}` on stderr, nothing written (R-S23).
- Determinism note: fully deterministic. No masks.

**C-S2: skeleton.** Inventory → Skeleton: one slot per decision, meaning fields `null`, value fields pre-filled by R-S9.
- **W-CS2-N:** `minimal/inventory.jsonld` → exit 0, → `minimal/skeleton.jsonld`.
- **W-CS2-Δ1 (one factor: references and containment):** the full fixture's inventory → exit 0; slot counts exactly 10 `type`, 35 `attribute`, 5 `reference`, 2 `containment`; containment slots keyed `ct:ot:Blade Server` and `ct:ot:Hard Drive`; every attribute slot's (`datatype`, `valueProperty`) equals its Jira type's R-S9 row. No slot exists for any `children` edge.
- **W-CS2-Δ2 (one factor: foreign context, negative witness):** an inventory whose `@context` is any IRI other than the bundled context IRI → exit 1, `{"code": "E-CTX-EXTERNAL"}`, no skeleton. **The H-S1 network guard logs no attempt** (R-S16).
- **W-CS2-Δ3 (one factor: errored inventory):** the W-CS1-Δ2 inventory → exit 1, `{"code": "E-SKEL-ERRORED"}`, no skeleton (R-S3).
- Determinism note: fully deterministic.

**C-S3: prompt.** Skeleton + Inventory (+ optional key subset) + term list → one or more prompts and a PromptSet.
- **W-CS3-N:** `minimal/skeleton.jsonld`, `minimal/inventory.jsonld` → exit 0; one batch, → `minimal/prompt.txt` (62,683 bytes); PromptSet = S-S8's crossing example.
- **W-CS3-Δ1 (one factor: hostile source text):** on the full fixture, the Software.Notes description appears **only** as a JSON string value inside the DATA block; `-----END DATA-----` occurs exactly once as a whole line.
- **W-CS3-Δ2 (one factor: budget):** full fixture, `--budget 68000` → exactly 2 batches, → `full/prompt-1-of-2.txt` (67,631 bytes; DATA = the groups of Organization through Server, 36 lines) and `full/prompt-2-of-2.txt` (64,719 bytes; Blade Server through Scan Event, 16 lines). Two batches result for every budget from 66,249 to 70,138 bytes.
- **W-CS3-Δ3 (one factor: subset):** `--keys ["at:Organization/Cost Center"]` → one batch whose DATA block holds exactly that line.
- **W-CS3-Δ4 (one factor: oversize groups):** full fixture, `--budget 63000` → exit 0; 10 batches (one per group); the PromptSet's `warnings` = exactly W-PROMPT-OVERSIZE for the groups of `ot:Person`, `ot:Location`, `ot:Hardware`, `ot:Server`, `ot:Software`, in that (group) order (R-S12).
- **W-CS3-Δ5 (one factor: budget below overhead):** `--budget 50000` → exit 1, `{"code": "E-PROMPT-BUDGET"}`, no prompt written.
- Determinism note: fully deterministic.

**C-S4: check.** Skeleton + the prompt being answered + pasted bytes → CheckReport. The prompt supplies the batch, the round, and the slot set (its DATA keys).
- **W-CS4-N:** (skeleton, `prompt.txt`, `proposal-pasted.txt`) → exit 0, → `minimal/check-report.jsonld`. The prose before the fence is ignored (R-S13).
- **W-CS4-Δ1 (one factor: wrong category, missing slot):** with `bad-proposal.txt` → exit 1, → `minimal/bad-check-report.jsonld`.
- **W-CS4-Δ2 (one factor: duplicate and unknown keys):** the N proposal with its Name mapping duplicated and an extra mapping keyed `at:Organization/Budget` → errors exactly E-CHK-DUPLICATE (`at:Organization/Name`) then E-CHK-UNKNOWN-KEY (`at:Organization/Budget`).
- **W-CS4-Δ3 (one factor: invented term):** the N proposal with Name's `iceClass` = `cco:ont99999999` → exactly one error, E-CHK-TERM. No E-CHK-CATEGORY: R-S20 stops at the first failing check per field.
- **W-CS4-Δ4 (one factor: wrong kind):** Name's `iceClass` = `cco:ont00001808` (*is about*, an object property) → exactly one error, E-CHK-KIND (R-S20).
- **W-CS4-Δ5 (one factor: range):** on the full fixture, a proposal valid except that reference `at:Person/Manager` uses a relation whose declared `rdfs:range` excludes Person's `referentClass` → exactly one error, E-CHK-RANGE (R-S8). *Literal pending OS-2* (a named defect at the gate, not an orphan).
- **W-CS4-Δ6 (one factor: human-only field):** the N proposal plus `"nullEquivalents": ["N/A"]` on Cost Center → exactly one error, E-CHK-HUMAN-FIELD.
- **W-CS4-Δ7 (one factor: answer extraction):** the N JSON object pasted twice, unfenced → exactly one error, E-CHK-JSON; no other check runs.
- **W-CS4-Δ8 (one factor: generic class):** `referentClass` = `bfo:BFO_0000001` → `validated`, `errors: []`, `warnings` = exactly `[{"code": "W-CHK-GENERIC", "key": "ot:Organization", "field": "referentClass", "value": "bfo:BFO_0000001", "rule": "R-S5", "message": "referentClass bfo:BFO_0000001 (entity) is a top-level class; check it is specific enough."}]`.
- **W-CS4-Δ9 (one factor: stale skeleton):** the reply's `skeletonSha256` differs from the prompt's → exactly one error, E-CHK-SKELETON; no other check runs.
- **W-CS4-Δ10 (injection outcome, negative witness):** on the full fixture at the default budget, a proposal mapping every field of every slot to `bfo:BFO_0000001` → `rejected` with exactly **52 errors** (10 E-CHK-CATEGORY on `recordClass`, 35 E-CHK-CATEGORY on `iceClass`, 7 E-CHK-KIND on `relation`) and **10 warnings** (W-CHK-GENERIC on `referentClass`), in R-S20 order. **The outcome does not depend on the LLM resisting the injection.**
- **W-CS4-Δ11 (one factor: information referent):** `referentClass` = `cco:ont00000853` → `validated`, one warning W-CHK-ICE-REFERENT.
- **W-CS4-Δ12 (one factor: wrong batch):** the reply's `batch` = `"2/2"` against a `1/1` prompt → exactly one error, E-CHK-BATCH; no other check runs.
- Determinism note: fully deterministic. The pasted bytes are the input; nothing is assumed about how they were produced.

**C-S5: repair prompt.** Skeleton + Inventory + rejected CheckReport + the prompt it checked → repair prompt for the same batch.
- **W-CS5-N:** on `bad-check-report.jsonld` with `prompt.txt` → exit 0, → `minimal/repair-prompt.txt`: round **2**, the same 3 DATA lines as the round-1 prompt, and an ERRORS block holding exactly the report's 2 errors in report order (R-S22).
- **W-CS5-Δ1 (negative witness):** on a `validated` report → exit 1, `{"code": "E-REPAIR-NOTHING"}`, no prompt (R-S22).
- Determinism note: fully deterministic.

**C-S6: accept.** Skeleton + Inventory + decisions + ≥ 1 validated (CheckReport, paste) pair (+ optional previous SDD) → SemanticDataDictionary.
- **W-CS6-N:** W-CS4-N's report and paste + S-O3's decisions → exit 0, → `minimal/sdd.jsonld`, with `acceptance.at` masked.
- **W-CS6-Δ1 (one factor: unvalidated, negative witness):** W-CS4-Δ1's report → exit 1, `{"code": "E-ACC-UNVALIDATED"}`, no SDD.
- **W-CS6-Δ2 (one factor: a rejection):** decisions *accept, accept, reject* → SDD with 2 mappings and `open: ["at:Organization/Cost Center"]`.
- **W-CS6-Δ3 (one factor: paste/report mismatch):** a paste whose sha256 differs from the report's `proposalSha256` → exit 1, `{"code": "E-ACC-MISMATCH"}`, no SDD.
- **W-CS6-Δ4 (one factor: null-equivalents):** decisions with `"nullEquivalents": {"at:Organization/Cost Center": ["N/A", "-"]}` → that mapping's `nullEquivalents` = `["-", "N/A"]`; nothing else changes.
- **W-CS6-Δ5 (one factor: existing output path, L2 refusal):** `--out` naming an existing file → exit 2, `{"code": "E-OUT-EXISTS"}`; the file's bytes are unchanged (R-S23).
- **W-CS6-Δ6 (one factor: uncovered decision):** a decision for a key that no supplied validated report covers → exit 1, `{"code": "E-ACC-UNCOVERED", "key": …}`, no SDD.
- **W-CS6-Δ7 (one factor: repair round):** W-JS2's round-2 report and paste → `sdd-round2.jsonld` (`at` masked).
- Determinism note: `acceptance.at` is masked, with the property: ISO-8601 UTC `YYYY-MM-DDTHH:MM:SSZ`, within ±5 s of the act. The witness files fix it at `2026-10-27T18:00:00Z`. `acceptance.by` is the input string verbatim (NG-S5). Everything else is deterministic.

**C-S7: rerun.** New schema + previous SDD → Inventory + RerunPlan.
- **W-CS7-N:** `minimal-organization-v2.json` + `minimal/sdd.jsonld` → exit 0, → `minimal/inventory-v2.jsonld` and `minimal/rerun-plan.jsonld`.
- **W-CS7-Δ1 (one factor: removal):** a v2 schema from which the Cost Center attribute **and its attribute-mapping entry** are both removed → `removed: ["at:Organization/Cost Center"]`. The next C-S6 merge moves it to `retired` with its last acceptance record.
- **W-CS7-Δ2 (one factor: identification switch):** previous SDD from the name-form fixture, new schema = the externalId variant → no `unchanged` key, every key `added` or `removed`, and `flags` = `[FL-KEY-SCHEME-CHANGED]`. No silent re-keying.
- Determinism note: fully deterministic.

## SDD §4: Data model & rules

Artifacts: `Inventory`, `Skeleton`, `PromptSet`, `CheckReport`, `RerunPlan`, `SemanticDataDictionary` (all JSON-LD;
`@context` is the bundled `https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld`), plus prompt
text and pasted bytes. All are **events**, immutable once written; a new round writes a new file.

- **R-S1: Canonical bytes.** Every JSON-LD artifact MUST be serialized as `JSON.stringify(value, null, 2)` + `"\n"` (UTF-8, LF), keys in the order shown by its witness file and JSON Schema (`schemas/*.schema.json`, OS-1). "sha256 of an artifact" means the sha256 of these bytes. An **item hash** (`itemSha256`) is the sha256 of the R-S1 bytes of one Inventory `objectTypes` or `attributes` entry. One exception, owned by ADR-005: `termListSha256` is the term list's own `terms_sha256` (sha256 of the compact JSON of its `terms` array). Witnesses: W-CS1-N, W-CS2-N, W-CS4-N, W-CS6-N; V-S1.
- **R-S2: Source keys.** Object type: `ot:` + esc(externalId if present, else name). Attribute: `at:` + esc(attribute externalId) if present, else `at:` + esc(owning type name) + `/` + esc(attribute name). Containment slot: `ct:` + the contained type's key. esc is RFC 6901 escaping. `source.identification` is `"externalId"` (every item has one), `"name"` (none does) or `"mixed"`. Two items yielding the same key is E-SRC-KEY-COLLISION (R-S3). Witnesses: W-CS1-N, W-CS1-Δ5, W-CS1-Δ6, W-CS1-Δ11; V-S2.
- **R-S3: Source validation.** C-S1 MUST validate against the vendored Atlassian schema and report each failure as E-SRC-SHAPE `{pointer, keyword, detail}`. `detail` is the missing property (`required`) or the offending value (`enum`). Umbrella `if`/`then` failures are not reported; their nested cause is. C-S1 MUST then check what that schema cannot express: E-SRC-REF-TARGET, E-SRC-MAP-TYPE, E-SRC-MAP-ATTR (an attribute neither on the type nor on an ancestor), E-SRC-DUP-TYPE, E-SRC-DUP-ATTR, E-SRC-KEY-COLLISION. An inventory with errors MUST have empty `objectTypes` and `attributes`, and C-S2 MUST refuse it (E-SKEL-ERRORED). Witnesses: W-CS1-Δ1–Δ4, W-CS1-Δ7–Δ11, W-CS2-Δ3.
- **R-S4: Hierarchy is not containment.** A `children` edge MUST become `parent` on the child type and nothing else. A mapping selector nested under another mapped type's selector MUST produce FL-CONTAINMENT and a `containment` slot. A mapping that uses an attribute defined only on an ancestor MUST produce FL-INHERITED-USE; that attribute keeps one slot, at its defining type. Witnesses: W-CS1-Δ6, W-CS2-Δ1.
- **R-S5: Categories.** `recordClass` and `iceClass` MUST be `cco:ont00000958` (Information Content Entity) or ICE-descended (named ancestry, ADR-008), else E-CHK-CATEGORY. A `referentClass` that is ICE-descended is validated with **W-CHK-ICE-REFERENT**: some records are about information, and that judgment is the person's. **W-CHK-GENERIC** is raised for any `recordClass`, `referentClass` or `iceClass` that is in the BFO namespace or is exactly `cco:ont00000958`. Witnesses: W-CS4-Δ1, W-CS4-Δ8, W-CS4-Δ10, W-CS4-Δ11.
- **R-S6: Coverage.** The proposal's mapping keys MUST equal the prompt's DATA keys, each exactly once (E-CHK-MISSING, E-CHK-DUPLICATE, E-CHK-UNKNOWN-KEY). Witnesses: W-CS4-Δ1, W-CS4-Δ2; V-S3.
- **R-S7: Terms.** Every CURIE MUST be in the cited term list (E-CHK-TERM), `permitted`, and of the field's kind: class for `recordClass`, `referentClass`, `iceClass`; object property for `relation`, or `sdd:NoRelation` in containment slots only (E-CHK-KIND). Witnesses: W-CS4-Δ3, W-CS4-Δ4; V-S6.
- **R-S8: Domain and range.** Where a relation has named `rdfs:domain` / `rdfs:range` in the pinned CCO, the owner (contained) type's `referentClass` MUST be or descend from the domain, and the target (container) type's from the range (E-CHK-RANGE). When the needed `referentClass` is neither in the same proposal nor in a supplied previous SDD, C-S4 raises the warning **W-CHK-RANGE-UNRESOLVED**. Witness: W-CS4-Δ5 (pending OS-2).
- **R-S9: Value table.** Datatype and value property are fixed by Jira type for the 12 non-reference types; the LLM never chooses them. `referenced_object` attributes become `reference` slots instead (R-S7).

  | Jira type | `datatype` | `valueProperty` |
  |---|---|---|
  | text, textarea, email, select, ipaddress | `xsd:string` | `cco:ont00001765` has text value |
  | url | `xsd:anyURI` | `cco:ont00001768` has URI value |
  | integer | `xsd:integer` | `cco:ont00001773` has integer value |
  | double | `xsd:double` | `cco:ont00001770` has double value |
  | boolean | `xsd:boolean` | `cco:ont00001772` has boolean value |
  | date | `xsd:date` | `cco:ont00001771` has date value |
  | date_time | `xsd:dateTime` | `cco:ont00001767` has datetime value |
  | time | `xsd:string` (lexical form of `xsd:time`) | `cco:ont00001765` has text value (the pin has no time-of-day value property, OS-5) |

  Witnesses: W-CS2-N; W-CS2-Δ1 (all 12 non-reference types occur in the full fixture).
- **R-S10: Human-only fields.** A proposal MUST NOT contain `nullEquivalents`, `acceptance`, `decision`, `datatype` or `valueProperty` (E-CHK-HUMAN-FIELD). Witness: W-CS4-Δ6.
- **R-S11: Prompt construction.** A prompt MUST be `spec/prompt-template-v2.txt` with its placeholders filled: skeleton hash, term-list hash, batch label, round; ERRORS = empty for round 1, else R-S22's block; DATA = one line per slot, in skeleton order, each `JSON.stringify` (no spaces) of exactly these fields — type `{key, kind, name, description, parent, selectors}`; attribute `{key, kind, name, description, owner, jiraType}`; reference `{key, kind, name, description, owner, target}`; containment `{key, kind, child, container, selector}`; CATALOGUE = ICE classes, other classes, object properties (permitted only), lines `curie<TAB>label` sorted by CURIE. **Source text MUST appear only as JSON string values inside DATA.** Witnesses: W-CS3-N, W-CS3-Δ1, W-CS5-N; V-S4.
- **R-S12: Batching.** Budget unit: **UTF-8 bytes** (default 200,000; `--budget`). A batch's size is the byte length of its prompt rendered with batch label `1/1` and round `1` (a label-independent measure, so batching never depends on the batch count; emitted prompts can differ by the label's extra digits). If the prompt with an empty DATA block exceeds the budget, C-S3 MUST fail with E-PROMPT-BUDGET. Otherwise C-S3 MUST fill batches greedily with whole object-type groups in skeleton order (a group is a type slot followed by its attribute, reference and containment slots). A group that alone exceeds the budget forms its own batch and adds W-PROMPT-OVERSIZE to the PromptSet, in group order. Witnesses: W-CS3-Δ2, W-CS3-Δ4, W-CS3-Δ5.
- **R-S13: Answer extraction.** C-S4 MUST take the JSON object from the paste: the whole paste (trimmed) if it is one JSON object, else the content of exactly one ```` ```json ```` fenced block. Otherwise it MUST report E-CHK-JSON and stop. Next, the reply's `skeletonSha256` and `batch` MUST equal the prompt's (E-CHK-SKELETON, E-CHK-BATCH; each stops further checks). Witnesses: W-CS4-N, W-CS4-Δ7, W-CS4-Δ9, W-CS4-Δ12.
- **R-S14: Validated is not accepted.** `CheckReport.status` ∈ {`validated`, `rejected`}; `validated` iff `errors` is empty. Warnings never block. No artifact field or CLI message MAY describe a validated proposal as "correct", "approved", "accepted" or "verified"; only C-S6 output carries `acceptance`. Witnesses: W-CS4-N, W-CS4-Δ8, W-CS6-N. Experience side: SDD-operator PR-O4.
- **R-S15: Absence semantics (ADR-003).** Every SDD MUST declare `"absenceKinds": ["missing", "explicit_null", "empty_string", "indistinguishable"]`, and every attribute mapping MUST carry `nullEquivalents` (default `[]`, sorted, set only through C-S6 decisions). No SDD field asserts anything about a referent from absence. Witnesses: W-CS6-N, W-CS6-Δ4.
- **R-S16: Context.** An input whose `@context` is not the bundled context IRI MUST be refused (E-CTX-EXTERNAL) without dereferencing. Witness: W-CS2-Δ2.
- **R-S17: Rerun matching.** Items match across schemas by key. A matched item is `unchanged` iff its current `itemSha256` equals the previous SDD's `source.itemSha256`, else `changed`. Arrays are sorted. In C-S6's merge, `unchanged` mappings MUST be carried byte-identical, `changed` ones MUST become `open`, and `removed` ones MUST move to `retired` with their last acceptance record. Witnesses: W-CS7-N, W-CS7-Δ1, W-CS7-Δ2; V-S5.
- **R-S18: Acceptance is bound to validated checks.** C-S6 MUST refuse unless every supplied report is `validated` (E-ACC-UNVALIDATED), sha256(paste) = `report.proposalSha256` (E-ACC-MISMATCH), and `report.skeletonSha256` = sha256(skeleton) (E-ACC-MISMATCH). Each decided key MUST be covered by some supplied report (E-ACC-UNCOVERED); its mapping and provenance come from the covering report with the highest `round`. Only decided keys change state. Witnesses: W-CS6-Δ1, W-CS6-Δ3, W-CS6-Δ6, W-CS6-Δ7; V-S5.
- **R-S19: Flags.** Flags never block. They are sorted by code, then key (JavaScript string order): FL-CONTAINMENT (with `container`), FL-INHERITED-USE (with the inherited attribute names, sorted), FL-NO-LABEL (neither the type nor any ancestor has a `label` attribute), FL-SELECT-VALUES-UNKNOWN (every `select` attribute), FL-UNMAPPED-TYPE, FL-KEY-SCHEME-CHANGED (C-S7 only). Witnesses: W-CS1-Δ6, W-CS7-Δ2.
- **R-S20: Check order and precedence.** C-S4 MUST run R-S13 first; any failure there stops it. It then reports coverage errors (R-S6): E-CHK-MISSING and E-CHK-DUPLICATE in skeleton order, then E-CHK-UNKNOWN-KEY in proposal order. Then, for each mapping whose key is a slot, in skeleton order, it checks the fields in the order `recordClass`, `referentClass`, `iceClass`, `relation`. Each field runs R-S7 (term, then kind), then R-S5 (category), then R-S8 (range), and **stops at the first error**. Warnings for a field are raised only if it has no error. Errors and warnings are listed in that traversal order. Witnesses: W-CS4-Δ1, W-CS4-Δ3, W-CS4-Δ4, W-CS4-Δ10.
- **R-S21: Messages.** Every error and warning in a CheckReport MUST carry `{code, key, field, value, rule, message}`, with `message` filled from a fixed template (`label` is the term list's label for `value`): E-CHK-CATEGORY `"{field} {value} ({label}) is not cco:ont00000958 (Information Content Entity) or a subclass of it."` · E-CHK-MISSING `"Slot {key} has no mapping in this batch."` · E-CHK-DUPLICATE `"Slot {key} is mapped more than once."` · E-CHK-UNKNOWN-KEY `"{key} is not a slot in this batch."` · E-CHK-TERM `"{field} {value} is not in the term list."` · E-CHK-KIND `"{field} {value} is not a permitted {expected} term."` · E-CHK-RANGE `"{field} {value} does not admit the referent classes it connects (domain/range)."` · E-CHK-HUMAN-FIELD `"{field} can only be set by a person at acceptance."` · E-CHK-JSON `"The reply does not contain exactly one JSON object."` · E-CHK-SKELETON `"The reply names a different skeleton than the prompt."` · E-CHK-BATCH `"The reply names batch {value}; the prompt is batch {batch}."` · W-CHK-GENERIC `"{field} {value} ({label}) is a top-level class; check it is specific enough."` · W-CHK-ICE-REFERENT `"referentClass {value} ({label}) is information content; check the record is about information."` · W-CHK-RANGE-UNRESOLVED `"{field} {value}: the domain/range check needs a referentClass not yet mapped."` Witnesses: W-CS4-Δ1 (two templates, literal), W-CS4-Δ8.
- **R-S22: Repair.** C-S5 MUST refuse a validated report (E-REPAIR-NOTHING). Otherwise its output is R-S11's prompt with the **same DATA lines** as the checked prompt, round = `report.round` + 1, and ERRORS = `"\nERRORS IN YOUR PREVIOUS REPLY\nYour previous reply for this batch was rejected for the reasons below. Return the complete corrected mapping set for every DATA line, not only the lines named here.\n"` followed by one `JSON.stringify` line per error, in report order, then `"\n"`. A repair reply is checked by C-S4 against the repair prompt, like any reply. Witnesses: W-CS5-N, W-CS5-Δ1, W-JS2.
- **R-S23: CLI input and output.** Every command MUST write only to stdout or to new paths. A `--out` or `--out-dir` target that exists MUST be refused with exit 2 and E-OUT-EXISTS, leaving it untouched. Unreadable input is exit 2 with E-IO; bad arguments are exit 2 with E-USAGE. Witnesses: W-CS6-Δ5, W-CS1-Δ12.

**Conflict record (P5).** Cycle 2 found W-CS4-Δ3 and W-CS4-Δ4 ("exactly one error") in conflict with R-S5 as then
written, which also fired E-CHK-CATEGORY for an unknown or non-class `iceClass` (SDD-F29). Halt; returned to the
author. Resolution, recorded: R-S20 was minted (per-field precedence, stop at the first error); the witnesses were
unchanged. The v0.1 "conflict record" was not a rule/witness conflict and is withdrawn (SDD-F41).

## SDD §5: Decomposition

| Component | Home | Serves |
|---|---|---|
| `core/canonical` (serializer, sha256, item hash) | `src/core/canonical.mjs` | R-S1, all capabilities |
| `core/terms` (term-list access, ancestry, domain/range) | `src/core/terms.mjs` | C-S3, C-S4 |
| `core/parse` | `src/core/parse.mjs` | C-S1, C-S7 |
| `core/skeleton` | `src/core/skeleton.mjs` | C-S2 |
| `core/prompt` | `src/core/prompt.mjs` | C-S3, C-S5 |
| `core/check` | `src/core/check.mjs` | C-S4 |
| `core/accept` | `src/core/accept.mjs` | C-S6 |
| `core/rerun` | `src/core/rerun.mjs` | C-S7 |
| `cli` | `src/cli/sdd.mjs` | the CLI surface (R-S23) |
| `html` (operator surface) | `site/` | SDD-operator CV-O1–CV-O3 |

The core is pure: no file, network, clock or randomness access. The CLI and the page supply bytes and the clock
(`acceptance.at` only). Every component serves a capability.

## SDD §6: Seams

Full hashes of every file named here are in the §11 registry.

| Seam | Producer → Consumer | Contract | Crossing example (literal) | Status |
|---|---|---|---|---|
| S-S1 | parse → skeleton, prompt, accept, rerun | Inventory | `minimal/inventory.jsonld` (`902ab965`) | filled |
| S-S2 | skeleton → prompt, check, repair, accept | Skeleton | `minimal/skeleton.jsonld` (`a250c034`) | filled |
| S-S3 | terms → prompt, check | term list | `ontology/term-list.json`, `terms_sha256` `0965d5a4` | filled |
| S-S4 | check → repair | rejected CheckReport | `minimal/bad-check-report.jsonld` (`4c6d7245`) | filled |
| S-S5 | check → accept | validated CheckReport | `minimal/check-report.jsonld` (`d6882951`) | filled |
| S-S6 | rerun → skeleton, prompt, accept | RerunPlan | `minimal/rerun-plan.jsonld` (`aa4dc216`) | filled |
| S-S7 | accept → rerun; → consumers | SemanticDataDictionary | `minimal/sdd.jsonld` (`14cb509d`) | filled |
| S-S8 | prompt → person, check | PromptSet | `{"@context": "https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld", "@type": "PromptSet", "skeletonSha256": "a250c034b1d5b1e03fe791dbd9a79ef20eac910fdea6c8b673539cdc1204bb88", "round": 1, "budget": 200000, "prompts": [{"batch": "1/1", "file": "prompt-1-of-1.txt", "bytes": 62683, "sha256": "14320bfb4a8ef2284c2ee3b7c35c712a1a2d20d5d1c2d9e17199515e086654db"}], "warnings": []}` | filled |
| **S-O1** *(cross-document, mirrored in SDD-operator §8)* | prompt → copy control → clipboard | prompt bytes | `minimal/prompt.txt` → clipboard bytes with the same sha256 (`14320bfb`) | filled |
| **S-O2** | paste box → check | pasted bytes | `minimal/proposal-pasted.txt` → C-S4 input with the same sha256 (`6eb7f5af`) | filled |
| **S-O3** | decide controls → accept | decisions | `{"by": "Aaron Damiano", "decisions": [{"key": "ot:Organization", "decision": "accept"}, {"key": "at:Organization/Name", "decision": "accept"}, {"key": "at:Organization/Cost Center", "decision": "accept"}], "nullEquivalents": {}}` | filled |
| **S-O4** | check → error/warning rows | CheckReport | `minimal/bad-check-report.jsonld` → 2 rows, text per SDD-operator W-PRO5-N | filled |
| **S-O5** | parse → inventory screen | Inventory | `minimal/inventory.jsonld` → `1 object type · 2 attributes · 0 references · 0 flags` | filled |
| **S-O6** | accept → download | SemanticDataDictionary | `minimal/sdd.jsonld` → downloaded bytes with the same sha256, `at` excepted | filled |

## SDD §7: Invariants & properties

Generator **G1**: random Jira Assets schemas valid against the vendored Atlassian schema. Each has 1–40 object types
in trees of depth ≤ 4; 0–12 attributes per type over the 13 types; 0–3 references per type, including self and
ancestor targets; 0–2 nested selectors; per-item random `externalId` presence (name, externalId and mixed
identification all occur); descriptions from corpus **K1** (plain text, quotes, backslashes, newlines, non-BMP
Unicode, U+2028, the literal lines `-----END DATA-----` and `-----BEGIN CATALOGUE-----`, instruction-like text).
Seeded; seeds recorded with each run.

- **V-S1: Determinism and platform parity.** Scope: every output of C-S1–C-S5 and C-S7, and C-S6 outputs except `acceptance.at`. Generator: all fixtures + G1, n ≥ 200. Property: two runs give identical bytes, and the Node CLI and the browser build give identical bytes. Pinned: W-CS1-N, W-CS2-N, W-CS3-N, W-CS4-N.
- **V-S2: Key soundness.** Scope: every C-S1 run. Generator: G1, n ≥ 200, each schema also permuted (array order shuffled) and with descriptions edited. Property: either the keys are unique, or C-S1 reports E-SRC-KEY-COLLISION naming every colliding key; the key set is invariant under permutation and description edits; every key unescapes (RFC 6901) to its source identifier. Pinned: W-CS1-Δ5, W-CS1-Δ11.
- **V-S3: Coverage closure** *(interaction: batching × coverage)*. Scope: (skeleton, budget, proposal) triples. Generator: G1 × budgets {68,000, 200,000} × proposals derived from a correct one by dropping, duplicating or renaming 0–3 keys, n ≥ 200 triples; plus budget 50,000 on every schema. Property: `validated` ⇒ mapping keys = the prompt's DATA keys exactly; every mutation is caught with its code; the batches' DATA keys partition the skeleton's slot keys; budget 50,000 ⇒ E-PROMPT-BUDGET. Pinned: W-CS4-Δ1, W-CS4-Δ2, W-CS3-Δ2, W-CS3-Δ5.
- **V-S4: Untrusted text containment** *(interaction: hostile text × escaping)*. Scope: every prompt and repair prompt. Generator: G1 with K1 descriptions, n ≥ 200. Property: (i) every DATA line parses as JSON, and every source string occurs only as a JSON-escaped value inside DATA; (ii) `-----END DATA-----` occurs exactly once as a whole line; (iii) for two schemas that differ only in descriptions and fit in one batch, the prompts differ only inside DATA lines and in the 2 occurrences of the skeleton hash. Pinned: W-CS3-Δ1.
- **V-S5: Acceptance monotonicity** *(interaction: rounds × rejection × schema change)*. Scope: sequences of C-S3–C-S7 operations. Generator: random sequences of length ≤ 30 over G1 schemas, with random pastes (valid, invalid, hostile) and decisions, n ≥ 100 sequences. Property: the accepted set changes only at C-S6 steps, only for decided keys or keys moved by R-S17; carried mappings are byte-identical; C-S3, C-S4 and C-S5 never change it. Pinned: W-JS2, W-JS3, W-JS4, W-CS6-Δ1.
- **V-S6: Term closure.** Scope: every SDD produced in V-S5 runs (≥ 100). Property: every CURIE is in the term list the SDD records, permitted, and of its field's kind; every `recordClass` and `iceClass` is ICE-descended. Pinned: W-CS6-N.

## SDD §8: Envelopes

Reference machine: `bench/config.json` (OS-6), Node 22 LTS; measured by `bench/run.mjs`, appended to `bench/results.jsonl`.
- **E-S1:** C-S1 → C-S4 on `synthetic-it-assets.json` ≤ 2 s wall-clock (CLI, cold).
- **E-S2:** C-S4 on a 5,000-slot G1 schema's full proposal ≤ 5 s.
- **E-S3:** the default-budget prompt for `synthetic-it-assets.json` is one batch of ≤ 200,000 bytes (the author's reference computation gives 70,139).

## SDD §9: Non-goals

- **NG-S0, experience level:** `{status: delegated(SDD-operator, sdd-operator.md); scope: the SDD Service product boundary (core, CLI, HTML tool); authority: the registrar; as-of: registry v0.2}`, discharged through WV-1.
- **NG-S1, no RDF individuals (ADR-007.1).** No capability creates instance data. *(Cited by R-S15.)*
- **NG-S2, no star-schema profile (ADR-002).**
- **NG-S3, no IQL evaluation.** `objectMappingIQL` is opaque.
- **NG-S4, no LLM or network integration (ADR-004).** *(Cited by SDD-operator PR-O2.)*
- **NG-S5, no authentication of acceptors.** *(Cited by SDD-operator NP-O2.)*
- **NG-S6, no specialised value properties.**
- **NG-S7, no third (assertion-process) individual (ADR-001).**
- **NG-S8, no select option values** (FL-SELECT-VALUES-UNKNOWN).
- **NG-S9, no OWL reasoning.** Named ancestry and named domain/range only; anonymous expressions are not evaluated.
- **NG-S10, no cardinality.**

## SDD §10: Acceptance (ordered conjunction, method P7)

1. No knockouts; coverage maps clean at every joint.
2. Experience gate: delegated per NG-S0, discharged by SDD-operator §14 through WV-1.
3. J-S1–J-S4 accepted via W-JS1–W-JS4 under H-S1.
4. C-S1–C-S7 accepted: every nominal witness and every delta, negative witnesses included.
5. S-S1–S-S8 exercised, and S-O1–S-O6 in integration.
6. V-S1–V-S6 pass at their stated generators and n.
7. E-S1–E-S3 met under their measurement paths.

ACCEPT = g₁ ∧ … ∧ g₇ (the minimum, never a mean). **Witness precondition (P10):** every W-\* MUST be validated by
execution against the implementation in a clean environment before a gate consumes it. *Status at v0.2: the witness
files are authored, with hashes computed by the author's reference generator (not an implementation); none is
validated.*

`Disposition: per method §6` · `Acceptance readiness: BLOCKED — OS-1, OS-2, OS-3, OS-4, OS-6, OS-7; SDD-operator OO-1, OO-2`

## SDD §11: Change discipline

**Witness registry (authoritative hashes).** Version 2 = changed or added by prop-001. Version-1 files superseded by
prop-001 are retained under `fixtures/witnesses/superseded/v1/` with their v1 hashes.

| File | Ver | sha256 | Cited by |
|---|---|---|---|
| `fixtures/jira-assets/minimal-organization.json` | 1 | `3239b1f085d090c71027032833831cf151b28ec90a935e01788b992ec6363869` | W-JS1–4, W-CS1-N, S-S7 |
| `fixtures/jira-assets/minimal-organization-v2.json` | 2 | `e86ef883322aa194ed10bda51118d02a9b0ddc51892d09d781514e9b11f5373b` | W-JS3, W-CS7-N |
| `fixtures/jira-assets/invalid/mapping-unknown-type.json` | 2 | `c8d3d96cb64f1ba0f6670891ef97882dc3c80f7063dc53693f8a4ff44b55af3f` | W-CS1-Δ9 |
| `fixtures/jira-assets/invalid/duplicate-attribute-name.json` | 2 | `356f2b8f4b92a50684426611409222a62ea05f5d6057e744b1d6820558c47557` | W-CS1-Δ10 |
| `fixtures/jira-assets/invalid/key-collision.json` | 2 | `7abce9aa6f6a0eef0a1dfcfbd64476d2a0df01807d6ee5c0034cd677b1835550` | W-CS1-Δ11 |
| `fixtures/witnesses/minimal/inventory.jsonld` | 1 | `902ab965e1d220a172944d758f2cf3931e8541a8e1c3000a3d82b13487e630ed` | W-CS1-N, W-CS2-N, W-CS3-N, S-S1, S-O5 |
| `fixtures/witnesses/minimal/skeleton.jsonld` | 1 | `a250c034b1d5b1e03fe791dbd9a79ef20eac910fdea6c8b673539cdc1204bb88` | W-CS2-N, W-CS3-N, W-CS4-N, S-S2, S-S8 |
| `fixtures/witnesses/minimal/prompt.txt` | 2 | `14320bfb4a8ef2284c2ee3b7c35c712a1a2d20d5d1c2d9e17199515e086654db` | W-CS3-N, W-CS4-N, W-CS5-N, S-S8, S-O1 |
| `fixtures/witnesses/minimal/proposal-pasted.txt` | 1 | `6eb7f5afb14cad25e38fad57eeea6118f78f433c1008698f01172bafacc28e9f` | W-CS4-N, W-JS2, S-O2 |
| `fixtures/witnesses/minimal/check-report.jsonld` | 2 | `d68829515dda3f4f44d317c0dc3d09170474e3b2fddd4aaf6cda9243d65db238` | W-CS4-N, W-CS6-N, S-S5 |
| `fixtures/witnesses/minimal/bad-proposal.txt` | 1 | `68704680864a30fc0eab135889059fb304dcf54210388d6ac58d2dbc7874909c` | W-CS4-Δ1, W-JS2 |
| `fixtures/witnesses/minimal/bad-check-report.jsonld` | 2 | `4c6d72456b8fdeca79b5649e633385466d2f3fcbda459cd4ebc610dc1f339eda` | W-CS4-Δ1, W-CS5-N, S-S4, S-O4 |
| `fixtures/witnesses/minimal/repair-prompt.txt` | 2 | `d439c251564d919de9368ae5a94d7d639559db5ac8cd08a9bd535e0bb5b8b452` | W-CS5-N, W-JS2 |
| `fixtures/witnesses/minimal/check-report-round2.jsonld` | 2 | `89e955ce0d2a4a8ac3f928ded181918e21b6bed957a60d5ea70fa5011ac47310` | W-JS2, W-CS6-Δ7 |
| `fixtures/witnesses/minimal/sdd.jsonld` | 2 | `14cb509da81932ec7f1b13ccf58f32a8dda1bca52a96ffdde04cbb2ac07773f4` | W-CS6-N, W-CS7-N, W-JS1, S-S7, S-O6 |
| `fixtures/witnesses/minimal/sdd-round2.jsonld` | 2 | `ef49006abd8b728f15c6cdcf6868c5f51a29a5aa501c38c3aa5efdf1a67e9619` | W-JS2, W-CS6-Δ7 |
| `fixtures/witnesses/minimal/inventory-v2.jsonld` | 2 | `0ea0045b7131f75356dafb2759250e97edeeab52cfec7ba67b6a2be9f6e47613` | W-CS7-N, W-JS3 |
| `fixtures/witnesses/minimal/rerun-plan.jsonld` | 2 | `aa4dc21626cb85605d8ca1fa6fc656e125cecc9bcd8a3d01d336916d1ab66d66` | W-CS7-N, W-JS3, S-S6 |
| `fixtures/witnesses/full/prompt-1-of-2.txt` | 2 | `996cbcb54e2135685d588938b38da62b730edbe59017592d0c4a5becdd564c1c` | W-CS3-Δ2 |
| `fixtures/witnesses/full/prompt-2-of-2.txt` | 2 | `e2245d97cb947ee4434b206cfe09fdee29215249b2cefdce533d5483dfdb45a7` | W-CS3-Δ2 |
| `spec/prompt-template-v2.txt` | 2 | `01faeb44c4d2a215c4a32bb167a10e282248323c41d6776d0e498200789d0432` | R-S11, R-S22 |
| `ontology/term-list.json` | ADR-005 | `terms_sha256` `0965d5a4bf184696def722537148c8ed4a93dca9bee365ad8be052c3c91156f5` | S-S3, every term-bearing witness |

**Supersession.** Changing any governed file is a supersession event. The superseded file is retained, and every
citer named in the reciprocal table below and in the "Cited by" column MUST be re-accepted before this document
regains its disposition. *Worked example:* a new Ontology-Template pin (ADR-005) changes `terms_sha256`, so the
skeleton changes (it cites the hash), so the prompt, check reports, repair prompt and SDDs all change. That fires
every W-CS2-\* to W-CS7-\* nominal witness, S-S2–S-S8, and, through the reciprocal table, every SDD-operator scene
that cites them.

**Reciprocal citations with SDD-operator.** Each row is a local artifact and the SDD-operator artifacts that cite it,
enumerated from both documents:

A citation is an explicit identifier: an artifact cites another iff its text names that id. Both tables are generated from that rule by scanning SDD-operator (prop-001 drafting aid; to become the governed OS-7 check).

| Local artifact | Cited by (SDD-operator) |
|---|---|
| NG-S4 | PR-O2 |
| NG-S5 | NP-O2, PR-O1 |
| R-S5 | W-PRO4-Δ1, W-PRO5-N |
| R-S6 | W-PRO5-N |
| R-S10 | W-PRO1-Δ2 |
| R-S11 | W-PRO6-Δ2 |
| R-S13 | W-PRO3-Δ1 |
| R-S14 | NP-O3, PR-O4 |
| R-S16 | PR-O2, W-PRO2-Δ2 |
| R-S18 | PR-O1 |
| R-S20 | W-PRO5-Δ1 |
| R-S21 | RV-O4, W-PRO4-Δ1, W-PRO5-N |
| R-S23 | PR-O3 |
| W-CS3-N | W-JO1, W-PRO6-N |
| W-CS3-Δ2 | W-PRO6-Δ1 |
| W-CS4-Δ1 | W-JO2, W-PRO3-N, W-PRO5-N |
| W-CS4-Δ8 | W-PRO4-Δ1 |
| W-CS5-N | W-JO2, W-PRO5-N |
| W-CS6-N | W-JO1, W-PRO1-N |
| W-CS6-Δ2 | W-PRO1-Δ4, W-PRO3-Δ3 |
| W-CS6-Δ4 | W-PRO1-Δ3 |
| W-CS6-Δ5 | W-PRO3-Δ2 |
| W-CS6-Δ7 | W-JO2 |
| W-JS1 | W-JO1, W-PRO2-Δ1 |
| W-JS2 | W-JO2, W-PRO2-Δ1 |
| W-JS3 | W-JO3, W-PRO2-Δ1 |
| W-JS4 | W-PRO2-Δ1, W-PRO3-Δ3 |
| S-O1–S-O6 | SDD-operator §8 rows S-O1–S-O6 (mirrored) |

The reciprocity of this table and SDD-operator §15's is **claimed, not yet demonstrated**: WV-1 gate 2 stays
*pending* until OS-7 verifies it mechanically. CAP-2 therefore remains active.

**Open items.**
- **OS-1:** author `schemas/*.schema.json` (one per artifact, including the proposal format C-S4 applies), the bundled `context/sdd-v1.jsonld` (hash-pinned), and **SHACL shapes for the SemanticDataDictionary** (`shapes/sdd-v1.shacl.ttl`, ADR-006), with `minimal/sdd.jsonld` as the conforming witness.
- **OS-2:** extend the term list with named `rdfs:domain` / `rdfs:range` (same reader, same pins) and write W-CS4-Δ5's literal.
- **OS-3:** implement G1 and K1.
- **OS-4:** build the core and CLI; execute every witness under H-S1.
- **OS-5:** registrar decision on `time` values (R-S9 fallback).
- **OS-6:** `bench/` with the reference machine.
- **OS-7:** a mechanical reciprocity check: extract every cross-document citation from both documents and compare it with both reciprocal tables. Run before cycle 3.

## SDD §12: Closure report (method P2)

Granularity: template structure. The one-paragraph summary and §1 are informative. Every BCP 14 clause lives in §3,
§4, §7, §8, §9 or §10.

| Clauses | Class | Falsifier | Validation | Gate |
|---|---|---|---|---|
| C-S1–C-S7 behaviour | FC-W | W-CS1-\* … W-CS7-\* | execution vs. implementation (OS-4) | §10.4 |
| R-S1–R-S23 | FC-RW | rule ↔ witness pairs listed in §4 | OS-4 | §10.4 |
| S-S1–S-S8, S-O1–S-O6 | FC-X | crossing examples, §6 | integration | §10.5 |
| V-S1–V-S6 | FC-P | generators + properties, §7 | property runs (OS-3) | §10.6 |
| J-S1–J-S4 | FC-C | W-JS1–W-JS4 under H-S1 | chain runs | §10.3 |
| E-S1–E-S3 | FC-M | thresholds + `bench/` | bench runs (OS-6) | §10.7 |
| NG-S\*, witness registry, reciprocal table, core purity | FC-A | audits: registry hashes recompute; core imports no I/O modules; OS-7 reciprocity check | audit | §10.1, §11 |

Orphan clauses: **0**. Named defects at the gate (not orphans): W-CS4-Δ5's literal (OS-2); the reciprocity
demonstration (OS-7).
