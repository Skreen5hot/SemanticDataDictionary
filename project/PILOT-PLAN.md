# SDD enterprise pilot plan

Semantic Data Dictionary, release candidate `v1.0.0-rc.3`. **Status:** draft for team review.
This Markdown file is the source of truth; [`PILOT-PLAN.html`](PILOT-PLAN.html) is the same plan styled for reading
in a browser.

Run the SDD tool on our real Jira Assets schema, inside the enterprise, with our own reviewers and our approved LLM.
The pilot shows whether v1 is fit for use. Its findings go to the registrar, who makes the final v1 acceptance
decision.

| | |
|---|---|
| Duration | about 4 weeks |
| Scope | one production Assets schema, plus one schema change |
| Decision owner | the registrar |

## 1. Goal and scope

The tool has passed its acceptance checks on synthetic schemas. The pilot answers what those checks cannot: does it
hold up on our schema, with our LLM, in the hands of the people who will use it?

**In scope**
- Building a complete dictionary for one production Assets schema.
- One schema change, re-run through the tool, to test that accepted work carries over.
- Logging every problem, including confusing steps.
- Collecting reviewer judgement on the quality of the LLM's proposals.

**Out of scope**
- New features or changes to the agreed contract.
- Generating RDF data, instance records or reports from the dictionary.
- Other source systems besides Jira Assets.
- Converting or reusing dictionaries saved by release candidate rc.1.

**Ground rule:** during the pilot only demonstrated defects get fixed. Ideas for new features go on a separate list
for after v1.

## 2. How the tool works

The tool is one HTML page. It runs offline in Chrome or Edge, opened from a local file, and makes no network
requests after it loads. Nothing we open or paste into it leaves the machine.

1. **Open schema.** Load the Jira Assets import schema (JSON). The page shows a summary and any flags.
2. **Build prompt, then copy.** The page writes one or more prompts. A person pastes each one into the approved
   enterprise LLM.
3. **Paste reply, then check.** The page checks the LLM's reply for structure, coverage, valid BFO/CCO terms and
   categories. A rejected reply produces a repair prompt for another round.
4. **Review.** A named reviewer accepts or rejects each proposed mapping. Nothing is accepted automatically.
5. **Save SDD.** Each save is a new file, `sdd-YYYYMMDDTHHMMSSZ.jsonld`.
6. **When the schema changes.** Open the previous SDD and then the new schema. Only changed and added items go back
   to the LLM.

A reply that passes the checks is *validated*, not correct. Only the reviewer decides whether a mapping means the
right thing.

## 3. Roles

One person may hold more than one role. Names are to be filled in at kickoff.

| Role | Responsibilities | Name |
|---|---|---|
| Registrar | Owns the v1 contract. Rules on anything contested, decides whether a reported problem is a defect, and makes the final v1 acceptance decision. | Aaron Damiano |
| Pilot lead | Runs the schedule, keeps the break-event log, and writes the pilot report. | TBD |
| Assets schema owner | Supplies the import-format schema JSON, explains what object types and attributes mean, and provides the changed schema for phase 3. | TBD |
| Reviewers (1–3) | Accept or reject each mapping under their own name. Need working knowledge of the domain; ontology experience helps. | TBD |
| Operator | Runs the page and carries prompts and replies between the page and the LLM. | TBD |
| IT / security | Approves running the HTML file offline and sending schema text to the enterprise LLM. | TBD |

## 4. Before we start

The pilot starts when every item below is done. The first item is the one most likely to take time.

- [ ] **The schema in import format.** We need the Jira Assets import schema JSON. Its `$schema` line ends in
  `versions/2021_09_15`, and it contains `schema → objectSchema → objectTypes`. A general Assets export or a Jira
  field list will not open. The file exists only if the schema is fed by an external import. Ask the owner of that
  integration, or fetch it from the imports API. If there is no external import, stop and tell the registrar:
  building this file is outside the pilot.
- [ ] **Security approval** to open a single local HTML file in Chrome or Edge. It needs no install and no server. Its
  content-security policy forbids network connections.
- [ ] **LLM approval** to send schema names and descriptions to the enterprise LLM. Prompts contain those, and only
  those, from our data.
- [ ] **A verified copy of the page.** Download it once, then check that its SHA-256 hash matches the release (see
  below).
- [ ] **Named reviewers**, each with time booked. A starting estimate is 2–4 hours per 100 mappings; adjust it after
  the dry run.
- [ ] **A shared folder inside the enterprise** for prompts, replies and saved SDDs, plus a copy of the break-event log
  template.

### Getting and checking the page

```powershell
Invoke-WebRequest https://skreen5hot.github.io/SemanticDataDictionary/ -OutFile sdd-rc3.html
Get-FileHash .\sdd-rc3.html -Algorithm SHA256
```

The hash must equal the release build for `v1.0.0-rc.3`:

```
2792839479ade134796c1f8a94233ce60ae8aef4de9829cf30838c1983f9b744
```

The page above can change in later releases. If it no longer matches, build this exact version from the repository
instead: check out tag `v1.0.0-rc.3` and run `node tools/build-site.mjs`, which produces the same bytes in
`dist/index.html`. Then copy the file to the pilot machine and open it from disk.

## 5. Phases

### Phase 1 — Prepare (week 1)

