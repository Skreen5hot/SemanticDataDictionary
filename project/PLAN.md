# SDD Service: plan

**Goal.** Turn a Jira Assets object schema into an accepted, validated **Semantic Data Dictionary**: a JSON
artifact mapping every object type, attribute and reference onto BFO/CCO. The structural work is mechanical and
offline; the meaning is proposed by the enterprise LLM through a copy-paste relay and accepted by a human.

**Governing documents.** Decisions: [`DECISIONS.md`](DECISIONS.md) (ADR-001 to ADR-004). Rationale:
[`../SDD-V2.0-SPEC.md`](../SDD-V2.0-SPEC.md). Findings to resolve: [`../review/register.md`](../review/register.md)
(SDD-F01 to F24). Method: *The Falsifiable Spec v0.4* (Specification-Refinement-System).

## The workflow the service implements

```
 Jira Assets schema JSON
        │  (1) parse: offline, deterministic
        ▼
 Structural inventory ── object types, attributes + types, identity keys, references (joins),
        │                type hierarchy, import selectors; ambiguities flagged (e.g. children ≠ containment)
        │  (2) skeleton
        ▼
 SDD skeleton ── every item present, meaning fields empty
        │  (3) prompt: skeleton + pinned BFO/CCO term list + output JSON Schema + rules
        ▼
 ┌──────────── air gap (manual relay, ADR-004) ────────────┐
 │  user pastes prompt → enterprise LLM → user pastes reply │
 └──────────────────────────────────────────────────────────┘
        │  (4) check: format · coverage · permitted terms · BFO categories · rules
        ├── errors ──► (5) repair prompt (errors only) ──► relay again
        ▼
 Proposed mappings ── (6) human accepts or rejects each one
        ▼
 Accepted SDD (+ acceptance record: who, what, when, which LLM round)
```

A later, separate step is **applying** an accepted SDD to actual Jira data to produce RDF. It is out of scope for v1
and declared as a non-goal, so v1 stays small.

## Phases

| # | Phase | Output | Exit condition |
|---|---|---|---|
| 0 | **Decisions** (this file + ADRs) | ADR-001 to ADR-004 | ADR-003 accepted by the registrar |
| 1 | **Ground truth** | Synthetic Jira Assets fixture schema covering every attribute type and edge case; pinned BFO/CCO releases plus the permitted-term list; Atlassian attribute types confirmed | Fixtures committed; term list hashed |
| 2 | **Author the spec pair** | `spec/sdd-service.md` (method §4: capabilities, journeys, seams, rules, properties, acceptance, closure report) **and** `spec/sdd-operator.md` (method §4A: promises and scenes for the relay loop) | Closure report with 0 orphans |
| 3 | **Grade and refine** | SRS cycle: two isolated raters, adjudication, findings, proposals, walks | Disposition **D-3**, readiness stated honestly |
| 4 | **Build** | Core library (shared), offline HTML tool, Node CLI. **The HTML tool is published through GitHub Pages** (Actions is enabled on the repo), at `https://skreen5hot.github.io/SemanticDataDictionary/`, which also serves the JSON-LD context at its IRI | Every witness executed in a clean environment; Pages deploy green |
| 5 | **Pilot** | You run it on the enterprise schema inside the enterprise | Your acceptance; break events logged |

Phase 2 also disposes all 24 cycle-1 findings: each one is resolved, deferred, or rejected, with reasons, in the new
spec's register.

## Draft capability list (for Phase 2)

| Id | Capability | Deterministic? |
|---|---|---|
| C1 | **Parse**: Jira Assets schema → structural inventory, with flagged ambiguities | Yes |
| C2 | **Skeleton**: inventory → SDD skeleton (all items, meaning fields empty) | Yes |
| C3 | **Prompt**: skeleton + term list + output schema + rules → prompt text | Yes |
| C4 | **Check**: pasted LLM reply → itemized errors, or a validated proposal | Yes (the LLM reply is the input; nothing is assumed about it) |
| C5 | **Repair prompt**: errors → follow-up prompt | Yes |
| C6 | **Accept**: per-mapping human accept or reject → accepted SDD plus acceptance record | Yes (the human act is the input) |
| C7 | **Re-run on schema change**: new schema and previous SDD → only new or changed items sent to the LLM | Yes |

Draft journeys: **J1** first dictionary (C1→C6) · **J2** repair loop (C4→C5→C4) · **J3** schema changed (C7→C3→…).

## Status

