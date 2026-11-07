# prop-005: SDD v1.2, project mode (SDD's side of EPS M3)

| | |
|---|---|
| **From** | SDD (Claude Opus 5.5, an agent, at the direction of Aaron Damiano, registrar) |
| **For** | The registrar; then EPS, as SDD's answer |
| **Answers** | `EPS-SDD-2026-11-06-m3-proposal-request` ([`../../../communications/eps/incoming/2026-11-06-m3-proposal-request.md`](../../../communications/eps/incoming/2026-11-06-m3-proposal-request.md)) |
| **Builds on** | EPS contract **v0.2** (`spec/edge-project-contract.md` at `8a9d747`), M2 as validated on 2026-11-06 |
| **Status** | **Revision 2**, 2026-11-06. The registrar approved the direction (A1–A5, O1–O4) and required six targeted revisions, made here (§12). On this revision, implementation is authorized within the approved scope. Nothing implemented yet |

## 0. The registrar's direction (2026-11-06)

| # | Direction |
|---|---|
| A1 | **SDD's input is a normalized schema.** Every source, Jira included, will reach SDD through the normalizer (the Schema service). Jira Assets was a stopgap. |
| A2 | **Build order: 1. SDD, 2. EPS, 3. the normalizer (Schema service), 4. RML, 5. BIBS 2.0.** No tool that depends on the normalizer is built before it. SDD comes first, so it does not wait: until the Schema service exists, it reads Jira through a stopgap reader. |
| A3 | **SDD's output is the SDD.** The RML service takes the normalized schema and the SDD, joined by key. Shapes and every RDF projection choice belong to the RML service. |
| A4 | **Project mode only.** SDD v1.2 works on project folders. Opening and saving single files remains only as the fallback when folder access is unavailable (M2-c). |
| A5 | **Each repository is self-contained.** No repository imports another at run time. They share files in the project folder, and versioned formats that each one vendors and pins. |

**Who owns what.**

- **SDD:** semantic interpretation and the person's mapping decisions.
- **The Schema service:** normalized structure, source identities and datatypes.
- **RML:** the projection into RDF.
- **EPS:** project storage, lineage, integrity, revisions and conflict detection. It does not own pipeline process
  or semantic compatibility.

**Boundaries.** No change to the EPS v0.2 contract is requested. The SDD output format and `sddVersion` 2 are
unchanged. The EPS module is vendored at a verified, pinned commit. The page stays offline and self-contained, and
keeps its manual fallback.

## 1. What SDD reads

**The target (A1).** An SDD is built from one **normalized schema** artifact in `normalized/`, cited in its record
as `{role: "structure", relation: "dependency"}`.

**Until the Schema service exists (A2, O4).** The person adds the Jira Assets import schema to `source/`. SDD
cites it directly as its `structure` input, which the contract already allows (EPS §3, EX-07). SDD's existing Jira
parser (C-S1) reads it. SDD never writes to `normalized/`. When the Schema service ships, SDD gains a reader for its
format. That reader gets its own conformance check against the Schema service's contract (M3-9). The Jira path is
then retired by the registrar's decision.

Inside SDD, both readers produce the same internal **Inventory** (`schemas/inventory-v1.schema.json`). Everything
after it (skeleton, prompt, check, repair, accept, rerun) works on the Inventory.

### What SDD needs from a normalized schema

This is a request to the Schema service, through the registrar. It is not a format. SDD's Inventory shows one
working form of each item; it is not offered as the format.

| # | SDD needs | Why | In the Inventory today as |
|---|---|---|---|
| N1 | **A key for every element** (object type, attribute, reference) meeting K1–K4 (§1.1), minted by the normalizer | RML joins the SDD to the normalized schema by this key (A3). SDD uses it verbatim and never mints its own | `key`, minted by SDD's stopgap reader (R-S2) |
| N2 | The source system's own identifiers, where it has them | Traceability to what other systems use (ADR-007.3) | `externalId` |
| N3 | Object types with name, description and parent (a source hierarchy, **not** subclassing) | Two-individual mapping (ADR-001); R-S4 | `objectTypes[]` |
| N4 | Attributes with owner, name, description and, for each scalar attribute, its **W3C XML Schema datatype**, set by the Schema service (O1) | One slot per attribute. R-S9 reads the datatype instead of deriving it from a Jira type | `attributes[]`, `type` (SDD maps the Jira type) |
| N5 | References with their target element | Reference slots and domain/range checks (R-S7, R-S8) | `type: referenced_object`, `target` |
| N6 | Identity parts and the label attribute | Designation and identity decisions | `identity`, `label`, `isIdentityPart`, `isLabel` |
| N7 | Nesting in the source data, as a candidate containment, never asserted parthood | R-S4: the person accepts or rejects containment | `selectors`, `FL-CONTAINMENT` |
| N8 | Known ambiguities, flagged rather than resolved | The person must see them (R-S19) | `flags[]` |
| N9 | Locators into the data (selectors and paths) | Not used by SDD. RML needs them, from the normalized schema (A3) | `selectors`, `locators` |

