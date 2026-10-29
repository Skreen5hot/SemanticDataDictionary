// Generator G2 (SDD-operator §9): seeded random action sequences of length ≤ 40 over exactly the §9 alphabet
//   open schema (from SDD G1) · build prompt · copy · paste (valid, invalid, hostile from K2) · accept item ·
//   reject item · accept all · edit name · edit null-equivalents · save · reload from a saved file ·
//   open a previous SDD.
// A sequence is abstract (what to do, with seeded choices); the concrete bytes of a paste are made at run time
// by concretePaste() from the prompt the page actually built, because "valid" is only defined against that prompt:
//   valid   = proposal.mjs correctProposal() on that prompt (R-S5–R-S8 satisfied), rendered by toPaste();
//   invalid = one seeded mutation of the valid reply that the spec makes an error (R-S6, R-S5, R-S7, R-S10, R-S13);
//   hostile = one K2 entry built on the valid reply.
// "Reload from a saved file" = reload the page (NP-O1: unsaved work is gone) and open a file this session saved
// as the previous SDD. "Open a previous SDD" = open, without reloading, a file the session saved, or (when none
// exists) a witness SDD or a witness SDD with a foreign @context (W-PRO2-Δ2).
// Every choice is a pure function of the session seed, so a recorded seed reproduces the sequence; runtime choices
// (which batch, which item) use rng.fork(`a<i>`) and the observed page, so they too reproduce for a deterministic page.
import { Rng } from './rng.mjs';
import { g1, render, editModel, toBytes } from './g1.mjs';
import { Assignment, correctProposal, parsePrompt, toPaste, ICE_CLASSES, NON_ICE_CLASSES, OBJECT_PROPERTIES } from './proposal.mjs';
import { k2Paste, k2Schema } from './k2.mjs';

export const ALPHABET = ['openSchema', 'build', 'copy', 'paste', 'accept', 'reject', 'acceptAll', 'name', 'nullEq', 'save', 'reloadFromSaved', 'openPrevious'];
export const NAMES = ['Aaron Damiano', 'Bob', '  Carol Ng  ', 'Zoë Ångström', 'O\'Brien "QA"', 'Dana', 'Eve <b>x</b>', 'Ünïcode \u{1F600}'];
export const NULL_EQ = [' N/A , -, ', 'none', '', ' , ,', 'NULL,null, n/a', 'unknown , ? ,  —', 'N/A,N/A', '<b>x</b>, approved'];

// Schema for a session: G1 with a seeded size class (most sessions small so a step is cheap; some at G1's full
// range of 1–40 types). Some sessions open a K2 source-names variant or an edited model (rerun against a saved SDD).
export function sessionSchemas(seed) {
  const r = new Rng(`${seed}/schema`);
  const maxTypes = r.pick([2, 3, 4, 6, 8, 12, 40]);
  const base = g1(`${seed}/g1`, { maxTypes });
  const variants = [{ tag: 'g1', bytes: base.bytes, schema: base.schema }];
  const { model } = editModel(base.model, r.fork('edit'));
  const edited = render(model); variants.push({ tag: 'g1-edited', bytes: toBytes(edited), schema: edited });
  const hostile = k2Schema(base.schema, r.fork('k2')); variants.push({ tag: 'k2-source-names', bytes: toBytes(hostile), schema: hostile });
  return { maxTypes, base, variants };
}

export function g2(seed, opts = {}) {
  const r = new Rng(`${seed}/g2`);
  const maxLen = opts.maxLen ?? 40;
  const len = r.bool(0.15) ? r.int(1, 12) : r.int(12, maxLen);
  const acts = [];
  const push = (a) => { if (acts.length < len) acts.push(a); };
  // weighted alphabet; sequences start with open schema most of the time (otherwise every act is refused early)
  const W = [['openSchema', 4], ['build', 8], ['copy', 4], ['paste', 18], ['accept', 14], ['reject', 6], ['acceptAll', 5], ['name', 6], ['nullEq', 6], ['save', 9], ['reloadFromSaved', 2], ['openPrevious', 3]];
  const tot = W.reduce((a, [, w]) => a + w, 0);
  const pickType = () => { let x = r.next() * tot; for (const [t, w] of W) { if ((x -= w) < 0) return t; } return 'save'; };
  const mk = (t) => {
    switch (t) {
      case 'openSchema': return { t, variant: r.pick(['g1', 'g1', 'g1', 'g1-edited', 'k2-source-names']) };
      case 'build': return { t, budget: r.bool(0.7) ? null : r.pick([50000, 64000, 66000, 70000, 90000, 200000]) };
      case 'copy': return { t };
      case 'paste': { const kind = r.pick(['valid', 'valid', 'valid', 'invalid', 'hostile', 'hostile']); return { t, kind }; }
      case 'accept': case 'reject': return { t };
      case 'acceptAll': return { t, confirm: r.bool(0.7) };
      case 'name': return { t, value: r.pick(NAMES) };
      case 'nullEq': return { t, text: r.pick(NULL_EQ) };
      case 'save': return { t };
      case 'reloadFromSaved': return { t };
      case 'openPrevious': return { t, source: r.pick(['saved', 'saved', 'saved', 'witness', 'foreign-context']) };
    }
  };
  if (r.bool(0.92)) { push(mk('openSchema')); if (r.bool(0.9)) push(mk('build')); }
  while (acts.length < len) {
    const t = pickType(); const a = mk(t);
    // PR-O3(a) probe: an invalid or hostile paste bracketed by saves (V-O1's byte-identity clause needs both saves)
    if (t === 'paste' && a.kind !== 'valid' && r.bool(0.6)) { push(mk('save')); push(a); push(mk('save')); continue; }
    if (t === 'name' && r.bool(0.3)) { push(a); push(mk('accept')); continue; }
    push(a);
  }
  return { seed: String(seed), len: acts.length, actions: acts };
}

