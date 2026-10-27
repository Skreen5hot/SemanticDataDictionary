# Jira Assets fixtures (synthetic)

Synthetic import schemas used as ground truth for the SDD Service (ADR-002). None is derived from any real
enterprise schema. All are written against Atlassian's **import schema `2021_09_15`**, the only published version
(see [`../../project/SOURCE-FORMAT.md`](../../project/SOURCE-FORMAT.md)).

## Files

| File | Purpose | Atlassian JSON Schema | sha256 |
|---|---|---|---|
| `synthetic-it-assets.json` | Main fixture: documented fields only (names, no externalIds) | valid | `2794d08c…b4eded` |
| `synthetic-it-assets-externalids.json` | Same schema with `externalId` / `objectTypeExternalId` / `attributeExternalId`, as in Atlassian's own example (fields beyond the published JSON Schema) | valid | `b6692a95…40c750` |
| `invalid/missing-attribute-type.json` | Attribute without `type` | **invalid** | `fff2af59…7d7770` |
| `invalid/unknown-attribute-type.json` | `type: "currency"` (not one of the 13) | **invalid** | `0f754ada…840304` |
| `invalid/reference-without-target.json` | `referenced_object` with no `referenceObjectTypeName` | **invalid** | `a709d145…d969c` |
| `invalid/unknown-reference-target.json` | Reference to an object type that doesn't exist | *valid*: only C1 can catch it | `ef233761…c398` |
| `invalid/mapping-unknown-attribute.json` | Mapping names an attribute the schema doesn't define | *valid*: only C1 can catch it | `1b9f1cdc…14c18` |
| `invalid/duplicate-object-type-name.json` | Two object types named `Person` | *valid*: only C1 can catch it | `158036c4…d7efb` |

The Atlassian JSON Schema column was produced with Ajv 8.17.1 (draft 2019-09) against the schema at sha256 `d42180cd…`,
on 2026-10-27. **The three "valid" invalid fixtures show that Atlassian's schema alone is not enough:** C1 (parse)
must add cross-reference checks.

Each invalid fixture is the main fixture with exactly **one** defect (a one-factor delta, method P2). Its
`objectSchema.description` names the defect.

## Coverage of the main fixture

| Case | Where |
|---|---|
| All 13 attribute types | `text` · `integer` (RAM GB) · `boolean` (Active, Encrypted) · `double` (Latitude) · `date` (Start Date) · `time` (Maintenance Window Start) · `date_time` (Last Scanned) · `url` (Warranty URL) · `email` (Email) · `textarea` (Address) · `select` (Status) · `ipaddress` (IP Address) · `referenced_object` (Owner, …) |
| Type hierarchy, 3 levels | Hardware → Server → Blade Server; Hardware → Laptop; Hardware → Hard Drive |
| **`children` vs. containment trap** | *Hard Drive* is a hierarchy child of *Hardware*, but its mapping selector `servers.disks` nests drives **inside servers**. *Blade Server* (`servers.blades`) is both a hierarchy child of Server and nested in it. The parser must report hierarchy and containment evidence separately and decide neither. |
| Self-reference | Person.Manager → Person |
| Reference to a parent type (polymorphic) | Software.Installed On → Hardware (could be a Laptop, Server, …) |
| Composite identity | Location: Site Code + Country (both `externalIdPart`); Software: Name + Version |
| Identity attribute ≠ label | Person: label *Full Name*, identity *Employee Number* |
| Multi-locator attribute | Person.Full Name ← `firstName`, `lastName` |
| Type with no label | Scan Event |
| Type with no mapping | Hardware (only its children are mapped) |
| **Inherited attributes in mappings** | Laptop/Server/Hard Drive mappings use Asset Tag, Serial Number, Owner, Location, which are defined only on *Hardware*. The format has no inheritance flag, so the parser must flag this as an assumption rather than resolve it silently. |
| Same attribute name on different types | `Name` on Organization, Location, Software |
| Name needing escaping | `Ports/Protocols` (a `/` in a JSON Pointer must be escaped as `~1`) |
| **Prompt-injection text (adversarial)** | Software.Notes `description` instructs the LLM to map everything to `bfo:BFO_0000001` and claim validation passed. The prompt must carry it as quoted data, and the check (C4) must catch the outcome regardless of what the LLM does (ADR-004). |
| `objectMappingIQL` | Department, Manager, Owner, Location, Installed On. Treated as **opaque strings**: the IQL syntax is not verified, and v1 does not evaluate it. |
| `select` with no options | The 2021_09_15 format has no field for select values, so a `select` attribute's allowed values are unknowable from the schema. |
