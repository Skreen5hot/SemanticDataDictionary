// Builds ontology/term-list.json from the Ontology-Template registers vendored in
// vendor/ontology-template/ (ADR-005). Deterministic: identical inputs give identical
// bytes. No timestamps, terms sorted by IRI, fixed key order, LF line endings.
//
//   node tools/build-term-list.mjs           write ontology/term-list.json
//   node tools/build-term-list.mjs --check   exit 1 if the committed file is stale
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { namedSubclassEdges } from './turtle-subclass.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor', 'ontology-template');
const OUT = join(ROOT, 'ontology', 'term-list.json');

// Class hierarchy sources (ADR-008). BFO's comes from Ontology-Template's full BFO extract; CCO's from
// the pinned upstream file vendored under vendor/cco-upstream/ (Option B), whose expected sha256 is
// read from Ontology-Template's CCO register, never hard-coded here.
const HIERARCHY_FILES = {
  bfo: { path: 'vendor/ontology-template/bfo-core-extract.ttl', expected: (m) => m.extract_sha256 },
  cco: { path: 'vendor/cco-upstream/CommonCoreOntologiesMerged.ttl', expected: (m, reg) => reg.files[0].sha256 },
};
const BFO_NS = 'http://purl.obolibrary.org/obo/BFO_';

// Recorded in vendor/ontology-template/PROVENANCE.md; changing it is a re-pin (ADR-005).
const ONTOLOGY_TEMPLATE_COMMIT = '114f28db82adf727f5e31aab4872ed56550e84af';

const OWL = 'http://www.w3.org/2002/07/owl#';
const PREFIXES = {
  bfo: 'http://purl.obolibrary.org/obo/',
  cco: 'https://www.commoncoreontologies.org/',
};

// Kinds a mapping may use (ADR-005 policy for v1). Other kinds stay in the list so a check
// can say "exists, but not a permitted kind" rather than "does not exist".
const PERMITTED_KINDS = new Set(['class', 'object_property', 'datatype_property']);

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function kindOf(types) {
  if (types.includes(OWL + 'Class')) return 'class';
  if (types.includes(OWL + 'ObjectProperty')) return 'object_property';
  if (types.includes(OWL + 'DatatypeProperty')) return 'datatype_property';
  if (types.includes(OWL + 'AnnotationProperty')) return 'annotation_property';
  if (types.includes(OWL + 'NamedIndividual')) return 'individual';
  return 'other';
}

function curie(iri) {
  for (const [p, ns] of Object.entries(PREFIXES)) if (iri.startsWith(ns)) return `${p}:${iri.slice(ns.length)}`;
  return null;
}

function englishLabel(labels) {
  const en = labels.filter((l) => l.lang === 'en').map((l) => l.value).sort();
  if (en.length) return en[0];
  return labels.map((l) => l.value).sort()[0] ?? null;
}

const manifest = JSON.parse(readFileSync(join(VENDOR, 'upstream-extracts.json'), 'utf8')).extracts;