// ---------- invalid mutations: each is an error under the spec for a correct base ----------
const clone = (o) => JSON.parse(JSON.stringify(o));
export const MUTATIONS = {
  'drop-mapping (E-CHK-MISSING)': (o, r) => { o.mappings.splice(r.int(0, o.mappings.length - 1), 1); },
  'duplicate-mapping (E-CHK-DUPLICATE)': (o, r) => { o.mappings.push(clone(r.pick(o.mappings))); },
  'unknown-key (E-CHK-UNKNOWN-KEY)': (o, r) => { const m = clone(r.pick(o.mappings)); m.key += ' X'; o.mappings.push(m); },
  'category (E-CHK-CATEGORY)': (o, r) => { const ms = o.mappings.filter((m) => 'iceClass' in m || 'recordClass' in m); if (!ms.length) return false; const m = r.pick(ms); m['iceClass' in m ? 'iceClass' : 'recordClass'] = r.pick(NON_ICE_CLASSES); },
  'invented-term (E-CHK-TERM)': (o, r) => { const m = r.pick(o.mappings); const f = ['recordClass', 'referentClass', 'iceClass', 'relation'].find((x) => x in m); m[f] = 'cco:ont99999999'; },
  'wrong-kind (E-CHK-KIND)': (o, r) => { const ms = o.mappings.filter((m) => 'iceClass' in m || 'recordClass' in m); if (!ms.length) return false; const m = r.pick(ms); m['iceClass' in m ? 'iceClass' : 'recordClass'] = r.pick(OBJECT_PROPERTIES).curie; },
  'human-field (E-CHK-HUMAN-FIELD)': (o, r) => { r.pick(o.mappings)[r.pick(['datatype', 'valueProperty'])] = 'xsd:string'; },
  'field-set (E-CHK-FIELDS)': (o, r) => { const m = r.pick(o.mappings); delete m.rationale; },
  'stale-skeleton (E-CHK-SKELETON)': (o) => { o.skeletonSha256 = 'f'.repeat(64); },
  'wrong-batch (E-CHK-BATCH)': (o) => { o.batch = '9/9'; },
  'shape (E-CHK-SHAPE)': (o) => { o.mappings = {}; },
  'empty-mappings (E-CHK-MISSING)': (o) => { o.mappings = []; },
  'json-syntax (E-CHK-JSON)': () => 'syntax',
};
export function invalidPaste(rng, base) {
  const names = Object.keys(MUTATIONS);
  for (let tries = 0; tries < 10; tries++) {
    const id = rng.pick(names); const o = clone(base);
    const res = MUTATIONS[id](o, rng);
    if (res === false) continue;
    if (res === 'syntax') { const t = toPaste(base, 'fenced'); return { id, text: t.slice(0, Math.max(10, Math.floor(t.length / 2))) }; }
    return { id, text: toPaste(o, rng.pick(['fenced', 'bare', 'compact'])) };
  }
  return { id: 'empty-mappings (E-CHK-MISSING)', text: toPaste({ ...base, mappings: [] }) };
}

// Concrete paste for an abstract paste action, given the prompt text the page built for the chosen batch (or null).
export function concretePaste(rng, kind, promptText, asg) {
  let base = null;
  if (promptText) { try { base = correctProposal(promptText, asg); } catch { base = null; } }
  if (kind === 'valid' && base) return { kind, id: 'correct-proposal', expect: 'validated', text: toPaste(base, rng.pick(['fenced', 'fenced', 'bare', 'compact'])) };
  if (kind === 'invalid' && base) { const m = invalidPaste(rng, base); return { kind, id: m.id, expect: 'rejected', text: m.text }; }
  if (kind === 'hostile' || !base) { const h = k2Paste(rng, base); return { kind: kind === 'hostile' ? 'hostile' : kind + '(no prompt: K2)', id: h.id, cls: h.cls, expect: h.expect, text: h.text }; }
}
export { Assignment, parsePrompt };

if (process.argv[1] && process.argv[1].endsWith('g2.mjs')) {
  const i = process.argv.indexOf('--seed'); const seed = i > 0 ? process.argv[i + 1] : 'demo';
  console.log(JSON.stringify(g2(seed), null, 1));
}
