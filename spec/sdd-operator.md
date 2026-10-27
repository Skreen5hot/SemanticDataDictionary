# SDD Service: operator experience (companion)

| | |
|---|---|
| **Conformance** | *The Falsifiable Spec v0.4*, method §4A form. Companion to [`sdd-service.md`](sdd-service.md) (`SDD`), which delegates its experience level here (NG-S0). Federated by weave record **WV-1** (§15). |
| **Status** | v0.1 draft, 2026-10-27. Ungraded. Nothing built; no scene executed. |
| **Stable identifiers** | Promises PR-O\*; journeys J-O\*; surface capabilities CV-O\*; rules RV-O\*; scenes W-PRO\*, W-JO\*; seams S-O\* (shared with SDD); invariants V-O\*; envelopes E-O\*; non-promises NP-O\*; harnesses H-O\*; open items OO-\*. |

**Applicability (P11 semantic test).** The person's work ranges over a *trajectory*: generate a prompt, carry it
out of the tool, paste a reply, read a report, repair, decide, save, possibly across several rounds and sessions.
The promises below quantify over that trajectory, not over single invocations, so this experience level exists.

**Mechanize-before-rate, stated once.** The surface (HTML page and CLI) generates no free language. Every string it
shows comes from a fixed vocabulary or from an artifact. Every clause below therefore has a mechanical falsifier,
and this document carries **no rated protocol**. The LLM's language never reaches the person except as artifact
content (`rationale`), which the surface displays as quoted data.

## SDD-operator §1: Purpose & user

The person from SDD §1, working at a desk with the enterprise LLM in another window. The promise, in their words:
*"I carry text between two windows, and nothing gets accepted, sent anywhere or lost unless I do it myself. When a
check passes, the tool tells me what it checked and that the meaning is still my call."*

## SDD-operator §2: Promise register

**PR-O1: Nothing is accepted without your explicit act.** (a) A mapping enters an SDD only through an accept act on
that mapping: a per-item **Accept**, or **Accept all N validated**, which names N. (b) No pasted text can perform,
pre-fill or simulate a decision. (c) The acceptor's name is typed by the person, never taken from an artifact.
Clause ↔ scene map (all mechanical, all clause-relevant): (a) → W-PRO1-N, W-PRO1-Δ1 · (b) → W-PRO1-Δ2 (adversarial)
· (c) → W-PRO1-Δ2 (name field empty although the paste names someone). Cites R-S18, NG-S5.

**PR-O2: Nothing leaves your machine.** (a) After the page has loaded, no network request occurs in any journey.
(b) No CLI command makes a network request. (c) A foreign `@context` is refused, never fetched. Clause ↔ scene map:
(a) → W-PRO2-N (request log empty across W-JO1) · (b) → W-PRO2-Δ1 (all CLI chains pass with networking disabled) ·
(c) → W-PRO2-Δ2 (adversarial). Cites NG-S4, R-S16.

**PR-O3: A bad paste never costs you work.** (a) After any rejected paste, everything already accepted in the session
is unchanged, byte for byte. (b) A repair round never un-accepts or re-opens an accepted mapping. (c) The tool never
overwrites or deletes a saved file. Clause ↔ scene map: (a) → W-PRO3-N, W-PRO3-Δ1 (adversarial) · (b) → W-JO2 ·
(c) → W-PRO3-Δ2 (refusal; the empty L2 class, §12).

**PR-O4: Validated never reads as approved.** (a) A check outcome is shown only with the fixed status texts of RV-O1.
(b) No text on the check or repair screens contains "correct", "approved", "accepted" or "verified", except inside
quoted artifact content. (c) Every warning is shown beside its item. Clause ↔ scene map: (a) → W-PRO4-N · (b) →
W-PRO4-N, V-O3 · (c) → W-PRO4-Δ1. Cites R-S14.

**PR-O5: Every problem names its item and its rule.** (a) Each error is one row showing code, key, field, value and
rule. (b) The number of rows equals the report's error count. (c) The repair prompt contains every row's error.
Clause ↔ scene map: (a), (b) → W-PRO5-N · (c) → W-PRO5-N (repair prompt bytes = C-S5 output, which lists all errors
per W-CS5-N).

**PR-O6: What you copy is exactly what was generated.** (a) **Copy prompt** places the prompt's exact bytes on the
clipboard. (b) The screen shows the first 8 hex characters of the prompt's sha256. (c) With several batches, each
has its own copy control, labelled "Batch i of n". Clause ↔ scene map: (a), (b) → W-PRO6-N · (c) → W-PRO6-Δ1.

