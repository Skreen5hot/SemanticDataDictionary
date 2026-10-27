# Source format: Jira Assets import schema

Phase 1 ground truth for ADR-002. Facts below are taken from Atlassian's published JSON Schema, not from memory.

## The authoritative definition

- **URL:** `https://api.atlassian.com/jsm/assets/imports/external/schema/versions/2021_09_15`
  (the `/jsm/insight/…` path serves byte-identical content).
- **Retrieved:** 2026-10-27. **sha256:** `d42180cd9a47b7eeaf3ae59ed9bd4010f9f06f07c6c6b63dc00fd46cdd43242f` (7,074 bytes).
  Declares itself JSON Schema draft 2019-09, `$id` `https://api.atlassian.com/jsm/insight/imports/external/schema/versions/2021_09_15`.
- **Only version found.** Probes of other plausible version paths (2022–2024 dates, `latest`, a versions index)
  all returned 404.
- **Not vendored.** The file carries no licence statement, so it is referenced by URL and hash rather than copied.
  The registrar decides whether it may be vendored for offline validation (see Open points).

## Facts established

| Topic | Fact (from the JSON Schema) | Consequence for the SDD Service |
|---|---|---|
| Attribute types | Exactly 13: `text, integer, boolean, double, date, time, date_time, url, email, textarea, select, ipaddress, referenced_object` | **Corrects ADR-002's draft list**, which wrongly named `datetime`, `status`, `user` and omitted `double`, `time`, `textarea`, `ipaddress`. |
| `children` | "Hierarchical children types" | Confirms ADR-002: hierarchy, not containment. No `inheritance` field exists. |
| `label` | "Marks an attribute as the object label" | Maps to a designation decision, not to identity. |
| `externalIdPart` | On the attribute *mapping*: "part of the unique identifier for this object type" | Identity is declared in the mapping section, not the schema section, and can be composite. |
| References | `referenced_object` requires `referenceObjectTypeName`: the target is named **by type name** | Reference resolution in C1 is by name. **No cardinality** (min/max) fields exist in this version. |
| Reference lookup | `objectMappingIQL`: "IQL used in referenced objects as a way to refer to them" | Opaque to v1 (IQL is not evaluated). |
| Required fields | objectType: `name`, `description`; attribute: `name`, `description`, `type`; mapping: `objectTypeName`, `selector`, `description`; attribute mapping: `attributeName`, `attributeLocators` (≥ 1) | Descriptions are always present, so prompts always carry free text from the source (ADR-004's injection surface). |
| Extra fields | No `additionalProperties: false` anywhere | Fields outside the schema (such as the `externalId` family) are syntactically allowed. |
| `select` values | No field defines a select attribute's options | Allowed values of `select` attributes are unknowable from the schema alone. |

## Discrepancy: the `externalId` family

Atlassian's own example (the "Disk Analysis Tool" sample) uses `externalId`, `objectTypeExternalId` and
`attributeExternalId`. **None of these appears in the 2021_09_15 JSON Schema.** They are permitted (no
`additionalProperties: false`) but undocumented there. C1 therefore MUST accept both forms: name-based identification
(documented) and externalId-based identification (observed in Atlassian's example). Both fixtures exist.

## Open points for the registrar

1. **Which form does the enterprise schema use?** You can check without sharing it: does it contain `externalId`
   fields? That decides which form is primary.
2. **May the Atlassian JSON Schema be vendored** for offline validation in the HTML tool and CLI? It has no stated
   licence. The alternative is to encode its constraints in the SDD's own input checks, citing its hash.
