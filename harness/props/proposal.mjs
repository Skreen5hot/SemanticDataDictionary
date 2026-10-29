// Correct-proposal generator (OS-3 deliverable 2; reusable by SDD-operator G2).
// Given the bytes of a prompt (R-S11), it answers every DATA line with terms from ontology/term-list.json chosen to
// satisfy R-S5–R-S8 as the spec states them:
//   R-S7  every CURIE is in the term list, permitted, and of the field's kind (class / object property);
//         sdd:NoRelation only in containment slots.
//   R-S5  recordClass and iceClass are cco:ont00000958 or descend from it by named ancestry (superclasses, transitively).
//   R-S8  a relation's every named domain admits the owner's (child's) referentClass and every named range the
//         target's (container's): the class equals it or descends from it. Relations with no named domain/range
//         are always admissible.
// referentClass / recordClass / iceClass choices are a pure function of (assignment seed, slot key), so the same type
// gets the same referentClass in every batch and round; that is what lets reference slots that cross batches still
// satisfy R-S8 when both ends are known.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng } from './rng.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TERM_LIST = JSON.parse(readFileSync(join(ROOT, 'ontology/term-list.json'), 'utf8'));
export const ICE = 'cco:ont00000958';
const PFX = TERM_LIST.prefixes; // { bfo: iri-base, cco: iri-base }
export const iriToCurie = (iri) => { for (const [p, base] of Object.entries(PFX)) if (iri.startsWith(base)) return `${p}:${iri.slice(base.length)}`; return iri; };
export const TERMS = new Map(TERM_LIST.terms.map((t) => [t.curie, t]));
const anc = new Map();
export function ancestors(curie) {
  if (anc.has(curie)) return anc.get(curie);
  const out = new Set(); anc.set(curie, out);
  const t = TERMS.get(curie); if (!t) return out;
  for (const s of t.superclasses || []) { const c = iriToCurie(s); out.add(c); for (const x of ancestors(c)) out.add(x); }
  return out;
}
export const isOrDescends = (c, d) => c === d || ancestors(c).has(d);
export const isIceDescended = (c) => isOrDescends(c, ICE);
export const CLASSES = TERM_LIST.terms.filter((t) => t.kind === 'class' && t.permitted).map((t) => t.curie);
export const ICE_CLASSES = CLASSES.filter(isIceDescended);
export const NON_ICE_CLASSES = CLASSES.filter((c) => !isIceDescended(c));
export const OBJECT_PROPERTIES = TERM_LIST.terms.filter((t) => t.kind === 'object_property' && t.permitted).map((t) => ({ curie: t.curie, domain: (t.domain || []).map(iriToCurie), range: (t.range || []).map(iriToCurie) }));
export const admits = (p, owner, target) => p.domain.every((d) => isOrDescends(owner, d)) && p.range.every((r) => isOrDescends(target, r));
// Generic per R-S5: BFO namespace or exactly ICE.
export const isGeneric = (c) => c.startsWith('bfo:') || c === ICE;

// ---------------- prompt parsing (R-S11 layout) ----------------
export function parsePrompt(text) {
  const lines = text.split('\n');
  const head = (k) => { const l = lines.find((x) => x.startsWith(k + ': ')); return l ? l.slice(k.length + 2) : null; };
  const b = lines.indexOf('-----BEGIN DATA (untrusted)-----');
  const e = lines.indexOf('-----END DATA-----', b + 1);
  if (b < 0 || e < 0) throw new Error('prompt has no DATA block');
  const dataLines = lines.slice(b + 1, e);
  return { skeleton: head('skeleton'), terms: head('terms'), batch: head('batch'), round: Number(head('round')), dataLines, data: dataLines.map((l) => JSON.parse(l)), lines, dataStart: b + 1, dataEnd: e };
}

