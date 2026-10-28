# Semantic Data Dictionary (SDD)

An edge-canonical service for building **Semantic Data Dictionaries**: machine-readable JSON artifacts that map an
existing data schema (tables/object types, columns/attributes, foreign keys/references) onto a realist
BFO / CCO / IAO model — without restructuring the source system.

**Status:** all seven v1 capabilities are built and independently verified, as a CLI and as an offline web page. The
release-verification milestone is next; see [`project/PLAN.md`](project/PLAN.md).

## Use the application

**Online:** <https://skreen5hot.github.io/SemanticDataDictionary/>. The page loads once and then makes no network
request. Everything runs in your browser, and nothing you open or paste leaves your machine.

**Offline (recommended inside an enterprise):**

1. Get the page as a single file. Either open the URL above and save it (*Save page as… → Webpage, HTML only*), or
   build it yourself with `node tools/build-site.mjs` and take `dist/index.html`.
2. Copy that one file to the offline machine and open it in a current Chromium-based browser (Chrome, Edge). It
   needs no server, network or install; it works from `file://`.

**The workflow:**

1. **Open schema** (your Jira Assets import schema JSON).
2. **Build prompt**, then **Copy prompt**. Paste it into your enterprise LLM yourself.
3. Paste the LLM's reply into **Paste reply** and press **Check reply**. You get one of two results:
   - *Validated* means only that its structure, coverage, terms and categories passed the checks. The meaning is
     still yours to judge.
   - *Rejected* lists every problem; use **Build repair prompt** and relay again.
4. Type your name, then **Accept** or **Reject** each mapping. Nothing is ever accepted for you.
5. **Save SDD**. Each save is a new file, `sdd-YYYYMMDDTHHMMSSZ.jsonld`. Keep it: work that is not saved does not
   survive a reload.
6. **When the schema changes:**
   1. **Open previous SDD**, then **Open schema** with the new schema. The page shows what is unchanged, changed,
      added and removed.
   2. Only the changed and added items go back to the LLM.
   3. Unchanged mappings keep their original acceptance.

   A different term list re-opens everything for your decision.

**CLI (Node 22+), same core:** `node src/cli/sdd.mjs parse | skeleton | prompt | check | repair | accept | rerun …`.
The commands are listed in [`spec/sdd-service.md`](spec/sdd-service.md) §3.

## Verification

- `node tools/run-witnesses.mjs`: the independent judge for every CLI witness.
- `node harness/h-o2.mjs`: the CLI under a network guard.
- `node harness/h-o1.mjs`: every operator scene, in Chromium via Playwright (`cd harness && npm ci` first).
- The Operator acceptance workflow runs all three on `ubuntu-24.04` with Node 22 (see
  [`bench/config.json`](bench/config.json)), and again against the published page.

## Specification

The v1 contract is the spec pair [`spec/sdd-service.md`](spec/sdd-service.md) and [`spec/sdd-operator.md`](spec/sdd-operator.md). Background:
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
