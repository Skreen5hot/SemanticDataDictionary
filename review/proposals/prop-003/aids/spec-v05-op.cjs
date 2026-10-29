// v0.5: SDD-operator spec edits. Run from the repository root.
const fs = require('fs');
function edit(P, pairs) {
  let t = fs.readFileSync(P, 'utf8');
  for (const [a, b] of pairs) {
    const n = t.split(a).length - 1;
    if (n !== 1) throw new Error(`${P}: ${n} matches for ${a.slice(0, 80)}`);
    t = t.replace(a, b);
  }
  fs.writeFileSync(P, t);
}

edit('spec/sdd-operator.md', [
  ['| **Status** | v0.4.1 (correction pass 2026-10-28',
   '| **Status** | v0.5 (2026-10-29, with SDD v0.5: an attribute mapping whose `iceClass` is `null` is shown with a fixed text; a version-1 previous SDD is refused; release candidate v1.0.0-rc.2). v0.4.1 (correction pass 2026-10-28'],
  ['RV-O1(validated); 3 items undecided. (5)', 'RV-O1(validated); 3 items undecided. (5)'], // anchor check only
  ['  plan\'s list headings `Unchanged ({n})` · `Changed ({n})` · `Added ({n})` · `Removed ({n})` (`{n}` is the length of the\n  RerunPlan\'s list of that name).',
   '  plan\'s list headings `Unchanged ({n})` · `Changed ({n})` · `Added ({n})` · `Removed ({n})` (`{n}` is the length of the\n  RerunPlan\'s list of that name) · inside `From the LLM\'s reply`, for an attribute mapping whose `iceClass` is `null`\n  (SDD R-S5), the line `iceClass — none asserted` in place of a CURIE and label.'],
  ['None contains\n  a PR-O4(b) word except `Accepted by {name}`, which appears only after a CV-O2 act. Witnesses: W-PRO4-N, W-PRO5-N, W-JO1.',
   'None contains\n  a PR-O4(b) word except `Accepted by {name}`, which appears only after a CV-O2 act. Witnesses: W-PRO4-N, W-PRO5-N, W-JO1,\n  W-PRO1-Δ7.'],
  ['with no DATA lines.` · E-SKEL-ERRORED `The schema has source errors, so no skeleton can be made.` Witnesses: W-PRO4-Δ1,\n  W-PRO5-N, W-PRO2-Δ2.',
   'with no DATA lines.` · E-SKEL-ERRORED `The schema has source errors, so no skeleton can be made.` An E-USAGE refusal of an\n  opened file carries the core\'s detail as its message (SDD R-S24). Witnesses: W-PRO4-Δ1, W-PRO5-N, W-PRO2-Δ2, W-PRO2-Δ3.'],
  ['dropped; sorted on save). `acceptance.at` is set at the click on Accept, not at save. Scenes: W-PRO1-N, W-PRO1-Δ1–Δ6.',
   'dropped; sorted on save). `acceptance.at` is set at the click on Accept, not at save. Scenes: W-PRO1-N, W-PRO1-Δ1–Δ7.'],
  ['- **W-PRO2-N:** W-JO1 end to end',
   '- **W-PRO1-Δ7 (no specific classification; SDD R-S5, W-CS6-Δ11):** W-JO1 steps 1–3; paste `minimal/proposal-null.txt` → RV-O1(validated) and no row; inside Cost Center\'s `From the LLM\'s reply` the line reads `iceClass — none asserted` and no CURIE is shown; all 3 items are undecided. Type "Aaron Damiano"; **Accept** ×3; **Save SDD** → equals `minimal/sdd-null.jsonld` except `at`. Property: a `null` classification is shown, and becomes part of the SDD only by an act.\n' +
   '- **W-PRO2-N:** W-JO1 end to end'],
  ['The IRI is never requested.',
   'The IRI is never requested.\n' +
   '- **W-PRO2-Δ3 (refusal: version-1 SDD, SDD R-S24, W-CS6-Δ12):** after W-JO1 step 1, open as the previous SDD `minimal/sdd.jsonld` with its `sddVersion` replaced by `1` → exactly one row, `E-USAGE · — · — · — · — — the previous SDD has sddVersion 1; this release reads only sddVersion 2`; no item reads `Accepted by …`; the request log is `[]`.'],
]);
console.log('sdd-operator.md ok');
