# SDD Service: substrate specification

| | |
|---|---|
| **Conformance** | Authored under *The Falsifiable Spec, Method Specification v0.4* (Specification-Refinement-System). Document pair: this file (`SDD`, substrate, method §4 form) and [`sdd-operator.md`](sdd-operator.md) (`SDD-operator`, experience companion, method §4A form), federated by weave record **WV-1** (housed in SDD-operator §15). |
| **Status** | v0.4.1 (targeted correction pass, 2026-10-28: SDD-F67–F70 corrected, SDD-F71 gaps triaged into existing rules; CAP-2 lifted by the registrar, Decision B, on independent verification; registrar Decision C). v0.4 (prop-002, merged 2026-10-28 with registrar Decision A): v0.3 plus the dispositions of cycle-3 findings SDD-F50–F66. Supersedes v0.1 @ `b4aab5b` (cycle 2: joint D-1) and v0.3 @ `5e5b4cc` (cycle 3: joint D-2). C-S1–C-S7 built (`src/`); every C-S* witness passes under an independent judge; SDD-F72 added (term-list change never carried silently). |
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
came from."* Category errors are caught as far as named ancestry and named domain and range in the pinned ontologies can show; anonymous class expressions are not evaluated (NG-S9).

## SDD §2: Journeys

Fixtures: [`fixtures/jira-assets/minimal-organization.json`](../fixtures/jira-assets/minimal-organization.json)
(`3239b1f0`) and its successor `minimal-organization-v2.json` (`e86ef883`). Literal artifacts:
[`fixtures/witnesses/minimal/`](../fixtures/witnesses/minimal/). Carried state in **bold**. Harness **H-S1**: a
shell runner executing the CLI chain in a clean container with networking disabled and the network guard of
SDD-operator H-O2 preloaded. Owner: this document's acceptance runner. Relay steps (the person and the LLM) are
supplied under H-S1 by the literal witness files each chain names (pastes, decisions, key lists), and exercised for
real by SDD-operator W-JO1–W-JO4 under H-O1. Every file a chain names is in the §11 registry.

**J-S1: first dictionary.** Chain example **W-JS1**: (1) C-S1 on the fixture → `minimal/inventory.jsonld` **`902ab965`**
(W-CS1-N). (2) C-S2 → `minimal/skeleton.jsonld` **`e990dbb3`** (W-CS2-N). (3) C-S3 with the inventory → one batch,
`minimal/prompt.txt` **`7f121f7a`**, round **1** (W-CS3-N). (4) *Relay:* the paste is `minimal/proposal-pasted.txt` **`7d3a9546`**.
(5) C-S4 on (skeleton, prompt, paste) → `minimal/check-report.jsonld` **`552fa6c8`**, `status: validated` (W-CS4-N).
(6) C-S6 with decisions *accept ×3* by "Aaron Damiano" → `minimal/sdd.jsonld` **`d311d909`** (`acceptance.at` masked)
(W-CS6-N). **Whole-journey outcome:** an SDD whose 3 mappings each carry their source element, its item hash, and
the prompt, proposal and report hashes of steps 3–5.

**J-S2: repair.** Chain example **W-JS2**: steps (1)–(3) of W-JS1. (4) The paste is `minimal/bad-proposal.txt` **`8a227d43`**.
(5) C-S4 → `minimal/bad-check-report.jsonld` **`981fe147`**: `rejected`, round 1, exactly E-CHK-MISSING
(`at:Organization/Cost Center`) then E-CHK-CATEGORY (`at:Organization/Name`), in R-S20 order (W-CS4-Δ1). (6) C-S5 on that report and
its prompt → `minimal/repair-prompt.txt` **`e14d0701`**, round **2**, the same 3 DATA lines plus an ERRORS block holding
those 2 errors (W-CS5-N). (7) The relay returns the complete corrected set, `minimal/proposal-pasted.txt`. (8) C-S4 on
(skeleton, repair prompt, paste) → `minimal/check-report-round2.jsonld` **`72e726b5`**, validated, round 2. (9) C-S6 →
`minimal/sdd-round2.jsonld` **`a05cff1a`**. Outcome: identical to W-JS1's SDD except, in every mapping's `provenance`,
`round` (2), `promptSha256` and `checkReportSha256`. `proposalSha256` is the same (the same paste). The round-1
failure leaves no trace in the mappings.

**J-S3: schema changed.** Chain example **W-JS3**: (1) inputs: **`minimal/sdd.jsonld`** (W-JS1) and
`minimal-organization-v2.json`, where Cost Center's description reads "Finance code". (2) C-S7 →
`minimal/inventory-v2.jsonld` **`0ea0045b`** and `minimal/rerun-plan.jsonld` **`4e09c7bb`**: unchanged
`["at:Organization/Name", "ot:Organization"]`, changed `["at:Organization/Cost Center"]`, added `[]`, removed `[]`
(W-CS7-N). (3) C-S2 → `minimal/skeleton-v2.jsonld`. (4) The person forms `minimal/keys-rerun.json` from the plan's `changed` ∪
`added` (sorted): `["at:Organization/Cost Center"]`. C-S3 with skeleton₂, inventory₂ and `--keys keys-rerun.json` →
`minimal/prompt-rerun.txt`, whose DATA block holds exactly that 1 line. (5) Relay: `minimal/proposal-rerun.txt`; C-S4 →
`minimal/check-report-rerun.jsonld`, validated. (6) C-S6 with decisions *accept* (Cost Center) and `--previous sdd.jsonld` →
`minimal/sdd-v2.jsonld`: the Organization and Name mappings byte-identical to **`minimal/sdd.jsonld`**'s (acceptance records
included), Cost Center newly accepted. Outcome: unchanged decisions are never re-sent or silently re-accepted.

**J-S4: partial acceptance.** Chain example **W-JS4**: W-JS1 through step 5, then C-S6 with decisions *accept,
accept, reject* (the reject on `at:Organization/Cost Center`) → `minimal/sdd-partial.jsonld`: 2 mappings,
`open: ["at:Organization/Cost Center"]` (W-CS6-Δ2). The person forms `minimal/keys-open.json` from that `open` list; C-S3
`--keys keys-open.json` → `minimal/prompt-open.txt` (1 DATA line); relay `minimal/proposal-open.txt`; C-S4 →
`minimal/check-report-open.jsonld`, validated; C-S6 with decisions *accept* (Cost Center) and `--previous sdd-partial.jsonld`
→ `minimal/sdd-j4.jsonld`: `open: []`, and the 2 earlier mappings byte-identical to `minimal/sdd-partial.jsonld`'s.

Coverage map (bidirectional): J-S1 → {C-S1, C-S2, C-S3, C-S4, C-S6} · J-S2 → {C-S1–C-S6} · J-S3 → {C-S7, C-S2,
C-S3, C-S4, C-S6} · J-S4 → {C-S6, C-S3, C-S4}. Every capability serves ≥ 1 journey. Every step is homed; the relay
steps are cross-document (SDD-operator J-O1–J-O4 via S-O1–S-O3, WV-1).

## SDD §3: Capabilities

**Surface.** The core library (pure functions over bytes and values, no I/O) and a CLI over it:

| Command | Inputs | Output |
|---|---|---|
| `sdd parse <schema> [--out <file>]` | schema bytes | Inventory |
| `sdd skeleton <inventory> [--out <file>]` | Inventory | Skeleton |
| `sdd prompt <skeleton> <inventory> [--keys <file>] [--budget <bytes>] --out-dir <dir>` | Skeleton, Inventory, optional key list | `prompt-<i>-of-<n>.txt` and `prompt-set.jsonld` in `<dir>` |
| `sdd check <skeleton> <prompt> <paste> [--out <file>]` | Skeleton, the prompt the reply answers, pasted bytes | CheckReport |
| `sdd repair <skeleton> <inventory> <report> <prompt> [--out <file>]` | Skeleton, Inventory, rejected CheckReport, the prompt it checked | repair prompt |
| `sdd accept <skeleton> <inventory> <decisions> --checked <report> <paste> [--checked …] [--previous <sdd>] [--out <file>]` | as listed; ≥ 1 validated (report, paste) pair | SemanticDataDictionary |
| `sdd rerun <schema> <previous-sdd> --out-dir <dir>` | schema bytes, SDD | `inventory.jsonld` and `rerun-plan.jsonld` in `<dir>` |

**Exit-code contract (R-S23):** **0** success; **1** the output is a domain report of errors (still written) or a refusal (nothing written);
**2** usage or I/O failure (`E-IO`, `E-USAGE`, `E-OUT-EXISTS`), with nothing written. Every artifact is canonical
bytes (R-S1). Without `--out`, a single-output command writes its artifact to stdout. A key list (`--keys`) is a JSON
array of slot keys; forming one from a RerunPlan or from an SDD's `open` list is the person's step, not a capability.
"→ `file`" means the output MUST equal that witness file byte for byte.

