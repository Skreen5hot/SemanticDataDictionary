// Minimal Turtle reader: returns the named rdfs:subClassOf edges in a Turtle document.
// Zero dependencies, so the term-list build stays offline and reproducible. It reads the full
// Turtle grammar it meets (prefixes, IRIs, prefixed names, short and long literals, language
// tags, datatypes, blank-node property lists, collections, `a`, `;` and `,`). It throws on
// anything it cannot read rather than skipping it. Only edges whose subject and object are
// both IRIs are returned; anonymous class expressions are counted, not followed.
// Validated against rdflib by tools/verify-hierarchy.py (see vendor/cco-upstream/PROVENANCE.md).

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';

function tokenize(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  const fail = (msg) => {
    const line = text.slice(0, i).split('\n').length;
    throw new Error(`turtle: ${msg} at line ${line}`);
  };
  while (i < n) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '#') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '<') {
      const end = text.indexOf('>', i);
      if (end < 0) fail('unterminated IRI');
      tokens.push({ t: 'iri', v: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const long = text.startsWith(c.repeat(3), i);
      const quote = long ? c.repeat(3) : c;
      let j = i + quote.length;
      for (;;) {
        if (j >= n) fail('unterminated literal');
        if (text[j] === '\\') { j += 2; continue; }
        if (text.startsWith(quote, j)) break;
        if (!long && text[j] === '\n') fail('newline in short literal');
        j++;
      }
      i = j + quote.length;
      if (text[i] === '@') { i++; while (i < n && /[A-Za-z0-9-]/.test(text[i])) i++; }
      else if (text.startsWith('^^', i)) {
        i += 2;
        if (text[i] === '<') { const end = text.indexOf('>', i); if (end < 0) fail('unterminated datatype IRI'); i = end + 1; }
        else { while (i < n && /[^\s;,.\])]/.test(text[i])) i++; }
      }
      tokens.push({ t: 'lit' });
      continue;
    }
    if ('[](),;'.includes(c)) { tokens.push({ t: c }); i++; continue; }
    if (c === '.') {
      // A '.' ends a statement unless it continues a number (handled in the word branch).
      tokens.push({ t: '.' }); i++; continue;
    }
    if (c === '@') {
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(text[j])) j++;
      tokens.push({ t: 'directive', v: text.slice(i + 1, j) });
      i = j;
      continue;
    }
    // Prefixed name, keyword, number or boolean. A trailing '.' that ends the statement is not part of it.
    let j = i;
    while (j < n && /[^\s<>"'\[\](),;#]/.test(text[j])) j++;
    let word = text.slice(i, j);
    while (word.endsWith('.') && !/^[+-]?\d+\.$/.test(word)) { word = word.slice(0, -1); j--; }
    if (!word) fail(`unexpected character ${JSON.stringify(c)}`);
    tokens.push({ t: 'word', v: word });
    i = j;
  }
  return tokens;
}

export function namedSubclassEdges(text) {
  const tokens = tokenize(text);
  const prefixes = {};
  let p = 0;
  let anonymousObjects = 0;
  const edges = [];
  // Named rdfs:domain / rdfs:range edges (SDD OS-2), collected the same way; anonymous objects counted.
  const domain = [], range = [];
  let anonymousDomain = 0, anonymousRange = 0;

  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const expect = (t) => { const k = next(); if (!k || k.t !== t) throw new Error(`turtle: expected ${t}, got ${k ? k.t : 'end'}`); return k; };

  const resolve = (tok) => {
    if (tok.t === 'iri') return tok.v;
    if (tok.t === 'word') {
      if (tok.v === 'a') return RDF_TYPE;
      const k = tok.v.indexOf(':');
      if (k >= 0) {
        const pre = tok.v.slice(0, k);
        if (!(pre in prefixes)) throw new Error(`turtle: undeclared prefix ${pre}:`);
        return prefixes[pre] + tok.v.slice(k + 1);
      }
    }
    return null; // literal, number, boolean
  };

  // Reads one object; returns its IRI if it is named, else null (after consuming it).
  const object = () => {
    const k = peek();
    if (k.t === '[') { next(); if (peek().t !== ']') predicateObjectList(null); expect(']'); return null; }
    if (k.t === '(') { next(); while (peek().t !== ')') object(); expect(')'); return null; }
    next();
    return resolve(k);
  };

  function predicateObjectList(subject) {
    for (;;) {
      const predicate = resolve(next());
      for (;;) {
        const isAnon = peek().t === '[' || peek().t === '(';
        const o = object();
        if (subject && predicate === SUBCLASS) {
          if (o) edges.push([subject, o]);
          else if (isAnon) anonymousObjects++;
        } else if (subject && predicate === DOMAIN) {
          if (o) domain.push([subject, o]);
          else if (isAnon) anonymousDomain++;
        } else if (subject && predicate === RANGE) {
          if (o) range.push([subject, o]);
          else if (isAnon) anonymousRange++;
        }
        if (peek() && peek().t === ',') { next(); continue; }
        break;
      }
      if (peek() && peek().t === ';') {
        while (peek() && peek().t === ';') next();
        if (!peek() || peek().t === '.' || peek().t === ']') return;
        continue;
      }
      return;
    }
  }

  while (p < tokens.length) {
    const k = peek();
    if (k.t === 'directive' || (k.t === 'word' && /^(PREFIX|BASE)$/i.test(k.v))) {
      next();
      const kind = k.v.toLowerCase();
      if (kind === 'prefix') {
        const name = next().v; // "pre:" or ":"
        prefixes[name.slice(0, -1)] = expect('iri').v;
      } else if (kind === 'base') {
        expect('iri');
      } else throw new Error(`turtle: unsupported directive @${k.v}`);
      if (peek() && peek().t === '.') next();
      continue;
    }
    let subject;
    if (k.t === '[') { next(); if (peek().t !== ']') predicateObjectList(null); expect(']'); subject = null; }
    else if (k.t === '(') { object(); subject = null; }
    else { next(); subject = resolve(k); }
    if (peek() && peek().t !== '.') predicateObjectList(subject);
    expect('.');
  }
  return { edges, anonymousObjects, domain, range, anonymousDomain, anonymousRange };
}
