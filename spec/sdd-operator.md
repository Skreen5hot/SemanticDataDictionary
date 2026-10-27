# SDD Service: operator experience (companion)

| | |
|---|---|
| **Conformance** | *The Falsifiable Spec v0.4*, method §4A form. Companion to [`sdd-service.md`](sdd-service.md) (`SDD`), which delegates its experience level here (NG-S0). Federated by weave record **WV-1** (§15). |
| **Status** | v0.2: prop-001 merged with registrar Decisions A and B (2026-10-27); supersedes v0.1 @ `b4aab5b`. Nothing built; no scene executed. |
| **Hash citation convention** | As SDD: 8-hex-character prefixes in prose; full values in the SDD §11 registry only. |
| **Stable identifiers** | Promises PR-O\*; journeys J-O\*; surface capabilities CV-O\*; rules RV-O\*; scenes W-PRO\*, W-JO\*; seams S-O\* (shared with SDD); invariants V-O\*; envelopes E-O\*; non-promises NP-O\* (NP-O0 is the terminal declaration); harnesses H-O\*; open items OO-\*. |

**Applicability (P11 semantic test).** The person's work ranges over a *trajectory*: generate a prompt, carry it
out of the tool, paste a reply, read a report, repair, decide, save, possibly over several rounds and sessions. The
promises below quantify over that trajectory, so this experience level exists.

**Mechanize-before-rate, stated once.** The surface generates no free language. Every string it shows is either
RV-O1 vocabulary (a fixed template filled with counts or names) or a field of an artifact the core produced (RV-O4).
Every clause below therefore has a mechanical falsifier, and there is **no rated protocol**.

## SDD-operator §1: Purpose & user

The person from SDD §1, at a desk with the enterprise LLM in another window. The promise, in their words: *"I carry
text between two windows, and nothing gets accepted, sent anywhere or lost unless I do it myself. When a check
passes, the tool tells me what it checked and that the meaning is still my call."*

## SDD-operator §2: Promise register

**PR-O1: Nothing is accepted without your explicit act.** (a) A mapping enters an SDD only through an accept act on
that mapping: a per-item **Accept**, or **Accept all N validated**, which names N. (b) No pasted text can perform,
pre-fill or simulate a decision. (c) The acceptor's name is typed by the person, never taken from an artifact.
Clause ↔ scene map (mechanical, clause-relevant): (a) → W-PRO1-N, W-PRO1-Δ1 · (b) → W-PRO1-Δ2 (adversarial) ·
(c) → W-PRO1-Δ2 (the name field stays empty although the paste names someone). Cites SDD R-S18, NG-S5.

**PR-O2: Nothing leaves your machine.** (a) After the page has loaded, no network request is attempted in any
journey. (b) No CLI command attempts a network request. (c) A foreign `@context` is refused, never fetched. Clause ↔
scene map: (a) → W-PRO2-N (H-O1 request log empty) · (b) → W-PRO2-Δ1 (the H-O2 network guard's attempt log is
empty, which is relevant because an attempt is logged even when it fails) · (c) → W-PRO2-Δ2 (adversarial). Cites
SDD NG-S4, R-S16.

**PR-O3: A bad paste never costs you work.** (a) After any rejected paste, everything already accepted in the
session is byte-identical. (b) A repair round never un-accepts or re-opens an accepted mapping. (c) The tool never
overwrites or deletes a file. Clause ↔ scene map: (a) → W-PRO3-N, W-PRO3-Δ1 (adversarial) · (b) → W-PRO3-Δ3, where
2 mappings are accepted *before* a rejected paste and a repair round · (c) → W-PRO3-Δ2 (refusal; L2 empty, §12).
Cites SDD R-S23.