### 1.1 Keys (O2)

The key algorithm is the Schema service's to define. SDD needs keys with these properties:

| # | Property |
|---|---|
| K1 | **Source-scoped identity.** A key identifies one element within one source, and the scope is part of the Schema service's definition |
| K2 | **Deterministic.** The same source gives the same keys, independent of order, time, machine or a counter |
| K3 | **Unique.** No two elements of one normalized schema share a key. A collision is an error, never resolved by an order-dependent suffix |
| K4 | **Stable across the source revisions the Schema service supports.** An element that is the same element in a later revision keeps its key. A key that changes is a removal plus an addition |

SDD consumes the keys verbatim (N1).

**For reference only:** SDD's stopgap reader mints keys by R-S2. An object type gets `ot:` plus its external id,
or its name if it has none. An attribute gets `at:` plus its external id, or `at:` plus `<type name>/<attribute
name>`. Characters are escaped as in RFC 6901, and no case folding or Unicode normalization is applied. That rule
is K2 and K3, and K1 within a single schema. It is not proposed as the Schema service's algorithm.

**The transition from the Jira stopgap.** Moving an SDD from stopgap input to normalized input is a **change of
input format**. It is treated like a term-list change: **every acceptance is reopened**, whether or not keys or
items happen to match (R5 in §2.1). Nothing is carried across the transition on the strength of a matching key.

- The previous SDD is cited as `history`.
- Its decisions are retired with their acceptance records, as removed items are today.
- The person reviews the whole dictionary once, on the new input.

A cheaper transition would need the Schema service to define how its elements correspond to Jira's. That would be
a separate decision, after its contract exists.

## 2. What SDD commits to `sdd/`

One commit writes three files through the EPS module: the artifact, its record, and a stage revision.

| Field | Value |
|---|---|
| Artifact | `sdd/sdd-<time>-<hash>.jsonld`: the SemanticDataDictionary bytes, in the unchanged format (`sddVersion` 2) |
| `kind` / `generation` | `sdd` / `assisted` |
| `producedBy` | `{responsibility: "sdd-author", tool: "sdd", version: "1.2.0"}` |
| Input `structure` | `dependency` on the normalized schema (or, on the stopgap, the source file) the SDD was built from. Its `sha256` equals the SDD's own `source.sha256` |
| Input `previous` | On a rerun: `history` on the previous SDD (see below) |
| Revision | `parents` = the `sdd/` heads that the person confirmed (§4, D2); `current` = the new SDD only |

**The previous SDD: `history`, not `dependency`.** In a v1.2 rerun, every mapping in the new SDD is validated
against the new SDD's own current inputs (§2.1). That makes the new SDD self-contained: its correctness does not
rest on the earlier SDD. The earlier SDD is therefore provenance, cited as `history` (EX-19).

A `dependency` on an earlier SDD would mean something different: an **active dependency**, where the new SDD
relies on the earlier one's content being right without revalidating it. EX-20 shows what the contract does with
that.

- After a rerun on a new input, the earlier SDD's own `structure` input is superseded, so the earlier SDD is out
  of date (`INPUT-SUPERSEDED`).
- A new SDD that depends on it inherits that, as `UPSTREAM-OUT-OF-DATE`. That is correct for an active dependency.
- It is also why a revalidated rerun must not use one: it would report a current, revalidated SDD as out of date.

SDD v1.2 never makes an active dependency on an earlier SDD. A future feature that carries content without
revalidating it would have to cite the earlier SDD as `dependency`, and would need the registrar's decision.

**Not inputs:** the term list and the Ontology-Template pin. They are part of the tool, recorded in the SDD's
`environment` and by `producedBy.version`.

**Not committed (O3):** prompts, pasted replies and check reports. The SDD records their SHA-256 in each mapping's
`provenance`. A hash identifies material; **it is not the material**. It lets someone who kept a prompt or reply
prove which one it was, and nothing more. How a person keeps that material is in §3.1.

