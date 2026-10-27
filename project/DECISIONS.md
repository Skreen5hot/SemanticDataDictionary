# Architecture Decision Records

Decisions that shape the SDD Service spec. Each cites the cycle-1 findings it resolves
(`review/register.md`). Status values: **Accepted** (registrar decided), **Proposed** (awaiting the registrar).

---

## ADR-001: Two individuals per source record (record and referent)

**Date:** 2026-10-27 · **Status:** Accepted (registrar)
**Resolves:** SDD-F03, SDD-F09, SDD-F10, SDD-F19 (and frames F01, F17)

**Decision.** Every source record yields at least two individuals, never one:

1. **The record:** an information artifact asserting something. Its provenance belongs here: source system,
   source record identifier, and the times it was created, updated and imported.
2. **The referent:** the entity the record is *about* (a hard drive, a file, a person), typed by the mapping.

The record is *about* the referent. Attribute values are carried by the record's information content, never as
literals inhering in the referent (preserving SDD v2.0's commitment that literals do not inhere in entities).

**Context.** SDD v2.0 claims rows are assertion events but maps the row straight to the asserted process (F03),
and its own example drops the assertion (F09). The format had one `maps_to_class` slot per table, so the
thesis was unimplementable (F10). Provenance was claimed but had nowhere to live (F19).

**Consequences.**
- The SDD format carries **two class slots per object type**: `record_class` and `referent_class`.
- Provenance fields are mapped onto the record individual, not the referent.
- This fits Jira Assets especially well: an Assets object *is* a CMDB record describing a real thing, so the
  record and the referent are separate entities by nature.
- The exact CCO/IAO classes for the record are decided in the spec against the **pinned** ontology artifacts
  (ADR-005) and checked with IRI_Linter (F06).
- **No third individual in v1** (registrar, 2026-10-27). A separate assertion-*process* individual (with an
  agent and a time) is not required. Phase 2 MAY evaluate it, but MUST NOT introduce it without a concrete
  requirement that the record-plus-referent model cannot satisfy, recorded as a new ADR.

---

## ADR-002: First profile is the Jira Assets object schema

**Date:** 2026-10-27 · **Status:** Accepted (registrar)
**Resolves:** SDD-F04

**Decision.** v1 of the service accepts **Jira Service Management Assets import schemas** (object types,
attributes, references, type hierarchy, import mappings). Star and snowflake warehouse schemas are a declared
non-goal for v1 (an `NG-*` entry), and may become a second profile later.

**Consequences.**
- Source concepts: object type → referent class (plus record class, ADR-001); attribute → information content
  about the referent; `referenced_object` attribute → candidate semantic relation (the joins);
  `externalIdPart` / `label` → identifiers and designations.
- **`objectTypes[].children` is type hierarchy, not containment.** It MUST NOT be turned into subclass or
  part-of relations without an explicit mapping decision. Containment evidence comes from import-mapping
  selectors (for example `hardDrives.files`) and is flagged for judgment, never inferred silently.
- Attribute-type coverage is enumerated in the spec and **confirmed against Atlassian's published import-schema
  documentation** before it is treated as complete.
  **Correction (Phase 1, 2026-10-27):** the draft list here was wrong. Atlassian's JSON Schema (`2021_09_15`, the
  only published version) defines exactly 13 types: `text, integer, boolean, double, date, time, date_time, url,
  email, textarea, select, ipaddress, referenced_object`. There is no `status` or `user` type. Evidence and hash:
  [`SOURCE-FORMAT.md`](SOURCE-FORMAT.md).
- Fixtures are **synthetic**. The enterprise schema is never shared, so the spec's witnesses use a synthetic
  schema that exercises every attribute type and edge case.

---

## ADR-003: One null rule, absence is unasserted

**Date:** 2026-10-27 · **Status:** **Accepted with amendment** (registrar, 2026-10-27)
**Resolves:** SDD-F05, SDD-F17, SDD-F18 (and rejects ariadne coherence-review F-S11-1)

