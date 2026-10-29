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

## Dispositions: cycle 1 (2026-10-27, appended; sections above unamended)

Every finding raised in cycle 1 is dispositioned against the SDD Service spec pair v0.1 (`spec/sdd-service.md`,
`spec/sdd-operator.md`) and ADR-001 to ADR-008. SDD v2.0 is retained as rationale only; its normative role is
superseded. Kinds: **resolved** (fixed as raised) · **resolved otherwise** (the defect cannot recur, for the stated
reason) · **deferred** (open item named) · **rejected** (reasons stated). None is dropped (PR-M1).

| Finding | Disposition | Where |
|---|---|---|
| SDD-F01 role relation conflict | resolved otherwise: v1 has no role/inverse construct; a reference maps to one object property, checked for kind and domain/range | R-S7, R-S8 |
| SDD-F02 instant vs interval | resolved otherwise: no temporal-region modelling in v1; date and time values are information-content literals | R-S9, NG-S1 |
| SDD-F03 assertion vs asserted | resolved: record and referent are separate slots | ADR-001, R-S5, C-S2 |
| SDD-F04 scope mismatch | resolved: Jira Assets profile only; star schemas a declared non-goal | ADR-002, NG-S2 |
| SDD-F05 null semantics conflict | resolved: single rule; F-S11-1's reading rejected | ADR-003, R-S15 |
| SDD-F06 unverified vocabulary | resolved: pinned term list; every CURIE checked. Four v2.0 terms shown not to exist in the pin | ADR-005, R-S7, V-S6 |
| SDD-F07 no normative keywords | resolved: BCP 14 profile; closure reports | both spec headers, §12/§16 |
| SDD-F08 instance-IRI minting | resolved otherwise: v1 mints no individuals | NG-S1 (ADR-007.1) |
| SDD-F09 example drops assertion layer | resolved: every type mapping carries `recordClass` | ADR-001, S-S7 |
| SDD-F10 one class slot per table | resolved: two slots | R-S5, W-CS2-N |
| SDD-F11 qualities listed as realizable | resolved otherwise: no hand-written BFO taxonomy; categories come from pinned ancestry | R-S5, ADR-008 |
| SDD-F12 ICE/IBE concretization | resolved otherwise: v1 types the record as an ICE and makes no concretization claim; bearers are a materialization concern | R-S5, NG-S1 |
| SDD-F13 house as site | resolved: domain/range checked mechanically (House is a material entity, not a site, per the pinned ancestry) | R-S8 (literal pending OS-2) |
| SDD-F14 `boundary_of: bfo:Occurrent` | resolved otherwise: no temporal boundary modelling in v1 | NG-S1 |
| SDD-F15 timestamp in a foreign-key column | resolved otherwise: no star schema; Jira date types fixed by the value table | NG-S2, R-S9 |
| SDD-F16 `house_dim` undefined | resolved otherwise: the v2.0 example is retired with its normative role | — |
| SDD-F17 latent role vs null semantics | resolved: nothing is posited from absence | ADR-003 rule 1, R-S15 |
| SDD-F18 gap sentinel | resolved: absence is recorded on the record, never instantiated | ADR-003 rules 1–2 |
| SDD-F19 provenance unmodelled | resolved for definitions: every mapping carries provenance and acceptance; record-level absence metadata deferred to materialization | S-S7, R-S15, NG-S1 |
| SDD-F20 "no restructuring" claim | resolved otherwise: the claim is not made; scope fixed | ADR-002 |
| SDD-F21 capabilities without mechanism | resolved: scope fixed at C-S1–C-S7; reasoning and projection are non-goals | ADR-007.4, NG-S9 |
| SDD-F22 no changelog | resolved: witness registry and supersession protocol | sdd-service §11 |
| SDD-F23 temporal precision, bitemporality | deferred: timezone, granularity and valid/assertion time belong to the materialization service | NG-S1 |
| SDD-F24 inverse-query paths disagree | resolved otherwise: no inverse construct in v1 | R-S7 |

**Register state:** 24 findings, 24 dispositioned (22 resolved or resolved otherwise, 1 of them with its witness literal pending
(F13 → OS-2); 1 partly deferred (F19); 1 deferred (F23); none rejected). Cycle 2 grades the spec pair.

---

# Cycle 2: SDD Service spec pair v0.1 (2026-10-27, appended; everything above unamended)

Subject: `spec/sdd-service.md` + `spec/sdd-operator.md` @ `b4aab5bea1d71dcb74d6e2942ddd266d5ae00629`, woven by WV-1.
Graded under *The Falsifiable Spec v0.4*.

