# Minimal core (C1–C4): milestone report

**Date:** 2026-10-28. **Spec:** v0.4 @ `72dec09`. **Scope:** C-S1 parse, C-S2 skeleton, C-S3 prompt, C-S4 check only.

## How it was done: independence by construction

| Role | Who | Saw | Did not see |
|---|---|---|---|
| Implementer | a separate agent | the spec, schemas, term list, template, Atlassian schema, fixtures and witnesses | the author's generator, check tools, review records |
| Judge, `tools/run-witnesses.mjs` | the author, written from the spec text | — | the implementation's code |
| Differential test, `evidence/difftest.cjs` | the author's reference generator vs. the implementation | **unseen** fixtures, never given to the implementer | — |
| CAP-2 verifier | a third agent | the two spec documents + the method | every existing tool |

## Results

| Capability | Executes | Witnesses (independent judge) | Unseen-input agreement |
|---|---|---|---|
| C-S1 parse | yes | 14/14 (N, Δ1–Δ12, 3 chain inventories) | 3/3 inventories |
| C-S2 skeleton | yes | 6/6 (N, Δ1–Δ3, 2 chain skeletons) | 3/3 skeletons |
| C-S3 prompt | yes | 9/9 (N + PromptSet, Δ1–Δ6, rerun subset), incl. byte-exact 2-batch and hostile prompts | 10/10 prompts (single and multi-batch) |
| C-S4 check | yes | 23/23 (N, Δ1–Δ18, 4 chain reports, Δ5/Δ15/Δ16 full fixture), 52/10 injection outcome exact | 6/6 reports (valid + corrupted) |
| CLI contract | yes | 2/2 extra (E-IO exit 2, E-OUT-EXISTS leaves the file intact) | — |

**Total: 54/54 witnesses pass under the independent judge** (the implementer's own runner: 48/48). The implementation is
`src/core/` (pure: no fs, network, clock, randomness or `process`; zero dependencies; its own SHA-256 and JSON-Schema
subset, so it is browser-capable) and `src/cli/sdd.mjs`, about 1,230 lines.

## Defects demonstrated (for registrar direction; not yet fixed)

- **SDD-F69 (major, demonstrated by the unseen-input test): template-fill injection.** A description containing
  `{{CATALOGUE}}` or `{{DATA}}` is expanded by a chained template fill: the author's reference generator did this and
  corrupted the prompt. The implementation uses single-pass substitution and was right. R-S11 does not require single
  pass. `tools/witness-check.mjs` fills the template the same chained way and would falsely reject a correct prompt for
  such a schema. *Proposed:* R-S11 states that placeholders are substituted in one pass and source text is never
  expanded; add the hostile placeholder text to a fixture; make witness-check single-pass.
- **SDD-F67 (major, CAP-2): reciprocity incomplete.** The independent verifier found SDD §5's `html` row citing
  SDD-operator CV-O1–CV-O3 missing from both tables. Cause: `tools/citations.mjs` skips every table row whose first
  cell starts with a backtick (meant for registry rows), which also drops this real citation. The tool reported "ok".
  *Proposed:* exclude registry rows by section, not by backtick; add this case to the mutation test.
- **SDD-F68 (minor): registry "Cited by" copy errors.** The `full/` and `hostile/` rows for prompt, inventory, skeleton
  and SDD copy the `minimal/` rows' citers (the author's registry builder matched on base names). Found independently by
  both agents. *Proposed:* match on full relative paths.
- **SDD-F70 (major): the citation rule is under-specified** (independent verifier). Undefined: the citing artifact for
  blocks defining several ids or none; the identifier universe (error codes, WV-1, `§` references); range and wildcard
  expansion; how the table relates to the registry; and direction (the merged table cannot tell which side's
  supersession fires). The method's own example also records `NG-L0 | WV-1`. *Proposed:* state the rule fully in SDD §11
  (one normative paragraph), then re-verify.
- **Implementation-surfaced spec gaps (25, mostly minor),** recorded by the implementer with the interpretations it
  chose. The material ones:
  - Inventory field rules exist only in witnesses (OS-1 schemas would fix this).
  - Containment-key clash when a type has two nested selectors.
  - Refusals (E-CTX-EXTERNAL, E-SKEL-ERRORED, E-PROMPT-BUDGET) vs. R-S23's "report still written".
  - The stderr error-object shape.
  - Mismatched-input cases with no code (handled as E-USAGE).
  - The W-PROMPT-OVERSIZE shape.
  - R-S8's "previous SDD" with no `check` input for it.
  - Shape-error keyword order.
  - The catalogue header lines, defined only by example.

## CAP-2: independent verification result

**Gate 1 (seams mirrored): MET.** All six S-O rows are byte-identical, filled, and their hashes match the registry.
**Gate 2 (citations reciprocal): NOT MET** under every reading tested: the closest reading misses 3 pairs
(SDD-F67), and broader readings add more (SDD-F70). **CAP-2 remains active.** The two tables are identical to each
other; the failure is completeness.

## What remains

- **Spec:** F67–F70 and the implementer's gap list (above).
- **Outside this milestone:** C-S5–C-S7, the HTML tool, property generators (G1/K1, G2/K2), H-S1/H-O* harnesses, benches.