NG/NP citations: NG-S4 (PR-O2), NG-S5 (PR-O1, NP-O2), R-S14 (PR-O4).

## SDD-operator §3: Posture *(informative)*

Plain, procedural, and modest about what a check means. This sits outside the graded surface; the partition is
stated here.

## SDD-operator §4: Journeys

Harness **H-O1**: Playwright driving `site/` in Chromium. The page loads, then the context's network is set to
offline and every request is logged. Clipboard read is enabled; file choosers and downloads are intercepted. Owner:
this document's acceptance runner, registered both sides via WV-1. Harness **H-O2**: a shell runner executing the
CLI inside a container started with networking disabled (`--network=none`).

**J-O1: first dictionary, in the browser.** Chain scene **W-JO1** (H-O1): (1) open `minimal-organization.json` →
the inventory screen lists 1 type and 2 attributes, with 0 flags. (2) **Build prompt** → 1 batch; the screen shows
`4082dfe5` (PR-O6). (3) **Copy prompt** → clipboard sha256 = `4082dfe5…facc28e9f`. (4) Paste `proposal-pasted.txt`
→ status text RV-O1(validated), with 3 items listed as undecided. (5) Type name "Aaron Damiano"; **Accept** ×3 →
3 accepted. (6) **Save SDD** → a download whose content equals W-CS6-N's SDD (`acceptance.at` masked). Carried
state: the skeleton hash from step 2 binds steps 4–6. The page is the C-S1–C-S6 core (SDD W-JS1) behind CV-O1–CV-O3.

**J-O2: repair, in the browser.** Chain scene **W-JO2** (H-O1): steps (1)–(3) of W-JO1. (4) Paste `bad-proposal.txt`
→ RV-O1(rejected, 2) with 2 error rows. (5) **Build repair prompt** → copied bytes = C-S5 output (W-CS5-N). (6) Paste
`proposal-pasted.txt` → validated. (7) Accept ×3, save → SDD with `round: 2`. Property (PR-O3b): no accepted item
existed before step 7, and none was created or removed by steps 4–6.

**J-O3: schema changed.** Chain scene **W-JO3** (H-O2, CLI): SDD W-JS3 executed by the person through the CLI,
networking disabled. The plan's `unchanged` items appear in the final SDD with their original `acceptance.at`.

**J-O4: hostile paste.** Chain scene **W-JO4** (H-O1): W-PRO1-Δ2, then W-PRO3-Δ1, in one session after W-JO1 step 5.
Outcome: the 3 accepted items are unchanged; no new decision exists.

Coverage: PR-O1 → {J-O1, J-O4} · PR-O2 → {J-O1, J-O3} · PR-O3 → {J-O2, J-O4} · PR-O4 → {J-O1, J-O2} · PR-O5 →
{J-O2} · PR-O6 → {J-O1, J-O2}. J-O1 → {CV-O1, CV-O2, CV-O3} · J-O2 → {CV-O1, CV-O2, CV-O3} · J-O3 → {CV-O3, CLI} ·
J-O4 → {CV-O1, CV-O2}. Every promise is homed; every journey serves a promise; every step is homed. Clean.

## SDD-operator §5: Surface capabilities

- **CV-O1: relay.** Show the inventory and its flags; build the prompt(s); copy; accept a paste; show the check
  report; build and copy a repair prompt. Scenes: W-PRO4-N, W-PRO5-N, W-PRO6-N, W-PRO6-Δ1.
- **CV-O2: decide.** Per-item **Accept** / **Reject**; **Accept all N validated**; the acceptor-name field; per-attribute
  null-equivalents entry (comma-separated, trimmed, sorted on save). Scenes: W-PRO1-N, W-PRO1-Δ1, W-PRO1-Δ2.
- **CV-O3: files.** Open a schema or a previous SDD; save each artifact as a new download (never overwrite). The CLI
  equivalent writes with `--out` and refuses an existing path. Scenes: W-PRO3-Δ2, W-JO3.
- Determinism note: every screen text is from RV-O1's vocabulary or is artifact content. Masks: `acceptance.at`
  (property as SDD C-S6) and the download filename timestamp (property `sdd-YYYYMMDDTHHMMSSZ.jsonld`, within ±5 s).

## SDD-operator §6: Conversational data model & rules