**Raters.** A and B, both Claude subagents, both **isolated per SRS R-S1**. Each was given an identical folder
(manifest sha256 `2b6650a4…`) holding the method, `spec/`, `fixtures/`, `ontology/` and `project/DECISIONS.md` cut
from `b4aab5b`. Excluded: this register, `project/PLAN.md` (which lists the author's self-identified gaps) and every
prior grade. The author (the session that wrote the spec) did not rate.

## Grade vectors

| Dim | Service A | Service B | Operator A | Operator B |
|---|---|---|---|---|
| P1 | 2 | 2 | 1 | 1 |
| P2 | 1 | 1 | 1 | 1 |
| P3 | 1 | 1 | 1 | 1 |
| P4 | 2 | 2 | 2 | 2 |
| P5 | 1 | 1 | 1 | 1 |
| P6 | 2 | 2 | 2 | 2 |
| P7 | 2 | 2 | 2 | 2 |
| **P8** | **2** | **1** | 2 | 2 |
| P9 | 1 | 1 | 1 | 1 |
| P10 | 1 | 1 | 1 | 1 |
| P11 | n/a | n/a | 1 | 1 |
| **Total** | 15/20 | 14/20 | 15/22 | 15/22 |

Both raters: P11 not applicable to the service (it delegates through NG-S0) and applicable to the operator; no
zeros; **CAP-1 inactive; CAP-2 active** (WV-1 gate 2, "citation graphs reciprocal", is marked met but is not, per
SDD-F27).

## Adjudication (SRS R-S4)

- **Agreed:** 20 of 21 dimension scores. **No contested knockouts.**
- **Nonzero disagreement: service P8 (A 2, B 1)**, routed to a third rater or the registrar. Both raters found the
  same defect (C-S6 cannot derive `round` / `promptSha256`, SDD-F26); they differ only on whether to charge it to
  P8 as well as to P2/P4.
- **Invariance:** the service is D-2 at 14 or 15. The operator is 15/22 = D-1 (68.2 %, the §6.2 pin). The joint
  result is min = **D-1**, under either resolution of P8. CAP-2 bounds the joint result at D-2 and does not bind below D-1.

`Joint Disposition: D-1 Uniformly under-specified` (dual-rated; service P8 pending third rater/registrar; invariant)
`Acceptance readiness: BLOCKED — SDD-F25 (wrong witness hashes); OS-1–OS-4, OS-6; OO-1, OO-2; CAP-2`

Per document: service `D-2 Reconstruction required` (14 or 15/20) · operator `D-1 Uniformly under-specified` (15/22).

**Author verification:** SDD-F25 was recomputed by the author against the committed files and confirmed.

## Findings: cycle 2 (A and B merged; sources cited)

| Id | Sev | Dim | Finding | Src |
|---|---|---|---|---|
| **SDD-F25** | **Major** | P10 | **Three abbreviated witness hashes are wrong:** prompt.txt printed `4082dfe5…facc28e9f` (true `…d04d2cafc`; the tail was spliced from the proposal hash) at service :40, :96, :280 and operator :72; proposal-pasted.txt `…c136` (true `…bafacc28e9f`) at :42, :281; bad-proposal.txt `…7909c` (true `…874909c`) at :283. The full hashes are correct, so the documents contradict themselves. | A-F1, B-F1 |
| **SDD-F26** | **Major** | P8/P4/P2 | **C-S6 cannot derive `provenance.round` or `promptSha256`** from its declared inputs. Repair-round semantics are undefined (which slot set a repair reply is checked against, and how it merges). W-CS5-N claims "round 2" and "same header" although the template has no round field. W-JS2's outcome claim is wrong. | A-F2, A-F9, A-F8, B-F5 |
| **SDD-F27** | **Major** | P10 (CAP-2) | **Reciprocity is incomplete.** The operator cites W-CS5-N, W-CS6-N, W-CS4-Δ8, W-CS3-Δ2, R-S10, R-S16, R-S18 and W-JS2–4, none recorded in service §11; the worked supersession misses W-PRO5-N, W-JO2, W-PRO6-Δ1. WV-1 gate 2 is overclaimed. | A-F3, B-F10 |
| **SDD-F28** | **Major** | P3/P4 | **Contracts can't feed their consumers.** C-S3's DATA lines need names and descriptions that the skeleton lacks, so the inventory is an undeclared input. C-S7 needs per-item hashes, but the SDD stores only the whole-inventory hash. | A-F4 |
| **SDD-F29** | **Major** | P5 | **Rule/witness conflict on error precedence.** R-S5 also fires E-CHK-CATEGORY for an unknown or non-class `iceClass`, so W-CS4-Δ3/Δ4's "exactly one error" can't hold. No precedence or ordering rule exists. W-CS4-Δ10's expected error set is underdetermined. **P5 halt.** | A-F5, B-F4, B-F20 |
| **SDD-F30** | **Major** | P5/P11 | **RV-O1's rejected text "…Nothing was accepted."** contains "accepted" before any act, which violates PR-O4(b) and V-O3 by construction. It is also misleading in W-PRO3-N, where items are accepted. | A-F6, B-F3 |
| **SDD-F31** | **Major** | P5/P2 | **Unpaired clauses and witnesses.** Witnesses with no rule: W-CHK-GENERIC (undefined), E-CHK-SKELETON, E-SKEL-ERRORED, E-REPAIR-NOTHING. Rules with no witness: E-SRC-MAP-TYPE, E-SRC-DUP-ATTR, W-CHK-ICE-REFERENT, W-PROMPT-OVERSIZE, E-CHK-RANGE-UNRESOLVED, CLI exit 2. Two invalid fixtures are cited by nothing. The closure report claims 0 orphans. | A-F7, A-F19, B-F6 |
| **SDD-F32** | **Major** | P3/P11 | **Substrate→surface seams are missing** (CheckReport→screen, inventory→screen, SDD→download). W-PRO4-Δ1's warning text exists in no artifact, which breaks the "no free language" premise. Adding the SDD→download row honestly would be *pending* and activate CAP-1. | A-F11, B-F2, B-F9 |
| **SDD-F33** | **Major** | P11/P2 | **Falsifiers that don't bear on their clauses.** PR-O2(b) ("passes with networking disabled" doesn't prove no request was attempted; H-O2 needs a request log). PR-O3(b) is mapped to W-JO2, in which nothing is accepted before the repair round, so it passes vacuously. | A-F12, B-F8 |
| **SDD-F34** | **Major** | P9 | **V-S4's property is false:** descriptions feed the inventory hash, which feeds the skeleton hash, which is printed outside DATA. | A-F10 |
| **SDD-F35** | **Major** | P5/P8 | **W-JO4 contradicts W-PRO1-Δ2:** it runs that scene after 3 acceptances, but the scene expects all items undecided and the name field empty. | A-F14 |
| **SDD-F36** | **Major** | cross-doc | **`--out` refusal (exit 2, E-OUT-EXISTS) is defined only in the operator document.** The substrate CLI contract lacks it, yet the L2-empty claim rests on it. | A-F19, B-F11 |
| **SDD-F37** | **Major** | P2/P3 | **W-CS6-N resolves to pending, elided S-S7.** The main output contract has no literal instance, and W-JO1, W-PRO1-N and W-PRO1-Δ1 inherit that. | B-F7 |
| **SDD-F38** | Minor | P9 | **Mixed identification can collide:** `ot:`+externalId of one type can equal `ot:`+name of another. No rule covers it, yet V-S2 claims uniqueness. | A-F13 |
| **SDD-F39** | Minor | P9 | **Property parameters missing or broken.** n is missing for V-S3, V-S5, V-S6, V-O2 and V-O3. V-S3's 50k budget is below the ~62.2k fixed overhead, an undefined R-S12 case. "Characters" is undefined for non-BMP text. | A-F17, B-F12 |
| **SDD-F40** | Minor | P1 | **The operator has no terminal declaration.** Note: the method's own §5A specimen also lacks one (method observation). | A-F15, B-F17 |
| **SDD-F41** | Minor | P5/ontology | **The conflict record is not a rule/witness conflict,** and its premise ("CCO models software as an ICE") is uncheckable: the pin has no Software class. | A-F16, B-F14 |
| **SDD-F42** | Minor | various | **Small inconsistencies:** R-S9 claims "13 types, each with its row" (12 types, 8 rows; `referenced_object` has none). `terms_sha256` is over compact JSON, contradicting R-S1's "sha256 always means". A warning carries an E- code. J-S3's `unchanged` list is unsorted, and J-S3 skips C-S2. The service calls its companion "Part II". | A-F18, B-F5, B-F14, B-F17 |
| **SDD-F43** | Minor | P7 | **Readiness lines omit blockers:** OO-1 (service), and OO-2, OS-3 and OS-6 (operator and joint). | A-F20, B-F18 |
| **SDD-F44** | Minor | P11 | **PR-O4, PR-O5 and PR-O6 lack adversarial scenes.** | A, B-F13 |
| **SDD-F45** | Minor | ADR | **Unrecorded deviations from ADRs:** no SHACL check (ADR-006), and no JSON Schema output format in the prompt (ADR-004.1). | A-F22, B-F15 |
| **SDD-F46** | Minor | P11 | **PR-O6 is unscoped by platform:** clipboards may normalise LF to CRLF. | A-F21 |
| **SDD-F47** | Minor | P8/P10 | **Harness and homing gaps:** H-O2 has no owner in its definition; J-O3 is homed to "CLI", which is not a CV capability; W-JS1's relay step names no harness. | B-F19 |
| **SDD-F48** | Minor | P5 | **DATA-line formats for reference and containment slots are unspecified.** W-CS3-Δ2's "exactly 2 batches" is within ~300 characters of flipping. | B-F16 |
| **SDD-F49** | Minor | P2 | **W-CS7-Δ1 is underspecified:** if the mapping still names Cost Center, E-SRC-MAP-ATTR fires first. | B-F20 |