**Rule (R-NULL), as proposed.** When a source record has no value for an attribute (the attribute is absent, empty,
or a reference is unset), the mapping generates **no assertion about the referent** for that attribute:

1. **Nothing is instantiated about the world.** No placeholder individual, no `information_gap` entity, no
   negated claim, no "latent" role. (Resolves F17 and F18: positing anything is itself an assertion.)
2. **The absence is recorded on the record, not the referent.** The record individual MAY list its
   unasserted attributes as provenance ("record R did not state attribute A"). That is a true statement about the
   record, and a downstream user can tell "unknown" apart from "known to be absent".
3. **An explicit null is still absence.** An empty string, `null`, or a placeholder value is never a
   negative assertion. ariadne's F-S11-1 reading is rejected.
4. **Null-equivalent values are declared, never guessed.** A value like `"N/A"` or `"-"` is treated as absence
   only if the SDD lists it as a null-equivalent for that attribute. Otherwise it is an ordinary value.
5. **Negation needs an explicit mapping.** A claim that something does *not* hold (for example a boolean
   attribute `Encrypted = false`) is produced only when the SDD maps that specific value to a stated
   meaning, and never from absence.

**Why this rule.** It is the only reading consistent with open-world semantics and with ADR-001. Since every
claim has an asserter, "the source said nothing" is a fact about the source, so it belongs on the record.

**Amendment (registrar, 2026-10-27).** Where the source makes them distinguishable, three kinds of absence are
kept apart as **record-level metadata**:

| Kind | Source shape (example) | Recorded on the record as |
|---|---|---|
| **Missing attribute** | the attribute key is not present on the object | `missing` |
| **Explicit null** | the attribute is present with value `null` | `explicit_null` |
| **Empty string** | the attribute is present with value `""` | `empty_string` |

None of the three ever becomes an ontological assertion about the referent. Where the source cannot distinguish
them (for example, an export that renders all three identically), the record states that the kind is
indistinguishable rather than guessing. Attribute-specific null-equivalences (rule 4) remain **explicitly
configurable** per attribute in the SDD and are never inferred.

---

## ADR-004: The LLM proposes through an air gap; the human accepts; the tool checks

**Date:** 2026-10-27 · **Status:** Accepted (registrar)
**Resolves:** frames the service's experience level (P11 applies)

**Decision.** The service has **no integrated LLM** and makes **no network calls**. The ontological mapping is
proposed by the enterprise LLM through a manual relay:

1. The tool **generates a prompt**: the structural skeleton (from the schema), the pinned list of permitted
   BFO/CCO terms, the required output format (a JSON Schema), and the mapping rules (ADR-001 to ADR-003).
2. The user **pastes the prompt into the secure enterprise LLM**, then **pastes the LLM's output back** into the tool.
3. The tool **checks the output deterministically**: format, full coverage (every object type, attribute and
   reference mapped exactly once), only permitted terms, BFO category checks, and the mapping rules. Every error
   names the item and the rule it breaks.
4. On errors, the tool **generates a repair prompt** listing only the errors, and the relay repeats.
5. The **human accepts or rejects each mapping** explicitly. Only accepted mappings enter the final SDD, which
   records who accepted what and when.

**Consequences.**
- **Edge-canonical end to end.** The tool is an offline single HTML page plus a Node CLI that run the same core.
  The enterprise schema never leaves the user's machine except through the user's own paste into the enterprise LLM.
- **Pasted LLM output is untrusted data,** never instructions. The same applies to schema text placed in the
  prompt: Jira descriptions can contain text that steers the LLM, and the checks, not the LLM's compliance, are
  the guarantee.
- **The relay loop is an interaction over time,** so the spec needs a companion experience document (method
  §4A) with promises and adversarial scenes. Examples: "nothing is accepted without an explicit human act";
  "a hostile or malformed paste never corrupts accepted work"; "the tool never transmits".
