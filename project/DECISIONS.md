# Architecture Decision Records

Decisions that shape the SDD Service spec. Each cites the cycle-1 findings it resolves
(`review/register.md`). Status values: **Accepted** (registrar decided), **Proposed** (awaiting the registrar).

---

## ADR-001: Two individuals per source record (assertion and referent)

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
- The exact CCO/IAO classes for the record (and whether the act of assertion is a third, process individual)
  are decided in the spec against a **pinned** CCO release and checked with IRI_Linter (F06).

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
- Attribute-type coverage (text, integer, boolean, date, datetime, select, status, user, URL, email,
  referenced object, and so on) is enumerated in the spec and **confirmed against Atlassian's published import-schema
  documentation** before it is treated as complete.
- Fixtures are **synthetic**. The enterprise schema is never shared, so the spec's witnesses use a synthetic
  schema that exercises every attribute type and edge case.

---

## ADR-003: One null rule, absence is unasserted

**Date:** 2026-10-27 · **Status:** **Proposed** (the registrar asked for a rule; this is the proposal)
**Resolves:** SDD-F05, SDD-F17, SDD-F18 (and rejects ariadne coherence-review F-S11-1)

**Proposed rule (R-NULL).** When a source record has no value for an attribute (the attribute is absent, empty,
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