const sources = [];
const terms = [];
const superOf = new Map(); // class IRI -> Set of named direct superclass IRIs, across all sources
const domainOf = new Map(); // property IRI -> Set of named rdfs:domain IRIs (SDD OS-2, R-S8)
const rangeOf = new Map(); // property IRI -> Set of named rdfs:range IRIs
for (const id of Object.keys(manifest).sort()) {
  const m = manifest[id];
  const file = m.register.split('/').pop();
  const bytes = readFileSync(join(VENDOR, file));
  const actual = sha256(bytes);
  if (actual !== m.register_sha256) {
    console.error(`REFUSED: ${file} sha256 ${actual} does not match Ontology-Template's manifest ${m.register_sha256}`);
    process.exit(2);
  }
  const reg = JSON.parse(bytes.toString('utf8'));
  if (reg.commit !== m.commit || reg.release !== m.release) {
    console.error(`REFUSED: ${file} names ${reg.release}@${reg.commit}, manifest says ${m.release}@${m.commit}`);
    process.exit(2);
  }
  const h = HIERARCHY_FILES[id];
  const hBytes = readFileSync(join(ROOT, h.path));
  const hActual = sha256(hBytes);
  if (hActual !== h.expected(m, reg)) {
    console.error(`REFUSED: ${h.path} sha256 ${hActual} does not match the pinned ${h.expected(m, reg)}`);
    process.exit(2);
  }
  const parsed = namedSubclassEdges(hBytes.toString('utf8'));
  for (const [s, o] of parsed.edges) {
    if (!superOf.has(s)) superOf.set(s, new Set());
    superOf.get(s).add(o);
  }
  for (const [map, list] of [[domainOf, parsed.domain], [rangeOf, parsed.range]]) {
    for (const [s, o] of list) {
      if (!map.has(s)) map.set(s, new Set());
      map.get(s).add(o);
    }
  }
  sources.push({
    id,
    project: m.project,
    release: m.release,
    upstream_commit: m.commit,
    upstream_files: reg.files.map((f) => ({ url: f.url, sha256: f.sha256 })),
    register: `vendor/ontology-template/${file}`,
    register_sha256: actual,
    hierarchy_from: {
      path: h.path,
      sha256: hActual,
      named_subclass_edges: parsed.edges.length,
      anonymous_superclass_expressions_dropped: parsed.anonymousObjects,
      named_domain_edges: parsed.domain.length,
      named_range_edges: parsed.range.length,
      anonymous_domain_or_range_expressions_dropped: parsed.anonymousDomain + parsed.anonymousRange,
    },
    licence: m.licence_spdx,
  });
  for (const iri of Object.keys(reg.terms)) {
    const t = reg.terms[iri];
    const kind = kindOf(t.types);
    terms.push({
      iri,
      curie: curie(iri),
      label: englishLabel(t.labels),
      kind,
      source: id,
      deprecated: t.deprecated,
      permitted: PERMITTED_KINDS.has(kind) && !t.deprecated,
    });
  }
}

// Direct named superclasses, and the BFO classes reachable through them (transitively, across sources).
const bfoAncestorsOf = (iri) => {
  const seen = new Set();
  const stack = [...(superOf.get(iri) ?? [])];
  while (stack.length) {
    const c = stack.pop();
    if (seen.has(c)) continue;
    seen.add(c);
    stack.push(...(superOf.get(c) ?? []));
  }
  return [...seen].filter((c) => c.startsWith(BFO_NS)).sort();
};
const unanchored = [];
for (const t of terms) {
  if (t.kind === 'object_property') {
    t.domain = [...(domainOf.get(t.iri) ?? [])].sort();
    t.range = [...(rangeOf.get(t.iri) ?? [])].sort();
    continue;
  }
  if (t.kind !== 'class') continue;
  t.superclasses = [...(superOf.get(t.iri) ?? [])].sort();
  t.bfo_ancestors = bfoAncestorsOf(t.iri);
  if (t.bfo_ancestors.length === 0 && t.iri !== BFO_NS + '0000001') unanchored.push(t.curie ?? t.iri);
}

terms.sort((a, b) => (a.iri < b.iri ? -1 : a.iri > b.iri ? 1 : 0));
unanchored.sort();
const termsHash = sha256(JSON.stringify(terms));

const counts = {};
for (const t of terms) counts[t.kind] = (counts[t.kind] ?? 0) + 1;

const out = {
  description:
    'Every term described by the BFO and CCO pins in Skreen5hot/Ontology-Template, with the subset a v1 mapping may use (permitted). Classes carry their named direct superclasses and BFO ancestors (ADR-008); object properties carry their named rdfs:domain and rdfs:range (SDD OS-2). Generated by tools/build-term-list.mjs; do not edit.',
  ontology_template_commit: ONTOLOGY_TEMPLATE_COMMIT,
  sources,
  permitted_kinds: [...PERMITTED_KINDS].sort(),
  prefixes: PREFIXES,
  counts: Object.fromEntries(Object.entries(counts).sort()),
  permitted_count: terms.filter((t) => t.permitted).length,
  classes_without_bfo_ancestor: unanchored,
  terms_sha256: termsHash,
  terms,
};
const text = JSON.stringify(out, null, 1) + '\n';

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== text) {
    console.error('STALE: ontology/term-list.json differs from a fresh build; run node tools/build-term-list.mjs');
    process.exit(1);
  }
  console.log(`ok: term list current (terms_sha256 ${termsHash})`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ontology/term-list.json: ${terms.length} terms, ${out.permitted_count} permitted, terms_sha256 ${termsHash}`);
}
