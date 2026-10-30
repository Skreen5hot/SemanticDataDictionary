# SDD Service: plan

**Goal.** Turn a Jira Assets object schema into an accepted, validated **Semantic Data Dictionary**: a JSON
artifact mapping every object type, attribute and reference onto BFO/CCO. The structural work is mechanical and
offline; the meaning is proposed by the enterprise LLM through a copy-paste relay and accepted by a human.

**Governing documents.** Decisions: [`DECISIONS.md`](DECISIONS.md) (ADR-001 to ADR-008). Spec: [`../spec/sdd-service.md`](../spec/sdd-service.md) v0.4.1. Rationale:
[`../SDD-V2.0-SPEC.md`](../SDD-V2.0-SPEC.md). Findings: [`../review/register.md`](../review/register.md). Method: *The Falsifiable Spec v0.4* (Specification-Refinement-System).

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

## Path to v1 (registrar direction, 2026-10-28)

Five milestones, in order. Every implementation slice is built by an independent implementer from the spec alone and
judged by `tools/run-witnesses.mjs` (written from the spec text, never from the implementation). No new grading
cycles, architecture or scope unless a demonstrated blocker needs a registrar decision.

### 1. C1–C6 core: COMPLETE

- **Delivered:**
  - pure core `src/core/` (no I/O, clock or randomness; browser-capable) and the CLI `src/cli/sdd.mjs`, covering
    parse, skeleton, prompt, check, repair and accept;
  - spec v0.4.1 (F67–F71 resolved; Decision C);
  - CAP-2 lifted (Decision B).
- **Completion condition (met):** every C-S1–C-S6 witness passes under the independent judge (91/91 at `428c10b`),
  including end-to-end repair and acceptance. All regression checks pass.
- **Blockers:** none.

### 2. C7 schema-change handling: COMPLETE

- **Deliverables:**
  - `sdd rerun` (C-S7): new schema + previous SDD → Inventory + RerunPlan;
  - SDD-F72: a different term list never carries silently;
  - witnesses W-CS7-N, Δ1–Δ3 and W-CS6-Δ10;
  - the W-JS3 chain end to end, and removal → retired.
- **Completion condition (met):** the independent judge passes every C-S7 check (104/104 overall) and the
  regression suite is green. This closes the capability part of OS-4.
- **Blockers:** none.

### 3. Offline HTML application: COMPLETE

- **Deliverables:**
  - `site/`: one offline page reusing `src/core/` unchanged, implementing SDD-operator CV-O1–CV-O3 and PR-O1–PR-O6;
  - the bundled term list and the JSON-LD context `context/sdd-v1.jsonld` (the context part of **OS-1**), served at
    its IRI by GitHub Pages;
  - the Pages deploy;
  - **OO-1:** `harness/netguard.mjs` and the H-O1 (Playwright) and H-O2 harnesses, with every W-JO\* and W-PRO\*
    scene executed.
- **Completion condition:**
  - every SDD-operator scene passes under H-O1 with the browser offline;
  - browser and CLI produce identical bytes for the same inputs (V-S1 parity);
  - E-O1 (works from `file://`), E-O2 and E-O3 (≤ 3 MB) are met;
  - the Pages deploy is green.
- **Blockers:** none known.

### 4. Release verification: COMPLETE

- **Deliverables:**
  - **OS-1** (remainder): JSON Schemas for the remaining artifacts, plus SHACL shapes for the SDD with
    `minimal/sdd.jsonld` conforming;
  - **OS-3:** generators G1 and K1, with V-S1–V-S6 run at their stated n;
  - **OO-2:** generators G2 and K2, with V-O1–V-O3 run;
  - **OS-6:** `bench/` on the reference machine, covering E-S1–E-S3;
  - **H-S1:** every witness re-run in a clean, network-disabled container (the execution remainder of OS-4);
  - both acceptance conjunctions evaluated (SDD §10, SDD-operator §14), and a release candidate tagged.
- **Completion condition (met, 2026-10-29):** both acceptance conjunctions hold on the reference runner at
  `12cbb83` (Release verification run 40911400026; Operator acceptance runs 40911400125 and 40911512747); readiness is
  READY in both documents. Release candidate tagged `v1.0.0-rc.1`. Evidence: `review/register.md`.
- **Blockers:** none.

### 4a. Simplified attribute contract (spec v0.5, release candidate v1.0.0-rc.2): COMPLETE

Registrar-approved after the external ontological review (`review/register.md`, v0.5 entry): no `valueProperty`;
`iceClass` is a permitted ICE class or `null`; `sddVersion` 2 with a clean break from v1.0.0-rc.1 (unchanged).

### 5. Enterprise pilot and registrar acceptance: NEXT (registrar)

Pilot plan for the enterprise team (draft for team review): [`PILOT-PLAN.md`](PILOT-PLAN.md), the source of truth;
[`PILOT-PLAN.html`](PILOT-PLAN.html) is the same plan styled for a browser.

- **Deliverables:**
  - the release candidate run on the enterprise Jira Assets schema inside the enterprise: the offline page (or its
    saved copy), relayed by hand to the enterprise LLM;
  - break events logged;
  - fixes only for demonstrated defects.
- **Completion condition:** the registrar's final acceptance of v1.
- **Blockers:** none known. This needs the registrar's access to the enterprise environment. The open request to
  Ontology-Template (CCO hierarchy register) does not block: ADR-008 Option B is in place.

### Checks to run before any commit to `spec/`, `fixtures/`, `src/` or `tools/`

`node tools/run-witnesses.mjs`, `node tools/registry-check.mjs`, `node tools/witness-check.mjs`,
`node tools/oracle-check.mjs`, `node tools/citations.mjs`, `node tools/build-term-list.mjs --check`, and
`node tools/mutation-test.mjs` when any check changes.

## Capabilities (v1 scope, fixed)

| Id | Capability | Status |
|---|---|---|
| C1 | **Parse**: Jira Assets schema → structural inventory, with flagged ambiguities | Built |
| C2 | **Skeleton**: inventory → SDD skeleton (all items, meaning fields empty) | Built |
| C3 | **Prompt**: skeleton + term list + output schema + rules → prompt text | Built |
| C4 | **Check**: pasted LLM reply → itemized errors, or a validated proposal | Built |
| C5 | **Repair prompt**: errors → follow-up prompt for the same batch | Built |
| C6 | **Accept**: per-mapping human accept or reject → accepted SDD plus acceptance record | Built |
| C7 | **Re-run on schema change**: new schema and previous SDD → only new or changed items go back to the LLM | Built |

## History (phases 0–3, condensed)

- **Phases 0–1 (2026-10-27):** the decisions (ADR-001 to ADR-008) and the ground truth (pinned ontologies, term list,
  fixtures, Atlassian schema) are complete.
- **Phases 2–3:** the spec pair was authored and graded over three cycles, and prop-001 and prop-002 were merged. The
  history is in `review/register.md`.
- **Process change (2026-10-28):** incremental build with independent executable verification replaced paper
  grading cycles.

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