**Method observations (for Specification-Refinement-System, not against this spec):** (1) P1's closure rule requires
a terminal declaration at the outermost level, but the §5A specimen has none (both raters noted it). (2) Repeated
from cycle 1: the vacuous READY in §6.2.6.

**Register state:** cycle 2 raised 25 findings (SDD-F25–F49), 0 dispositioned. One routing is open: service P8. Next:
a proposal (`review/proposals/prop-001`), merged only on the registrar's command (no auto-merge).

## Registrar ruling: cycle 2 (2026-10-27, appended; sections above unamended)

- The registrar (Aaron Damiano) **accepts the cycle-2 results and the joint D-1 disposition.**
- **Service P8 = 1** (rater B's score), ruled by the registrar instead of a third rater. Rationale: both raters
  identified the same underlying deficiency (SDD-F26: carried state C-S6 cannot derive), so a third evaluation would
  not materially change the outcome.
- **Adjudicated vectors:** service P1 2 · P2 1 · P3 1 · P4 2 · P5 1 · P6 2 · P7 2 · **P8 1** · P9 1 · P10 1 = **14/20**,
  D-2. Operator 15/22, D-1. **Joint D-1**, CAP-2 active. `provisional: false`.

`Joint Disposition: D-1 Uniformly under-specified`
`Acceptance readiness: BLOCKED — SDD-F25; OS-1–OS-4, OS-6; OO-1, OO-2; CAP-2`

- **prop-001 authorized for drafting** under these constraints: (1) one consolidated proposal disposing F25–F49 with
  rationale; (2) priority on corrections to requirements, contracts, contradictions, witnesses and traceability,
  especially the operator spec; (3) architecture, the seven capabilities and v1 scope preserved, with nothing added
  unless it resolves a demonstrated defect; (4) CAP-2 applied: no reciprocity or traceability claim until
  demonstrated; (5) method observations kept separate; (6) no change to the approved specs and no cycle 3 without the
  registrar's authorization.

## Merge of prop-001: spec v0.2 (2026-10-27, appended; sections above unamended)

The registrar approved merging prop-001 as **spec v0.2**, with:
- **Decision A** (ADR-004.1 amended): the pinned JSON Schema `schemas/proposal-v1.schema.json` is the checker's
  authoritative contract (R-S13, E-CHK-SHAPE). The prompt carries a concise per-kind output contract and a
  representative example (template v2's ANSWER FORMAT), and leaving the schema text out of it must not weaken
  validation. Merge-time additions required by Decision A: E-CHK-SHAPE and E-CHK-FIELDS with message templates, and
  witnesses W-CS4-Δ13 and W-CS4-Δ14.
- **Decision B:** the `time` text fallback is retained; no capability invents a time or date value (R-S9). OS-5 is closed.
- Scope, the seven capabilities, CAP-2 (until OS-7) and every hash check are preserved. Cycle 3 is **not** started.

**Merge-time regeneration.** Decision A changed the template, so every prompt-bearing witness was regenerated by the
reference generator. Two budgets were re-picked from the new sizes so their witnesses stay discriminating: W-CS3-Δ2
69,000 (two batches for 66,965–70,854) and W-CS3-Δ4 63,700. The v1 `prompt.txt`, `check-report.jsonld`,
`bad-check-report.jsonld` and `prompt-template-v1.txt` were retained under `fixtures/witnesses/superseded/v1/`.
Audit: every registry hash recomputes from its file, and every prose prefix belongs to a registry hash.

**Dispositions of cycle-2 findings (as proposed in prop-001; F45 completed by Decision A):** SDD-F25–F44 and
F46–F49 **resolved**. SDD-F45 **resolved** (SHACL in OS-1; the prompt/schema roles fixed by the ADR-004.1
amendment). SDD-F27 is resolved in content; its demonstration is OS-7, and CAP-2 stays active until then.

## Pre-cycle-3 items OS-2 and OS-7: spec v0.3 (2026-10-27, appended; sections above unamended)

- **OS-2 closed.** The term list carries named `rdfs:domain` / `rdfs:range` for every object property, from the same
  pins. The reader matches rdflib 7.1.1 exactly on all six edge sets (CCO domain 148 named + 15 anonymous, range 149 + 15;
  BFO 28 / 31). New `terms_sha256` `a9e01756`, which superseded every term-bearing witness; the version-2 files are
  retained under `fixtures/witnesses/superseded/v2/` (files current at spec v0.2). **W-CS4-Δ5 is literal:** the
  full-fixture proposal with Person→Manager = `bfo:BFO_0000056` *participates in* (range *process*) gives exactly one
  E-CHK-RANGE. Its baseline W-CS4-Δ15 (minted) validates with one W-CHK-ICE-REFERENT. The reference computation
  also confirms W-CS4-Δ10's 52 errors / 10 warnings.
- **OS-7 closed.** `tools/citations.mjs` extracts every cross-document citation (explicit-identifier rule) and
  checks that both documents carry the same reciprocal table and identical mirrored seam rows. Result: 59 citations,
  6 seam rows, exit 0. It fails on a dropped table entry and on an unrecorded citation (both probed). **WV-1 gate 2
  met; CAP-2 inactive** while the check passes.
- **Hash checks kept and governed:** `tools/registry-check.mjs` (27 registry rows plus the term-list hash; prefix
  resolution; probed with a 1-byte tamper) joins `build-term-list.mjs --check`, `citations.mjs`,
  `communications.mjs` and `verify-hierarchy.py`.
- **Remaining blockers (none pre-cycle-3):** OS-1 (remaining artifact schemas, the bundled context, SHACL shapes),
  OS-3 (G1/K1 generators), OS-4 and OO-1 (build and execute every witness and scene), OS-6 (bench), OO-2 (G2/K2).
  All are implementation work.

---

# Cycle 3: SDD Service spec pair v0.3 (2026-10-27, appended; everything above unamended)

Subject: `spec/` @ `5e5b4cc912adf4ba873ec91df13b5fa758385cf7`. Raters A and B, Claude subagents, **isolated per SRS
R-S1**: identical folders (manifest `28db59df…`) holding the method, `spec/`, `fixtures/`, `ontology/`, `schemas/`,
`tools/` and `project/DECISIONS.md`. The register and plan were excluded; `vendor/` was absent by design. The author
did not rate.

## Grade vectors and adjudication

| Dim | Service A | Service B | Operator A | Operator B |
|---|---|---|---|---|
| P1 | 2 | 2 | 2 | 2 |
| P2 | 1 | 1 | 1 | 1 |
| P3 | 1 | 1 | 2 | 2 |
| P4 | 2 | 2 | 2 | 2 |
| P5 | 1 | 1 | 1 | 1 |
| P6 | 2 | 2 | 2 | 2 |
| P7 | 2 | 2 | 2 | 2 |
| **P8** | **1** | **2** | 2 | 2 |
| P9 | 1 | 1 | 1 | 1 |
| P10 | 1 | 1 | 1 | 1 |
| P11 | n/a | n/a | 2 | 2 |
| **Total** | 14/20 | 15/20 | 18/22 | 18/22 |

- **Agreed:** 20 of 21 dimension scores; no zeros; **CAP-1 inactive; CAP-2 active.** Both raters: WV-1 gate 1 is
  false, because the SDD's S-O1 row is corrupt (SDD-F51).
- **Nonzero disagreement: service P8 (A 1, B 2)**, routed to the registrar. Source: J-S3 and J-S4 chains not fully
  literal (SDD-F56).
- **Invariance:** service D-2 at 14 or 15; operator 18/22 = D-2; joint **D-2**, also capped there by CAP-2.

`Joint Disposition: D-2 Reconstruction required` (dual-rated; service P8 pending registrar; invariant)
`Acceptance readiness: BLOCKED — SDD-F50, F51, F52 (P5 halts / weave defect); OS-1, OS-3, OS-4, OS-6; OO-1, OO-2`

Progress against cycle 2: the operator document rose from D-1 (15/22) to D-2 (18/22); the joint result from D-1 to D-2.

**Author verification:** SDD-F50, F51 and F52 recomputed and confirmed by the author before recording.

## Findings: cycle 3 (A and B merged)

| Id | Sev | Dim | Finding | Src |
|---|---|---|---|---|
| **SDD-F50** | **Critical** | P5/P10 | **The relay pastes name a superseded skeleton.** `proposal-pasted.txt` and `bad-proposal.txt` carry `skeletonSha256` `a250c034` (the v0.2 skeleton); the current skeleton and prompt are `e990dbb3`. Under R-S13 every check of them stops at E-CHK-SKELETON, so W-CS4-N, Δ1–Δ4, Δ6, Δ8, Δ11–Δ13 and every minimal chain and scene state wrong outcomes. Cause: the OS-2 supersession walk regenerated outputs but not inputs that *embed* the skeleton hash, and the registry check cannot see embedded hashes (method defect shape D-M1). | A-F1, A-F3, B-F1 |
| **SDD-F51** | **Critical** | P3/P10 (CAP-2) | **The SDD's S-O1 seam row holds closure-report cells, and `tools/citations.mjs` reports it as identical.** Its seam pattern also matches the operator's closure row `S-O1–S-O6`; `--write` copied that row in and the check compared it with itself. WV-1 gate 1 is false. The author's probes covered citation drift, not seam drift. | A-F2, B-F3 |
| **SDD-F52** | **Major** | P5 | **Error order conflicts with R-S20**, which puts coverage errors first. `bad-check-report.jsonld`, W-JS2, the repair prompt's ERRORS block and W-PRO5-N list E-CHK-CATEGORY before E-CHK-MISSING. **P5 halt.** | B-F2 |
| **SDD-F53** | **Major** | P5/P9/P11 | **PR-O4(b) can be broken by ordinary input.** RV-O4 renders `key` and `value` verbatim (both LLM-controlled), and CV-O1 shows source names, so a reply key `approved` or a Jira attribute named "Verified" puts a forbidden word outside quoted blocks. K2 tests only `rationale`. RV-O1's "two per-item texts" claim is wrong. R-S14 is unscoped against quoted LLM text in `rationale`. | A-F5, B-F4, B-F15 |
| **SDD-F54** | **Major** | P9/technical | **The DATA end marker can be forged:** `JSON.stringify` does not escape U+2028, which JS regexes and many renderers treat as a line break, so a description can produce a line reading `-----END DATA-----`. "Whole line" is undefined in R-S11 and V-S4. | B-F5 |
| **SDD-F55** | **Major** | P4/P3 | **CLI surface inconsistencies.** `--out` is used by R-S23 and W-CS6-Δ5 but appears in no signature. `rerun` has two outputs and no destinations. S-S6 names consumers whose signatures take no RerunPlan. J-S3's "changed ∪ added" key list is computed by no capability. S-S1 lists `rerun` as an Inventory consumer, but rerun takes schema bytes. | A-F6, A-F9 |
| **SDD-F56** | **Major** | P8 | **J-S3 and J-S4 are not fully literal** (no relay pastes, decisions or output files); H-S1 claims fixture files that do not exist. W-CS6-Δ2 and W-CS7-Δ1/Δ2 have no literal artifacts. | A-F4 |
| **SDD-F57** | **Major** | P2 | **Orphan sub-clauses** contrary to "0": W-CHK-RANGE-UNRESOLVED; E-USAGE; R-S18's skeleton-mismatch branch and "highest round"; R-S14's CLI-message ban; R-S9's no-invention clause; R-S16 beyond `skeleton`; `{expected}` undefined in two templates; §12's claim about where BCP 14 clauses live; NP-O5's "tolerates CRLF". | A-F7, B-F6, B-F11 |
| **SDD-F58** | **Major** | P9 | **Universals discharged by witnesses only:** R-S4, R-S12 (greedy fill), R-S14, R-S15, R-S16, R-S19, R-S23. Operator: `acceptorName` is outside V-O1; PR-O3(a) has no property; PR-O2(b) is witness-only. | A-F8, A-F11, B P9 |
| **SDD-F59** | Minor | P10 | **Registry incomplete:** the synthetic fixtures, the 6 invalid fixtures and the full skeleton (`f203f691`, no file) are missing; retained v1 hashes are not recorded. `fixtures/jira-assets/README.md` gives the externalIds hash as `…40c750`; the real hash is `…1d59c750` (a spliced tail, F25's pattern). | A-F10, B-F7 |
| **SDD-F60** | Minor | consistency | **Stale version markers:** "as-of registry v0.2" (NG-S0, NP-O0) and "Status at v0.2" in v0.3 documents; registry "Version 3" undefined. | A-F12, B-F9 |
| **SDD-F61** | Minor | accuracy | **OS-2's counts describe the source file, not the term list:** CCO 148/149 are file edges; the term list holds 112/110 on object properties. "Every object property" is overstated (113 of 225 CCO properties have no domain). | A-F15, B-F10 |
| **SDD-F62** | Minor | ontology | **The "valid" Δ15 baseline relates a Descriptive ICE by *located in*,** which BFO restricts to independent continuants. It passes only through NG-S9 (anonymous domain). §1's "category-wrong" promise is not scoped to NG-S9. | A-F16, B-F8 |
| **SDD-F63** | Minor | ADR | **ADR-004 step 4 says repair lists "only the errors";** R-S22 resends the full DATA. No amendment is recorded. | A-F17, B-F13 |
| **SDD-F64** | Minor | P10 | **The citation graph is narrower than the dependencies:** G1/K1 ids are not tracked; blocks without a bold local id (SDD §2 coverage, the §5 `html` row, §10) drop real citations. | A-F18, B-F12 |
| **SDD-F65** | Minor | P11 | **Two scoping gaps in PR-O1:** PR-O1(c) is unfalsified for names pre-filled from an opened SDD; PR-O1(a) vs R-S17 carry-forward (mappings enter a new SDD without an act in that session) needs scoping. | A-F13, B-F14 |
| **SDD-F66** | Minor | P6/P2 | **Operator scene precision:** W-PRO3-N's "same `at` by identity"; W-PRO2-Δ2's E-CTX-EXTERNAL row format is undefined by RV-O4/R-S21; W-PRO3-Δ1's "random bytes" is unseeded and not paste-able; RV-O3's source-schema block and CV-O3's "open a previous SDD" have no scene. | A-F14, A P2 |

**Method observation (for SRS, separate):** a registry hash audit cannot see hashes *embedded inside* governed files
(SDD-F50). The method's supersession walk (P10.3) needs embedded-digest dependencies in the citation graph.

**Register state:** cycle 3 raised 17 findings (SDD-F50–F66), 0 dispositioned. Open routing: service P8.

## Registrar ruling: cycle 3 (2026-10-27, appended; sections above unamended)

- The registrar accepts the cycle-3 adjudication and the joint **D-2** result.
- **Service P8 = 1** (rater A's score), ruled by the registrar. Rationale: both raters identified the same deficiency
  (SDD-F56: J-S3 and J-S4 not fully literal), and a third evaluation would not change the disposition. Adjudicated
  service vector: 14/20, D-2. Operator 18/22, D-2. **Joint D-2**, CAP-2 active. `provisional: false`.
- **prop-002 authorized for drafting:** address F50–F66 (P5 halts, witness correctness, seam reciprocity and CAP-2
  first); fix underlying causes (a generator for inputs as well as outputs, embedded-reference checks, seam-drift
  detection); checks must detect deliberately corrupted artifacts, and a generator must not validate its own results
  on shared assumptions; the seven capabilities, the architecture and the v1 boundaries are preserved; CAP-2 stays
  active until the reciprocity evidence is independently demonstrated; one consolidated proposal with diff,
  dispositions and verification results; no merge without authorization.
- **Process change:** after prop-002 is approved, the next priority is a **minimal implementation of the shared
  deterministic core** (parse, skeleton, prompt, check) against real executable witnesses, not another paper cycle.
  Neither cycle 4 nor full Phase 4 starts without authorization.

## prop-002 review, correction and merge: spec v0.4 (2026-10-28, appended; sections above unamended)

- **Registrar review:** prop-002 accepted as meaningful progress. **Decision A approved:** ADR-004 step 4 amended (the
  repair prompt lists the errors and resends the batch, consistent with R-S22). **Decision B: CAP-2 remains active**
  until a separate agent, independent of the tools' author, verifies reciprocity during the minimal-core
  implementation and the result is recorded.
- **Correction required before merge (done):** the mutation-test harness passed a corruption whenever *any* check
  failed. Corrected: each corruption names its expected detecting check, and only that check's failure counts.
  Resynchronised corruptions update the registry row *and* the prose prefixes and require `registry-check` to pass, so
  detection cannot rest on a hash inconsistency. A control case (a registry-only corruption declared as needing
  `witness-check`) must be, and is, classified "not detected".
- **Verification after the correction:** baseline clean; **76/76 corruptions detected by their expected check**;
  control correctly classified. Changed results: every resynchronised corruption is now detected with
  `registry-check` passing (previously stale prose prefixes also tripped it; the F52 replay is now caught by
  `oracle-check` alone). No substantive new defect. All existing checks green: `build-term-list --check`,
  `communications`, `registry-check` (93 rows), `witness-check` (44 files, 359 digests, 8 prompts), `oracle-check`
  (8/8), `citations` (97), `verify-hierarchy.py` (6/6), `mutation-test`.
- **Merged** to `main` as `4d19818` (branch `prop-002` @ `eb181df`). Cycle-3 findings SDD-F50–F66 are dispositioned as
  in `review/proposals/prop-002/prop-002.md` (F63 completed by Decision A). **CAP-2 active.**
- **Next (authorized):** a bounded minimal-core implementation of C1–C4 against the executable witnesses, with an
  independent CAP-2 verification. Not authorized: the complete application, or cycle 4.

## Minimal core C1–C4 and independent CAP-2 verification (2026-10-28, appended; sections above unamended)

Full report: `review/core-v0/milestone-report.md`.
- **Implementation** (`src/`): built by a separate agent from the spec alone, without the author's generator or check
  tools. Pure core, zero dependencies.
- **Independent judge** (`tools/run-witnesses.mjs`): **54/54 C-S1–C-S4 witnesses pass.**
- **Unseen-input differential test:** 28/28 outputs agree between the implementation and the reference generator.
- **CAP-2 (verified by a third agent, independent of the tools' author): Gate 1 MET; Gate 2 NOT MET.** CAP-2 remains active.

| Id | Sev | Finding | Found by |
|---|---|---|---|
| **SDD-F67** | Major | **Reciprocity incomplete:** SDD §5 `html` row ↔ CV-O1–CV-O3 missing from both tables. `citations.mjs` skips rows whose first cell starts with a backtick, which drops this citation and still reports "ok". | independent CAP-2 verifier |
| **SDD-F68** | Minor | **Registry "Cited by" copy errors** for the `full/` and `hostile/` prompt, inventory, skeleton and SDD rows (base-name matching in the author's builder). | verifier and implementer, independently |
| **SDD-F69** | Major | **Template-fill injection:** placeholder text such as `{{CATALOGUE}}` in a description is expanded by a chained fill (the author's reference generator and `witness-check.mjs`). R-S11 does not require single-pass substitution; the independent implementation used it. | unseen-input differential test |
| **SDD-F70** | Major | **The citation rule is under-specified:** citing artifact for multi-id or no-id blocks; the identifier universe (codes, WV-1, § refs); ranges and wildcards; relation to the registry; direction. | independent CAP-2 verifier |
| **SDD-F71** | Minor | **Implementation-surfaced gaps** (the implementer's list, items 1–25): inventory field rules only in witnesses (OS-1); containment-key clash; refusal vs "report still written"; the stderr object shape; uncoded mismatched inputs; the W-PROMPT-OVERSIZE shape; R-S8's previous SDD with no `check` input; shape-error keyword order; catalogue headers defined only by example. | independent implementer |

**Register state:** F67–F71 open, awaiting the registrar's direction. No spec change has been made.

## Targeted correction pass F67–F70, F71 triage, CAP-2 re-verification (2026-10-28, appended; sections above unamended)

Registrar direction: correct F67–F70 in one bounded pass; independent verification preserved; triage F71; no cycle 4.
Spec v0.4.1.

| Id | Disposition | Regression (expected checker, `tools/mutation-test.mjs`) |
|---|---|---|
| **SDD-F69** | **Corrected.** R-S11 now requires single-pass placeholder substitution, so source text stays inert. `witness-check.mjs` is single-pass. New fixture `hostile-placeholders.json` and witness **W-CS3-Δ7** (inventory, skeleton, prompt). These were produced by the independent implementation and are byte-identical to the single-pass reference. The judge also checks R-S11's property from the spec text. The pre-fix witness-check falsely rejects the correct prompt (demonstrated). The review aid `prop-002/aids/gen.cjs` keeps its chained fill as a historical record; it is not used by any check. | "chained fill expands `{{CATALOGUE}}` inside DATA" (resynced) → witness-check |
| **SDD-F67** | **Corrected.** Exclusion is by region (§11 registry tables), not by a cell's leading backtick. The SDD §5 `html` row ↔ CV-O1–CV-O3 is now in both tables, as is WV-1. On the exact failure, the pre-fix tool stays silent and the corrected one names all three pairs (demonstrated). | "SDD §5 row missing from both tables" → citations |
| **SDD-F68** | **Corrected.** "Cited by" is derived by whole relative path, and `registry-check.mjs` verifies the column (`--write` regenerates it). Bare `minimal/` base names in the journeys and scenes are now prefixed, and the hostile/full intermediates are named in their witnesses. | "full/ row copies minimal/ Cited by" → registry-check |
| **SDD-F70** | **Corrected.** The normative citation rule is in SDD §11, items (1)–(7): identifiers, blocks, attribution, citation and ranges, excluded regions, no direction, and the registry relationship. SDD-operator §15 adopts it. One shared reader (`tools/lib/spec-blocks.mjs`) serves both tools. **Round 1** (independent verifier): gate 2 NOT MET, because the rule text under-determined attribution (own-document bold span), the W-PRO id forms and code spans, and "Cited by" missed W-CS4-Δ18. The rule *text* was corrected, not the tables. The whole-path matcher then reproduced the single W-CS4-Δ18 miss on its own. **Round 2** (fresh verifier, no knowledge of round 1): gate 1 MET, gate 2 MET. | (F67 and F68 rows) |
| **SDD-F71** | **Triaged** (`review/core-v0/gap-triage.md`). 4 Blocking: #3 escalated as **Decision C**, #11, #13 and #18 resolved by clarification. 18 Clarification, of which 7 are sentences in existing rules (R-S3, R-S4, R-S11, R-S12, R-S23) and the rest recorded only. 2 Deferred (#1 → OS-1, #24); #25 = F68. | — |

**CAP-2:** both WV-1 gates have now been demonstrated by an independent verifier. Its scripts are in
`review/core-v0/evidence/cap2-round2/`, and round 1's in `evidence/cap2-round1-verify.mjs`. **Lifting CAP-2 is left to
the registrar.** Residual notes from round 2, which do not affect the gates:
- the Stable-identifiers row lists codes that rule item (1) excludes;
- weave-table rows attribute to "SDD-operator §15", not WV-1.

The item (7) jira-assets base-name reading was made explicit.

**Checks:**
- registry-check, witness-check, oracle-check, citations and build-term-list `--check` are ok;
- the independent judge passes 57/57 C-S1–C-S4 witnesses (54 before, plus 3 for W-CS3-Δ7);
- the implementation's own runner passes 48/48;
- the mutation test detects 83 corruptions with their expected checkers, and the control case behaves correctly;
- the unseen-input difftest agrees 28/28.

**Register state:** F67–F70 corrected and F71 triaged. Open: Decision C (registrar) and the CAP-2 lift (registrar).

## Registrar decisions B and C; C-S5 built (2026-10-28, appended; sections above unamended)

- **Decision B: CAP-2 LIFTED** on the round-2 independent verification (gate 1 MET; gate 2 MET, 107 pairs). Evidence:
  `review/core-v0/evidence/cap2-round2/`. Recorded in SDD §11, SDD-operator §15 and both status rows. CAP-2 is
  reinstated only on new evidence.
- **Decision C (Option 1): implemented.** Two containment slots with one key → E-SRC-KEY-COLLISION under R-S2, which
  makes it a v1 limitation. The key format is unchanged. New negative witness **W-CS1-Δ13** uses
  `invalid/two-containers.json`. Before the fix it exited 0 with two `ct:ot:Hard Drive` slots; now it exits 1 with
  exactly that error. A single-container control still parses. The implementer's reading: one type under *one*
  container through two nested selectors also yields two `ct:` slots, so it is refused too, under R-S2 as written.
- **C-S5 repair: built** by the independent implementer (`src/core/repair.mjs`, the CLI command `sdd repair`). The
  independent judge (`tools/run-witnesses.mjs`) now covers C-S5. It checks R-S22 from the spec text, not only witness
  bytes: removing the ERRORS block and restoring the round must give back the checked prompt byte for byte. Its
  results:
  - W-CS5-N passes;
  - W-CS5-Δ1 passes;
  - 6 R-S23 refusals pass, each with nothing written;
  - E-OUT-EXISTS passes;
  - **two end-to-end loops** pass: the minimal W-JS2 chain (byte-equal at every step) and the full fixture
    (rejected E-CHK-RANGE → repair → validated round 2, with no witness file).

  Judge total: **69/69**; the implementer's runner: 61/61.
- **Readings recorded, no spec change** (not blocking):
  - R-S22's ERRORS lines are joined by LF and end with one final LF. The witness bytes fix this, and the judge and
    the implementer chose it independently.
  - A validated report is refused before the input-chain checks. Either way nothing is written.
  - Non-JSON input gives E-IO.
  - Error lines escape U+2028/U+2029 (R-S11).
- **All other checks pass:**
  - registry-check, witness-check, oracle-check, citations and build-term-list;
  - the mutation test detects 84 corruptions with their expected checkers, and the control case behaves correctly;
  - the unseen-input difftest agrees 28/28.

## C-S6 accept built (2026-10-28, appended; sections above unamended)

- **Built by the independent implementer** (`src/core/accept.mjs`, CLI `sdd accept`). The core stays pure: the CLI
  reads the clock and passes `at` in.
- **Independent judge: 91/91.** The C-S6 checks, all written from the spec before the code existed (they failed
  against the prior build):
  - W-CS6-N, Δ2, Δ4, Δ7, Δ9 (both `--checked` orders) are byte-equal. Only the act's own `acceptance.at` is masked,
    after a format and ±5 s check.
  - The W-JS3 and W-JS4 `--previous` merges are byte-equal, carried acceptance records included.
  - The refusals Δ1 (also one unvalidated among validated), Δ3, Δ6 (names the key), Δ8, Δ5 (file unchanged) and
    E-USAGE, E-IO and E-CTX-EXTERNAL all write nothing.
  - A validated report with zero decisions accepts nothing.
  - A forged validated report whose paste smuggles `nullEquivalents`, `acceptance` and `datatype` is refused (the
    paste is re-checked against its report).
  - **End to end:** schema → validated → accept ×3 equals `minimal/sdd.jsonld`. With a partial rejection it equals
    `minimal/sdd-partial.jsonld`, and Cost Center stays open.
- The implementer's runner: 85/85.
- **Readings recorded, no spec change** (none blocking; the witness bytes fix each):
  - containment `itemSha256` is the FL-CONTAINMENT flag entry;
  - R-S18 checks run before the R-S23 chain checks (W-CS6-Δ8 requires it);
  - `open` and `retired` are sorted;
  - on equal highest rounds, the first `--checked` pair wins;
  - a reject also needs coverage;
  - a retired entry is the full previous mapping;
  - the decisions shape is strict;
  - the previous SDD's term list is not compared with the current one.
- **All other checks pass:** the regressions (registry, witness, oracle, citations and term list); the mutation test
  (84 corruptions detected, control correct); the difftest (28/28).

## C-S7 rerun built; SDD-F72; v1 roadmap (2026-10-28, appended; sections above unamended)

| Id | Sev | Finding | Disposition |
|---|---|---|---|
| **SDD-F72** | Major | **A previous SDD built on another term list was carried silently.** Demonstrated: `sdd accept --previous` with a previous SDD whose `termListSha256` differs exited 0 and carried both earlier acceptances unchanged. The spec had no rule. Found against the registrar's C-S7 requirement ("incompatible term-list versions … never silently accepted"). | **Corrected.** R-S17 now applies §11 supersession: a term-list change marks no item `unchanged` and adds FL-TERMS-CHANGED (R-S19), and C-S6's `--previous` merge carries nothing (those keys become `open`). Witnesses W-CS7-Δ3 and W-CS6-Δ10. *Alternative, if the registrar prefers:* refuse outright. Not chosen, because it would discard every earlier decision. |

- **C-S7 built** by the independent implementer (`src/core/rerun.mjs`, CLI `sdd rerun`), with the C-S6 F72 fix in
  `src/core/accept.mjs`.
- **Independent judge: 104/104.** The C-S7 checks were written from the spec before the code existed:
  - W-CS7-N, Δ1 and Δ2 are byte-equal for both the inventory and the plan. Each inventory also equals `sdd parse`
    of the same schema.
  - Δ2 does no silent re-keying.
  - Δ3: another term list gives every item `changed` plus FL-TERMS-CHANGED.
  - W-CS6-Δ10 carries nothing.
  - The refusals (E-CTX-EXTERNAL; E-USAGE for a non-SDD previous; E-IO; E-USAGE; E-OUT-EXISTS with the directory
    untouched) write nothing.
  - **End to end:** the W-JS3 chain (rerun → re-prompt only changed ∪ added → check → accept with `--previous`)
    equals `sdd-v2.jsonld`, and every intermediate is byte-equal. The removal chain retires Cost Center with its
    acceptance record and carries the others byte-identical.
- The implementer's runner: 97/97.
- **Readings recorded, no spec change** (none blocking):
  - previous items are the SDD's `mappings`, so a previously open key comes back as `added`;
  - a kind change counts as `changed`;
  - FL-KEY-SCHEME-CHANGED fires on any identification change, including to or from `mixed`;
  - an errored new schema writes only its inventory (exit 1, no plan);
  - a `--previous` SDD lacking `termListSha256` or `identification` is refused (E-USAGE);
  - the RerunPlan key order follows the witnesses (its schema is part of OS-1).
- **All other checks pass:** the regressions (registry, witness, oracle, citations, term list), the mutation test (84
  corruptions detected, control correct) and the difftest (28/28).
- **`project/PLAN.md`** now shows the five-milestone path to v1. Milestones 1–2 are complete and the offline HTML
  application is next.

## Milestone 3: offline HTML application (2026-10-28, appended; sections above unamended)

- **Decision F72 approved by the registrar:** the term-list change re-opens mappings for decision; no outright refusal.
- **Built by the independent implementer:**
  - `site/` (`app.mjs` view, `session.mjs` state) over the unchanged `src/core/`;
  - `tools/build-site.mjs`, which makes one self-contained `dist/index.html` (902,685 bytes, deterministic, CSP
    `connect-src 'none'`);
  - `context/sdd-v1.jsonld`;
  - `.github/workflows/pages.yml`.
- **Core and CLI:** `src/core` and the CLI are unchanged in git.
- **Independent harnesses** (the author's; written from the operator spec and `harness/UI-CONTRACT.md`, a locator-only
  contract):
  - **H-O1** (`harness/h-o1.mjs`, Playwright/Chromium) covers every W-PRO\* and W-JO1/2/4 scene, workflow 7 (previous
    SDD + changed schema), browser/CLI parity, E-O1 (saved copy, `file://`, offline throughout), E-O2 (5 runs, worst
    binds) and E-O3.
  - **H-O2** (`harness/h-o2.mjs` + `harness/netguard.mjs`) runs the whole CLI judge with every node process guarded.
    It has a positive control that proves the guard blocks and logs.
- **Results:**
  - **Locally (Windows, Chromium 141):** H-O1 passes 24/24, H-O2 3/3, with E-O2 at worst 192 ms.
  - **Reference runner** (`ubuntu-24.04`, Node 22; run 40760792190): H-O2 passes inside `docker --network none` and
    H-O1 passes against `dist/`.
  - **Published page:** H-O1 passes 23/23 locally and on the runner (run 40760873398). The page is byte-identical to
    the local build, and the context is served at its IRI as `application/ld+json`.
  - **JSON-LD context:** all 30 witness artifacts expand under rdflib with no key dropped, and class and relation
    fields become IRIs.
- **Harness correction (one):** W-PRO1-Δ5 had assumed that an undecided open key is shown as an empty row. The page
  shows no row until a reply covers the key, which also satisfies "no new decision exists". The assertion was
  widened to accept either form.
- **Implementer's readings, recorded with no spec change:**
  - On Windows, copying uses a copy event: Chromium's async clipboard turns LF into CRLF there, which would break
    PR-O6(a).
  - Decisions stay changeable after a save; every save is a new file.
  - Accept and Reject need a typed name first.
  - "Accept all N" counts undecided validated items only, so it never overrides a Reject.
  - Warnings are shown in their item's row.
  - Saving needs a validated report, as the CLI requires `--checked`.
- **OO-1 closed.** Readiness remains BLOCKED on OO-2 and OS-1, OS-3, OS-4 and OS-6 (milestone 4).

## Milestone 4: release verification, first reference run (2026-10-29, appended; sections above unamended)

- **OS-3 harness** (`harness/props/`, by an independent verification agent working black-box from the spec):
  generators G1 and K1, a correct-proposal generator, and V-S1–V-S6. Run on the reference runner (`ubuntu-24.04`,
  Node 22.23.4, 4-core AMD EPYC 9V45, 16 GB, Chromium 141; run 40879236007, seed `rc-fbc466c…`):
  - V-S1 217/217, V-S2 200/200, V-S3 100/100 and V-S6 250/250;
  - **V-S4 192/200 and V-S5 99/100.**
- **All 9 failures were harness defects, not product defects.** Each was reproduced byte-for-byte on Windows with the
  same seed, which also shows determinism across platforms.
  - **H-1 (V-S4, 8 cases):** the harness injected K1 text (`-----END DATA-----`, `-----BEGIN CATALOGUE-----`) into
    a *pasted* key. The repair prompt echoed that key inside an `E-CHK-UNKNOWN-KEY` JSON line, as R-S22 requires, and
    the source-string scan counted it as a source string outside DATA.
    - In all 8 cases the key was present in the paste and absent from the schema.
    - The structure clause (ii) held in all of them: exactly one END DATA line, and no CR or U+2028/U+2029.
    - *Fix:* the source scan now skips R-S22's ERRORS lines. A new, stricter clause requires the ERRORS lines to be
      exactly the report's errors, `JSON.stringify`'d, in report order.
  - **H-2 (V-S5, 1 case):** the schema-edit step reused a type name ("New Type 11"). The product correctly refused the
    schema (E-SRC-DUP-TYPE and the resulting attribute-key collision; exit 1; errored inventory written) and the
    harness expected success. *Fix:* added types get a fresh, unique name and externalId.
  - **After the fixes, same seed:** V-S4 passes 200/200 (the new clause 200/200) and V-S5 passes 100/100.
- **Envelopes on the reference runner (OS-6)** all pass:
  - E-S1 worst 172 ms (limit 2 s);
  - E-S2 worst 120 ms on a 5,233-slot schema (limit 5 s);
  - E-S3: one batch of 70,855 bytes.

  *Reading:* E-S2's "5,000-slot G1 schema" exceeds G1's own bounds (about 720 slots), so it is G1 with the type
  count raised (`harness/props/bench-e-s2.mjs`).
