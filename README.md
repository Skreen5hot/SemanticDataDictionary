# Semantic Data Dictionary (SDD)

An edge-canonical service for building **Semantic Data Dictionaries**: machine-readable JSON artifacts that map an
existing data schema (tables/object types, columns/attributes, foreign keys/references) onto a realist
BFO / CCO / IAO model — without restructuring the source system.

**Status:** specification only. Implementation has not started.

## Specification

[`SDD-V2.0-SPEC.md`](SDD-V2.0-SPEC.md) — *Formalizing Semantic Data Dictionaries for Realist Star Schemas, Version 2.0*
(Draft, January 2026). Moved from the FNSR spec library:
`Skreen5hot/ariadne` → `docs/03-specifications/semantic-data-dictionary.md`
(introduced in `e10529d`, copied byte-identical from ariadne `10eef18`).

Key commitments of the spec:

- Rows are **assertion events**, not bare facts.
- Columns map to **identifiers**, **information content entities** (ICE) concretized by **information bearing
  entities** (IBE), or literals — literals do not inhere in real entities.
- Foreign keys become **typed, invertible semantic relations** (with role classes where a role is realized).
- A missing value is an **absence of assertion** (`iao:information_gap`), never a claim of nonexistence.
- Temporal columns carry explicit **instant vs. interval** precision.

## Principles

- **Edge-canonical:** every deterministic step runs offline — in a browser or with Node — with zero network calls.
- **Deterministic where possible, judgment where necessary:** structural extraction and validation are mechanical
  and reproducible; ontological mapping decisions are proposals (from a human or an LLM) that must pass
  deterministic validation and human acceptance.

## License

[MIT](LICENSE)