- **Determinism boundary:** everything except the LLM is deterministic and tested exactly. The LLM's output is
  declared non-deterministic, and every acceptance property is stated on what the tool *does* with it.
- **Validity is not correctness** (registrar clarification, 2026-10-27). The tool's checks establish only
  *structural and logical validity*: well-formed, complete coverage, permitted terms, no BFO category errors,
  rules satisfied. They do **not** establish that a mapping *means the right thing*. The tool MUST NOT present a
  passing check as semantic approval. **Human acceptance is the final authority on meaning**, and the SDD records
  both separately: "validated" (by the tool) and "accepted" (by a named human).

---

## ADR-005: Permitted terms come from Ontology-Template's pinned artifacts

**Date:** 2026-10-27 · **Status:** Accepted (registrar)
**Resolves:** SDD-F06 (and SDD-F13's "pinned relation" requirement)

**Decision.** The permitted BFO/CCO term list is **derived from the actual pinned ontology artifacts vendored in
`Skreen5hot/Ontology-Template`**. No release is selected independently, and none newer than those pins is used.

**Consequences.**
- The derivation is a deterministic, offline extraction from those artifacts. The resulting term list records:
  ontology names and versions, the Ontology-Template **source commit**, and the **sha256 of every artifact** read.
  Anyone can regenerate the list and get identical bytes.
- Prompts, checks and the SDD itself cite the term-list hash, so a mapping environment is reproducible.
- Upgrading ontologies means re-pinning in Ontology-Template first, then regenerating the term list. That is a
  supersession event for every accepted SDD that cites the old hash.

---

## ADR-006: JSON-LD is the canonical representation

**Date:** 2026-10-27 · **Status:** Accepted (registrar)

**Decision.** The SDD and every inter-component contract (inventory, skeleton, proposal, check report, accepted
SDD) are **JSON-LD**, with a **fixed, versioned, locally resolvable `@context`** shipped with the tool.

**Consequences.**
- **No external context fetching.** A document whose `@context` is a remote URL that is not one of the tool's own
  local contexts is rejected. Contexts are resolved from the bundled copy only, keeping the system edge-canonical.
- Each artifact is checkable deterministically twice: **JSON Schema** (shape) and **SHACL** (graph constraints,
  aligned with Ontology-Template's shapes where applicable).
- Contexts carry a version in their identifier. Changing a context is a supersession event (method P10).

---

## ADR-007: v1 boundary: definitions not instances, fixed architecture, traceability, fixed scope

**Date:** 2026-10-27 · **Status:** Accepted (registrar)

**Decision.**

1. **Mapping definitions are not RDF individuals.** An SDD contains *mapping definitions*: for each source object
   type, attribute and reference, which classes and relations its records and referents will be typed with. It
   contains **no instance data**. The RDF individuals (a specific hard drive, its record) are created only by a
   **future materialization service** that applies an accepted SDD to Jira records. That service is outside v1, a
   declared non-goal (`NG-*`), and the SDD's vocabulary MUST keep the two apart (for example, `referent_class`
   names a class to instantiate later and never denotes an individual).
2. **Architecture is fixed:** a shared, pure computation core, JSON-LD contracts (ADR-006), an offline HTML
   interface and a Node CLI over that same core, and **no mandatory infrastructure** (no server, database, queue
   or network).
3. **Source-to-semantic traceability.** The SDD preserves, for every mapping, the original source object type,
   attribute, reference, and identifier definitions (external IDs, names, types), and the explicit mapping
   decision made: who proposed it (which LLM round), its validation result, and who accepted it and when. Every
   semantic statement in the SDD traces back to the source element it came from.
4. **Scope is fixed at the seven agreed capabilities** (C1 parse, C2 skeleton, C3 prompt, C4 check, C5 repair
   prompt, C6 accept, C7 re-run on schema change). Anything else is a non-goal for v1, or needs a new ADR.