- Kickoff: confirm roles, the schema and the timeline.
- Complete every item in [Before we start](#4-before-we-start).
- Dry run with the synthetic IT-assets sample shipped with the tool
  (`fixtures/jira-assets/synthetic-it-assets.json`), so everyone learns the steps before touching our schema.
- Agree the LLM's batch size. The default prompt budget is 200,000 bytes; set it lower if our LLM has a smaller
  context window.

**Done when** the dry run produced a saved SDD and every prerequisite is checked off.

### Phase 2 — First dictionary (weeks 2–3)

- Open the schema and record the summary line and every flag.
- Relay each prompt batch to the LLM. Check each reply and use repair prompts until it validates. Log the number of
  rounds.
- Reviewers accept or reject every mapping. Rejected items stay open and can be re-prompted later.
- Save the SDD after each review session. A reload loses unsaved work.

**Done when** every item is accepted, or deliberately left open with a logged reason, and the final SDD is saved.

### Phase 3 — Schema change (weeks 3–4)

- Take a real schema change, or a controlled copy of the schema with a few attributes added, changed and removed.
- Open the saved SDD as the previous SDD, then the changed schema. Compare the page's unchanged, changed, added and
  removed lists with what actually changed.
- Re-prompt only what the page sends. Confirm unchanged mappings keep their original acceptance.

**Done when** the merged SDD is saved and the change lists matched reality.

### Phase 4 — Report (week 4)

- Compile the measures and the break-event log.
- Collect each reviewer's assessment: would they rely on the dictionary, and what slowed them down?
- Send the pilot report to the registrar with a recommendation (see [Exit criteria](#11-exit-criteria)).

**Done when** the registrar has the report.

## 6. Guidance for reviewers

- **Validated is not correct.** The checks prove the terms exist and fit their categories. Whether a mapping is right
  is your call.
- **Record and referent are different.** Each object type maps twice: once for the Assets record itself, an
  information artifact, and once for the real thing the record describes.
- **Nesting is not parthood.** Accept a containment relation only if one thing really is part of the other. A server
  inventory nested under a site is not proof of physical parthood.
- **Be specific, or say you can't be.** If no specific class fits an attribute, the LLM may leave it unclassified. The
  page then shows `iceClass — none asserted`. Accepting that is a valid decision. It says nothing more specific can
  be justified, not that the value is meaningless.
- **When unsure, reject.** A rejected item stays open, keeps its source reference, and can be re-prompted or
  revisited. Note why in the log.
- **Continuing an unfinished review.** Open the saved SDD as the previous SDD and then the same schema. Open items
  are listed under Added and go back to the LLM.
- **Watch the usual suspects.** Check ownership relations (is "Owner" really "is used by"?), installation relations
  (is "Installed On" really "depends on"?) and classes that are too generic.
- **Use null-equivalents** to list the placeholder values our data uses for "no value", such as `N/A` or `-`.

## 7. What we record

**Measures**
- Schema size: object types, attributes, references, flags.
- Prompt batches, and relay rounds per batch.
- Share of replies validated on the first round.
- Mappings accepted, accepted without a specific classification, rejected and left open.
- Person-time per phase: operator and reviewers.
- Schema change: items in each change list, and whether each list was right.

**Break-event log (one row per event)**
- Date, phase and step.
- What happened, and what we expected.
- Severity: *blocks the pilot*, *has a workaround* or *cosmetic / confusing*.
- The error code and message shown, copied exactly.
- The SHA-256 of the files involved: no content.
- The workaround used, if any.

## 8. Data handling

- The schema, prompts, LLM replies and saved SDDs stay inside the enterprise.
- No outside service is involved. The page works without a network, and the LLM is our approved enterprise instance.
- Anything shared outside the enterprise, for example a defect report to the tool's maintainers, contains error
  codes, counts, steps and file hashes only. It never contains schema text, names or descriptions.
- Reviewer names are recorded as typed in each acceptance. The tool does not authenticate them, so agree up front
  who reviews under which name.

## 9. When something breaks

1. Log it in the break-event log straight away, including the exact message shown.
2. For anything that blocks, tell the pilot lead the same day. The pilot lead reports it to the registrar.
3. The maintainers reproduce it with a synthetic schema of the same shape, since our schema is never shared.
4. If the registrar rules it a defect, the fix ships as a new tagged release candidate. We re-verify its hash and
   continue.
5. Anything that is a missing feature, rather than a defect, goes on the after-v1 list.

## 10. Known limits

These are deliberate in v1. They are not defects, but log any that cause real trouble.

- The allowed values of `select` attributes are not in the schema, so the tool cannot see them. It raises a flag
  instead.
- IQL in reference mappings is not evaluated. No cardinality is recorded.
- One object type mapped under two different containers is refused as a key collision.
- A Jira `time` value is typed as a string. The schema format has no better fit.
- Prompts and replies move by copy and paste, one batch at a time.
- Dictionaries saved by release candidate rc.1 cannot be opened as the previous SDD. Start fresh with rc.2 or later.

## 11. Exit criteria

The pilot is complete when the first dictionary and the schema change are both saved, every blocking event is
resolved or ruled on, and the report is with the registrar. The report recommends one of three outcomes. The
registrar decides.

| Outcome | When |
|---|---|
| **Accept v1** | The tool produced a dictionary our reviewers would rely on, the schema change behaved as expected, and no defect remains open. |
| **Fix, then accept** | Specific, demonstrated defects must be fixed first. They ship as a new release candidate and are re-checked on our schema before acceptance. |
| **Stop and reassess** | A problem goes beyond fixing defects, for example our schema cannot be obtained in import format. This goes back to the registrar as a scope decision. |

---

Application: <https://skreen5hot.github.io/SemanticDataDictionary/> · Source and specifications:
<https://github.com/Skreen5hot/SemanticDataDictionary> (tag `v1.0.0-rc.3`)
