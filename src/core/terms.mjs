// core/terms: term-list access, named ancestry (ADR-008), named domain/range (R-S8, NG-S9). Pure.

import { cmp } from './canonical.mjs';

export const ICE_CURIE = 'cco:ont00000958';
export const NO_RELATION = 'sdd:NoRelation';

/** Build an index over a parsed term-list value (ontology/term-list.json). */
export function indexTerms(termList) {
  const byCurie = new Map();
  const byIri = new Map();
  for (const t of termList.terms) {
    byCurie.set(t.curie, t);
    byIri.set(t.iri, t);
  }
  const ancCache = new Map();
  // Named ancestors (IRIs) of a class: transitive closure over `superclasses`, plus each visited
  // node's `bfo_ancestors` (covers BFO superclasses that are not themselves listed as terms).
  function ancestors(iri) {
    if (ancCache.has(iri)) return ancCache.get(iri);
    const seen = new Set();
    const stack = [iri];
    while (stack.length) {
      const cur = byIri.get(stack.pop());
      if (!cur) continue;
      for (const s of [...(cur.superclasses || []), ...(cur.bfo_ancestors || [])]) {
        if (!seen.has(s)) { seen.add(s); stack.push(s); }
      }
    }
    ancCache.set(iri, seen);
    return seen;
  }
  const iceIri = byCurie.get(ICE_CURIE)?.iri;

  const api = {
    termsSha256: termList.terms_sha256,
    ontologyTemplateCommit: termList.ontology_template_commit,
    get: (curie) => byCurie.get(curie),
    label: (curie) => byCurie.get(curie)?.label ?? null,
    /** class `curie` is, or descends from, the class with IRI `ancestorIri`. */
    isOrDescendsIri(curie, ancestorIri) {
      const t = byCurie.get(curie);
      if (!t) return false;
      return t.iri === ancestorIri || ancestors(t.iri).has(ancestorIri);
    },
    isIce(curie) {
      return iceIri !== undefined && api.isOrDescendsIri(curie, iceIri);
    },
    /** Catalogue sections (R-S11): permitted ICE classes, other permitted classes, permitted object properties. */
    catalogue() {
      const ice = [], other = [], props = [];
      for (const t of termList.terms) {
        if (!t.permitted) continue;
        if (t.kind === 'class') (api.isIce(t.curie) ? ice : other).push(t);
        else if (t.kind === 'object_property') props.push(t);
      }
      const sort = (xs) => xs.sort((a, b) => cmp(a.curie, b.curie));
      return { ice: sort(ice), other: sort(other), props: sort(props) };
    },
  };
  return api;
}