State: `Session {schemaBytes?, inventory?, skeleton?, batches[], pastes[] (append-only), reports[] (append-only),
decisions{key → accept|reject}, acceptorName, nullEquivalents{key → string[]}, savedFiles[]}`. Pastes and reports
are append-only; only CV-O2 acts write `decisions`.

- **RV-O1: Fixed status vocabulary.** The check outcome is shown only as one of exactly:
  `Validated: structure, coverage, terms and categories checked. Meaning not yet reviewed: accept or reject each mapping.`
  · `Rejected: N problem(s). Nothing was accepted.` · per item after an act: `Accepted by <name>` / `Rejected by <name>`.
  Witness: W-PRO4-N.
- **RV-O2: Only acts write decisions.** No paste, report or file load may write `decisions` or `acceptorName`.
  Witness: W-PRO1-Δ2; V-O1.
- **RV-O3: Artifact text is quoted.** `rationale` and source descriptions are rendered as text content (never as
  HTML), inside a block labelled "From the LLM's reply" or "From the source schema". Witness: W-PRO1-Δ2 (the markup in
  its rationale renders literally).

## SDD-operator §7: Decomposition

`site/index.html` + `site/app.mjs` (view and state, serving CV-O1–CV-O3) over the same `src/core/` modules as the
CLI (SDD §5), loaded as bundled ES modules with the term list. Nothing is fetched after load. `src/cli/sdd.mjs`
serves J-O3. Published through GitHub Pages at `https://skreen5hot.github.io/SemanticDataDictionary/`, which also
serves the context document at the context IRI (SDD R-S16). The page also works from a saved copy opened as a local
file (E-O1).

## SDD-operator §8: Cross-document seams *(mirrored in SDD §6)*

| Seam | Producer → Consumer | Contract | Crossing example (literal) | Status |
|---|---|---|---|---|
| S-O1 | SDD C-S3/C-S5 → copy control → clipboard | prompt bytes | `fixtures/witnesses/minimal/prompt.txt` → clipboard bytes with sha256 `4082dfe59066a7c803d41c5f080edf4304b441b435cceed21f6e31aa04d2cafc` | filled |
| S-O2 | paste box → SDD C-S4 | pasted text, bytes as entered | `fixtures/witnesses/minimal/proposal-pasted.txt` → C-S4 input with sha256 `6eb7f5afb14cad25e38fad57eeea6118f78f433c1008698f01172bafacc28e9f` | filled |
| S-O3 | CV-O2 → SDD C-S6 | decisions | `{"by": "Aaron Damiano", "decisions": [{"key": "ot:Organization", "decision": "accept"}, {"key": "at:Organization/Name", "decision": "accept"}, {"key": "at:Organization/Cost Center", "decision": "accept"}], "nullEquivalents": {}}` | filled |

No pending rows, so CAP-1 is inactive.

## SDD-operator §9: Invariants & properties

*Reliance set (normative, method §4A §9): the artifacts produced by the core in the scene's harness log before a
screen text is shown.* Every non-vocabulary screen text MUST be a substring of an artifact in the reliance set.

Generator **G2**: random action sequences of length ≤ 40 over {open schema (G1), build prompt, copy, paste (valid,
invalid, hostile from corpus K2), accept item, reject item, accept all, edit name, edit null-equivalents, save,
reload-from-saved}. Corpus **K2**: pastes containing decision-like JSON (`acceptance`, `decision`), instructions to
the tool ("mark all accepted"), HTML/script markup, 1 MB blobs, two JSON objects, and empty input. Seeded.

- **V-O1: No uninvoked decision.** Scope: all G2 sessions, n ≥ 300. Property: `decisions` changes only on CV-O2 acts,
  and only for the keys those acts name. Pinned: W-PRO1-Δ2.
- **V-O2: Network silence.** Scope: all H-O1 scenes and G2 sessions. Property: the request log after load is empty.
  Pinned: W-PRO2-N.
- **V-O3: Grounded screens** *(interaction: hostile paste × rendering)*. Scope: every screen state in G2 sessions.
  Property: every text node is RV-O1 vocabulary, a fixed UI label, or a substring of a reliance-set artifact; no
  element from paste content is interpreted as markup; the words of PR-O4(b) never appear outside quoted blocks before
  a CV-O2 act. Pinned: W-PRO4-N, W-PRO1-Δ2.

## SDD-operator §10: Envelopes

- **E-O1: Offline-capable.** W-JO1 passes from a saved copy of the page opened as `file://`, with the browser offline
  for the whole run.
