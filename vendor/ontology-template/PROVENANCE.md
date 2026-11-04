# Provenance: Ontology-Template pinned artifacts

Per ADR-005, the permitted-term list is derived only from the pinned ontology artifacts vendored in
`Skreen5hot/Ontology-Template`. The files in this directory are byte-identical copies of those artifacts.

- **Source repository:** https://github.com/Skreen5hot/Ontology-Template
- **Source commit:** `7cfdfbfe5dde13be7a0fd99b52711bdb0cdee3fb` (2026-11-03; on Ontology-Template's `main`, not a
  release, ADR-009). Previously `114f28db82adf727f5e31aab4872ed56550e84af` (2026-10-27).
- **Copied:** 2026-10-27, and the hierarchy registers with the changed manifest, sources and notice on 2026-11-04.
  Each file's sha256 was verified against Ontology-Template's own manifest (`upstream-extracts.json`, copied here)
  before copying. The registers and BFO files are byte-identical at both commits.

| File | Ontology-Template path | Upstream | sha256 |
|---|---|---|---|
| `bfo-register.json` | `vendor/bfo/bfo-register.json` | BFO 2020 `release-2024-01-29` @ `044490fc…` (76 terms) | `ff473b47aae7610e11303166bfc9ab6c46e234cea0b7265e16f19c0283986186` |
| `bfo-core-extract.ttl` | `vendor/bfo/bfo-core-extract.ttl` | BFO 2020, all terms in full | `8bbeda8fe261f74e766fb186e51e9b28e1c42948403c66c776247f84e641ecd2` |
| `bfo-disjointness.ttl` | `vendor/bfo/bfo-disjointness.ttl` | BFO 2020, 21 pairwise disjointness axioms | `a4447e93b2024d8f93c06800cf0e35580ec097246fe08f984593272c43bdbfa5` |
| `cco-register.json` | `vendor/cco/cco-register.json` | CCO `v2.0-2024-11-06` @ `510dad76…` (1,995 terms) | `6ae382fafc5b3b1098ec155bf8d5f956921a8219a282ccbda79f3ce22d61185c` |
| `bfo-hierarchy.json` | `vendor/bfo/bfo-hierarchy.json` | BFO 2020, every class's named direct superclasses (36 classes) | `dc404065db47eddd820124e977095d8278c09317373302342a9a7846835e4947` |
| `cco-hierarchy.json` | `vendor/cco/cco-hierarchy.json` | CCO v2.0, every class's named direct superclasses (1,385 classes, 1 outside namespace) | `8d2461b9a5805141713d54e618ad102c18dd7db0680e86a11beb2a4f7c054194` |
| `upstream-sources.yaml` | `config/upstream-sources.yaml` | the pins themselves | — |
| `upstream-extracts.json` | `config/upstream-extracts.json` | the manifest of hashes above | — |
| `NOTICE.md` | `vendor/NOTICE.md` | attribution required by both licences (BFO CC-BY-4.0, CCO BSD-3-Clause) | — |

`tools/build-term-list.mjs` re-verifies every hash against `upstream-extracts.json` before it reads anything, and
refuses to run on a mismatch.

**Known limit:** the registers record every term's existence, labels and OWL types, and the hierarchy registers
every class's named superclasses (ADR-009, answering `SDD-OT-2026-10-27-cco-class-hierarchy-register`). Neither
records object-property **domain and range**, so those are still read from `../cco-upstream/` (ADR-008).

**Upgrading:** re-pin in Ontology-Template first, then re-copy these files at the new commit and regenerate the term
list. Every accepted SDD citing the old term-list hash is then superseded (ADR-005).
