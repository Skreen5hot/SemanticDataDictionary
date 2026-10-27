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
| 4 | **Build** | Core library (shared), offline HTML tool, Node CLI | Every witness executed in a clean environment |
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

## Open questions for the registrar

1. **ADR-003:** accept the proposed null rule as written, or amend it?
2. **Pinned ontologies:** which BFO and CCO releases? Your Ontology-Template repo vendors pinned copies, so should
   the term list be derived from it?
3. **Output form:** plain JSON SDD, or JSON-LD (so it is directly RDF-readable)? I'd recommend JSON-LD with a
   fixed context, so the SDD itself is checkable with SHACL from Ontology-Template.
4. **Third individual?** ADR-001 leaves open whether the *act* of asserting (a process with time and agent) is
   modeled separately from the record. Decide in Phase 2, with the pinned CCO in hand.