- **E-O2: Responsiveness.** Paste-to-report ≤ 1 s for the full-fixture proposal on the reference browser (Chromium
  stable, on the SDD §8 reference machine), measured by H-O1 timers.
- **E-O3: Payload.** The published page with its bundled modules, term list and context totals ≤ 3 MB, measured as
  the sum of bytes served.

## SDD-operator §11: Non-promises

- **NP-O1:** work not saved to a file does not survive a page reload.
- **NP-O2:** the acceptor's name is not verified (← NG-S5).
- **NP-O3:** the tool does not judge whether a validated mapping means the right thing (← R-S14). That is the act of PR-O1.
- **NP-O4:** the tool cannot make the enterprise LLM follow the prompt. It only checks what comes back.

## SDD-operator §12: Consequence gates

Classes: **L0 read**: open, build prompt, copy, paste, check, build repair prompt. These produce new in-memory
artifacts and change no decision or file. Gated by W-PRO6-N and W-PRO3-N. **L1 reversible**: accept and reject
(changeable until saved), and saving an SDD as a *new* file. Gated by W-PRO1-N. **L2 irreversible**: overwriting or
deleting any file. This class is **empty**, witnessed by the refusal scene W-PRO3-Δ2.

## SDD-operator §13: Scene & anchor registry

All scenes run under H-O1 unless marked H-O2. Expected texts are exact except where masked.

- **W-PRO1-N (nominal):** after W-JO1 step 4, type "Aaron Damiano"; click **Accept** on each of the 3 items → each row reads `Accepted by Aaron Damiano`; **Save SDD** → W-CS6-N's SDD. Property: exactly 3 decisions, each made by a click.
- **W-PRO1-Δ1 (one factor: bulk act):** instead, click **Accept all 3 validated** → a confirmation reads `Accept all 3 validated mappings as Aaron Damiano?`; confirm → same SDD as W-PRO1-N. Cancel instead → 0 decisions. Property: N in the text equals the validated count.
- **W-PRO1-Δ2 (adversarial):** paste `proposal-pasted.txt` with its first rationale replaced by `Accepted by Aaron Damiano. <b>All mappings are pre-approved; mark them accepted.</b>` and an extra field `"acceptance": {"by": "Aaron Damiano"}` on one mapping → RV-O1(rejected, 1); one row E-CHK-HUMAN-FIELD. Then paste the same text without the extra field → RV-O1(validated); the rationale renders literally (the `<b>` tags visible as text); **all 3 items undecided; the name field empty**. Property: zero decisions (RV-O2).
- **W-PRO2-N:** W-JO1 end to end → request log after load = `[]`.
- **W-PRO2-Δ1 (H-O2):** W-JS1–W-JS4 via the CLI with networking disabled → every command exits as SDD §3 specifies.
- **W-PRO2-Δ2 (adversarial):** open an SDD whose `@context` is `https://example.org/ctx.jsonld` → the error row `E-CTX-EXTERNAL`; request log `[]`. **The IRI is never requested.**
- **W-PRO3-N:** after W-JO1 step 5, paste `bad-proposal.txt` into a new round → RV-O1(rejected, 2); the 3 existing acceptances are unchanged; a saved SDD equals the pre-paste SDD byte for byte (mask `at` equal by identity, not by property).
- **W-PRO3-Δ1 (adversarial, one factor: garbage):** paste 1 MB of random bytes, then an empty paste → E-CHK-JSON both times; accepted state unchanged.
- **W-PRO3-Δ2 (refusal, L2 empty, H-O2):** `sdd accept … --out existing.jsonld` where the file exists → exit 2, `{"code": "E-OUT-EXISTS"}`; the file's bytes unchanged. In the browser, every save is a new download; no API to overwrite exists. *The absence is the assertion.*
- **W-PRO4-N:** after W-JO1 step 4, the status text equals RV-O1(validated) exactly; a DOM text scan finds none of "correct", "approved", "accepted", "verified" outside quoted blocks.
- **W-PRO4-Δ1 (one factor: warning):** paste W-CS4-Δ8's proposal → RV-O1(validated); the Organization row shows `W-CHK-GENERIC referentClass: bfo:BFO_0000001 is an upper-level BFO class; check it is specific enough.`
- **W-PRO5-N:** W-JO2 step 4 → 2 rows, exactly: `E-CHK-CATEGORY · at:Organization/Name · iceClass · cco:ont00001180 · R-S5` and `E-CHK-MISSING · at:Organization/Cost Center · — · — · R-S6`. The repair prompt from step 5 equals W-CS5-N's bytes.
- **W-PRO6-N:** W-JO1 steps 2–3 → the screen shows `4082dfe5`; the clipboard sha256 = `4082dfe59066a7c803d41c5f080edf4304b441b435cceed21f6e31aa04d2cafc`.
- **W-PRO6-Δ1 (one factor: batches):** full fixture with budget 70,000 → two copy controls labelled `Batch 1 of 2` and `Batch 2 of 2`; each copies the bytes of W-CS3-Δ2's corresponding batch.
- **Anchors:** none. There is no rated protocol (mechanize-before-rate, stated in the header).