**Consistency with RML (A3): RML's to verify.** EPS establishes integrity and recorded-dependency consistency: an
SDD's record names the exact normalized schema it was built from. EPS does not establish that an SDD fits the
normalized schema that RML selects. RML records the two as separate inputs, and nothing in EPS compares them. So
before using the pair, the RML service checks two things:

- the SDD's `source.sha256` (equal to its record's `structure` input) is the exact normalized schema RML uses;
- the SDD's keys join that schema's keys.

That check belongs to RML, not to SDD or EPS. SDD adds nothing to its format for it.

**Refusals and conflicts.** SDD commits only through the EPS writer, so R-W3 and R-W4 apply. The page shows each
refusal in words:

- `REFUSED-CONFLICTED`: two people saved from the same state. The page shows both SDDs, a person chooses, and SDD
  writes the merge revision.
- `REFUSED-UNEVALUABLE`: a file could not be read, often a OneDrive file not downloaded.

### 2.1 Rerun: what reopens

An acceptance is carried into the new SDD **only if nothing it depends on changed**. A key that is still present is
never enough. Today R-S17 compares each item's own Inventory hash and reopens everything on a term-list change.
v1.2 keeps both and adds the cases where a mapping's validity depends on other items:

| # | Reopens the mapping when | Today |
|---|---|---|
| R1 | Its own item changed (Inventory item hash differs, or its slot kind differs) | yes (R-S17) |
| R2 | The term list changed (and so the Ontology-Template pin) | yes (R-S17, FL-TERMS-CHANGED) |
| R3 | **A reference or containment mapping:** either type it connects is reopened, because its domain/range check (R-S8) depends on their classes | **new** |
| R4 | **An attribute mapping:** its owning type is reopened, because the attribute describes that type's record | **new** |
| R5 | **The input format changed** (`source.format` differs, for example the Jira stopgap → a normalized schema) | **new** (flag `FL-FORMAT-CHANGED`) |
| R6 | **A carried mapping fails the current checks** (R-S5, R-S7, R-S8, run again against the current term list and the new SDD's other mappings) | **new** |

Reopening propagates: a type reopened by R1 reopens its attributes (R4) and the references that connect it (R3).
R3 and R4 follow only from a type reopened in this same rerun, and the propagation ends there. A reopened mapping
becomes `open`, and its previous acceptance moves to `retired`, as R-S17 does for removed items.

R3 to R6 change the rule, not the format. They are a spec change (§11), with new witnesses for C-S6 and C-S7.

## 3. What SDD keeps in `sdd/work/`

**One file per work session:** `sdd/work/session-<id>.json`, where `<id>` is random and made when the session
starts. Separate sessions never share a file.

| Field | What |
|---|---|
| `format` | `sdd-work/1` |
| `project` | The project's `@id` |
| `session`, `writer`, `seq`, `savedAt` | The session id; a random id for this page instance; a counter raised on every save; and the time |
| `basis` | What the session started from: the `structure` input `{path, sha256}`, the previous SDD `{path, sha256}` or null, the `sdd/` heads, the term list SHA-256 and the tool version |
| `status` | `active`, or `committed` with the SDD's path after a successful commit |
| `state` | The operator session (SDD-operator §6): inventory and skeleton SHA-256s; prompts, pasted replies and check reports (append-only); decisions; the acceptor's name; null equivalents |

**Autosave.**

- **When:** after each act that changes state: a reply checked, a decision made, or a name entered.
- **Serialized:** at most one save runs at a time. Acts during a save are kept in memory, and the next save writes
  the latest state.
- **How:** through the module's `replace()`.
- **Before each save,** SDD reads the file and checks that it is still the bytes this page last wrote (D3).
- **On failure,** nothing is lost from memory. The page shows "work not saved", tries again at the next act, and
  offers *Export work* (a download of the session file). Closing the page with unsaved work asks first.

A work file is never cited by a record (R-P4.9).

### 3.1 After a commit: the relay material

A successful commit marks the session `committed`. **It is not deleted automatically.** Deleting it would discard
the prompts, pasted replies and check reports, which exist nowhere else in the project (O3). The SDD keeps only
their hashes.

- **Remove session** deletes it, after a confirmation that says exactly that: "This discards the prompts, replies
  and check reports of this session. The SDD keeps only their hashes."
- **Export relay material** downloads one file with the prompts, replies and check reports, so a person who must
  retain them can keep them wherever their records belong.
- `work/` is mutable and outside EPS's guarantees (R-P6), so a session left there is a convenience, not a retained
  record.

## 4. How SDD detects that work is out of date (§9: detected, not prevented)

SDD checks on resume, before each save, and before and after each commit. It works from a fresh read of the
folder each time.

| # | Situation | How SDD sees it | What happens |
|---|---|---|---|
| D1 | The input moved on: a newer normalized schema, or a source change | The EPS evaluation of `basis.structure` (`INPUT-SUPERSEDED`, `SOURCE-CHANGED`, `INPUT-ALTERED`, …) | Offered: rerun on the new input from this session's decisions, which reopens what §2.1 requires; or discard |
| D2 | **A newer SDD head exists** (someone committed meanwhile) | The `sdd/` heads differ from `basis` | **Commit is blocked** until the person chooses. Either rerun with the newer SDD as `previous` (recommended), or confirm superseding it, in a dialog that names that SDD and its time. The confirmed heads become the revision's parents |
| D3 | Another page wrote this session file | Before a save: the file's bytes are not the ones this page last wrote (`writer` or `seq` differ) | Autosave stops. The person reloads the other version, or saves this one as a new session. SDD never overwrites |
| D4 | **The same session diverged on two PCs** | Two or more files in `work/` carry the same `session` id. A OneDrive conflict copy keeps the id inside the file but gets a new name | Both are shown as one diverged session, side by side. The person picks one to continue; the other is kept until they remove it. Nothing is merged automatically |
| D5 | The term list or tool version changed | `basis` differs from the running tool | As R2: every item reopens |
| D6 | The session file cannot be read | E-UNREADABLE from the module | "Not available offline": resume after OneDrive downloads it |

**What the sequence check cannot do.** `seq` and `writer` detect another writer on the next save that sees its
bytes. They cannot prevent two PCs, each offline or between syncs, from diverging on the same session. That case is
detected afterwards, by D4.

**The window around a commit.** The EPS writer takes the heads it finds at the moment it writes as the new
revision's parents. A head that arrives between SDD's check and the write would be superseded. So after a commit,
SDD compares the revision's parents with the heads the person confirmed. If they differ, the page says plainly
which SDD the commit superseded, and offers a rerun. A head that arrives after the commit is a fork, reported as
`conflicted` (R-W3). Closing the window itself would need an EPS module option to commit only on expected parents.
That is a module change, not a contract change, and is not requested here (§12).

## 5. When a project folder cannot be opened (M2-c)

- **No folder access at all** (no API, or disabled by policy): the page uses the module's own words from
  `browser/access.mjs` and offers the manual fallback (A4): *Open schema* and *Save SDD* as single files. A banner
  says that nothing is recorded in a project.
- **NotFoundError on a deep path:** the page says the project folder is probably too deep and must be under about
  140 characters (EPS's M2 limit).
- **A permission not granted after a restart:** one button asks for it again. The stored handle is kept.

## 6. How SDD shows that it is saving

- **Commit:** a progress line, "Saving to the project: 1 of 3 (SDD)… 2 of 3 (record)… 3 of 3 (revision)". Every
  action is disabled until the commit ends.
  - On success, the page names the new SDD file, then runs the after-commit check (§4).
  - On failure, it says what was written, and that pressing *Save* again completes the commit (EPS §10).
  - At 0.5–0.9 s per file, about 2–3 s is expected, and up to about 20 s in the slowest OneDrive run.
- **Work:** a quiet status ("Work saved 14:02:31", "Saving work…" or "Work not saved"). It never blocks the person.

## 7. How SDD takes the EPS module in (A5)

SDD **vendors** it, the way it vendors Ontology-Template:

- `vendor/edge-project-store/` holds exactly the module files the browser needs, copied from one EPS commit.
- `vendor/edge-project-store/PROVENANCE.md` names that commit and each file's SHA-256, taken over the committed
  bytes. The folder is `-text`.
- A new check verifies each file against its pin before every build and test run.
- `tools/build-site.mjs` inlines the module into the single page, which keeps the build byte-reproducible.

Moving to a new EPS version is a re-pin, by the registrar's decision, like ADR-009.

**What SDD needs from EPS:**

- a stable list of the browser module's files;
- no dependencies;
- ES modules that can be inlined;
- a tagged commit per module version (M4 decides the rest).

## 8. Requests to the EPS contract

**None.** v0.2 covers what SDD v1.2 needs:

- citing a source file directly (EX-07);
- `history` for the previous SDD (EX-19);
- a tool-defined `work/` (R-P6);
- refusals (R-W3, R-W4);
- unreadable files (R-E10).

## 9. Registrar decisions

| # | Question | Decision (2026-11-06) |
|---|---|---|
| O1 | Who sets an attribute's XSD datatype once input is normalized? | **The Schema service** (N4). R-S9 reads it |
| O2 | Keys | **Deterministic and unique**, defined by the Schema service (K1–K4). SDD consumes them verbatim. R-S2 is not prescribed |
| O3 | Commit the relay evidence as artifacts? | **Not in v1.2** (§3.1 says how to keep it) |
| O4 | On the stopgap, SDD cites the Jira file in `source/` directly | **Yes.** SDD never writes `normalized/` |

## 10. Acceptance criteria for M3 (SDD side)

| AC | Criterion |
|---|---|
| M3-1 | SDD opens a project folder, on a `file:` page and on the published page. It shows each stage's status from the EPS evaluation and lists the candidate inputs |
| M3-2 | A first SDD built from a source schema in `source/` is committed. Its record matches §2, and `eps status` reports it `[up to date]` |
| M3-3 | **Rerun.** A rerun commits an SDD citing the previous one as `history`, and `eps status` reports it up to date (the EX-19 case). A regression test shows that the same SDD cited as `dependency` is `UPSTREAM-OUT-OF-DATE` (the EX-20 case), and that SDD never writes `dependency` on an earlier SDD. Tests show each of R1–R6 reopening exactly the mappings §2.1 requires, including propagation. They also show that a mapping is never carried on a matching key alone. Mappings that nothing affected are carried byte for byte |
| M3-4 | **Resume.** Closing and reopening the browser mid-session resumes from `sdd/work/` with nothing lost. Autosaves never overlap. After a failed save (injected), the decisions are still in memory and are saved by the next save or by *Export work*. After a commit, the session stays until removed, and removal states what it discards |
| M3-5 | **Detection.** D1–D6 are each detected, in tests and in the two-PC check. D2: no commit supersedes a newer head without the person's confirmation naming it, and the after-commit check reports a head that arrived during the commit. D4: a conflict copy of the same session is shown as one diverged session, and nothing is merged automatically |
| M3-6 | A fork from two PCs is shown as conflicted, and a person resolves it from the page |
| M3-7 | With folder access disabled, the page explains, and the single-file fallback works |
| M3-8 | **Build and pins.** The vendored EPS module matches its PROVENANCE pins at the named commit, and a changed byte fails the check. The page makes no network request, is byte-reproducible, and works from `file:`. The SDD output format and `sddVersion` 2 are unchanged. Every existing operator scene and witness still passes, except the C-S6/C-S7 witnesses that §2.1 changes, which are re-issued through the independent generator |
| M3-9 | **Later, not for M3 sign-off:** when the Schema service's contract exists, SDD's normalized-schema reader gets its own conformance check against it (N1–N9, K1–K4). M3 itself proceeds on the Jira stopgap |

## 11. What changes in SDD's own documents

- A new ADR-010, project mode, recording A1–A5 and the ownership in §0.
- The spec pair moves to v0.7:
  - C-S1's input becomes "a normalized schema; the Jira Assets import schema as the interim reader";
  - R-S17 gains R3–R6 (§2.1), with `FL-FORMAT-CHANGED`;
  - the operator journeys move to a project;
  - single-file save becomes the fallback only (A4).
- `sddVersion` stays **2**: the SDD format does not change.

## 12. How this revision answers the registrar's conditions (2026-11-06)

| # | Condition | Where |
|---|---|---|
| 1 | Previous SDD: `history` by default, distinguished from an active dependency; affected mappings reopen; EX-20 corrected; regression tests | §2, §2.1, M3-3 |
| 2 | EPS does not establish SDD/normalized compatibility for RML; RML verifies | §2 ("Consistency with RML") |
| 3 | Keys: requirements, not R-S2; verbatim; transition behavior | §1.1, R5, M3-9 |
| 4 | Sessions: what `seq` cannot do; same-session copies; no silent supersede; serialized autosave; no lost decisions | §3, §4 (D2–D4), M3-4, M3-5 |
| 5 | Deleting a committed session discards relay material; how to keep it; hashes are not evidence | §2 ("Not committed"), §3.1 |
| 6 | Strengthen M3-3, M3-4, M3-5 and M3-8; normalized compatibility gets its own check later | §10 |

**Found while revising, for a separate decision (not requested):** the EPS writer has no way to commit only on
expected parents, which leaves the short window in §4. SDD detects it after the commit. Closing it would need an
EPS module option, which is a module change, not a contract change.

## Not in this proposal

The Schema service's format, the RML service, packaging and publication of the EPS module (M4), and any change to
the EPS contract.