**PR-O4: Validated never reads as approved.** (a) A check outcome is shown only with RV-O1's status texts. (b) Before
any CV-O2 act, no text outside a quoted block contains the whole words "correct", "approved", "accepted" or
"verified" (case-insensitive). (c) Every warning is shown in its item's row. Clause ↔ scene map: (a) → W-PRO4-N ·
(b) → W-PRO4-N, W-PRO4-Δ2 (adversarial: the LLM's rationale claims approval) · (c) → W-PRO4-Δ1. Cites SDD R-S14.

**PR-O5: Every problem names its item and its rule.** (a) Each error or warning is one row rendered by RV-O4.
(b) The number of rows equals the report's errors plus warnings. (c) The repair prompt carries every error.
Clause ↔ scene map: (a), (b) → W-PRO5-N, W-PRO5-Δ1 (adversarial: 6 errors, none dropped) · (c) → W-PRO5-N,
W-PRO5-Δ1 (repair prompt bytes = SDD C-S5's output).

**PR-O6: What you copy is exactly what was generated.** Scope: the clipboard as read back by the browser on the H-O1
platform (Chromium; Linux and Windows runners). (a) **Copy prompt** places the prompt's exact bytes on the
clipboard. (b) The screen shows the first 8 hex characters of the prompt's sha256. (c) With several batches, each
has its own control, labelled `Batch i of n`. Clause ↔ scene map: (a), (b) → W-PRO6-N, W-PRO6-Δ2 (adversarial:
hostile Unicode) · (c) → W-PRO6-Δ1.

NG/NP citations: SDD NG-S4 (PR-O2), NG-S5 (PR-O1, NP-O2); SDD R-S14 (PR-O4), R-S16 (PR-O2), R-S18 (PR-O1),
R-S21 (RV-O4), R-S23 (PR-O3).

## SDD-operator §3: Posture *(informative)*

Plain, procedural, and modest about what a check means. This sits outside the graded surface; the partition is
stated here.

## SDD-operator §4: Journeys

**H-O1:** Playwright driving `site/` in Chromium (Linux and Windows runners). The page loads, then the context goes
offline and every request is logged. Clipboard read is enabled; file choosers and downloads are intercepted. **H-O2:**
a shell runner executing the CLI in a container with networking disabled, every `node` process started with
`--import harness/netguard.mjs`. That module wraps `net`, `tls`, `dns`, `http`, `https` and `fetch` and appends every
attempted call to `netguard.log` before failing it. **Owner of both:** this document's acceptance runner,
registered both sides via WV-1.

**J-O1: first dictionary, in the browser.** Chain scene **W-JO1** (H-O1): (1) open `minimal-organization.json` → the
summary line `1 object type · 2 attributes · 0 references · 0 flags` (S-O5). (2) **Build prompt** → one control,
`Batch 1 of 1`, and the text `795cc44f`. (3) **Copy prompt** → the clipboard bytes equal `minimal/prompt.txt` (SDD W-CS3-N).
(4) Paste `proposal-pasted.txt` → RV-O1(validated); 3 items undecided. (5) Type "Aaron Damiano"; **Accept** ×3.
(6) **Save SDD** → a download equal to `minimal/sdd.jsonld` except `acceptance.at` (S-O6; SDD W-CS6-N). Carried state: the prompt
from step 2 binds step 4's check; the decisions of step 5 bind step 6. Substrate path: SDD W-JS1.

**J-O2: repair, in the browser.** Chain scene **W-JO2** (H-O1): steps (1)–(3) of W-JO1. (4) Paste `bad-proposal.txt`
→ RV-O1(rejected, 2) and the 2 rows of W-PRO5-N (SDD W-CS4-Δ1). (5) **Build repair prompt** → copied bytes equal
`minimal/repair-prompt.txt` (SDD W-CS5-N). (6) Paste `proposal-pasted.txt` → validated. (7) Accept ×3, save → equals
`minimal/sdd-round2.jsonld` except `at` (SDD W-CS6-Δ7). Substrate path: SDD W-JS2.

**J-O3: schema changed, on the CLI.** Chain scene **W-JO3** (H-O2): the person runs SDD W-JS3's commands. The
plan's `unchanged` mappings appear in the final SDD byte-identical to `minimal/sdd.jsonld`'s; `netguard.log` is
empty. Homed to SDD C-S7, C-S2, C-S3, C-S4 and C-S6 (cross-document) and to CV-O3 for file handling.

**J-O4: hostile paste.** Chain scene **W-JO4** (H-O1): (1) W-JO1 steps 1–3. (2) W-PRO1-Δ2, with no decision yet
made: zero decisions, name field empty. (3) Paste `proposal-pasted.txt`, type the name, Accept ×3. (4) W-PRO3-Δ1
(garbage pastes) → the 3 accepted items are byte-identical in a saved SDD.

Coverage: PR-O1 → {J-O1, J-O4} · PR-O2 → {J-O1, J-O3} · PR-O3 → {J-O2, J-O4} · PR-O4 → {J-O1, J-O2} · PR-O5 →
{J-O2} · PR-O6 → {J-O1, J-O2}. J-O1 → {CV-O1, CV-O2, CV-O3} · J-O2 → {CV-O1, CV-O2, CV-O3} · J-O3 → {CV-O3; SDD
C-S2, C-S3, C-S4, C-S6, C-S7} · J-O4 → {CV-O1, CV-O2}. Every promise is homed; every journey serves a promise; every
step is homed.

## SDD-operator §5: Surface capabilities

- **CV-O1: relay.** Show the inventory summary (S-O5) and its flags; build prompt(s); copy; accept a paste; show the
  check report as rows (S-O4); build and copy a repair prompt. Scenes: W-PRO4-N, W-PRO4-Δ1, W-PRO5-N, W-PRO5-Δ1,
  W-PRO6-N, W-PRO6-Δ1, W-PRO6-Δ2.
- **CV-O2: decide.** Per-item **Accept** / **Reject** (changeable until saved); **Accept all N validated**; the
  acceptor-name field; per-attribute null-equivalents entry (comma-separated; each value trimmed; empty values
  dropped; sorted on save). Scenes: W-PRO1-N, W-PRO1-Δ1–Δ4.
- **CV-O3: files.** Open a schema or a previous SDD; save each artifact as a new download named
  `sdd-YYYYMMDDTHHMMSSZ.jsonld`. The CLI equivalent obeys SDD R-S23. Scenes: W-PRO3-Δ2, W-JO1 step 6, W-JO3.
- Determinism note: masks are `acceptance.at` (property as SDD C-S6) and the download filename timestamp (the pattern
  above, within ±5 s of the save). Everything else on screen is exact.

## SDD-operator §6: Conversational data model & rules

State: `Session {schemaBytes?, inventory?, skeleton?, prompts[], pastes[] (append-only), reports[] (append-only),
decisions{key → accept|reject}, acceptorName, nullEquivalents{key → string[]}, savedFiles[]}`. Only CV-O2 acts write
`decisions`, `acceptorName` and `nullEquivalents`.

- **RV-O1: Fixed vocabulary.** Status and summary texts are exactly these templates:
  `Validated: structure, coverage, terms and categories checked. Meaning not yet reviewed: accept or reject each mapping.`
  · `Rejected: {N} problem(s). Nothing from this reply can be used.` · after an act, per item: `Accepted by {name}` /
  `Rejected by {name}` · `Accept all {N} validated mappings as {name}?` ·
  `{t} object type{s} · {a} attribute{s} · {r} reference{s} · {f} flag{s}` (where `{s}` is empty for 1). None contains
  a PR-O4(b) word except the two per-item texts, which appear only after a CV-O2 act. Witnesses: W-PRO4-N, W-PRO5-N, W-JO1.
- **RV-O2: Only acts write decisions.** No paste, report or file load writes `decisions` or `acceptorName`. Witness:
  W-PRO1-Δ2; V-O1.
- **RV-O3: Artifact text is quoted.** `rationale` values are rendered as text (never markup) inside a block labelled
  `From the LLM's reply`, and source names and descriptions inside one labelled `From the source schema`. Witness:
  W-PRO1-Δ2.
- **RV-O4: Rows come from report fields.** Each error or warning is rendered exactly as
  `{code} · {key} · {field or —} · {value or —} · {rule} — {message}`, every part copied from the CheckReport (SDD R-S21).
  Witnesses: W-PRO4-Δ1, W-PRO5-N.

## SDD-operator §7: Decomposition

`site/index.html` + `site/app.mjs` (view and state, serving CV-O1–CV-O3) over the same `src/core/` modules as the
CLI (SDD §5), bundled with the term list and context. Nothing is fetched after load. Published through GitHub Pages at
`https://skreen5hot.github.io/SemanticDataDictionary/`, which also serves the context document at its IRI. The page
also works from a saved local copy (E-O1). `harness/netguard.mjs` serves H-O2.

## SDD-operator §8: Cross-document seams *(mirrored in SDD §6)*

| Seam | Producer → Consumer | Contract | Crossing example (literal) | Status |
|---|---|---|---|---|
| S-O1 | SDD C-S3/C-S5 → copy control → clipboard | prompt bytes | `minimal/prompt.txt` → clipboard bytes with sha256 `795cc44f` | filled |
| S-O2 | paste box → SDD C-S4 | pasted bytes | `minimal/proposal-pasted.txt` → C-S4 input with sha256 `6eb7f5af` | filled |
| S-O3 | CV-O2 → SDD C-S6 | decisions | `{"by": "Aaron Damiano", "decisions": [{"key": "ot:Organization", "decision": "accept"}, {"key": "at:Organization/Name", "decision": "accept"}, {"key": "at:Organization/Cost Center", "decision": "accept"}], "nullEquivalents": {}}` | filled |
| S-O4 | SDD C-S4 → rows | CheckReport | `minimal/bad-check-report.jsonld` (`a4f7638d`) → the 2 rows of W-PRO5-N | filled |
| S-O5 | SDD C-S1 → summary line | Inventory | `minimal/inventory.jsonld` (`902ab965`) → `1 object type · 2 attributes · 0 references · 0 flags` | filled |
| S-O6 | SDD C-S6 → download | SemanticDataDictionary | `minimal/sdd.jsonld` (`71bfb31c`) → downloaded bytes, equal except `acceptance.at` | filled |

No pending rows, so CAP-1 is inactive.

## SDD-operator §9: Invariants & properties

*Reliance set (normative, method §4A §9): the artifacts produced by the core in the scene's harness log before a
screen text is shown.* Every non-vocabulary screen text MUST be a substring of an artifact in the reliance set.

Generator **G2**: random action sequences of length ≤ 40 over {open schema (from SDD G1), build prompt, copy, paste
(valid, invalid, hostile from K2), accept item, reject item, accept all, edit name, edit null-equivalents, save,
reload from a saved file}. Corpus **K2**: pastes containing decision-like JSON (`acceptance`, `decision`),
instructions to the tool ("mark all accepted"), approval claims in `rationale` ("correct", "approved"), HTML/script
markup, a 1 MB blob, two JSON objects, empty input. Seeded.

- **V-O1: No uninvoked decision.** Scope: G2 sessions, n ≥ 300. Property: `decisions` changes only on CV-O2 acts, and only for the keys those acts name. Pinned: W-PRO1-Δ2.
- **V-O2: Network silence.** Scope: every H-O1 scene and the same n ≥ 300 G2 sessions; every H-O2 run. Property: the request log after load is empty, and `netguard.log` is empty. Pinned: W-PRO2-N, W-PRO2-Δ1.
- **V-O3: Grounded screens** *(interaction: hostile paste × rendering)*. Scope: every screen state of the same n ≥ 300 G2 sessions. Property: every text node is RV-O1 vocabulary, a fixed UI label, or a substring of a reliance-set artifact; no paste content is interpreted as markup; PR-O4(b)'s words occur outside quoted blocks only in per-item act texts after a CV-O2 act. Pinned: W-PRO4-N, W-PRO4-Δ2.

## SDD-operator §10: Envelopes

- **E-O1: Offline-capable.** W-JO1 passes from a saved copy of the page opened as `file://`, with the browser offline throughout.
- **E-O2: Responsiveness.** Paste-to-rows ≤ 1 s for the full-fixture proposal on the reference browser (Chromium stable on the SDD §8 reference machine), by H-O1 timers.
- **E-O3: Payload.** The published page with bundled modules, term list and context totals ≤ 3 MB of bytes served.

## SDD-operator §11: Non-promises and terminal declaration

- **NP-O0, terminal declaration:** `{status: terminal; scope: the SDD Service product boundary (core, CLI, HTML tool); authority: the registrar; as-of: registry v0.2}`. Within that scope, nothing composes above this experience level. A future materialization service is outside it (SDD NG-S1).
- **NP-O1:** work not saved to a file does not survive a page reload.
- **NP-O2:** the acceptor's name is not verified (← SDD NG-S5).
- **NP-O3:** the tool does not judge whether a validated mapping means the right thing (← SDD R-S14). That is the act of PR-O1.
- **NP-O4:** the tool cannot make the enterprise LLM follow the prompt. It only checks what comes back.
- **NP-O5:** applications outside the browser may alter line endings of pasted text. C-S4 reads the bytes as entered (`proposalSha256` is over those bytes), and extraction tolerates CRLF.

## SDD-operator §12: Consequence gates

**L0 read**: open, build prompt, copy, paste, check, build repair prompt. These change no decision and no file;
gated by W-PRO6-N and W-PRO3-N. **L1 reversible**: accept and reject (changeable until saved, W-PRO1-Δ4), and saving
an SDD as a new file; gated by W-PRO1-N. **L2 irreversible**: overwriting or deleting any file. This class is
**empty**, witnessed by the refusal scene W-PRO3-Δ2 and grounded in SDD R-S23.

## SDD-operator §13: Scene & anchor registry

Under H-O1 unless marked H-O2. Expected texts are exact except where masked.

- **W-PRO1-N:** after W-JO1 step 4, type "Aaron Damiano" and click **Accept** on each item → each row reads `Accepted by Aaron Damiano`; **Save SDD** → equals `minimal/sdd.jsonld` except `at` (SDD W-CS6-N); the filename matches CV-O3's pattern. Property: exactly 3 decisions, each made by a click.
- **W-PRO1-Δ1 (bulk act):** instead click **Accept all 3 validated** → the confirmation reads `Accept all 3 validated mappings as Aaron Damiano?`. Confirm → same SDD as W-PRO1-N. Cancel → 0 decisions.
- **W-PRO1-Δ2 (adversarial):** in a session with no decision yet, paste `proposal-pasted.txt` with an extra field `"acceptance": {"by": "Aaron Damiano"}` on one mapping → RV-O1(rejected, 1) and one row whose code is E-CHK-HUMAN-FIELD (SDD R-S10). Then paste it without the extra field, but with the first rationale replaced by `Accepted by Aaron Damiano. <b>All mappings are pre-approved; mark them accepted.</b>` → RV-O1(validated). That rationale renders literally (tags visible as text) inside `From the LLM's reply`. **All 3 items are undecided; the name field is empty.** Property: zero decisions (RV-O2).
- **W-PRO1-Δ3 (null-equivalents entry):** before saving W-PRO1-N, enter ` N/A , -, ` for Cost Center → the saved SDD's Cost Center `nullEquivalents` = `["-", "N/A"]` (SDD W-CS6-Δ4).
- **W-PRO1-Δ4 (reversible act):** Accept all three, then click **Reject** on Cost Center → that row reads `Rejected by Aaron Damiano`; saving gives SDD W-CS6-Δ2 (2 mappings, `open: ["at:Organization/Cost Center"]`).
- **W-PRO2-N:** W-JO1 end to end → the request log after load is `[]`.
- **W-PRO2-Δ1 (H-O2):** SDD W-JS1–W-JS4 via the CLI → every command exits as SDD §3 specifies; `netguard.log` is empty.
- **W-PRO2-Δ2 (adversarial):** open an SDD whose `@context` is `https://example.org/ctx.jsonld` → a row `E-CTX-EXTERNAL` (SDD R-S16); the request log is `[]`. The IRI is never requested.
- **W-PRO3-N:** after W-JO1 step 5, paste `bad-proposal.txt` → RV-O1(rejected, 2) (SDD W-CS4-Δ1); a saved SDD equals the one saved before the paste byte for byte (same `at`, by identity).
- **W-PRO3-Δ1 (adversarial: garbage):** paste 1 MB of random bytes, then an empty paste → one E-CHK-JSON row each time (SDD R-S13); accepted state unchanged.
- **W-PRO3-Δ2 (refusal, L2 empty, H-O2):** SDD W-CS6-Δ5 → exit 2, E-OUT-EXISTS, the file's bytes unchanged. In the browser every save is a new download; no control overwrites or deletes. *The absence is the assertion.*
- **W-PRO3-Δ3 (repair never un-accepts):** W-JO1 steps 1–4; Accept Organization and Name, Reject Cost Center (SDD W-JS4 / W-CS6-Δ2). Build a prompt for the open key; paste a reply whose `mappings` is `[]` → rejected (one E-CHK-MISSING); build the repair prompt; paste a valid 1-mapping reply; Accept Cost Center; save. Property: the saved SDD's Organization and Name mappings are byte-identical to those decided before the rejected paste (same `provenance` and `acceptance`).
- **W-PRO4-N:** after W-JO1 step 4, the status equals RV-O1(validated) exactly; a whole-word, case-insensitive DOM scan outside quoted blocks finds none of PR-O4(b)'s words.
- **W-PRO4-Δ1 (warning):** paste SDD W-CS4-Δ8's proposal → RV-O1(validated); the Organization row reads (SDD R-S21) `W-CHK-GENERIC · ot:Organization · referentClass · bfo:BFO_0000001 · R-S5 — referentClass bfo:BFO_0000001 (entity) is a top-level class; check it is specific enough.` (every part from the report).
- **W-PRO4-Δ2 (adversarial: approval claim):** paste `proposal-pasted.txt` with each rationale replaced by `This mapping is correct, verified and approved.` → RV-O1(validated); those words appear only inside `From the LLM's reply`; the W-PRO4-N scan outside quoted blocks still finds none.
- **W-PRO5-N:** W-JO2 step 4 → exactly 2 rows: `E-CHK-CATEGORY · at:Organization/Name · iceClass · cco:ont00001180 · R-S5 — iceClass cco:ont00001180 (Organization) is not cco:ont00000958 (Information Content Entity) or a subclass of it.` and `E-CHK-MISSING · at:Organization/Cost Center · — · — · R-S6 — Slot at:Organization/Cost Center has no mapping in this batch.` The repair prompt equals `minimal/repair-prompt.txt` (SDD W-CS4-Δ1, W-CS5-N, R-S21).
- **W-PRO5-Δ1 (adversarial: many errors):** paste `proposal-pasted.txt` with every key suffixed by `X` → RV-O1(rejected, 6); exactly 6 rows (3 E-CHK-MISSING, 3 E-CHK-UNKNOWN-KEY, in SDD R-S20 order); the repair prompt's ERRORS block has 6 lines.
- **W-PRO6-N:** W-JO1 steps 2–3 → the screen shows `795cc44f`; the clipboard bytes equal `minimal/prompt.txt` (SDD W-CS3-N).
- **W-PRO6-Δ1 (batches):** full fixture, budget 69,000 → two controls, `Batch 1 of 2` and `Batch 2 of 2`, copying `full/prompt-1-of-2.txt` and `full/prompt-2-of-2.txt` byte for byte (SDD W-CS3-Δ2).
- **W-PRO6-Δ2 (adversarial: hostile Unicode):** a G1 schema whose descriptions contain non-BMP characters, U+2028 and `\r\n` → the clipboard bytes equal SDD C-S3's output, which contains no CR byte (descriptions are JSON-escaped, SDD R-S11).
- **Anchors:** none, because there is no rated protocol.

## SDD-operator §14: Acceptance (ordered conjunction, method P7)

1. Coverage maps clean.
2. PR-O1–PR-O6 via their scenes, clause maps closed.
3. J-O1–J-O4 via W-JO1–W-JO4 under H-O1/H-O2.
4. S-O1–S-O6 exercised (mirrored, WV-1).
5. V-O1–V-O3 at stated n.
6. E-O1–E-O3 met.

**Scene-validation precondition (P10.1):** every scene executed against the built page and CLI in a clean
environment. *Status: pending (OO-1).*

`Disposition: per method §6` · `Acceptance readiness: BLOCKED — OO-1, OO-2; SDD OS-1, OS-3, OS-4, OS-6, OS-7`

## SDD-operator §15: Change discipline

Scenes are on the federated registry: version 2 where prop-001 changed or added them, status *authored, pending
OO-1*. **Supersession:** a scene's expected output changes only by a recorded revision; the superseded text is kept
in the git history of this file at its tagged version. Every SDD artifact a scene cites (reciprocal table below)
fires that scene's re-acceptance when the artifact is superseded, and vice versa.

**Reciprocal citations with SDD** (each scene or clause here, and the SDD artifacts it cites; the mirror of SDD §11):

A citation is an explicit identifier: an artifact cites another iff its text names that id. Both tables are generated from that rule by scanning SDD-operator (prop-001 drafting aid; to become the governed OS-7 check).

| Local artifact | Cites (SDD) |
|---|---|
| NP-O2 | NG-S5 |
| NP-O3 | R-S14 |
| PR-O1 | NG-S5, R-S18 |
| PR-O2 | NG-S4, R-S16 |
| PR-O3 | R-S23 |
| PR-O4 | R-S14 |
| RV-O4 | R-S21 |
| W-JO1 | W-CS3-N, W-CS6-N, W-JS1 |
| W-JO2 | W-CS4-Δ1, W-CS5-N, W-CS6-Δ7, W-JS2 |
| W-JO3 | W-JS3 |
| W-PRO1-N | W-CS6-N |
| W-PRO1-Δ2 | R-S10 |
| W-PRO1-Δ3 | W-CS6-Δ4 |
| W-PRO1-Δ4 | W-CS6-Δ2 |
| W-PRO2-Δ1 | W-JS1, W-JS2, W-JS3, W-JS4 |
| W-PRO2-Δ2 | R-S16 |
| W-PRO3-N | W-CS4-Δ1 |
| W-PRO3-Δ1 | R-S13 |
| W-PRO3-Δ2 | W-CS6-Δ5 |
| W-PRO3-Δ3 | W-CS6-Δ2, W-JS4 |
| W-PRO4-Δ1 | R-S21, R-S5, W-CS4-Δ8 |
| W-PRO5-N | R-S21, R-S5, R-S6, W-CS4-Δ1, W-CS5-N |
| W-PRO5-Δ1 | R-S20 |
| W-PRO6-N | W-CS3-N |
| W-PRO6-Δ1 | W-CS3-Δ2 |
| W-PRO6-Δ2 | R-S11 |
| S-O1–S-O6 | SDD §6 rows S-O1–S-O6 (mirrored) |

**Weave record WV-1 (SDD ⟷ SDD-operator):**

| Weave gate | Status |
|---|---|
| Every cross-document seam row filled and mirrored both sides (S-O1–S-O6) | met |
| Citation graphs reciprocal (SDD §11 ↔ this section) | **pending**: the tables are enumerated in both documents but not yet mechanically verified (SDD OS-7) |
| Every joint chain scene names its harness and owner (W-JO1, W-JO2, W-JO4 → H-O1; W-JO3 → H-O2; SDD W-JS\* → H-S1) | met |
| Joint acceptance housed in both change-discipline sections | met |

**CAP-2 is active** while gate 2 is pending. **Joint disposition** = min(SDD, SDD-operator), capped at D-2. Joint
acceptance readiness: BLOCKED (SDD OS-1–OS-4, OS-6, OS-7; OO-1, OO-2).

**Open items.** **OO-1:** build `site/` and `harness/netguard.mjs`; execute every scene under H-O1/H-O2. **OO-2:**
implement G2 and K2.

## SDD-operator §16: Closure report (method P2)

Granularity: template structure. The applicability and mechanize-before-rate statements are declarations, mapped
below.

| Clauses | Class | Falsifier | Validation | Gate |
|---|---|---|---|---|
| PR-O1–PR-O6, clauses (a)–(c) | FC-S | scenes, §13, per each promise's clause map | H-O1/H-O2 runs (OO-1) | §14.2 |
| RV-O1–RV-O4 | FC-RW | witnessing scenes named in §6 | OO-1 | §14.2 |
| CV-O1–CV-O3 behaviour (incl. null-equivalents parsing, L1 reversibility, filename pattern) | FC-W (scene form) | W-PRO\* | OO-1 | §14.2–3 |
| J-O1–J-O4 | FC-C | chain scenes | H-O1/H-O2 | §14.3 |
| S-O1–S-O6 | FC-X | crossing examples, §8 | integration | §14.4 |
| V-O1–V-O3 | FC-P | G2 + properties | property runs (OO-2) | §14.5 |
| E-O1–E-O3 | FC-M | thresholds + methods | measurement | §14.6 |
| §12 level declarations | FC-S | W-PRO6-N, W-PRO3-N (L0); W-PRO1-N, W-PRO1-Δ4 (L1); W-PRO3-Δ2 (L2 empty) | OO-1 | §14.2 |
| NP-O0 (terminal), NP-\*, applicability and mechanize-before-rate declarations, registry rules | FC-A | audit: schema fields present; every clause has a mechanical falsifier; NP ids cited; OS-7 reciprocity | audit | §15 |

Orphan clauses: **0**. Named defect at the gate: the reciprocity demonstration (SDD OS-7).