## SDD-operator §14: Acceptance (ordered conjunction, method P7)

1. Coverage maps clean.
2. PR-O1–PR-O6 via their scenes, clause maps closed.
3. J-O1–J-O4 via W-JO1–W-JO4 under H-O1 / H-O2.
4. S-O1–S-O3 exercised (mirrored, WV-1).
5. V-O1–V-O3 at stated n.
6. E-O1–E-O3 met.

**Scene-validation precondition (P10.1):** every scene executed against the built page and CLI in a clean
environment. *Status: pending (OO-1).*

`Disposition: per method §6` · `Acceptance readiness: BLOCKED — OO-1 (scene execution), SDD OS-4 (core)`

## SDD-operator §15: Change discipline

Scenes are on the federated registry: version 1, status *authored, pending OO-1*. Citations: W-PRO1-N ← J-O1, S-O3,
§12/L1 · W-PRO3-Δ2 ← §12/L2 · W-PRO6-N ← S-O1, J-O1. **Reciprocal entries (mirrored in SDD §11):** S-O1 ↔ W-PRO6-N;
S-O2 ↔ W-PRO3-N; S-O3 ↔ W-PRO1-N; R-S14 ↔ PR-O4; NG-S4 ↔ PR-O2, W-PRO2-N; NG-S5 ↔ NP-O2; W-JS1 ↔ W-JO1.

**Weave record WV-1 (SDD ⟷ SDD-operator):**

| Weave gate | Status |
|---|---|
| Every cross-document seam row filled and mirrored both sides (S-O1–S-O3) | met |
| Citation graphs reciprocal (SDD §11 ↔ this section) | met |
| Every joint chain scene names its harness and owner (W-JO1, W-JO2, W-JO4 → H-O1; W-JO3 → H-O2; operator acceptance runner) | met |
| Joint acceptance housed in both change-discipline sections | met |

All weave gates met, so CAP-2 is inactive. **Joint disposition** = min(SDD, SDD-operator), subject to caps. Joint
acceptance readiness: BLOCKED (SDD OS-1–OS-4, OS-6; OO-1).

**Open items.** **OO-1:** build `site/`; execute every scene under H-O1/H-O2. **OO-2:** implement G2 and K2.

## SDD-operator §16: Closure report (method P2)

Granularity: template structure. Free-floating normative clauses: none. The applicability and mechanize-before-rate
statements in the header are declarations, mapped below.

| Clauses | Class | Falsifier | Validation | Gate |
|---|---|---|---|---|
| PR-O1–PR-O6, clauses (a)–(c) | FC-S | scenes, §13, per each promise's clause map | H-O1/H-O2 runs (OO-1) | §14.2 |
| RV-O1–RV-O3 | FC-RW | witnessing scenes named in §6 | OO-1 | §14.2 |
| CV-O1–CV-O3 behaviour | FC-W (scene form) | W-PRO\* | OO-1 | §14.2–3 |
| J-O1–J-O4 | FC-C | chain scenes | H-O1/H-O2 | §14.3 |
| S-O1–S-O3 | FC-X | crossing examples, §8 | integration | §14.4 |
| V-O1–V-O3 | FC-P | G2 + properties | property runs (OO-2) | §14.5 |
| E-O1–E-O3 | FC-M | stated thresholds + methods | measurement | §14.6 |
| §12 level declarations | FC-S | W-PRO6-N, W-PRO3-N (L0); W-PRO1-N (L1); W-PRO3-Δ2 (L2 empty) | OO-1 | §14.2 |
| Applicability + mechanize-before-rate declarations; NP-\*; registry rules | FC-A | audit: every clause above has a mechanical falsifier; NP ids cited | audit | §15 |

Orphan clauses: **0**.
