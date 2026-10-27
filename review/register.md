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

## Grade record: rater B (2026-10-27, appended; sections above unamended)

- **Rater:** B (Claude subagent). **Isolated per SRS R-S1:** its context was exactly `{spec.md, method-v0.4.md}`.
  Manifest sha256: spec `7954c405…f2cbf1` (byte-identical to `SDD-V2.0-SPEC.md` @ `c4d04b5`),
  method `112b1274…cbf1e8c`. It was instructed not to read any other file and reported reading only those two.
- **Status:** single rater, therefore provisional (§6.3). **P11:** not applicable (same reasoning as A), so ten
  dimensions.

| Dim | B | Evidence (spec lines) | Note |
|---|---|---|---|
| P1 | 0 *(borderline 1)* | 13, 59–70, 284, 293 | A parts list, not a composition; no terminal declaration. |
| P2 | 1 *(borderline 0)* | 215–253; 0 BCP 14 keywords | Kept off 0 only because two worked examples exist. |
| P3 | 0 | 13, 55, 277, 284 | Edges implied; no seam table or crossing example. |
| P4 | 1 *(borderline 0)* | 76–209, 224–250, 277 | The SDD JSON is effectively a signature; projection surface has no behaviour. |
| P5 | **0** | rules 78–81, 88–92, 202; witnesses 217–253 | Rules unwitnessed, examples name no rule, overlaps conflict, no protocol. |
| P6 | 0 | 225, 244–249 | Instance-ID minting undeclared and unmasked. |
| P7 | 0 | 268–277, 293 | Review topics, not gates; no report lines. |
| P8 | 0 | absent | No journeys. |
| P9 | 0 | 78–81, 95, 260, 264 | Unscoped universals. |
| P10 | 0 | 1, 13 | No registry, versioning, supersession, or NG/NP absences. |

**Total 2/20.** Knockouts: P1, P3, P5, P6, P7, P8, P9, P10.
`Disposition: D-0 Describes, doesn't define` (provisional, single rater)
`Acceptance readiness: BLOCKED`: no gates (P7 = 0); no falsifier validated; examples contradict rules.

## Adjudication: cycle 1 (A vs B, per SRS R-S4)

| Dim | A | B | Result |
|---|---|---|---|
| P1, P3, P6, P7, P8, P9, P10 | 0 | 0 | **Agreed knockouts** |
| P2, P4 | 1 | 1 | Agreed (both borderline) |
| **P5** | 1 | **0** | **Contested knockout** (either-rater zero), routed to the human queue (the registrar) |

**Disposition line: WITHHELD** while P5 is contested (R-S4 / method §6.3). The outcome is **invariant to P5's
resolution**: seven agreed knockouts already fix **D-0** under either reading.
`Acceptance readiness: BLOCKED`: no acceptance gates; no falsifier validated; P5 halts (SDD-F01, F02).

**Method observation (filed for SRS, not against this spec):** rater B notes that §6.2.6 defines READY as "every
gate-consumed falsifier is validated", which a document with *no* gates satisfies vacuously. Both raters reported
BLOCKED; the method text should exclude the vacuous READY.

## Findings: rater B, merged into the register

B's findings that duplicate A's are cross-referenced, not re-registered:
B-F2 → SDD-F03; B-F3 and B-F10 → SDD-F01 (B-F10 adds that `participates_as` is not a BFO/RO relation);
B-F4 → SDD-F02; B-F6 (`end_date` part) → SDD-F05; B-F13 → SDD-F06; B-F18 → SDD-F07. New findings:

