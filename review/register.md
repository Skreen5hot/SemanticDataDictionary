# SDD findings register: cycle 1

Graded under *The Falsifiable Spec, Method Specification v0.4*
(`Skreen5hot/Specification-Refinement-System` → `falsifiable-spec-method-v0.4.md`).
Subject: `SDD-V2.0-SPEC.md` @ `c4d04b5` (sha256 `7954c405…f2cbf1`). **Append-only:** rows are never edited or
deleted; later entries go in new appended sections.

## Grade record: rater A (2026-10-27)

- **Rater:** A (Claude, in the authoring session).
- **Status:** single rater, therefore provisional (§6.3). **Not isolated** under SRS R-S1: the rater's context
  included prior discussion of this spec and ariadne's coherence review (S-11). An isolated rater B is
  recorded in a separate section.
- **P11 applicability:** not applicable. No requirement ranges over an interaction history, so the grade uses ten
  dimensions.

| Dim | Score | Evidence | Justification |
|---|---|---|---|
| P1 | 0 | whole document | Starts from the artifact format. No levels, capabilities or journeys, and no terminal declaration. |
| P2 | 1 | spec:217–253; 0 BCP 14 keywords | Worked examples exist but are informal (not literal expected output). No closure report. No clause is identifiable as normative (P2.1). |
| P3 | 0 | spec:281 | Consumers (RDF, APIs, SHML) are mentioned only as an evaluation criterion. No seams, contracts or crossing examples. |
| P4 | 1 | spec:97–203, 217–253 | Row → graph behaviour is shown once. The SDD artifact is given as JSON fragments only (the M1 "mapping table" form). No behaviour is given for projection. |
| P5 | 1 *(borderline 0)* | spec:162–163 vs 245–246; 179–180 vs 248 | Rules carry no IDs, so examples can't cite them. Several rules have no example. Two rule/example conflicts (F1, F2). No conflict protocol. |
| P6 | 0 | spec:225, 244–248 | Instance IRIs (`Person_1`, `ActOfOccupancy_1`, `TemporalInterval_1`) have no minting rule. Non-determinism is undeclared. |
| P7 | 0 | spec:270 | §6 is a list of review considerations, with no gates and no report lines. |
| P8 | 0 | whole document | No journeys. |
| P9 | 0 | spec:76–92 | Universal rules (rows are assertions; missing foreign key → information gap; literals never inhere) have no scope, generator or property. |
| P10 | 0 | spec:13 | No witness IDs, registry or supersession protocol. Claims v2.0 "introduces" features but has no v1.0 changelog. |

**Total 3/20.** Knockouts: P1, P3, P6, P7, P8, P9, P10. No caps (no cross-document seams).
`Disposition: D-0 Describes, doesn't define` (provisional, single rater, not isolated)
`Acceptance readiness: BLOCKED`: no gates stated; no falsifier validated.

## Findings: rater A

| Id | Sev | Dim | Finding | Evidence |
|---|---|---|---|---|
| **SDD-F01** | **Critical** | P5 | **Rule/witness conflict: role relation.** The rule maps `person_id` with `type: participates_as`, `inverse_type: is_realized_by`. The witness has no `participates_as` edge; it shows the process realizing a role that inheres in the person. The inverse is also ill-typed: a person is not realized, a role is realized by a process. **P5 halt.** | spec:162–164 vs 245–246; 198–201 |
| **SDD-F02** | **Critical** | P5 | **Rule/witness conflict: temporal region.** The rule says the process `occupies_temporal_region` with `boundary_type: start_instant` (a `bfo:TemporalInstant`, spec:130). The witness says it occupies `TemporalInterval_1` bounded by the start. In BFO a process occupies an interval, so the witness is sound and the rule is not. **P5 halt.** | spec:179–180 vs 248–249; 130 |
| **SDD-F03** | **Major** | P5 / ontology | **Self-contradiction: assertion vs. asserted.** §2.2 says fact tables are assertion events. §3.5 maps the fact table to `cco:ActOfOccupancy` (the occupancy process itself) while also tagging it `epistemic_role: AssertionEvent`. That puts two distinct entities (the act of asserting, and the process asserted about) in one mapping. | spec:51 vs 155–157 |
| **SDD-F04** | **Major** | P1 (scope) | **Scope mismatch with the intended source.** The spec is scoped to star and snowflake schemas (fact and dimension tables). The motivating source is an object-type schema (Jira Assets: object types, attributes, `referenced_object` references, type hierarchy) with no fact tables. "Rows are assertion events" has no stated counterpart there. Needs a broadened scope or an object-schema profile. | spec:11–13, 51 |
| **SDD-F05** | **Major** | P5 / P10 | **Cross-document null-semantics conflict, and an undefined column.** ariadne's coherence review F-S11-1 claims an explicit null is a negative assertion. The spec states no such rule (every null is absence of assertion). The witness relies on an `end_date` column that is never defined. | spec:86–92, 253; ariadne `docs/00-foundation/coherence-review.md` S-11 |
| **SDD-F06** | Minor | P2 / P10 | **Unverified, undeclared vocabulary.** Prefixes `bfo:`, `cco:`, `iao:`, `xsd:` are used with no declaration or `@context`. Relation names `participates_as`, `has_site`, `is_site_of`, `is_realized_by` and `has_text_value` are unprefixed. Class IRIs (`cco:PersonNameRecord`, `cco:ActOfOccupancy`, `cco:ResidentRole`, `cco:PersonName`) have not been checked against a pinned CCO release (IRI_Linter). Not asserted wrong, only unchecked. | spec:105–112, 155–171, 198 |
| **SDD-F07** | Minor | P2 | **No normative keywords.** 0 BCP 14 keywords and 1 lowercase "should" (in §6, addressed to reviewers). No clause is identifiable as normative, so a closure report cannot be built for the spec as written. | grep census |
| **SDD-F08** | Minor | P6 | **Instance-IRI minting undefined.** The examples mint `Person_1`, `ResidentRole_1`, `TemporalInterval_1` with no rule, so the output of applying an SDD is not reproducible or testable. | spec:225, 244–248 |

Dispositions: none yet. All findings are open, pending the planning of the SDD Service spec (method §4 form),
which will cite this register.
