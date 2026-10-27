# Provenance: pinned CCO source (Option B, ADR-008)

`CommonCoreOntologiesMerged.ttl` is the **same file Ontology-Template pins** for CCO, byte for byte. It is vendored
so the class hierarchy can be derived offline. It is not a newer or different release.

- **Upstream:** `CommonCoreOntology/CommonCoreOntologies`, commit `510dad76be0ef710b65a421075af912af25342b7`
  (release `v2.0-2024-11-06`), path `src/cco-merged/CommonCoreOntologiesMerged.ttl`.
- **sha256:** `e609db27478a2c8b52b9bb5eb5ac979ac323510e851c368e4d9ec7d1c153fe5b` (1,239,810 bytes). This equals
  the digest Ontology-Template records for its CCO pin (`vendor/ontology-template/cco-register.json` → `files[0].sha256`),
  which is where `tools/build-term-list.mjs` reads the expected value from. A mismatch refuses the build.
- **Retrieved:** 2026-10-27 from `raw.githubusercontent.com` at the pinned commit.
- **Licence:** BSD-3-Clause. Attribution: *Common Core Ontologies v2.0. Copyright (c) 2017 CUBRC, Inc., licensed
  BSD-3-Clause.* (see `../ontology-template/NOTICE.md`). Licence text at the pin:
  https://github.com/CommonCoreOntology/CommonCoreOntologies/blob/510dad76be0ef710b65a421075af912af25342b7/LICENSE

## How it is used

`tools/turtle-subclass.mjs` (zero dependencies) reads the named `rdfs:subClassOf` edges. It was validated against an
independent oracle, **rdflib 7.1.1**, with `tools/verify-hierarchy.py` on 2026-10-27: an exact match on both inputs.

| File | Named edges | Anonymous superclass expressions (counted, not followed) |
|---|---|---|
| `CommonCoreOntologiesMerged.ttl` | 1,421 | 111 |
| `../ontology-template/bfo-core-extract.ttl` | 35 | 0 |

## Retirement

This is a stopgap pending request `SDD-OT-2026-10-27-cco-class-hierarchy-register`. When Ontology-Template ships a
hierarchy register from the same pin, the two derivations are compared, then this directory is removed and the
term list is rebuilt from Ontology-Template's artifact alone.