| Id | Src | Sev | Dim | Finding | Evidence |
|---|---|---|---|---|---|
| **SDD-F09** | B-F1 | **Critical** | P5 | **The example drops the assertion layer.** The rules say rows are assertions, not facts, but §4.2 renders the row directly as `ActOfOccupancy_1 (Process)`, with no assertion act, asserter or assertion time. That is the conflation the paper exists to prevent. | spec:51, 78–79, 157 vs 243–250 |
| **SDD-F10** | B-F2 (ext.) | **Critical** | P1 | **The thesis has no implementable mapping.** Each row needs two individuals (an assertion act, and the occupancy it is about), but the SDD schema has one `maps_to_class` slot per table. Extends SDD-F03 from contradiction to structural impossibility. | spec:155–157 |
| **SDD-F11** | B-F8 | Major | ontology | **Qualities are listed as realizable dependent continuants.** In BFO, qualities are not realizable; only roles, dispositions and functions are. | spec:44 |
| **SDD-F12** | B-F9 | Major | ontology | **ICE/IBE concretization is misstated.** An ICE is concretized by an information quality entity that inheres in an IBE; the IBE is not the concretization. "Person_1 has ICE: PersonName" contradicts `about: cco:Person`: the ICE is *about* the person, not had by it. | spec:47, 111, 121, 226–227 |
| **SDD-F13** | B-F11 | Major | ontology | **A house is treated as a site.** `has_site` / `is_site_of` target `cco:House`, a material entity, but a BFO site is immaterial. The relation needs a site the house bounds, or a different, pinned relation. | spec:171–173 |
| **SDD-F14** | B-F12 | Minor | ontology | **`boundary_of: bfo:Occurrent` is wrong.** A temporal instant bounds a temporal interval, not a process. | spec:135 |
| **SDD-F15** | B-F5 | Major | P5 / P2 | **A timestamp appears in a foreign-key column.** `start_date_id` is a foreign key to `time_dim.time_id`, but the example value is `2026-01-01T10:09`, which is not a valid `xsd:dateTime` (no seconds) and has no timezone. | spec:177–178 vs 239 |
| **SDD-F16** | B-F6 | Major | undefined | **`house_dim` is referenced but never defined.** | spec:169 |
| **SDD-F17** | B-F7 | Major | P5 / P9 | **The latent-role rule asserts what the null semantics forbid.** "Role exists independently of assertion" / `role_remains_latent` posits roles for persons no row mentions, which contradicts absence-of-assertion. Unscoped. | spec:88–95 vs 202, 208 |
| **SDD-F18** | B-F14 | Minor | ontology | **The gap sentinel contradicts absence.** Instantiating `iao:information_gap` for a missing foreign key is itself a positive assertion, in tension with "absence_of_assertion". `is_disjoint_with_nonexistence` applies class disjointness to an interpretation flag. | spec:89–91 |
| **SDD-F19** | B-F15 | Major | P9 / P4 | **Provenance is claimed but not modeled.** "Every fact is traceable to an assertion event", but there is no asserter, source, assertion time or load time anywhere in the schema. | spec:54, 260 |
| **SDD-F20** | B-F16 | Major | P9 | **"No restructuring needed" is unscoped and already strained.** The assertion layer (F10) and interval derivation (F02) need information the warehouse lacks. | spec:13, 264, 284 |
| **SDD-F21** | B-F17 | Major | P4 / P3 | **Advertised capabilities have no mechanism.** Belief-scoped reasoning, counterfactual projections and RDF/API/SHML projection have no mechanism, output or seam. "SHML" is undefined in this document. | spec:277, 288–289 |
| **SDD-F22** | B-F19 | Minor | P10 | **No v1 baseline or changelog** for what v2.0 "introduces". | spec:13 |
| **SDD-F23** | B-F20 | Minor | P9 | **"Temporal precision" means instant-vs-interval here**, not granularity. No granularity, timezone or calendar policy, and no bitemporality (valid time vs. assertion time) despite the assertion framing. | spec:13, 70, 261 |
| **SDD-F24** | B-F21 | Minor | P5 | **The inverse-query paths disagree:** "House → Occupancy → Person" vs "House → Residents". | spec:190 vs 252 |

**Verification note (rater A, appended):** every mechanically checkable claim in SDD-F11–F24 was confirmed against
the spec text at the cited lines (`qualities` at 44; `boundary_of` at 135; timestamp at 239; no `house_dim`
definition; latent-role text at 202, 208; differing query paths at 190, 252). The ontological judgments (F11–F14)
are recorded as rater B's claims, consistent with BFO 2020 as rater A understands it, and are subject to registrar
acceptance like every other finding.

**Register state after cycle 1:** 24 findings (SDD-F01–F24), 0 dispositioned. One contested knockout (P5) awaits the
registrar.

## Registrar ruling: cycle 1 (2026-10-27, appended; sections above unamended)

- **Contested knockout P5:** the registrar (Aaron Damiano, author of record) adopts **rater B's score, P5 = 0**.
  Basis: the §6.1 zero anchor "examples naming no rule" is literally met, because the spec's rules carry no
  identifiers an example could cite.
- **Adjudicated vector:** P1 0 · P2 1 · P3 0 · P4 1 · **P5 0** · P6 0 · P7 0 · P8 0 · P9 0 · P10 0 = **2/20**.
  Knockouts: P1, P3, P5, P6, P7, P8, P9, P10. No caps. `provisional: false` (dual-rated, adjudicated).

`Disposition: D-0 Describes, doesn't define`
`Acceptance readiness: BLOCKED`: no acceptance gates; no falsifier validated; P5 halts at SDD-F01, SDD-F02.

**Register state:** 24 findings open, 0 dispositioned. Disposition of findings is deferred to the SDD Service spec
(method §4 form), which supersedes this document's normative role; SDD v2.0 remains as rationale.
