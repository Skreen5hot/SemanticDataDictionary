# prop-002: SDD Service spec pair v0.3 → v0.4

**Status:** proposed, **not merged**. Drafted 2026-10-27 under the registrar's cycle-3 authorization.
**Proposed state:** branch [`prop-002`](https://github.com/Skreen5hot/SemanticDataDictionary/tree/prop-002) @ `d268019`
(based on `main` @ `7b56b8a`). **Diff:** [`prop-002.diff`](prop-002.diff) covers `spec/`, `project/`, `tools/` and
`.gitattributes` (1,231 lines). Fixture and witness changes (60 files) are on the branch; every one is listed with its
sha256 in the proposed SDD §11 registry. **Merge rule:** only on the registrar's command. No cycle 4.

## Root-cause fixes (registrar direction 2 and 3)

| Cause | Fix | Independent of the generator? |
|---|---|---|
| Inputs embedding a superseded digest were never regenerated (F50) | The generator builds **every** witness, pastes and decisions included, from the current pins | — (this is the generator) |
| Hash checks could not see digests *inside* files (F50) | `tools/witness-check.mjs`: every embedded digest must name a current, non-superseded file; typed relations between prompt, paste, report, skeleton, inventory and SDD; R-S11 prompt rules re-derived from the spec text | yes: bytes and spec relations only |
| Witness outputs were validated only by the code that made them (F52) | `tools/oracle-check.mjs` feeds each report's own prompt and paste to `tools/oracle/oracle-b.cjs`, the checker written by isolated rater B from the spec alone, kept byte-for-byte | yes: different author, different code |
| Seam check matched a closure row and compared it with itself (F51) | `tools/citations.mjs`: a seam row's first cell is exactly one `S-On`; registry rows and reciprocal tables are derived indexes, not citations | yes |
| No proof the checks catch anything | `tools/mutation-test.mjs` plants corruptions and requires a failing check | yes |

## Verification results (on branch `prop-002`)

| Check | Result |
|---|---|
| `node tools/registry-check.mjs` | ok: 93 rows recompute (62 current + 31 superseded); all 93 governed files listed; prose prefixes resolve to **current** hashes only |
| `node tools/witness-check.mjs` | ok: 44 witness files, 359 embedded digests; 8 prompts obey R-S11 |
| `node tools/oracle-check.mjs` | ok: all 8 CheckReport witnesses agree with the independent oracle (errors, warnings, order, status) |
| `node tools/citations.mjs` | ok: 97 cross-document citations, identical tables; 6 mirrored seam rows identical |
| `node tools/mutation-test.mjs` | **ok: baseline clean; 76/76 corruptions detected**: replays of F50, F51 and F52, a dropped error, a status lie, provenance and item-hash tampering, a raw U+2028, a dropped catalogue line, term-list drift, a dropped or unrecorded citation, a stale prefix, an unlisted file, and one byte flipped in each of 62 governed files. Every re-synced corruption is also caught by a non-hash check. |
| `node tools/build-term-list.mjs --check`; `tools/verify-hierarchy.py` | ok; rdflib matches on 6/6 edge sets |
| Against `main` (v0.3), for contrast | witness-check reports F50 and F59; oracle-check reports F52 |

**What independent checking found during drafting (now resolved in the spec):**
- **Two ambiguities the oracle exposed.** (1) R-S8's "needed referentClass": the independent reading (warn when either endpoint is unknown) was adopted and stated. (2) Whether a `referentClass` of exactly `cco:ont00000958` raises one warning or both: both are raised, GENERIC first.
- **A real separator defect.** The first escaping attempt still let raw U+2028 through, and a JavaScript multiline regex then found `-----END DATA-----` twice. The prompt rules now catch that.
- **A defect in the new registry check itself.** A stale prose prefix "resolved" against the superseded table. Prefixes now resolve to current hashes only; the mutation test covers it.

## Dispositions: SDD-F50 to SDD-F66

| Finding | Disposition | Where |
|---|---|---|
| F50 stale skeleton in pastes | **resolved** + cause fixed | generator builds inputs; witness-check; §11 "Embedded digests" |
| F51 corrupt S-O1; false seam pass | **resolved** + cause fixed | citations.mjs exact seam match; S-O1 restored; mutation-tested |
| F52 error order vs R-S20 | **resolved** (witnesses follow R-S20) | bad report, J-S2, repair prompt, W-PRO5-N; oracle-checked |
| F53 PR-O4(b) via keys/values/names | **resolved** | PR-O4(b) binds tool-composed text; artifact text always quoted (RV-O3, RV-O4); R-S14 scoped; K2 extended; W-PRO4-Δ3 |
| F54 U+2028 forges END DATA | **resolved** | R-S11 escaping + "line" = LF-delimited; W-CS3-Δ6, `hostile/prompt.txt`; V-S4(ii) |
| F55 CLI signature gaps | **resolved** | `--out` on every single-output command; `rerun --out-dir`; key lists are the person's step; S-S1/S-S6 consumers corrected |
| F56 J-S3/J-S4 not literal | **resolved** | every step has a witness file; W-CS6-Δ2, W-CS7-Δ1/Δ2 literal |
| F57 orphan sub-clauses | **resolved** | W-CS4-Δ16 (unresolved range), Δ18 (E-USAGE); W-CS6-Δ8 (skeleton branch), Δ9 (highest round); R-S14/R-S16/R-S23/R-S9 properties in V-S5/V-S6; `{expected}` defined; §12 sentence fixed; NP-O5's CRLF claim removed |
| F58 witness-only universals | **resolved** | V-S2 (R-S4, R-S19), V-S3 (greedy fill), V-S5 (R-S14, R-S16, R-S23), V-S6 (R-S9, R-S15), V-O1 (`acceptorName`, PR-O3(a)); PR-O2 mapped to V-O2 |
| F59 registry incomplete; README hash | **resolved** | registry lists every governed file + a superseded table; completeness enforced; README hash corrected (and every README abbreviation re-verified) |
| F60 stale version markers | **resolved** | v0.4 throughout; "Ver *n*" defined |
| F61 OS-2 counts | **resolved** | term-list and source-file counts stated separately |
| F62 incoherent baseline; §1 overclaim | **resolved** | Software→Hardware now `bfo:BFO_0000084` *generically depends on*; §1 scoped to NG-S9 |
| F63 ADR-004 step 4 vs R-S22 | **resolved pending registrar** | amendment drafted in `project/DECISIONS.md` (decision A below) |
| F64 citation graph too narrow | **resolved** | section-level attribution; G1/K1/G2/K2 citable; 97 citations (was 59) |
| F65 PR-O1 scoping | **resolved** | carried mappings keep their original act; (c) covers opened SDDs; W-PRO1-Δ5 |
| F66 scene precision | **resolved** | `at` fixed at the click; E-CTX-EXTERNAL row and message defined; seeded garbage; RV-O3 source block exercised by W-PRO6-Δ2 |

## Summary

**Scope:** the seven capabilities, the architecture and the v1 boundaries are unchanged. There is no new functionality.
The additions are checks (`witness-check`, `oracle-check`, `mutation-test`, the oracle file), witness files, two
fixtures (`hostile-separators.json`, `minimal-organization-v3-removed.json`) and spec clarifications.

**Registrar decisions needed:**
- **A. ADR-004 step 4 amendment (F63):** the repair prompt lists the errors *and* resends the batch (as R-S22 has done since v0.2).
- **B. Independent verification for CAP-2.** CAP-2 stays active as directed. The reciprocity evidence is now mechanical and mutation-tested, but it is the author's. Proposed route: verify it during the minimal core implementation, by a separate agent that did not write the tools, or accept the mutation-test record as sufficient.

**Unresolved (named, unchanged):** OS-1 (the remaining artifact schemas, the context, SHACL), OS-3/OO-2 (generators),
OS-4/OO-1 (execution), OS-6 (bench). These are the subject of the next, separately authorized step: a minimal core
implementation run against these executable witnesses.
