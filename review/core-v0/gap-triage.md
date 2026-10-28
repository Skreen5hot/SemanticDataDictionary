# SDD-F71: triage of the 25 implementation-surfaced gaps

**Date:** 2026-10-28. **Source:** the independent implementer's list (C1–C4 milestone). **Direction:** classify each
gap as Blocking, Clarification or Deferred; adopt the simplest interpretation consistent with the architecture; escalate
only genuine design choices. Nothing here adds a requirement: a clarification is a sentence inside an existing rule,
or no text at all where the existing rule already determines the answer.

**Classes.** *Blocking* = a wrong guess could make a conforming implementation diverge, or would block C-S5.
*Clarification* = the implementer's reading is the only reasonable one; it is adopted. *Deferred* = it belongs to an
open item or a later slice and does not affect C1–C4 or C-S5.

## Blocking

| # | Gap | Resolution | Where |
|---|---|---|---|
| 3 | A type under two containers yields two containment slots with the same key `ct:` + type key | **Unresolved: escalated (Decision C below).** Demonstrated: a fixture mapping `Hard Drive` under both `servers.disks` and `laptops.drives` parses (exit 0) to two FL-CONTAINMENT flags, and the skeleton holds two slots keyed `ct:ot:Hard Drive`. | R-S2, V-S2 |
| 11 | Refusals vs R-S23's "report still written" | Resolved: a *refusal* (E-CTX-EXTERNAL, E-SKEL-ERRORED, E-PROMPT-BUDGET, E-REPAIR-NOTHING) is exit 1 with nothing written. Only a domain report holding errors is written at exit 1. This matches every witness and covers C-S5's E-REPAIR-NOTHING. | R-S23, exit-code contract |
| 13 | Readable inputs that do not belong together have no code | Resolved: they are bad arguments, exit 2 E-USAGE (mismatched skeleton/inventory/prompt/report, a term-list hash mismatch, an empty `--keys` or one naming a non-slot). This covers C-S5's (report, prompt) pairing. | R-S23 |
| 18 | R-S8's "supplied previous SDD": `sdd check` has no such input | Resolved: the phrase is struck. Only the same proposal resolves a connected `referentClass`; otherwise W-CHK-RANGE-UNRESOLVED. No witness changes. | R-S8 |

## Clarification (adopted)

| # | Gap | Adopted reading | Spec text |
|---|---|---|---|
| 2 | Containment "nested under" | the selector begins with another mapped type's selector + `.`; the longest prefix names the container; a type's own mappings are not candidates | R-S4 sentence |
| 6 | Source-error order | R-S3 listing order, document order within a code; any E-SRC-SHAPE stops the later checks | R-S3 sentence |
| 7 | Duplicate name vs key collision | a key reported as a duplicate is not reported again as a collision (W-CS1-Δ4, Δ10 require it) | R-S3 sentence |
| 12 | stderr shape | one line, a JSON object whose `code` is the error code; other members (e.g. `message`) MAY follow | R-S23 sentence |
| 14 | Catalogue section headers | the three header lines, verbatim, as in every witness prompt; ICE = `cco:ont00000958` and its named descendants | R-S11 sentence |
| 15 | W-PROMPT-OVERSIZE shape | `{code, key, bytes, budget}` | R-S12 sentence |
| 16 | "Exceeds" | strictly greater (the stated 66,965–70,854 range confirms it) | R-S12 sentence |
| 4 | Mapping resolution | by `objectTypeName` / `attributeName`; the mapping's externalId fields are not used for resolution | none needed (R-S2 keys use the *schema's* externalId) |
| 5 | FL-NO-LABEL scope | every type, mapped or not | none needed (R-S19 has no mapped condition) |
| 8 | `detail` for other keywords | `type` → expected type; `minItems` → actual length; `pattern`/length → the value | recorded here; no witness depends on it |
| 9 | Non-JSON schema bytes | E-SRC-SHAPE `{pointer: "", keyword: "json", detail: null}`, exit 1 | recorded here |
| 10 | Errored inventory's `identification`, `flags` | identification computed best-effort; `flags: []` | recorded here |
| 17 | W-CS3-Δ3 fixture | the minimal fixture (its key file is `minimal/keys-open.json`) | none needed |
| 19 | `sdd:NoRelation` | in a reference slot → E-CHK-KIND; in a containment slot it skips kind, category and range checks | recorded here |
| 20 | Traversal details | first occurrence of a duplicated mapping is field-checked; E-CHK-UNKNOWN-KEY once per distinct key; human-only fields in R-S10 order | recorded here |
| 21 | R-S21 field values left open | E-CHK-HUMAN-FIELD `value` null; E-CHK-SKELETON/BATCH `value` = the reply's value; DUPLICATE, UNKNOWN-KEY, FIELDS, JSON: `field`, `value` null | recorded here; the independent oracle agrees on all 8 report witnesses |
| 22 | R-S13 "first failure" keyword order | the implementer's order (type, enum/const, string keywords, required, if/then, properties in reply order, additionalProperties, minItems, items); pointer = the object's own path for required/additionalProperties | recorded here |
| 23 | Fence detection | case-sensitive ```` ```json ````, CRLF tolerated | recorded here |

## Deferred

| # | Gap | Deferred to |
|---|---|---|
| 1 | Inventory field rules exist only in witnesses (order of `locators` etc.) | OS-1 (artifact schemas). The witnesses are normative meanwhile. |
| 24 | Catalogue labels assumed free of TAB/LF/CR | Holds for the pinned term list. A future pin should be guarded by `tools/build-term-list.mjs`, not by a new rule. |
| 25 | Registry "Cited by" copy errors | Not deferred: it is SDD-F68, fixed in this pass. |

## Decision C (registrar): containment key when one type has several containers

R-S2 keys a containment slot as `ct:` + the contained type's key, which assumes one container per type. Jira mappings
allow one type under several selectors. Today the implementation silently emits duplicate slot keys, which breaks V-S2
(keys unique) and R-S2's own collision rule.

- **Option 1 (recommended for v1): refuse.** Apply R-S2 as written: two containment slots with one key is
  E-SRC-KEY-COLLISION, so C-S1 reports it and the person must resolve it. No key format change and no witness changes;
  it fails loudly rather than guessing. Cost: a real schema with such a type cannot proceed until the registrar
  revisits it.
- **Option 2: key by container.** `ct:` + type key + `/` + container key. This gives one slot per (type, container),
  but it changes the key format of every containment slot. That supersedes the full-fixture witnesses and the
  minimal-to-full chains (a supersession event under SDD §11).
- **Option 3: one slot, several containers.** Merge into one slot. This needs a rule for which relation the slot
  holds, so it is a design change.

Until decided, no C1–C4 witness exercises the case and C-S5 does not create slots, so it does not block C-S5.