**C-S1: parse.** Jira Assets import schema (bytes) → Inventory.
- **W-CS1-N:** `minimal-organization.json` → exit 0, → `minimal/inventory.jsonld`.
- **W-CS1-Δ1 (one factor: missing type):** `invalid/missing-attribute-type.json` → exit 1; `objectTypes: []`, `attributes: []`, `errors` = exactly `[{"code": "E-SRC-SHAPE", "pointer": "/schema/objectSchema/objectTypes/0/attributes/1", "keyword": "required", "detail": "type"}]`.
- **W-CS1-Δ2 (one factor: dangling reference):** `invalid/unknown-reference-target.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-REF-TARGET", "key": "at:Person/Manager", "value": "Employee"}]`.
- **W-CS1-Δ3 (one factor: unknown mapped attribute):** `invalid/mapping-unknown-attribute.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-MAP-ATTR", "key": "ot:Organization", "value": "Budget"}]`.
- **W-CS1-Δ4 (one factor: duplicate type):** `invalid/duplicate-object-type-name.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-DUP-TYPE", "key": "ot:Person"}]`.
- **W-CS1-Δ5 (one factor: externalId identification):** `synthetic-it-assets-externalids.json` → exit 0; `source.identification` = `"externalId"`; Organization's key = `ot:object-type~1organization`; its Cost Center's key = `at:object-type-attribute~1organization~1cost-center`.
- **W-CS1-Δ6 (one factor: the full fixture's ambiguities):** `synthetic-it-assets.json` → exit 0, → `full/inventory.jsonld` (and C-S2 on it → `full/skeleton.jsonld`); `flags` = exactly these 9, in R-S19 order: `FL-CONTAINMENT ot:Blade Server` (container `ot:Server`) · `FL-CONTAINMENT ot:Hard Drive` (container `ot:Server`) · `FL-INHERITED-USE ot:Blade Server` (`Asset Tag`) · `FL-INHERITED-USE ot:Hard Drive` (`Serial Number`) · `FL-INHERITED-USE ot:Laptop` (`Asset Tag, Owner, Purchase Cost, Purchase Date, Serial Number, Status`) · `FL-INHERITED-USE ot:Server` (`Asset Tag, Location`) · `FL-NO-LABEL ot:Scan Event` · `FL-SELECT-VALUES-UNKNOWN at:Hardware/Status` · `FL-UNMAPPED-TYPE ot:Hardware`. The key `at:Server/Ports~1Protocols` is present.
- **W-CS1-Δ7 (one factor: enum):** `invalid/unknown-attribute-type.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-SHAPE", "pointer": "/schema/objectSchema/objectTypes/0/attributes/1/type", "keyword": "enum", "detail": "currency"}]`.
- **W-CS1-Δ8 (one factor: conditional requirement):** `invalid/reference-without-target.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-SHAPE", "pointer": "/schema/objectSchema/objectTypes/1/attributes/6", "keyword": "required", "detail": "referenceObjectTypeName"}]` (the umbrella `if`/`then` error is not reported, R-S3).
- **W-CS1-Δ9 (one factor: unknown mapped type):** `invalid/mapping-unknown-type.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-MAP-TYPE", "key": null, "value": "Printer"}]`.
- **W-CS1-Δ10 (one factor: duplicate attribute):** `invalid/duplicate-attribute-name.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-DUP-ATTR", "key": "at:Organization/Cost Center"}]`.
- **W-CS1-Δ11 (one factor: key collision):** `invalid/key-collision.json` → exit 1; `errors` = exactly `[{"code": "E-SRC-KEY-COLLISION", "key": "ot:object-type~1organization"}]`.
- **W-CS1-Δ12 (one factor: unreadable input):** `sdd parse missing.json` (no such file) → exit 2, `{"code": "E-IO"}` on stderr, nothing written (R-S23).
- **W-CS1-Δ13 (one factor: one type under two containers, Decision C):** `invalid/two-containers.json` (`Hard Drive` mapped at `servers.disks` and at `laptops.drives`) → exit 1; `errors` = exactly `[{"code": "E-SRC-KEY-COLLISION", "key": "ct:ot:Hard Drive"}]`; `objectTypes` and `attributes` empty (R-S2, R-S3).
- Determinism note: fully deterministic. No masks.

**C-S2: skeleton.** Inventory → Skeleton: one slot per decision, meaning fields `null`, value fields pre-filled by R-S9.
- **W-CS2-N:** `minimal/inventory.jsonld` → exit 0, → `minimal/skeleton.jsonld`.
- **W-CS2-Δ1 (one factor: references and containment):** the full fixture's inventory → exit 0; slot counts exactly 10 `type`, 35 `attribute`, 5 `reference`, 2 `containment`; containment slots keyed `ct:ot:Blade Server` and `ct:ot:Hard Drive`; every attribute slot's (`datatype`, `valueProperty`) equals its Jira type's R-S9 row. No slot exists for any `children` edge.
- **W-CS2-Δ2 (one factor: foreign context, negative witness):** an inventory whose `@context` is any IRI other than the bundled context IRI → exit 1, `{"code": "E-CTX-EXTERNAL"}`, no skeleton. **The H-S1 network guard logs no attempt** (R-S16).
- **W-CS2-Δ3 (one factor: errored inventory):** the W-CS1-Δ2 inventory → exit 1, `{"code": "E-SKEL-ERRORED"}`, no skeleton (R-S3).
- Determinism note: fully deterministic.

**C-S3: prompt.** Skeleton + Inventory (+ optional key subset) + term list → one or more prompts and a PromptSet.
- **W-CS3-N:** `minimal/skeleton.jsonld`, `minimal/inventory.jsonld` → exit 0; one batch, → `minimal/prompt.txt` (63,399 bytes) and → `minimal/prompt-set.jsonld`.
- **W-CS3-Δ1 (one factor: hostile source text):** on the full fixture, the Software.Notes description appears **only** as a JSON string value inside the DATA block; `-----END DATA-----` occurs exactly once as a whole line.
- **W-CS3-Δ2 (one factor: budget):** full fixture, `--budget 69000` → exactly 2 batches, → `full/prompt-1-of-2.txt` (68,803 bytes; DATA = the groups of Organization through Blade Server, 39 lines) and `full/prompt-2-of-2.txt` (64,979 bytes; Hard Drive through Scan Event, 13 lines). Two batches result for every budget from 66,965 to 70,854 bytes.
- **W-CS3-Δ3 (one factor: subset):** `--keys ["at:Organization/Cost Center"]` → one batch whose DATA block holds exactly that line.
- **W-CS3-Δ4 (one factor: oversize groups):** full fixture, `--budget 63700` → exit 0; 10 batches (one per group); the PromptSet's `warnings` = exactly W-PROMPT-OVERSIZE for the groups of `ot:Person`, `ot:Location`, `ot:Hardware`, `ot:Server`, `ot:Software`, in that (group) order (R-S12).
- **W-CS3-Δ6 (one factor: separators, SDD-F54):** `hostile-separators.json` (a type description holding U+2028, the text `-----END DATA-----`, U+2029, CR LF and instruction text) → `hostile/inventory.jsonld` → `hostile/skeleton.jsonld` → `hostile/prompt.txt`: the prompt contains no U+2028 or U+2029 code point (each is written as the six-character escape `\u2028` or `\u2029`) and no CR byte; exactly one LF-delimited line equals `-----END DATA-----`; every DATA line parses as JSON.
- **W-CS3-Δ7 (one factor: placeholder text in source, SDD-F69):** `hostile-placeholders.json` (the minimal fixture with every placeholder name, and one unknown `{{UNKNOWN}}`, written inside two descriptions) → `hostile/placeholders-inventory.jsonld`, `hostile/placeholders-skeleton.jsonld`, `hostile/placeholders-prompt.txt`: the template's placeholders are each filled once; every placeholder-like string from the source appears only inside its DATA line's JSON string, verbatim; the DATA and CATALOGUE begin and end lines each occur exactly once, and no line outside DATA contains `{{`.
- **W-CS3-Δ5 (one factor: budget below overhead):** `--budget 50000` → exit 1, `{"code": "E-PROMPT-BUDGET"}`, no prompt written.
- Determinism note: fully deterministic.

**C-S4: check.** Skeleton + the prompt being answered + pasted bytes → CheckReport. The prompt supplies the batch, the round, and the slot set (its DATA keys).
- **W-CS4-N:** (skeleton, `minimal/prompt.txt`, `minimal/proposal-pasted.txt`) → exit 0, → `minimal/check-report.jsonld`. The prose before the fence is ignored (R-S13).
- **W-CS4-Δ1 (one factor: wrong category, missing slot):** with `minimal/bad-proposal.txt` → exit 1, → `minimal/bad-check-report.jsonld`.
- **W-CS4-Δ2 (one factor: duplicate and unknown keys):** the N proposal with its Name mapping duplicated and an extra mapping keyed `at:Organization/Budget` → errors exactly E-CHK-DUPLICATE (`at:Organization/Name`) then E-CHK-UNKNOWN-KEY (`at:Organization/Budget`).
- **W-CS4-Δ3 (one factor: invented term):** the N proposal with Name's `iceClass` = `cco:ont99999999` → exactly one error, E-CHK-TERM. No E-CHK-CATEGORY: R-S20 stops at the first failing check per field.
- **W-CS4-Δ4 (one factor: wrong kind):** Name's `iceClass` = `cco:ont00001808` (*is about*, an object property) → exactly one error, E-CHK-KIND (R-S20).
- **W-CS4-Δ5 (one factor from W-CS4-Δ15: range):** (`full/skeleton.jsonld`, `full/prompt.txt`, `full/proposal-range.txt`): the Δ15 proposal with `at:Person/Manager`'s relation changed to `bfo:BFO_0000056` (*participates in*, named range `bfo:BFO_0000015` *process*; Person's `referentClass` `cco:ont00001262` is not a process) → exit 1, → `full/check-report-range.jsonld`: exactly one error, E-CHK-RANGE on `at:Person/Manager`; the Δ15 warning is unchanged.
- **W-CS4-Δ6 (one factor: human-only field):** the N proposal plus `"nullEquivalents": ["N/A"]` on Cost Center → exactly one error, E-CHK-HUMAN-FIELD.
- **W-CS4-Δ7 (one factor: answer extraction):** the N JSON object pasted twice, unfenced → exactly one error, E-CHK-JSON; no other check runs.
- **W-CS4-Δ8 (one factor: generic class):** `referentClass` = `bfo:BFO_0000001` → `validated`, `errors: []`, `warnings` = exactly `[{"code": "W-CHK-GENERIC", "key": "ot:Organization", "field": "referentClass", "value": "bfo:BFO_0000001", "rule": "R-S5", "message": "referentClass bfo:BFO_0000001 (entity) is a top-level class; check it is specific enough."}]`.
- **W-CS4-Δ9 (one factor: stale skeleton):** the reply's `skeletonSha256` differs from the prompt's → exactly one error, E-CHK-SKELETON; no other check runs.
- **W-CS4-Δ10 (injection outcome, negative witness):** on the full fixture at the default budget, a proposal mapping every field of every slot to `bfo:BFO_0000001` → `rejected` with exactly **52 errors** (10 E-CHK-CATEGORY on `recordClass`, 35 E-CHK-CATEGORY on `iceClass`, 7 E-CHK-KIND on `relation`) and **10 warnings** (W-CHK-GENERIC on `referentClass`), in R-S20 order. **The outcome does not depend on the LLM resisting the injection.**
- **W-CS4-Δ11 (one factor: information referent):** `referentClass` = `cco:ont00000853` → `validated`, one warning W-CHK-ICE-REFERENT.
- **W-CS4-Δ12 (one factor: wrong batch):** the reply's `batch` = `"2/2"` against a `1/1` prompt → exactly one error, E-CHK-BATCH; no other check runs.
- **W-CS4-Δ13 (one factor: field set):** Name's mapping carries `relation` instead of `iceClass` → exactly one error, E-CHK-FIELDS (`at:Organization/Name`), message `"at:Organization/Name must have exactly the fields key, iceClass, rationale."`; no field check runs for that mapping (R-S20).
- **W-CS4-Δ15 (one factor: the full fixture, baseline for Δ5):** (`full/skeleton.jsonld`, `full/prompt.txt` (70,855 bytes), `full/proposal-valid.txt`) → exit 0, → `full/check-report-valid.jsonld`: `validated`, no errors, exactly one warning W-CHK-ICE-REFERENT on `ot:Software` (`cco:ont00000853`). Relations include `cco:ont00001798` *is supervised by* (domain and range Person) and `bfo:BFO_0000176` *continuant part of* (domain and range continuant) for both containment slots, and `bfo:BFO_0000084` *generically depends on* (domain *generically dependent continuant*) for Software→Hardware, so R-S8 is exercised on passing inputs.
- **W-CS4-Δ16 (one factor: batch 2 of 2, unresolved range):** (full skeleton, `full/prompt-2-of-2.txt`, `full/proposal-batch2.txt`: the Δ15 mappings for batch 2's keys, `batch: "2/2"`) → `full/check-report-batch2.jsonld`: validated; warnings exactly W-CHK-RANGE-UNRESOLVED on `ct:ot:Hard Drive` (its container Server is mapped in batch 1), W-CHK-ICE-REFERENT on `ot:Software`, W-CHK-RANGE-UNRESOLVED on `at:Software/Installed On` (its target Hardware is in batch 1).
- **W-CS4-Δ17 (one factor: both warnings):** the N proposal with Organization's `referentClass` = `cco:ont00000958` → validated; warnings exactly W-CHK-GENERIC then W-CHK-ICE-REFERENT on `ot:Organization` (R-S5).
- **W-CS4-Δ18 (one factor: usage):** `sdd check minimal/skeleton.jsonld` (two arguments missing) → exit 2, `{"code": "E-USAGE"}`, nothing written (R-S23).
- **W-CS4-Δ14 (one factor: shape):** `"mappings": {}` → exactly one error, `{"code": "E-CHK-SHAPE", "key": null, "field": null, "value": "/mappings", "rule": "R-S13", "message": "The reply does not match the proposal schema at /mappings (type)."}`; no other check runs.
- Determinism note: fully deterministic. The pasted bytes are the input; nothing is assumed about how they were produced.

**C-S5: repair prompt.** Skeleton + Inventory + rejected CheckReport + the prompt it checked → repair prompt for the same batch.
- **W-CS5-N:** on `minimal/bad-check-report.jsonld` with `minimal/prompt.txt` → exit 0, → `minimal/repair-prompt.txt`: round **2**, the same 3 DATA lines as the round-1 prompt, and an ERRORS block holding exactly the report's 2 errors in report order (R-S22).
- **W-CS5-Δ1 (negative witness):** on a `validated` report → exit 1, `{"code": "E-REPAIR-NOTHING"}`, no prompt (R-S22).
- Determinism note: fully deterministic.

**C-S6: accept.** Skeleton + Inventory + decisions + ≥ 1 validated (CheckReport, paste) pair (+ optional previous SDD) → SemanticDataDictionary.
- **W-CS6-N:** W-CS4-N's report and paste + S-O3's decisions → exit 0, → `minimal/sdd.jsonld`, with `acceptance.at` masked.
- **W-CS6-Δ1 (one factor: unvalidated, negative witness):** W-CS4-Δ1's report → exit 1, `{"code": "E-ACC-UNVALIDATED"}`, no SDD.
- **W-CS6-Δ2 (one factor: a rejection):** decisions *accept, accept, reject* → `minimal/sdd-partial.jsonld` (2 mappings, `open: ["at:Organization/Cost Center"]`).
- **W-CS6-Δ3 (one factor: paste/report mismatch):** a paste whose sha256 differs from the report's `proposalSha256` → exit 1, `{"code": "E-ACC-MISMATCH"}`, no SDD.
- **W-CS6-Δ4 (one factor: null-equivalents):** decisions with `"nullEquivalents": {"at:Organization/Cost Center": ["N/A", "-"]}` → that mapping's `nullEquivalents` = `["-", "N/A"]`; nothing else changes.
- **W-CS6-Δ5 (one factor: existing output path, L2 refusal):** `--out` naming an existing file → exit 2, `{"code": "E-OUT-EXISTS"}`; the file's bytes are unchanged (R-S23).
- **W-CS6-Δ6 (one factor: uncovered decision):** a decision for a key that no supplied validated report covers → exit 1, `{"code": "E-ACC-UNCOVERED", "key": …}`, no SDD.
- **W-CS6-Δ8 (one factor: wrong skeleton):** W-CS6-N's inputs, but with `minimal/skeleton-v2.jsonld` as the skeleton → exit 1, `{"code": "E-ACC-MISMATCH"}`, no SDD (R-S18, skeleton branch).
- **W-CS6-Δ9 (one factor: two covering reports):** `--checked` both `minimal/check-report.jsonld` (round 1) and `minimal/check-report-round2.jsonld` (round 2), each with its paste → equals `minimal/sdd-round2.jsonld`: every mapping takes the round-2 provenance (R-S18, highest round).
- **W-CS6-Δ7 (one factor: repair round):** W-JS2's round-2 report and paste → `minimal/sdd-round2.jsonld` (`at` masked).
- **W-CS6-Δ10 (one factor: previous SDD from another term list, SDD-F72):** W-JS3 step 6's inputs, with `--previous` = `minimal/sdd.jsonld` whose `environment.termListSha256` is replaced by 64 zeros → exit 0; `mappings` = only `at:Organization/Cost Center` (accepted in this act); `open` = `["at:Organization/Name", "ot:Organization"]`: nothing is carried (R-S17).
- Determinism note: `acceptance.at` is masked, with the property: ISO-8601 UTC `YYYY-MM-DDTHH:MM:SSZ`, within ±5 s of the act. The witness files fix it at `2026-10-27T18:00:00Z`. `acceptance.by` is the input string verbatim (NG-S5). Everything else is deterministic.

**C-S7: rerun.** New schema + previous SDD → Inventory + RerunPlan.
- **W-CS7-N:** `minimal-organization-v2.json` + `minimal/sdd.jsonld` → exit 0, → `minimal/inventory-v2.jsonld` and `minimal/rerun-plan.jsonld`.
- **W-CS7-Δ1 (one factor: removal):** `minimal-organization-v3-removed.json` (the Cost Center attribute and its attribute-mapping entry both removed) + `minimal/sdd.jsonld` → `minimal/inventory-v3.jsonld` and `minimal/rerun-plan-removed.jsonld`: `removed: ["at:Organization/Cost Center"]`, the other two `unchanged`. The next C-S6 merge moves it to `retired` with its last acceptance record.
- **W-CS7-Δ2 (one factor: identification switch):** `synthetic-it-assets-externalids.json` + `full/sdd.jsonld` (all 52 Δ15 mappings accepted) → `full/inventory-externalids.jsonld` and `full/rerun-plan-switch.jsonld`: `unchanged` and `changed` empty, every previous key `removed`, every new key `added`, `flags` = `[{"code": "FL-KEY-SCHEME-CHANGED", "key": null, "previous": "name", "current": "externalId"}]`. No silent re-keying.
- **W-CS7-Δ3 (one factor: another term list, SDD-F72):** `minimal-organization-v2.json` + `minimal/sdd.jsonld` with its `environment.termListSha256` replaced by 64 zeros → exit 0, → `minimal/inventory-v2.jsonld`; the plan has `unchanged` empty, `changed` = `["at:Organization/Cost Center", "at:Organization/Name", "ot:Organization"]`, `added` and `removed` empty, `flags` = exactly `[{"code": "FL-TERMS-CHANGED", "key": null, "previous": <64 zeros>, "current": <the bundled terms_sha256>}]`. No silent carry across term lists.
- Determinism note: fully deterministic.

## SDD §4: Data model & rules

Artifacts: `Inventory`, `Skeleton`, `PromptSet`, `CheckReport`, `RerunPlan`, `SemanticDataDictionary` (all JSON-LD;
`@context` is the bundled `https://skreen5hot.github.io/SemanticDataDictionary/context/sdd-v1.jsonld`), plus prompt
text and pasted bytes. All are **events**, immutable once written; a new round writes a new file.

- **R-S1: Canonical bytes.** Every JSON-LD artifact MUST be serialized as `JSON.stringify(value, null, 2)` + `"\n"` (UTF-8, LF), keys in the order shown by its witness file and JSON Schema (`schemas/*.schema.json`, OS-1). "sha256 of an artifact" means the sha256 of these bytes. An **item hash** (`itemSha256`) is the sha256 of the R-S1 bytes of one Inventory `objectTypes` or `attributes` entry. One exception, owned by ADR-005: `termListSha256` is the term list's own `terms_sha256` (sha256 of the compact JSON of its `terms` array). Witnesses: W-CS1-N, W-CS2-N, W-CS4-N, W-CS6-N; V-S1.
- **R-S2: Source keys.** Object type: `ot:` + esc(externalId if present, else name). Attribute: `at:` + esc(attribute externalId) if present, else `at:` + esc(owning type name) + `/` + esc(attribute name). Containment slot: `ct:` + the contained type's key. esc is RFC 6901 escaping. `source.identification` is `"externalId"` (every item has one), `"name"` (none does) or `"mixed"`. Two items yielding the same key is E-SRC-KEY-COLLISION (R-S3); this includes two containment slots for one type, so a type mapped under two containers is refused (registrar Decision C: a v1 limitation; the key format is unchanged). Witnesses: W-CS1-N, W-CS1-Δ5, W-CS1-Δ6, W-CS1-Δ11, W-CS1-Δ13; V-S2.
- **R-S3: Source validation.** C-S1 MUST validate against the vendored Atlassian schema and report each failure as E-SRC-SHAPE `{pointer, keyword, detail}`. `detail` is the missing property (`required`) or the offending value (`enum`). Umbrella `if`/`then` failures are not reported; their nested cause is. C-S1 MUST then check what that schema cannot express: E-SRC-REF-TARGET, E-SRC-MAP-TYPE, E-SRC-MAP-ATTR (an attribute neither on the type nor on an ancestor), E-SRC-DUP-TYPE, E-SRC-DUP-ATTR, E-SRC-KEY-COLLISION. Errors are reported in that order, in document order within a code; any E-SRC-SHAPE error stops the later checks, and a key already reported as a duplicate is not reported again as a collision (SDD-F71 #6, #7). An inventory with errors MUST have empty `objectTypes` and `attributes`, and C-S2 MUST refuse it (E-SKEL-ERRORED). Witnesses: W-CS1-Δ1–Δ4, W-CS1-Δ7–Δ11, W-CS2-Δ3.
- **R-S4: Hierarchy is not containment.** A `children` edge MUST become `parent` on the child type and nothing else. A mapping selector nested under another mapped type's selector MUST produce FL-CONTAINMENT and a `containment` slot. A selector is nested under another when it begins with that selector followed by `.`; the longest such selector names the container, and the type's own mappings are not candidates (SDD-F71 #2). A mapping that uses an attribute defined only on an ancestor MUST produce FL-INHERITED-USE; that attribute keeps one slot, at its defining type. Witnesses: W-CS1-Δ6, W-CS2-Δ1.
- **R-S5: Categories.** `recordClass` and `iceClass` MUST be `cco:ont00000958` (Information Content Entity) or ICE-descended (named ancestry, ADR-008), else E-CHK-CATEGORY. A `referentClass` that is ICE-descended is validated with **W-CHK-ICE-REFERENT**: some records are about information, and that judgment is the person's. **W-CHK-GENERIC** is raised for any `recordClass`, `referentClass` or `iceClass` that is in the BFO namespace or is exactly `cco:ont00000958`. When both warnings apply (a `referentClass` of exactly `cco:ont00000958`), both are raised, W-CHK-GENERIC first. Witnesses: W-CS4-Δ1, W-CS4-Δ8, W-CS4-Δ10, W-CS4-Δ11, W-CS4-Δ17.
- **R-S6: Coverage.** The proposal's mapping keys MUST equal the prompt's DATA keys, each exactly once (E-CHK-MISSING, E-CHK-DUPLICATE, E-CHK-UNKNOWN-KEY). Witnesses: W-CS4-Δ1, W-CS4-Δ2; V-S3.
- **R-S7: Terms.** Every CURIE MUST be in the cited term list (E-CHK-TERM), `permitted`, and of the field's kind: class for `recordClass`, `referentClass`, `iceClass`; object property for `relation`, or `sdd:NoRelation` in containment slots only (E-CHK-KIND). Witnesses: W-CS4-Δ3, W-CS4-Δ4; V-S6.
- **R-S8: Domain and range.** A relation's named `rdfs:domain` and `rdfs:range` come from the term list (built from the pins, OS-2); anonymous domain or range expressions are not evaluated (NG-S9). The owner (contained) type's `referentClass` MUST be or descend from **every** named domain, and the target (container) type's from every named range (E-CHK-RANGE). `sdd:NoRelation` is exempt. If either connected type's `referentClass` is not given, as a permitted class, by the same proposal (`sdd check` takes no previous SDD; SDD-F71 #18), C-S4 raises the warning **W-CHK-RANGE-UNRESOLVED** and performs no range check for that field, whether or not the relation declares a domain or range. Witnesses: W-CS4-Δ5, W-CS4-Δ15, W-CS4-Δ16.
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
  | time | `xsd:string` (lexical form of `xsd:time`) | `cco:ont00001765` has text value (the pin has no time-of-day value property; registrar Decision B keeps this fallback) |

  No artifact contains a date or time value other than `acceptance.at` and text copied from the source (Decision B); absent values follow R-S15. Falsified by V-S6. Witnesses: W-CS2-N; W-CS2-Δ1 (all 12 non-reference types occur in the full fixture).
- **R-S10: Human-only fields.** A proposal MUST NOT contain `nullEquivalents`, `acceptance`, `decision`, `datatype` or `valueProperty` (E-CHK-HUMAN-FIELD). Witness: W-CS4-Δ6.
- **R-S11: Prompt construction.** A prompt MUST be `spec/prompt-template-v2.txt` with its placeholders filled: skeleton hash, term-list hash, batch label, round; ERRORS = empty for round 1, else R-S22's block; DATA = one line per slot, in skeleton order, each `JSON.stringify` (no spaces), with U+2028 and U+2029 then written as the escapes `\u2028` and `\u2029` so that no DATA line contains a line or paragraph separator, of exactly these fields — type `{key, kind, name, description, parent, selectors}`; attribute `{key, kind, name, description, owner, jiraType}`; reference `{key, kind, name, description, owner, target}`; containment `{key, kind, child, container, selector}`; CATALOGUE = three sections, each opened by its header line: `# Information Content Entity classes (recordClass, iceClass)` (`cco:ont00000958` and its named descendants), `# Other classes (referentClass)`, `# Object properties (relation)`; permitted terms only, lines `curie<TAB>label` sorted by CURIE within a section (SDD-F71 #14). **Source text MUST appear only as JSON string values inside DATA.** A *line* is a maximal LF-delimited byte sequence; the prompt contains no CR byte and no U+2028 or U+2029 code point. **Placeholders are substituted in a single pass over the template (SDD-F69):** each `{{NAME}}` occurrence in the template is replaced by its value, and inserted text is never scanned again, so placeholder-like text in source data (e.g. a description containing `{{CATALOGUE}}`) stays inert and appears verbatim, JSON-escaped, in its DATA line. Witnesses: W-CS3-N, W-CS3-Δ1, W-CS3-Δ6, W-CS3-Δ7, W-CS5-N; V-S4.
- **R-S12: Batching.** Budget unit: **UTF-8 bytes** (default 200,000; `--budget`). A batch's size is the byte length of its prompt rendered with batch label `1/1` and round `1` (a label-independent measure, so batching never depends on the batch count; emitted prompts can differ by the label's extra digits). If the prompt with an empty DATA block exceeds the budget, C-S3 MUST fail with E-PROMPT-BUDGET. Otherwise C-S3 MUST fill batches greedily with whole object-type groups in skeleton order (a group is a type slot followed by its attribute, reference and containment slots). A group that alone exceeds the budget forms its own batch and adds W-PROMPT-OVERSIZE `{code, key, bytes, budget}` (the group's type key, its size, the budget) to the PromptSet, in group order. *Exceeds* means strictly greater (SDD-F71 #15, #16). Witnesses: W-CS3-Δ2, W-CS3-Δ4, W-CS3-Δ5.
- **R-S13: Answer extraction.** C-S4 MUST take the JSON object from the paste: the whole paste (trimmed) if it is one JSON object, else the content of exactly one ```` ```json ```` fenced block. Otherwise it MUST report E-CHK-JSON and stop. The object MUST then validate against the pinned, versioned proposal schema `schemas/proposal-v1.schema.json` (§11 registry); the first failure is reported as E-CHK-SHAPE (`value` = its JSON Pointer) and stops further checks. The schema is the authoritative output contract; the prompt carries a concise statement of it and an example, never a weaker one (ADR-004.1 as amended). Next, the reply's `skeletonSha256` and `batch` MUST equal the prompt's (E-CHK-SKELETON, E-CHK-BATCH; each stops further checks). Witnesses: W-CS4-N, W-CS4-Δ7, W-CS4-Δ9, W-CS4-Δ12, W-CS4-Δ14.
- **R-S14: Validated is not accepted.** `CheckReport.status` ∈ {`validated`, `rejected`}; `validated` iff `errors` is empty. Warnings never block. No field value or message the tool itself composes MAY describe a validated proposal as "correct", "approved", "accepted" or "verified"; text the tool only copies (an LLM `rationale`, keys, values, source names and descriptions) is outside this rule and is always presented as quoted (SDD-operator RV-O3, RV-O4). Only C-S6 output carries `acceptance`. Witnesses: W-CS4-N, W-CS4-Δ8, W-CS6-N. Experience side: SDD-operator PR-O4.
- **R-S15: Absence semantics (ADR-003).** Every SDD MUST declare `"absenceKinds": ["missing", "explicit_null", "empty_string", "indistinguishable"]`, and every attribute mapping MUST carry `nullEquivalents` (default `[]`, sorted, set only through C-S6 decisions). No SDD field asserts anything about a referent from absence. Witnesses: W-CS6-N, W-CS6-Δ4.
- **R-S16: Context.** An input whose `@context` is not the bundled context IRI MUST be refused (E-CTX-EXTERNAL) without dereferencing. Witness: W-CS2-Δ2.
- **R-S17: Rerun matching.** Items match across schemas by key. A matched item is `unchanged` iff its current `itemSha256` equals the previous SDD's `source.itemSha256`, else `changed`. Arrays are sorted. In C-S6's merge, `unchanged` mappings MUST be carried byte-identical, `changed` ones MUST become `open`, and `removed` ones MUST move to `retired` with their last acceptance record. **A term-list change supersedes every acceptance (§11; SDD-F72):** if the previous SDD's `environment.termListSha256` differs from the bundled term list's `terms_sha256`, C-S7 marks no item `unchanged` (every matched item is `changed`) and adds FL-TERMS-CHANGED, and C-S6's `--previous` merge carries no mapping (each previously mapped key that is still a slot and is not decided in this act becomes `open`; removed keys still move to `retired`). Witnesses: W-CS7-N, W-CS7-Δ1, W-CS7-Δ2, W-CS7-Δ3, W-CS6-Δ10; V-S5.
- **R-S18: Acceptance is bound to validated checks.** C-S6 MUST refuse unless every supplied report is `validated` (E-ACC-UNVALIDATED), sha256(paste) = `report.proposalSha256` (E-ACC-MISMATCH), and `report.skeletonSha256` = sha256(skeleton) (E-ACC-MISMATCH). Each decided key MUST be covered by some supplied report (E-ACC-UNCOVERED); its mapping and provenance come from the covering report with the highest `round`. Only decided keys change state. Witnesses: W-CS6-Δ1, W-CS6-Δ3, W-CS6-Δ6, W-CS6-Δ7, W-CS6-Δ8, W-CS6-Δ9; V-S5.
- **R-S19: Flags.** Flags never block. They are sorted by code, then key (JavaScript string order): FL-CONTAINMENT (with `container`), FL-INHERITED-USE (with the inherited attribute names, sorted), FL-NO-LABEL (neither the type nor any ancestor has a `label` attribute), FL-SELECT-VALUES-UNKNOWN (every `select` attribute), FL-UNMAPPED-TYPE, FL-KEY-SCHEME-CHANGED and FL-TERMS-CHANGED (C-S7 only). Each flag is `{code, key}` plus: FL-CONTAINMENT `container`, `selector`; FL-INHERITED-USE `attributes`; FL-KEY-SCHEME-CHANGED `previous`, `current` (with `key: null`); FL-TERMS-CHANGED `previous`, `current` (the two term-list hashes, with `key: null`). Witnesses: W-CS1-Δ6, W-CS7-Δ2; the flags of `full/inventory.jsonld`.
- **R-S20: Check order and precedence.** C-S4 MUST run R-S13 first; any failure there stops it. It then reports coverage errors (R-S6): E-CHK-MISSING and E-CHK-DUPLICATE in skeleton order, then E-CHK-UNKNOWN-KEY in proposal order. Then, for each mapping whose key is a slot, in skeleton order: R-S10 (each human-only field present is one E-CHK-HUMAN-FIELD); then the field set: the mapping's other fields MUST be exactly `{key, recordClass, referentClass, rationale}` (type), `{key, iceClass, rationale}` (attribute) or `{key, relation, rationale}` (reference, containment), else one E-CHK-FIELDS and no field check for that mapping; then it checks the fields in the order `recordClass`, `referentClass`, `iceClass`, `relation`. Each field runs R-S7 (term, then kind), then R-S5 (category), then R-S8 (range), and **stops at the first error**. Warnings for a field are raised only if it has no error. Errors and warnings are listed in that traversal order. Witnesses: W-CS4-Δ1, W-CS4-Δ3, W-CS4-Δ4, W-CS4-Δ6, W-CS4-Δ10, W-CS4-Δ13.
- **R-S21: Messages.** Every error and warning in a CheckReport MUST carry `{code, key, field, value, rule, message}`, with `message` filled from a fixed template (`label` is the term list's label for `value`): E-CHK-CATEGORY `"{field} {value} ({label}) is not cco:ont00000958 (Information Content Entity) or a subclass of it."` · E-CHK-MISSING `"Slot {key} has no mapping in this batch."` · E-CHK-DUPLICATE `"Slot {key} is mapped more than once."` · E-CHK-UNKNOWN-KEY `"{key} is not a slot in this batch."` · E-CHK-TERM `"{field} {value} is not in the term list."` · E-CHK-KIND `"{field} {value} is not a permitted {expected} term."` · E-CHK-RANGE `"{field} {value} does not admit the referent classes it connects (domain/range)."` · E-CHK-HUMAN-FIELD `"{field} can only be set by a person at acceptance."` · E-CHK-JSON `"The reply does not contain exactly one JSON object."` · E-CHK-SHAPE `"The reply does not match the proposal schema at {value} ({keyword})."` · E-CHK-FIELDS `"{key} must have exactly the fields {expected}."` · E-CTX-EXTERNAL `"The file's @context is not the bundled SDD context."` (`{expected}` is `class` for `recordClass`, `referentClass` and `iceClass` and `object property` for `relation` in E-CHK-KIND, and the slot kind's field list in R-S20 order, joined by ", ", in E-CHK-FIELDS) · E-CHK-SKELETON `"The reply names a different skeleton than the prompt."` · E-CHK-BATCH `"The reply names batch {value}; the prompt is batch {batch}."` · W-CHK-GENERIC `"{field} {value} ({label}) is a top-level class; check it is specific enough."` · W-CHK-ICE-REFERENT `"referentClass {value} ({label}) is information content; check the record is about information."` · W-CHK-RANGE-UNRESOLVED `"{field} {value}: the domain/range check needs a referentClass not yet mapped."` Witnesses: W-CS4-Δ1 (two templates, literal), W-CS4-Δ8, W-CS4-Δ13, W-CS4-Δ14, W-CS4-Δ16.
- **R-S22: Repair.** C-S5 MUST refuse a validated report (E-REPAIR-NOTHING). Otherwise its output is R-S11's prompt with the **same DATA lines** as the checked prompt, round = `report.round` + 1, and ERRORS = `"\nERRORS IN YOUR PREVIOUS REPLY\nYour previous reply for this batch was rejected for the reasons below. Return the complete corrected mapping set for every DATA line, not only the lines named here.\n"` followed by one `JSON.stringify` line per error, in report order, then `"\n"`. A repair reply is checked by C-S4 against the repair prompt, like any reply. Witnesses: W-CS5-N, W-CS5-Δ1, W-JS2.
- **R-S23: CLI input and output.** Every command MUST write only to stdout or to new paths. A `--out` or `--out-dir` target that exists MUST be refused with exit 2 and E-OUT-EXISTS, leaving it untouched. Unreadable input is exit 2 with E-IO; bad arguments are exit 2 with E-USAGE. Inputs that are each readable but do not belong together (a skeleton not built from the given inventory or citing another term list, a prompt not built from the given skeleton, a report that does not answer the given prompt, a `--keys` list that is empty or names a non-slot) are bad arguments. A *refusal* (E-CTX-EXTERNAL, E-SKEL-ERRORED, E-PROMPT-BUDGET, E-REPAIR-NOTHING) is exit 1 with no artifact written; only a domain report (an Inventory or CheckReport holding errors) is written at exit 1. Whenever nothing is written, stderr carries one line: a JSON object whose `code` is the error code (other members, such as `message`, MAY follow). (SDD-F71 #11–#13.) Witnesses: W-CS6-Δ5, W-CS1-Δ12, W-CS4-Δ18; V-S5.

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
| S-S1 | parse → skeleton, prompt, repair, accept | Inventory | `minimal/inventory.jsonld` (`902ab965`) | filled |
| S-S2 | skeleton → prompt, check, repair, accept | Skeleton | `minimal/skeleton.jsonld` (`e990dbb3`) | filled |
| S-S3 | terms → prompt, check | term list | `ontology/term-list.json`, `terms_sha256` `a9e01756` | filled |
| S-S4 | check → repair | rejected CheckReport | `minimal/bad-check-report.jsonld` (`981fe147`) | filled |
| S-S5 | check → accept | validated CheckReport | `minimal/check-report.jsonld` (`552fa6c8`) | filled |
| S-S6 | rerun → the person (forms the `--keys` list) and accept (`--previous` merge, R-S17) | RerunPlan | `minimal/rerun-plan.jsonld` (`4e09c7bb`) | filled |
| S-S7 | accept → rerun; → consumers | SemanticDataDictionary | `minimal/sdd.jsonld` (`d311d909`) | filled |
| S-S8 | prompt → person, check | PromptSet | `minimal/prompt-set.jsonld` | filled |
| **S-O1** *(cross-document, mirrored in SDD-operator §8)* | SDD C-S3/C-S5 → copy control → clipboard | prompt bytes | `minimal/prompt.txt` → clipboard bytes with sha256 `7f121f7a` | filled |
| **S-O2** | paste box → SDD C-S4 | pasted bytes | `minimal/proposal-pasted.txt` → C-S4 input with sha256 `7d3a9546` | filled |
| **S-O3** | CV-O2 → SDD C-S6 | decisions | `{"by": "Aaron Damiano", "decisions": [{"key": "ot:Organization", "decision": "accept"}, {"key": "at:Organization/Name", "decision": "accept"}, {"key": "at:Organization/Cost Center", "decision": "accept"}], "nullEquivalents": {}}` | filled |
| **S-O4** | SDD C-S4 → rows | CheckReport | `minimal/bad-check-report.jsonld` (`981fe147`) → the 2 rows of W-PRO5-N | filled |
| **S-O5** | SDD C-S1 → summary line | Inventory | `minimal/inventory.jsonld` (`902ab965`) → `1 object type · 2 attributes · 0 references · 0 flags` | filled |
| **S-O6** | SDD C-S6 → download | SemanticDataDictionary | `minimal/sdd.jsonld` (`d311d909`) → downloaded bytes, equal except `acceptance.at` | filled |

## SDD §7: Invariants & properties

Generator **G1**: random Jira Assets schemas valid against the vendored Atlassian schema. Each has 1–40 object types
in trees of depth ≤ 4; 0–12 attributes per type over the 13 types; 0–3 references per type, including self and
ancestor targets; 0–2 nested selectors; per-item random `externalId` presence (name, externalId and mixed
identification all occur); descriptions from corpus **K1** (plain text, quotes, backslashes, newlines, non-BMP
Unicode, U+2028, the literal lines `-----END DATA-----` and `-----BEGIN CATALOGUE-----`, instruction-like text).
Seeded; seeds recorded with each run.

- **V-S1: Determinism and platform parity.** Scope: every output of C-S1–C-S5 and C-S7, and C-S6 outputs except `acceptance.at`. Generator: all fixtures + G1, n ≥ 200. Property: two runs give identical bytes, and the Node CLI and the browser build give identical bytes. Pinned: W-CS1-N, W-CS2-N, W-CS3-N, W-CS4-N.
- **V-S2: Key soundness.** Scope: every C-S1 run. Generator: G1, n ≥ 200, each schema also permuted (array order shuffled) and with descriptions edited. Property: either the keys are unique, or C-S1 reports E-SRC-KEY-COLLISION naming every colliding key; the key set is invariant under permutation and description edits; every key unescapes (RFC 6901) to its source identifier; flags are sorted and shaped per R-S19; no slot is derived from a `children` edge, and every nested selector yields exactly one containment slot (R-S4). Pinned: W-CS1-Δ5, W-CS1-Δ6, W-CS1-Δ11.
- **V-S3: Coverage closure** *(interaction: batching × coverage)*. Scope: (skeleton, budget, proposal) triples. Generator: G1 × budgets {69,000, 200,000} × proposals derived from a correct one by dropping, duplicating or renaming 0–3 keys, n ≥ 200 triples; plus budget 50,000 on every schema. Property: `validated` ⇒ mapping keys = the prompt's DATA keys exactly; every mutation is caught with its code; the batches' DATA keys partition the skeleton's slot keys; every batch boundary is forced (adding the next group would exceed the budget, R-S12 greedy fill); budget 50,000 ⇒ E-PROMPT-BUDGET. Pinned: W-CS4-Δ1, W-CS4-Δ2, W-CS3-Δ2, W-CS3-Δ5.
- **V-S4: Untrusted text containment** *(interaction: hostile text × escaping)*. Scope: every prompt and repair prompt. Generator: G1 with K1 descriptions, n ≥ 200. Property: (i) every DATA line parses as JSON, and every source string occurs only as a JSON-escaped value inside DATA; (ii) exactly one LF-delimited line equals `-----END DATA-----`, and the prompt contains no CR, U+2028 or U+2029; (iii) for two schemas that differ only in descriptions and fit in one batch, the prompts differ only inside DATA lines and in the 2 occurrences of the skeleton hash. Pinned: W-CS3-Δ1.
- **V-S5: Acceptance monotonicity** *(interaction: rounds × rejection × schema change)*. Scope: sequences of C-S3–C-S7 operations. Generator: random sequences of length ≤ 30 over G1 schemas, with random pastes (valid, invalid, hostile) and decisions, n ≥ 100 sequences. Property: the accepted set changes only at C-S6 steps, only for decided keys or keys moved by R-S17; carried mappings are byte-identical; C-S3, C-S4 and C-S5 never change it. In the same runs: no message the CLI composes contains an R-S14 word (R-S14); every command given an existing `--out`/`--out-dir` target exits 2 with E-OUT-EXISTS and leaves it unchanged (R-S23); every command given a JSON-LD input whose `@context` is foreign exits 1 with E-CTX-EXTERNAL and the network guard logs no attempt (R-S16). Pinned: W-JS2, W-JS3, W-JS4, W-CS6-Δ1, W-CS6-Δ5.
- **V-S6: Term closure.** Scope: every SDD produced in V-S5 runs (≥ 100). Property: every CURIE is in the term list the SDD records, permitted, and of its field's kind; every `recordClass` and `iceClass` is ICE-descended; `absenceKinds` is present and every `nullEquivalents` is sorted (R-S15); no value matching an ISO-8601 date or time appears except `acceptance.at` and text copied from the source (R-S9). Pinned: W-CS6-N, W-CS6-Δ4.

## SDD §8: Envelopes

Reference machine: `bench/config.json` (OS-6), Node 22 LTS; measured by `bench/run.mjs`, appended to `bench/results.jsonl`.
- **E-S1:** C-S1 → C-S4 on `synthetic-it-assets.json` ≤ 2 s wall-clock (CLI, cold).
- **E-S2:** C-S4 on a 5,000-slot G1 schema's full proposal ≤ 5 s.
- **E-S3:** the default-budget prompt for `synthetic-it-assets.json` is one batch of ≤ 200,000 bytes (the author's reference computation gives 70,855).

## SDD §9: Non-goals

- **NG-S0, experience level:** `{status: delegated(SDD-operator, sdd-operator.md); scope: the SDD Service product boundary (core, CLI, HTML tool); authority: the registrar; as-of: registry v0.4}`, discharged through WV-1.
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
execution against the implementation in a clean environment before a gate consumes it. *Status (2026-10-29): met.
Every W-\* is executed against the implementation by the independent judge `tools/run-witnesses.mjs`, inside a clean
container with networking disabled and the H-O2 network guard preloaded (H-S1; the Operator acceptance workflow on
`ubuntu-24.04`), with an empty guard log.*

`Disposition: per method §6` · `Acceptance readiness: BLOCKED — SDD-operator OO-2`

## SDD §11: Change discipline

**Witness registry (authoritative hashes).** Ver *n* = the file last changed in spec v0.*n* (4.1 = the F67–F70 correction pass). Every witness file a chain, witness or seam names is listed (SDD-F59). Version-1 files superseded by
prop-001 are retained under `fixtures/witnesses/superseded/v1/` with their v1 hashes.

| File | Ver | sha256 | Cited by |
|---|---|---|---|
| `fixtures/jira-assets/hostile-placeholders.json` | 4.1 | `0d5e238cb90a87418994d556d467a2900f61357454fafb4ebdefcec9290471ab` | W-CS3-Δ7 |
| `fixtures/jira-assets/hostile-separators.json` | 4 | `9c2b74a5146c00492b6f073d3f0370f736f3e807e5dd4ea1be18f327e227caf7` | W-CS3-Δ6, W-PRO6-Δ2 |
| `fixtures/jira-assets/invalid/duplicate-attribute-name.json` | 2 | `356f2b8f4b92a50684426611409222a62ea05f5d6057e744b1d6820558c47557` | W-CS1-Δ10 |
| `fixtures/jira-assets/invalid/duplicate-object-type-name.json` | 1 | `158036c4c703ce42e269583aae6e63ad47912f76ee0b345abe551d3cfd6d7efb` | W-CS1-Δ4 |
| `fixtures/jira-assets/invalid/key-collision.json` | 2 | `7abce9aa6f6a0eef0a1dfcfbd64476d2a0df01807d6ee5c0034cd677b1835550` | W-CS1-Δ11 |
| `fixtures/jira-assets/invalid/mapping-unknown-attribute.json` | 1 | `1b9f1cdcbdf780e1ae9b5d9068039634c5b2dd8224f4033ac0d39e0d6b514c18` | W-CS1-Δ3 |
| `fixtures/jira-assets/invalid/mapping-unknown-type.json` | 2 | `c8d3d96cb64f1ba0f6670891ef97882dc3c80f7063dc53693f8a4ff44b55af3f` | W-CS1-Δ9 |
| `fixtures/jira-assets/invalid/missing-attribute-type.json` | 1 | `fff2af590e085490667ea8356aee965cac6773e16ca250089a1adcc0b27d7770` | W-CS1-Δ1 |
| `fixtures/jira-assets/invalid/reference-without-target.json` | 1 | `a709d1457d65fc7bab1fb00367c4839d8b0f3f43810d3e06499c4322ac1d969c` | W-CS1-Δ8 |
| `fixtures/jira-assets/invalid/two-containers.json` | 4.1 | `f747a948434d84438324d90255b954aa01cf9e1b0d37a06e572411ec9495d79b` | W-CS1-Δ13 |
| `fixtures/jira-assets/invalid/unknown-attribute-type.json` | 1 | `0f754ada66d9d471716c92035fc29ee71ba0221cf8585ee51cc165567a840304` | W-CS1-Δ7 |
| `fixtures/jira-assets/invalid/unknown-reference-target.json` | 1 | `ef2337610680a27c2d00e1e9dd80bba8e99c94d666d4ec11fb445706c059c398` | W-CS1-Δ2 |
| `fixtures/jira-assets/minimal-organization-v2.json` | 2 | `e86ef883322aa194ed10bda51118d02a9b0ddc51892d09d781514e9b11f5373b` | H-S1, W-CS7-N, W-CS7-Δ3, W-JS3, W-PRO1-Δ6 |
| `fixtures/jira-assets/minimal-organization-v3-removed.json` | 4 | `0ced1f7e469fd90db9aaec1bd4cb317c871129341822836c84c90f8b16144ad7` | W-CS7-Δ1 |
| `fixtures/jira-assets/minimal-organization.json` | 1 | `3239b1f085d090c71027032833831cf151b28ec90a935e01788b992ec6363869` | H-S1, W-CS1-N, W-JO1, W-PRO1-Δ6 |
| `fixtures/jira-assets/synthetic-it-assets-externalids.json` | 1 | `b6692a952b16c198499c4268938636dcf80f01a8956b66b7b000351e1d59c750` | W-CS1-Δ5, W-CS7-Δ2 |
| `fixtures/jira-assets/synthetic-it-assets.json` | 1 | `2794d08cdf3a87d72151d4c8dc84ac999291010bf04ccc5ca8d22ad736b4eded` | E-S1, E-S3, W-CS1-Δ6 |
| `fixtures/witnesses/full/check-report-batch2.jsonld` | 4 | `9908fa5122c725dbaecde831136f66e568e82213e783e81379bddd2a6f0c79e7` | W-CS4-Δ16 |
| `fixtures/witnesses/full/check-report-range.jsonld` | 4 | `63936cbe766233b205c29939e651279d2e6b9824350949f6b47ddf35c63ccabc` | W-CS4-Δ5 |
| `fixtures/witnesses/full/check-report-valid.jsonld` | 4 | `0b871856721f021036238aa9e99bcbe53a041f16badbfbb8c774d5116e890e8e` | W-CS4-Δ15 |
| `fixtures/witnesses/full/inventory-externalids.jsonld` | 4 | `1fe97aa53077bf383800857870731c817df7d806ffa582859217b9d06016d2e0` | W-CS7-Δ2 |
| `fixtures/witnesses/full/inventory.jsonld` | 4 | `1db35f4f744fece9e4c018982b182cef3deaf5a7eaeb0274936ac95d16058fd8` | R-S19, W-CS1-Δ6 |
| `fixtures/witnesses/full/prompt-1-of-2.txt` | 4 | `5727e10f0ee3f9d3c54924bf925400cba432243f05b2368b5b0ceda00df6f556` | W-CS3-Δ2, W-PRO6-Δ1 |
| `fixtures/witnesses/full/prompt-2-of-2.txt` | 4 | `d47df8f76a249c99141d4f27eb9a11d43aa13c736694cf626c8481f80f10678c` | W-CS3-Δ2, W-CS4-Δ16, W-PRO6-Δ1 |
| `fixtures/witnesses/full/prompt.txt` | 4 | `13fdfcb117fb2f48dd57673ddaf14a1d54d5375eebc11528b52133a161721dd0` | W-CS4-Δ5, W-CS4-Δ15 |
| `fixtures/witnesses/full/proposal-batch2.txt` | 4 | `d61332a9190e19c257f980fbd6f98aad8f0c71eac6030a82262fd48dae115f98` | W-CS4-Δ16 |
| `fixtures/witnesses/full/proposal-range.txt` | 4 | `86f399d9de1e8760e9845188df86c5dc6a7ed731fa9fe377c0686257a6be395c` | W-CS4-Δ5 |
| `fixtures/witnesses/full/proposal-valid.txt` | 4 | `35b8ea337aabea99e792d29a0bd5e8210d17f98bbda1c64387a204446da6e429` | W-CS4-Δ15 |
| `fixtures/witnesses/full/rerun-plan-switch.jsonld` | 4 | `134c43dac1be14d268fd07bc5209e1f0043eda274f1bd019c05ec78bec974b75` | W-CS7-Δ2 |
| `fixtures/witnesses/full/sdd.jsonld` | 4 | `ea9a77a61ddae9583811a67a188c4e42beb64b4229a557ced0a6d242113a0cff` | W-CS7-Δ2 |
| `fixtures/witnesses/full/skeleton.jsonld` | 4 | `2b309d2d0b201923ae3ce5057e0217d24e339881a963692671c3da206aa78616` | W-CS1-Δ6, W-CS4-Δ5, W-CS4-Δ15 |
| `fixtures/witnesses/hostile/inventory.jsonld` | 4 | `45287065c3675e5486cfb47e7c3efd40acde59f619a4c19ce8818bc78eac0b89` | W-CS3-Δ6 |
| `fixtures/witnesses/hostile/placeholders-inventory.jsonld` | 4.1 | `afe3f6e3c3ff35aada713c600070bab33a66ce3a3c23d2ed337ddef45e82961b` | W-CS3-Δ7 |
| `fixtures/witnesses/hostile/placeholders-prompt.txt` | 4.1 | `a21325de5b1da71f50a6db07f376cc45a0db9c9b1aad1fcae17e4e7d4f8fd9d3` | W-CS3-Δ7 |
| `fixtures/witnesses/hostile/placeholders-skeleton.jsonld` | 4.1 | `e53bda6626ec041919f101cb1cc9ae3da0202f9da824849b0d47c03388dac062` | W-CS3-Δ7 |
| `fixtures/witnesses/hostile/prompt.txt` | 4 | `d18c9b86a228033d67fe11a441f2a8ab0c227a9c44c5e8021722a1ec5f2a628e` | W-CS3-Δ6, W-PRO6-Δ2 |
| `fixtures/witnesses/hostile/skeleton.jsonld` | 4 | `f6c464a9e92487e9f6c301f5e27f29afef356525f9f2c9a040f799b131f65fdc` | W-CS3-Δ6 |
| `fixtures/witnesses/minimal/bad-check-report.jsonld` | 4 | `981fe147072fa2ba4eac652875070c3156e3cf15751777e5761c188dba17f84b` | S-O4, S-S4, W-CS4-Δ1, W-CS5-N, W-JS2 |
| `fixtures/witnesses/minimal/bad-proposal.txt` | 4 | `8a227d43ea6603ad4110fbacb8df81b6b87bf9f3ca39abb74fea106f89162282` | W-CS4-Δ1, W-JO2, W-JS2, W-PRO3-N |
| `fixtures/witnesses/minimal/check-report-open.jsonld` | 4 | `075052bc8ce9237965ce4f47135fe673ad5644b8cc56ab6cb73b6ab1757fd165` | W-JS4 |
| `fixtures/witnesses/minimal/check-report-rerun.jsonld` | 4 | `58e92f706ff928b88d20329ff6d427e74f06d12068332142bb8e8f97a91ee17c` | W-JS3 |
| `fixtures/witnesses/minimal/check-report-round2.jsonld` | 4 | `72e726b51537d8a3e47635468cebd303bfa5db6facbcab72b88d347860bc052c` | W-CS6-Δ9, W-JS2 |
| `fixtures/witnesses/minimal/check-report.jsonld` | 4 | `552fa6c873611e7aace29d27fbd76e8ac52e8d343d276fe3df3ea52c890dfd3d` | S-S5, W-CS4-N, W-CS6-Δ9, W-JS1 |
| `fixtures/witnesses/minimal/inventory-v2.jsonld` | 2 | `0ea0045b7131f75356dafb2759250e97edeeab52cfec7ba67b6a2be9f6e47613` | W-CS7-N, W-CS7-Δ3, W-JS3 |
| `fixtures/witnesses/minimal/inventory-v3.jsonld` | 4 | `58ae56066dc8132857d7e62093c6df0c2f05b1c25becdd2dd49a80bd48b20343` | W-CS7-Δ1 |
| `fixtures/witnesses/minimal/inventory.jsonld` | 1 | `902ab965e1d220a172944d758f2cf3931e8541a8e1c3000a3d82b13487e630ed` | S-O5, S-S1, W-CS1-N, W-CS2-N, W-CS3-N, W-JS1 |
| `fixtures/witnesses/minimal/keys-open.json` | 4 | `865ce456f7c0c708448fed13e267169d171d5fde96c68ea4319908f5152f69e5` | W-JS4 |
| `fixtures/witnesses/minimal/keys-rerun.json` | 4 | `865ce456f7c0c708448fed13e267169d171d5fde96c68ea4319908f5152f69e5` | W-JS3 |
| `fixtures/witnesses/minimal/prompt-open.txt` | 4 | `7b7791a63b7dc49e3fc342cecbeb01f8fe8e828b372c5d32944ff71b73c3105d` | W-JS4 |
| `fixtures/witnesses/minimal/prompt-rerun.txt` | 4 | `05aa533075216937dfe8a33929bf0a50dbc9182977f2838d99bc8cd795b45916` | W-JS3 |
| `fixtures/witnesses/minimal/prompt-set.jsonld` | 4 | `62ab24f870e21290c3e2b6578c79d9c6859f15ae266856882a4b7971073ba27b` | S-S8, W-CS3-N |
| `fixtures/witnesses/minimal/prompt.txt` | 3 | `7f121f7a15ed3f67563c10d2038c2722c87e92fab7160eae37bdcc3e78cbcc3c` | S-O1, W-CS3-N, W-CS4-N, W-CS5-N, W-JO1, W-JS1, W-PRO6-N |
| `fixtures/witnesses/minimal/proposal-open.txt` | 4 | `6537840cf5c054a5e813ea6f4bf27cf7c97bb06a325031168ea629b9c91c1a46` | W-JS4 |
| `fixtures/witnesses/minimal/proposal-pasted.txt` | 4 | `7d3a9546da8c8ab55b25ec8e0e6e761c12529855de54fb280b47c8935d3be91b` | S-O2, W-CS4-N, W-JO1, W-JO2, W-JO4, W-JS1, W-JS2, W-PRO1-Δ2, W-PRO4-Δ2, W-PRO4-Δ3, W-PRO5-Δ1 |
| `fixtures/witnesses/minimal/proposal-rerun.txt` | 4 | `e7ed529bd3440ee30fbee4028141aa483fa7f2857dc33a0278ebb3f811127351` | W-JS3, W-PRO1-Δ6 |
| `fixtures/witnesses/minimal/repair-prompt.txt` | 4 | `e14d07015a3d8d33cc586f6ce2b72bd86797e6fbe6b439f85e47aa0f347b1a86` | W-CS5-N, W-JO2, W-JS2, W-PRO5-N |
| `fixtures/witnesses/minimal/rerun-plan-removed.jsonld` | 4 | `d739af913a63a0f783fd5ad18c05b90fb70a3c44cb7330e00f0a7d9278d88414` | W-CS7-Δ1 |
| `fixtures/witnesses/minimal/rerun-plan.jsonld` | 4 | `4e09c7bbe63d5a11faea0e8f7eec02d645bf70f5cd3342c0addd1540dfa4e0f5` | S-S6, W-CS7-N, W-JS3 |
| `fixtures/witnesses/minimal/sdd-j4.jsonld` | 4 | `1990267916386cc6be2ae2f8fee2b31fd72e79cfcdfb1c2dd5e1ff2496a1e601` | W-JS4 |
| `fixtures/witnesses/minimal/sdd-partial.jsonld` | 4 | `769ddf341e8a55907f545da426271ee677e3a571588d712a811d7f3090577091` | W-CS6-Δ2, W-JS4, W-PRO1-Δ5 |
| `fixtures/witnesses/minimal/sdd-round2.jsonld` | 4 | `a05cff1a945158c98ce4ff534fc061b1e128b7ca1f44e13e4a51fd5434f65160` | W-CS6-Δ7, W-CS6-Δ9, W-JO2, W-JS2 |
| `fixtures/witnesses/minimal/sdd-v2.jsonld` | 4 | `cae6b1aaf6e43b38b5bda92084842ce100352b41a7a226ebe3929fde27d6c767` | W-JS3, W-PRO1-Δ6 |
| `fixtures/witnesses/minimal/sdd.jsonld` | 4 | `d311d909a03fe3bb193dd60f51c6086127c18fc86764420de4004fc3ce4e07f3` | OS-1, S-O6, S-S7, W-CS6-N, W-CS6-Δ10, W-CS7-N, W-CS7-Δ1, W-CS7-Δ3, W-JO1, W-JO3, W-JS1, W-JS3, W-PRO1-N, W-PRO1-Δ6 |
| `fixtures/witnesses/minimal/skeleton-v2.jsonld` | 4 | `60411c630940a686335e005622284427b07384650c4668721216a392d5196bef` | W-CS6-Δ8, W-JS3 |
| `fixtures/witnesses/minimal/skeleton.jsonld` | 3 | `e990dbb36831aa769a09a7d5df64d396698511482c3ba849064353500ff9de57` | S-S2, W-CS2-N, W-CS3-N, W-CS4-Δ18, W-JS1 |
| `schemas/inventory-v1.schema.json` | 4.1 | `d99750e46f7a0ea7e5b5ec7712168cab65b2b5d972580763f87f5daf5c10b080` | OS-1 |
| `schemas/skeleton-v1.schema.json` | 4.1 | `b0dae470dc9bcb8b3a857d624376287af28d185cf400683e2beea1c2ed7b006d` | OS-1 |
| `schemas/prompt-set-v1.schema.json` | 4.1 | `6f78b0ca38274d52758ffb691369b1e32176d8eff48d5befc7ec812b65f72b45` | OS-1 |
| `schemas/check-report-v1.schema.json` | 4.1 | `e1605720e831110077265fd20ccdf2732e0f1c152d5972ce18114b9f2377f7f9` | OS-1 |
| `schemas/rerun-plan-v1.schema.json` | 4.1 | `49f3b3bf9ba6c6273061a4fe2f6583995f2b5cee9e52e30428ac4b96a6ad2119` | OS-1 |
| `schemas/sdd-v1.schema.json` | 4.1 | `13e207f8e20afe7c5f5174d6ea6451b80fc93a6a8eeb6b7e6aaf9acc025fe2af` | OS-1 |
| `schemas/proposal-v1.schema.json` | 2 | `c722a5cc7ba3c04233302698f0efb42701e373ade153e0a87c628ada73f7f631` | R-S13 |
| `spec/prompt-template-v2.txt` | 2 | `78c0635dd8f2c20de38d3f74a0a39e70d747231b95d81783a06c7ca45914cd59` | R-S11 |
| `ontology/term-list.json` | ADR-005 | `terms_sha256` `a9e01756d749655a53088833bb97612791caf9a19220065848c826f99985cd39` | S-S3, every term-bearing witness |

**Superseded files (retained; never cited by a current witness, enforced by `tools/witness-check.mjs`).**

| File | Current in | sha256 |
|---|---|---|
| `fixtures/witnesses/superseded/v1/bad-check-report.jsonld` | v0.1 | `7d7e42392fb2ede15330011f34badceb40f36b38e19ced94c05d9a40fd7b71b4` |
| `fixtures/witnesses/superseded/v1/check-report.jsonld` | v0.1 | `1dbc907c8bf3a33f285694884d0fa82bbd81a8c7294dce108e4288ac2ac9caea` |
| `fixtures/witnesses/superseded/v1/prompt-template-v1.txt` | v0.1 | `247a6a88b74d0cbecdca90989612f291c331fcb5cbb27a81d0323b71a3600439` |
| `fixtures/witnesses/superseded/v1/prompt.txt` | v0.1 | `4082dfe59066a7c803d41c5f080edf4304b441b435cceed21f6e31aa04d2cafc` |
| `fixtures/witnesses/superseded/v2/full/prompt-1-of-2.txt` | v0.2 | `106c0c899600a2025b1a8662f2b1590640df585e3e6202f35f64c6c637bd1287` |
| `fixtures/witnesses/superseded/v2/full/prompt-2-of-2.txt` | v0.2 | `a98f5432a336f82f2d64fa4b22dcf9b4ac4ecc8f9669e3ce33cae392a76753cb` |
| `fixtures/witnesses/superseded/v2/minimal/bad-check-report.jsonld` | v0.2 | `a4f7638d9f31dadc0e6df6d56500b333b3af61c3310ad7fd4c92502b64374090` |
| `fixtures/witnesses/superseded/v2/minimal/check-report-round2.jsonld` | v0.2 | `f8bd453f2bf08c34e0a278be2aaaa77373cad7bbb015b8dd6cac586de7d47507` |
| `fixtures/witnesses/superseded/v2/minimal/check-report.jsonld` | v0.2 | `a95955c84c647debbbb16a359c34d023450700fb5e442a72a81b5a45b781a22c` |
| `fixtures/witnesses/superseded/v2/minimal/prompt.txt` | v0.2 | `795cc44ff937b4634316fdcc0f21a38aa834deca19de315b98df1bd277af337b` |
| `fixtures/witnesses/superseded/v2/minimal/repair-prompt.txt` | v0.2 | `7b89ca1bd0a8cfdc3e46a52bab0829b425fe5e802f0e13ad3edfacdba7706127` |
| `fixtures/witnesses/superseded/v2/minimal/rerun-plan.jsonld` | v0.2 | `aa147e29fe999b90802c7ca0824ec798d317c99b67566ef10a2034e5903ba606` |
| `fixtures/witnesses/superseded/v2/minimal/sdd-round2.jsonld` | v0.2 | `54677ba3d35a747a371d6290744f1922f5dfb8d7e52ff2863ec3cee48e53b83e` |
| `fixtures/witnesses/superseded/v2/minimal/sdd.jsonld` | v0.2 | `71bfb31c1bf7cf53a8872b76fce037fd75b1789cf3725e247820b5f72c0b7b4b` |
| `fixtures/witnesses/superseded/v2/minimal/skeleton.jsonld` | v0.2 | `a250c034b1d5b1e03fe791dbd9a79ef20eac910fdea6c8b673539cdc1204bb88` |
| `fixtures/witnesses/superseded/v3/full/check-report-range.jsonld` | v0.3 | `d54e470c70ac16e2fa6be019b2d5b33dcddd14b09060f1895887dcc6096ddbe0` |
| `fixtures/witnesses/superseded/v3/full/check-report-valid.jsonld` | v0.3 | `1f8124fa97180169c3e89f803b70c00f9995eab6f0ac7fc14f3051e4e55a3562` |
| `fixtures/witnesses/superseded/v3/full/prompt-1-of-2.txt` | v0.3 | `2378bd1a8b66041b69156f77708512f26b66601462b26d4ac888f6b605a416f7` |
| `fixtures/witnesses/superseded/v3/full/prompt-2-of-2.txt` | v0.3 | `d55030d92d74948d0a916a5ead5284e84f043915c57b39d0ebf8c4a1635a6c2f` |
| `fixtures/witnesses/superseded/v3/full/prompt.txt` | v0.3 | `81bd90593e2e3c6649153337d52b42e5bafff1ff39a37d1119ff17a94e5d560a` |
| `fixtures/witnesses/superseded/v3/full/proposal-range.txt` | v0.3 | `4a535565187cd5a81157ca8c173877e5bcc129facf1758101d1089af7a8a5eae` |
| `fixtures/witnesses/superseded/v3/full/proposal-valid.txt` | v0.3 | `db03f8a11ace02f8eee1ab7b425610c2e41ff21581a21f31f0caabc3fb3f7d9a` |
| `fixtures/witnesses/superseded/v3/minimal/bad-check-report.jsonld` | v0.3 | `426c5945d9ee8003a7ff20f8741bd8d065a2f311d0efc67696eb377f8e02d5c4` |
| `fixtures/witnesses/superseded/v3/minimal/bad-proposal.txt` | v0.3 | `68704680864a30fc0eab135889059fb304dcf54210388d6ac58d2dbc7874909c` |
| `fixtures/witnesses/superseded/v3/minimal/check-report-round2.jsonld` | v0.3 | `2a83f393eb26b9f7956448257c1b3ba09dd89b04678aac68fdc4f0dec27665b5` |
| `fixtures/witnesses/superseded/v3/minimal/check-report.jsonld` | v0.3 | `b251db2e092646ae2a945b2bfd2b8e7bc3115fca78331cea73c2c88993c3e2ee` |
| `fixtures/witnesses/superseded/v3/minimal/proposal-pasted.txt` | v0.3 | `6eb7f5afb14cad25e38fad57eeea6118f78f433c1008698f01172bafacc28e9f` |
| `fixtures/witnesses/superseded/v3/minimal/repair-prompt.txt` | v0.3 | `7ff9455dcb8d8915b59b4855376d9d7aefc84b9c226c38608f2d3e7e10b13648` |
| `fixtures/witnesses/superseded/v3/minimal/rerun-plan.jsonld` | v0.3 | `6b032ea1c3b1ddb2223148399f1352d4190e6e598c575eeebb45b5f5f9be2496` |
| `fixtures/witnesses/superseded/v3/minimal/sdd-round2.jsonld` | v0.3 | `d3b2019ac166d63db193ae019176bc7ff15164882655efa36ddef8d678a69354` |
| `fixtures/witnesses/superseded/v3/minimal/sdd.jsonld` | v0.3 | `bc9b22911d6c62dcea563340cf6d18bf570367c3f721085cfb8e87411160a653` |

**Supersession.** Changing any governed file is a supersession event. The superseded file is retained, and every
citer named in the reciprocal table below and in the "Cited by" column MUST be re-accepted before this document
regains its disposition. *Worked example:* a new Ontology-Template pin (ADR-005) changes `terms_sha256`, so the
skeleton changes (it cites the hash), so the prompt, check reports, repair prompt and SDDs all change. That fires
every W-CS2-\* to W-CS7-\* nominal witness, S-S2–S-S8, and, through the reciprocal table, every SDD-operator scene
that cites them.

**Reciprocal citations with SDD-operator.** Each row is a local artifact and the SDD-operator artifacts it is linked with by a citation in either direction (rule item 6),
enumerated from both documents:

**Citation rule (normative, SDD-F70).** (1) *Identifiers:* the ids each document's Stable-identifiers row declares, plus its property generators and corpora (SDD G1, K1; SDD-operator G2, K2) and the weave record WV-1 (an SDD-operator artifact, defined in SDD-operator §15). Witness and scene ids have exactly the forms `W-CSn-N`, `W-CSn-Δn`, `W-JSn` (SDD) and `W-PROn-N`, `W-PROn-Δn`, `W-JOn` (SDD-operator), n a decimal number; any other `W-` string is a warning code. Codes (`E-*` errors, `W-*` warnings such as `W-CHK-*` and `W-PROMPT-OVERSIZE`, `FL-*` flags), section references (§n) and wildcards (`X*`) are not identifiers. The shared seams S-O* are governed by mirroring (gate 1), not by this table. (2) *Blocks:* a paragraph, a list item, or a table row; headings are not blocks. (3) *Attribution:* a block's citing artifact is the chain witness it defines ("Chain example/scene **W-J…**"), else, for a table row, the identifier that is its whole first cell, else the identifier **of the block's own document** that begins the first bold span to begin with one (bold spans that begin with anything else are skipped), else its section ("SDD §n" or "SDD-operator §n"; "SDD header" or "SDD-operator header" before §1). (4) *Citation:* a block cites every identifier of the other document that it names, in plain text or inside a code span; a range "X1–X4" or "W-…-Δ1–Δ4" names each id in it. (5) *Excluded regions (for the reciprocal table):* the reciprocal tables themselves, the §11 registry tables (a file index, below), and the mirrored S-O rows. A region is excluded by its location, never by its formatting. (6) *Direction:* none is recorded. A row means either side cites the other, and supersession of either side fires the other. (7) *Registry relationship:* the registry's "Cited by" column is a separate, file-level index: an artifact (attributed as in (3), from either document, with a mirrored S-O row attributed to its S-O id; only the registry tables are excluded) cites a registry file iff a block names, anywhere in its text, the file's repository path, or its path relative to `fixtures/witnesses/` or `fixtures/jira-assets/` (so a bare base name of a file under `fixtures/witnesses/` is not a citation; a top-level `fixtures/jira-assets/` file's relative path is its base name, which is). The term-list row is indexed by `terms_sha256`, not by this rule. Both documents carry the same table, generated and checked by `node tools/citations.mjs` (OS-7). The "Cited by" column is checked by `node tools/registry-check.mjs`.

<!-- reciprocity:begin -->
| SDD artifact | SDD-operator artifacts citing it or cited by it |
|---|---|
| C-S2 | SDD-operator §4, W-JO3 |
| C-S3 | SDD-operator §4, W-JO3 |
| C-S4 | NP-O5, SDD-operator §4, W-JO3 |
| C-S5 | PR-O5 |
| C-S6 | SDD-operator §4, SDD-operator §5, W-JO3 |
| C-S7 | RV-O2, SDD-operator §4, W-JO3 |
| G1 | G2 |
| H-S1 | H-O1, H-O2, SDD-operator §15, W-JO1, W-JO2, W-JO3, W-JO4 |
| NG-S0 | WV-1 |
| NG-S1 | NP-O0 |
| NG-S4 | PR-O2, SDD-operator §2 |
| NG-S5 | NP-O2, PR-O1, SDD-operator §2 |
| OS-7 | SDD-operator §15, SDD-operator §16 |
| R-S5 | W-PRO4-Δ1, W-PRO5-N |
| R-S6 | W-PRO4-Δ3, W-PRO5-N |
| R-S10 | W-PRO1-Δ2 |
| R-S11 | W-PRO6-Δ2 |
| R-S13 | W-PRO3-Δ1 |
| R-S14 | NP-O3, PR-O4, RV-O3, RV-O4, SDD-operator §2 |
| R-S16 | PR-O2, SDD-operator §2, W-PRO2-Δ2 |
| R-S17 | PR-O1, RV-O2, W-PRO1-Δ5, W-PRO1-Δ6 |
| R-S18 | PR-O1, RV-O2, SDD-operator §2, W-PRO1-Δ6 |
| R-S20 | W-PRO5-Δ1 |
| R-S21 | RV-O4, SDD-operator §2, W-PRO2-Δ2, W-PRO4-Δ1, W-PRO5-N |
| R-S23 | CV-O3, PR-O3, SDD-operator §2, SDD-operator §12 |
| SDD §2 | J-O1, J-O2, J-O3, J-O4, WV-1 |
| SDD §5 | CV-O1, CV-O2, CV-O3 |
| SDD §10 | H-O2, OO-2, WV-1 |
| SDD §11 | G2, K2, WV-1 |
| SDD header | WV-1 |
| W-CS3-N | W-JO1, W-PRO6-N |
| W-CS3-Δ2 | W-PRO6-Δ1 |
| W-CS3-Δ6 | W-PRO6-Δ2 |
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
<!-- reciprocity:end -->

Reciprocity is **checked mechanically and independently verified** (2026-10-28, v0.4.1). `node tools/citations.mjs` MUST pass on every
change to either document. `node tools/mutation-test.mjs` demonstrates that it fails on a drifted seam row, a dropped
table entry and an unrecorded citation. Its v0.3 seam check had a defect that hid a corrupted S-O1 row (SDD-F51). WV-1
gates 1 and 2 were **verified independently on 2026-10-28** by an agent that read only the two documents and the method and derived the citations from the rule above with its own parser: gate 1 MET, gate 2 MET (107 pairs, both tables equal to the derived set). The first verification round of this pass found the rule text under-determined (SDD-F70 round 1, corrected). **CAP-2 was lifted by the registrar (Decision B, 2026-10-28)** on this evidence (`review/core-v0/evidence/cap2-round2/`); it is reinstated only if new evidence invalidates the result.

**Embedded digests (SDD-F50).** A witness that embeds another governed file's sha256 (a paste's `skeletonSha256`, a
report's `promptSha256`, an SDD's provenance) cites that file. A supersession is complete only when
`node tools/witness-check.mjs` passes: every embedded digest names a current, non-superseded governed file, and the typed
relations between prompts, pastes, reports, skeletons, inventories and SDDs hold. The registry check alone cannot see
embedded digests. **Independent oracle.** `node tools/oracle-check.mjs` re-derives every CheckReport witness's errors and
warnings with a checker written from the spec by an isolated rater (`tools/oracle/oracle-b.cjs`, unmodified), so witness
outputs are not validated only by the generator that produced them.

**Open items.**
- **OS-1:** *closed (2026-10-28, milestone 4).* JSON Schemas `schemas/inventory-v1.schema.json`, `schemas/skeleton-v1.schema.json`, `schemas/prompt-set-v1.schema.json`, `schemas/check-report-v1.schema.json`, `schemas/rerun-plan-v1.schema.json`, `schemas/sdd-v1.schema.json` and the SDD shapes `shapes/sdd-v1.shacl.ttl` (term lists pinned to `terms_sha256` `a9e01756`); the context `context/sdd-v1.jsonld` is served at its IRI (milestone 3). Every current witness validates against its schema and every SDD witness conforms to the shapes, under the author's test (`src/test/schemas.mjs`) and an independent judge (`harness/os1_judge.py`: Python jsonschema and pyshacl, with spec-derived corruptions rejected). Was: author `schemas/*.schema.json` for the remaining artifacts (the proposal schema is done and pinned), the bundled `context/sdd-v1.jsonld` (hash-pinned), and **SHACL shapes for the SemanticDataDictionary** (`shapes/sdd-v1.shacl.ttl`, ADR-006), with `minimal/sdd.jsonld` as the conforming witness.
- **OS-2:** *closed (v0.3).* The term list carries every named `rdfs:domain` / `rdfs:range` the pins state: of 225 CCO object properties, 112 have at least one named domain and 110 at least one named range; of 40 BFO object properties, 28 and 31 (the rest have none, or only anonymous expressions, NG-S9). In the source files: CCO 148 named domain and 149 named range edges plus 15 and 15 anonymous; BFO 28 and 31. The reader matches rdflib 7.1.1 exactly on all six edge sets (`tools/verify-hierarchy.py`). The new `terms_sha256` superseded every term-bearing witness; the version-2 files are retained under `fixtures/witnesses/superseded/v2/`. W-CS4-Δ5 and Δ15 are literal.
- **OS-3:** *closed (2026-10-29).* G1 and K1 are implemented in `harness/props/` by an independent verification agent working black-box from §7. V-S1–V-S6 pass at the stated n on the reference runner (workflow run 40886607369: V-S1 217, V-S2 200, V-S3 100, V-S4 200, V-S5 100, V-S6 296; 10,797 CLI calls; network guard empty). Two harness defects found on the first run were fixed and are recorded in the register (H-1, H-2).
- **OS-4:** *closed (2026-10-29).* The core and CLI are built (C-S1–C-S7). Every witness is executed under H-S1 (see the §10 status).
- **OS-5:** closed by registrar Decision B (2026-10-27): the R-S9 text fallback is retained.
- **OS-6:** *closed (2026-10-29).* The reference environment is `bench/config.json` (`ubuntu-24.04`, Node 22; the hardware is recorded per run, not fixed). `bench/run.mjs` writes to `bench/results.jsonl`. E-S1–E-S3 pass on two reference runs, on different CPUs.
- **OS-7:** *tool built (v0.3), corrected and mutation-tested (v0.4); independent verification pending.* `tools/citations.mjs` extracts every cross-document citation (explicit-identifier rule, with section-level attribution for blocks that define no identifier) and checks both tables and the mirrored seam rows.

## SDD §12: Closure report (method P2)

Granularity: template structure. The one-paragraph summary and §1 are informative. Every BCP 14 clause lives in §3,
§4 and §7 to §11.

| Clauses | Class | Falsifier | Validation | Gate |
|---|---|---|---|---|
| C-S1–C-S7 behaviour | FC-W | W-CS1-\* … W-CS7-\* | execution vs. implementation (OS-4) | §10.4 |
| R-S1–R-S23 | FC-RW | rule ↔ witness pairs listed in §4 | OS-4 | §10.4 |
| S-S1–S-S8, S-O1–S-O6 | FC-X | crossing examples, §6 | integration | §10.5 |
| V-S1–V-S6 | FC-P | generators + properties, §7 | property runs (OS-3) | §10.6 |
| J-S1–J-S4 | FC-C | W-JS1–W-JS4 under H-S1 | chain runs | §10.3 |
| E-S1–E-S3 | FC-M | thresholds + `bench/` | bench runs (OS-6) | §10.7 |
| NG-S\*, witness registry, reciprocal table, core purity | FC-A | audits: registry hashes recompute; core imports no I/O modules; OS-7 reciprocity check | audit | §10.1, §11 |

Orphan clauses: **0**. Named defects at the gate: none in this document beyond the unexecuted witnesses (OS-4).
