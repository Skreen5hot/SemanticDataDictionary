#!/usr/bin/env node
// Build the offline page (SDD-operator §7, E-O1, E-O3). Node built-ins only; deterministic (same bytes every run).
//
//   node tools/build-site.mjs [--out <dir>]      (default: dist/)
//
// dist/index.html: ONE self-contained file. site/index.html with site/style.css inlined, and one inline classic
// script holding a small module registry: every ES module reachable from site/app.mjs (src/core/*, site/*) is wrapped
// in a function; its `import {..} from '..'` statements become registry lookups and its `export` keywords are removed
// (with the exported names assigned at the end). Nothing else in a module's source is changed. The term list, the
// prompt template, the proposal schema, the Atlassian schema and the context document are inlined as the virtual
// module `sdd:resources`. No external resource of any kind.
// dist/context/sdd-v1.jsonld: copied from context/sdd-v1.jsonld (the context the artifacts' @context IRI names).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 3 * 1024 * 1024; // E-O3

const args = process.argv.slice(2);
let OUT = path.join(ROOT, 'dist');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && i + 1 < args.length) OUT = path.resolve(args[++i]);
  else { process.stderr.write(`unknown argument ${args[i]}\n`); process.exit(2); }
}

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const readText = (p) => {
  const t = fs.readFileSync(path.join(ROOT, p), 'utf8');
  if (t.includes('\r')) throw new Error(`${p} contains CR bytes; the build expects LF line endings`);
  return t;
};

// ---------- module rewriting ----------

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';[ \t]*$/gm;
const EXPORT_DECL_RE = /^export (async function\*?|function\*?|const|let|class) ([A-Za-z_$][A-Za-z0-9_$]*)/gm;

function resolveSpecifier(fromId, spec) {
  if (spec === 'sdd:resources') return spec;
  if (!spec.startsWith('./') && !spec.startsWith('../')) throw new Error(`${fromId}: unsupported import '${spec}' (only relative and sdd:resources)`);
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));
}

function rewriteModule(id, src) {
  const deps = [];
  let out = src.replace(IMPORT_RE, (m, names, spec) => {
    const dep = resolveSpecifier(id, spec);
    deps.push(dep);
    const binds = names.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      const mm = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(x);
      if (!mm) throw new Error(`${id}: cannot rewrite import binding '${x}'`);
      return mm[2] ? `${mm[1]}: ${mm[2]}` : mm[1];
    });
    return `const { ${binds.join(', ')} } = __require(${JSON.stringify(dep)});`;
  });
  const exported = [];
  out = out.replace(EXPORT_DECL_RE, (m, kw, name) => { exported.push(name); return `${kw} ${name}`; });
  // Anything left that still looks like module syntax is refused rather than shipped half-rewritten.
  const leftover = /^\s*(import\s|import\{|export\s|export\{)/m.exec(out);
  if (leftover) throw new Error(`${id}: unsupported module syntax: ${out.slice(leftover.index, leftover.index + 60)}`);
  if (/\bimport\s*\(|\bimport\.meta\b/.test(out)) throw new Error(`${id}: dynamic import / import.meta is not allowed`);
  const tail = exported.map((n) => `__exports.${n} = ${n};`).join('\n');
  return { deps, code: `${out}${out.endsWith('\n') ? '' : '\n'}${tail}\n` };
}

function collectModules(entry) {
  const order = [];
  const seen = new Map();
  const visit = (id) => {
    if (seen.has(id) || id === 'sdd:resources') return;
    const m = rewriteModule(id, readText(id));
    seen.set(id, m);
    for (const d of m.deps) visit(d);
    order.push(id);
  };
  visit(entry);
  return order.map((id) => ({ id, ...seen.get(id) }));
}

// ---------- resources ----------

/** JSON text safe inside an inline <script>: '<' is escaped (valid in JSON strings and JS); U+2028/2029 are legal in JS strings. */
const LT_ESCAPE = String.fromCharCode(92) + 'u003c'; // backslash-u003c
const scriptSafe = (jsonText) => jsonText.replace(/</g, () => LT_ESCAPE);

function resourcesModule() {
  const json = (p) => scriptSafe(JSON.stringify(JSON.parse(readText(p))));
  const template = scriptSafe(JSON.stringify(readText('spec/prompt-template-v2.txt')));
  return [
    '__exports.RESOURCES = {',
    `  template: ${template},`,
    `  proposalSchema: ${json('schemas/proposal-v1.schema.json')},`,
    `  atlassianSchema: ${json('vendor/atlassian/assets-import-schema-2021_09_15.json')},`,
    `  context: ${json('context/sdd-v1.jsonld')},`,
    `  termList: ${json('ontology/term-list.json')}`,
    '};',
    '',
  ].join('\n');
}

// ---------- assemble ----------

function bundle() {
  const modules = collectModules('site/app.mjs');
  const parts = [
    '(function () {',
    "'use strict';",
    'var __defs = Object.create(null), __cache = Object.create(null);',
    'function __require(id) {',
    '  if (id in __cache) return __cache[id];',
    '  if (!(id in __defs)) throw new Error("module not bundled: " + id);',
    '  var m = {}; __cache[id] = m; __defs[id](m); return m;',
    '}',
    '__defs["sdd:resources"] = function (__exports) {',
    resourcesModule(),
    '};',
  ];
  for (const m of modules) {
    parts.push(`// ---- module ${m.id} ----`);
    parts.push(`__defs[${JSON.stringify(m.id)}] = function (__exports) {`);
    parts.push(m.code + '};');
  }
  parts.push('__require("site/app.mjs");', '})();', '');
  return { script: parts.join('\n'), modules: modules.map((m) => m.id) };
}

function build() {
  const { script, modules } = bundle();
  const style = readText('site/style.css');
  for (const [name, text] of [['script', script], ['style', style]]) {
    if (/<\/(script|style)/i.test(text) || text.includes('<!--')) throw new Error(`the inline ${name} contains a sequence that would end its element`);
  }
  const shell = readText('site/index.html');
  if (!shell.includes('/*@@STYLE@@*/') || !shell.includes('/*@@SCRIPT@@*/')) throw new Error('site/index.html lacks the inline markers');
  const html = shell.replace('/*@@STYLE@@*/', () => style.trimEnd()).replace('/*@@SCRIPT@@*/', () => script.trimEnd());
  const bytes = Buffer.from(html, 'utf8');
  if (bytes.length > MAX_BYTES) throw new Error(`dist/index.html is ${bytes.length} bytes, over the E-O3 limit of ${MAX_BYTES}`);

  const context = readText('context/sdd-v1.jsonld');
  JSON.parse(context);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'context'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), bytes);
  fs.writeFileSync(path.join(OUT, 'context', 'sdd-v1.jsonld'), context);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  return { bytes: bytes.length, modules };
}

const r = build();
process.stdout.write(`${rel(path.join(OUT, 'index.html'))}: ${r.bytes} bytes, ${r.modules.length} modules (${r.modules.join(', ')})\n`);