- **Phase 0: complete** (2026-10-27). The registrar approved the plan and resolved all four open questions: ADR-003
  accepted with amendment; ADR-005 (pinned ontologies from Ontology-Template); ADR-006 (JSON-LD canonical);
  third individual deferred (ADR-001); boundary and scope fixed (ADR-007).
- **Phase 1: complete** (2026-10-27). The blocking question below was resolved by the registrar: Option B (ADR-008),
  with a request sent to Ontology-Template. Both open points are answered (`SOURCE-FORMAT.md`).
- **Phase 2: drafted** (2026-10-27). [`spec/sdd-service.md`](../spec/sdd-service.md) (substrate: 7 capabilities, 4
  journeys, 19 rules, 6 properties) and [`spec/sdd-operator.md`](../spec/sdd-operator.md) (companion: 6 promises, 4
  journeys, 15 scenes), woven by WV-1. Both closure reports show 0 orphans. Minimal-fixture witnesses are literal
  files with computed hashes (`fixtures/witnesses/minimal/`). All 24 cycle-1 findings are dispositioned
  (`review/register.md`). Self-identified gaps: crossing examples S-S6 and S-S7 pending (OS-4); W-CS4-Δ5 literal
  pending (OS-2).
- **Spec v0.4 merged (2026-10-28, prop-002).** CAP-2 active pending independent reciprocity verification. Checks to run
  before any change to `spec/` or `fixtures/`: `registry-check`, `witness-check`, `oracle-check`, `citations`,
  `build-term-list --check`, and `mutation-test` when any check changes.
- **Minimal core (C1–C4): authorized 2026-10-28,** bounded: parse, skeleton, prompt, check against the executable
  witnesses. Not the full application; no cycle 4.
- **Phase 3 (history):** Cycle 2 graded v0.1 at joint D-1; prop-001 was merged as v0.2 (Decisions A and B); OS-2
  and OS-7 were completed as v0.3 (see `review/register.md`). **Cycle 3 awaits the registrar's authorization.**
  Before any commit to `spec/`, run: `node tools/registry-check.mjs`, `node tools/citations.mjs`,
  `node tools/build-term-list.mjs --check`.
- **Publishing (registrar, 2026-10-27):** GitHub Actions is on for Pages; the HTML tool ships there (Phase 4).

### Phase 1 deliverables

| Deliverable | Where | State |
|---|---|---|
| Pinned ontology artifacts | `vendor/ontology-template/` (Ontology-Template `114f28d`; every file hash-verified against its manifest) | Done |
| Permitted-term list | `ontology/term-list.json`, built by `tools/build-term-list.mjs` (deterministic; `--check` mode). 2,071 terms, 1,697 permitted; every class carries superclasses and BFO ancestors (ADR-008). `terms_sha256` `0965d5a4…1156f5` | Done |
| CCO class hierarchy | `vendor/cco-upstream/` (same pin, hash-checked against Ontology-Template's register); reader validated against rdflib | Done (Option B) |
| Atlassian JSON Schema | `vendor/atlassian/` (registrar-authorized) | Done |
| Upstream request | `communications/OT/outgoing/2026-10-27-cco-class-hierarchy-register.md` | Sent (open) |
| Atlassian format confirmed | `project/SOURCE-FORMAT.md`. 13 attribute types; ADR-002 corrected | Done |
| Synthetic fixtures | `fixtures/jira-assets/`: main + externalId variant + 6 one-defect invalid fixtures, all checked against Atlassian's JSON Schema | Done |

### Blocking question: BFO category checks need CCO's class hierarchy (resolved: Option B, ADR-008)

ADR-004 promises "BFO category checks" (for example, "a referent class must be a material entity", or rejecting
"a house as a site", SDD-F13). That needs each CCO class's ancestry up to BFO. **Ontology-Template's pinned
artifacts don't carry it:** the CCO register lists existence, labels and types only, and the CCO extract holds just
the 2 terms Ontology-Template names. Options:

- **A (recommended):** extend Ontology-Template's vendoring to also emit a **CCO hierarchy register** (each class's
  superclass chain) from the *same* pinned file. It keeps one source of truth with the same hash discipline, and
  your other ontology projects benefit too.
- **B:** the SDD build fetches the pinned CCO merged file itself (same commit, verified against the same sha256
  `e609db27…`) and derives the hierarchy. Same pin, but a second derivation path outside Ontology-Template.
- **C:** v1 drops category checks for CCO terms (existence and kind only). Category errors then fall to human
  acceptance.

### Other open points (answered)

From `SOURCE-FORMAT.md`: (1) the enterprise schema **does** use `externalId` fields, so they are a primary input form;
(2) Atlassian's JSON Schema **may** be vendored (done).