// ---------------- assignment ----------------
export class Assignment {
  constructor(seed, opts = {}) { this.seed = String(seed); this.opts = { iceReferentRate: 0.04, genericRate: 0.03, noRelationRate: 0.2, constrainedRate: 0.75, ...opts }; this.cache = new Map(); }
  rng(key, tag) { return new Rng(`${this.seed}|${tag}|${key}`); }
  referentClass(typeKey) {
    const k = 'ref:' + typeKey; if (this.cache.has(k)) return this.cache.get(k);
    const r = this.rng(typeKey, 'referent'); const x = r.next();
    const c = x < this.opts.iceReferentRate ? r.pick(ICE_CLASSES) : x < this.opts.iceReferentRate + this.opts.genericRate ? r.pick(CLASSES.filter((c) => c.startsWith('bfo:'))) : r.pick(NON_ICE_CLASSES);
    this.cache.set(k, c); return c;
  }
  recordClass(typeKey) { const r = this.rng(typeKey, 'record'); return r.bool(this.opts.genericRate) ? ICE : r.pick(ICE_CLASSES); }
  iceClass(attrKey) { const r = this.rng(attrKey, 'ice'); return r.bool(this.opts.genericRate) ? ICE : r.pick(ICE_CLASSES); }
  relation(slotKey, ownerKey, targetKey, containment) {
    const r = this.rng(slotKey, 'relation');
    if (containment && r.bool(this.opts.noRelationRate)) return 'sdd:NoRelation';
    const o = this.referentClass(ownerKey), t = this.referentClass(targetKey);
    const ck = `rel:${o}|${t}`;
    let cands = this.cache.get(ck);
    if (!cands) { const ok = OBJECT_PROPERTIES.filter((p) => admits(p, o, t)); cands = { constrained: ok.filter((p) => p.domain.length || p.range.length), free: ok.filter((p) => !p.domain.length && !p.range.length) }; this.cache.set(ck, cands); }
    const pool = cands.constrained.length && r.bool(this.opts.constrainedRate) ? cands.constrained : cands.free;
    return r.pick(pool).curie;
  }
}

// One mapping per DATA line, in DATA order, exactly the R-S20 field set for the slot kind.
export function correctMappings(data, asg, rationale = (d) => `Generated mapping for ${d.kind}.`) {
  return data.map((d) => {
    if (d.kind === 'type') return { key: d.key, recordClass: asg.recordClass(d.key), referentClass: asg.referentClass(d.key), rationale: rationale(d) };
    if (d.kind === 'attribute') return { key: d.key, iceClass: asg.iceClass(d.key), rationale: rationale(d) };
    if (d.kind === 'reference') return { key: d.key, relation: asg.relation(d.key, d.owner, d.target, false), rationale: rationale(d) };
    if (d.kind === 'containment') return { key: d.key, relation: asg.relation(d.key, d.child, d.container, true), rationale: rationale(d) };
    throw new Error('unknown slot kind ' + d.kind);
  });
}
export function correctProposal(promptText, asg, opts = {}) {
  const p = parsePrompt(promptText);
  return { skeletonSha256: p.skeleton, batch: p.batch, mappings: correctMappings(p.data, asg, opts.rationale) };
}
// Paste bytes: the bare object (pretty or compact) or prose + one ```json fence (R-S13 both forms).
export function toPaste(obj, style = 'fenced') {
  if (style === 'bare') return JSON.stringify(obj, null, 2) + '\n';
  if (style === 'compact') return JSON.stringify(obj);
  return 'Here is the mapping:\n\n```json\n' + JSON.stringify(obj, null, 2) + '\n```\n';
}
// The warnings a correct proposal is expected to raise are not errors; expectWarnings is informational only.
export function expectedWarnings(proposal, data) {
  const w = [];
  const typesHere = new Set(data.filter((d) => d.kind === 'type').map((d) => d.key));
  for (const m of proposal.mappings) {
    for (const f of ['recordClass', 'referentClass', 'iceClass']) if (m[f] && isGeneric(m[f])) w.push({ code: 'W-CHK-GENERIC', key: m.key, field: f });
    if (m.referentClass && isIceDescended(m.referentClass)) w.push({ code: 'W-CHK-ICE-REFERENT', key: m.key, field: 'referentClass' });
    const d = data.find((x) => x.key === m.key);
    if (m.relation && m.relation !== 'sdd:NoRelation') { const [o, t] = d.kind === 'reference' ? [d.owner, d.target] : [d.child, d.container]; if (!typesHere.has(o) || !typesHere.has(t)) w.push({ code: 'W-CHK-RANGE-UNRESOLVED', key: m.key, field: 'relation' }); }
  }
  return w;
}
