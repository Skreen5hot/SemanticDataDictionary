#!/usr/bin/env node
// SDD CLI (C-S1 parse, C-S2 skeleton, C-S3 prompt, C-S4 check, C-S5 repair). Reads files, passes bytes to the pure core,
// writes canonical bytes. Exit codes per R-S23: 0 success; 1 domain report of errors; 2 usage / I/O.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalBytes, fromUtf8 } from '../core/canonical.mjs';
import { parseSchema } from '../core/parse.mjs';
import { buildSkeleton, DomainError, UsageError } from '../core/skeleton.mjs';
import { buildPrompts, DEFAULT_BUDGET } from '../core/prompt.mjs';
import { checkProposal } from '../core/check.mjs';
import { buildRepairPrompt } from '../core/repair.mjs';
import { indexTerms } from '../core/terms.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RES = {
  template: path.join(ROOT, 'spec', 'prompt-template-v2.txt'),
  terms: path.join(ROOT, 'ontology', 'term-list.json'),
  proposalSchema: path.join(ROOT, 'schemas', 'proposal-v1.schema.json'),
  atlassian: path.join(ROOT, 'vendor', 'atlassian', 'assets-import-schema-2021_09_15.json'),
};

class Exit extends Error {
  constructor(status, obj) {
    super(obj && obj.code);
    this.status = status;
    this.obj = obj;
  }
}
const usage = (message) => new Exit(2, { code: 'E-USAGE', message });

const COMMANDS = {
  parse: { positional: 1, options: ['--out'] },
  skeleton: { positional: 1, options: ['--out'] },
  prompt: { positional: 2, options: ['--keys', '--budget', '--out-dir'], required: ['--out-dir'] },
  check: { positional: 3, options: ['--out'] },
  repair: { positional: 4, options: ['--out'] },
};

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const spec = COMMANDS[cmd];
  if (!spec) throw usage(`unknown command ${cmd === undefined ? '(none)' : cmd}; expected one of ${Object.keys(COMMANDS).join(', ')}`);
  const positional = [];
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      if (!spec.options.includes(a)) throw usage(`unknown option ${a} for ${cmd}`);
      if (a in opts) throw usage(`option ${a} given twice`);
      if (i + 1 >= rest.length) throw usage(`option ${a} needs a value`);
      opts[a] = rest[++i];
    } else positional.push(a);
  }
  if (positional.length !== spec.positional) throw usage(`${cmd} takes ${spec.positional} argument(s), got ${positional.length}`);
  for (const r of spec.required || []) if (!(r in opts)) throw usage(`${cmd} requires ${r}`);
  return { cmd, positional, opts };
}

function readInput(file) {
  try {
    return fs.readFileSync(file);
  } catch (e) {
    throw new Exit(2, { code: 'E-IO', message: `cannot read ${file}: ${e.code || e.message}` });
  }
}
function readResourceJson(file) {
  return JSON.parse(fromUtf8(readInput(file)));
}
function refuseExisting(target) {
  if (target !== undefined && fs.existsSync(target)) throw new Exit(2, { code: 'E-OUT-EXISTS', message: `${target} exists` });
}
function writeNew(file, bytes) {
  try {
    fs.writeFileSync(file, bytes, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') throw new Exit(2, { code: 'E-OUT-EXISTS', message: `${file} exists` });
    throw new Exit(2, { code: 'E-IO', message: `cannot write ${file}: ${e.code || e.message}` });
  }
}
function emit(out, bytes) {
  if (out === undefined) process.stdout.write(bytes);
  else writeNew(out, bytes);
}
function loadTerms() {
  return indexTerms(readResourceJson(RES.terms));
}

function run(argv) {
  const { cmd, positional, opts } = parseArgs(argv);
  refuseExisting(opts['--out']);
  refuseExisting(opts['--out-dir']);

  try {
    switch (cmd) {
      case 'parse': {
        const bytes = readInput(positional[0]);
        const inv = parseSchema(bytes, readResourceJson(RES.atlassian));
        emit(opts['--out'], canonicalBytes(inv));
        return inv.errors.length ? 1 : 0;
      }
      case 'skeleton': {
        const bytes = readInput(positional[0]);
        const terms = loadTerms();
        const sk = buildSkeleton(bytes, terms.termsSha256);
        emit(opts['--out'], canonicalBytes(sk));
        return 0;
      }
      case 'prompt': {
        const skeletonBytes = readInput(positional[0]);
        const inventoryBytes = readInput(positional[1]);
        let keys = null;
        if (opts['--keys'] !== undefined) {
          try {
            keys = JSON.parse(fromUtf8(readInput(opts['--keys'])));
          } catch (e) {
            if (e instanceof Exit) throw e;
            throw usage('--keys file is not JSON');
          }
        }
        let budget = DEFAULT_BUDGET;
        if (opts['--budget'] !== undefined) {
          if (!/^[1-9][0-9]*$/.test(opts['--budget'])) throw usage('--budget must be a positive integer (bytes)');
          budget = Number(opts['--budget']);
        }
        const template = fromUtf8(readInput(RES.template));
        const { promptSet, prompts } = buildPrompts({ skeletonBytes, inventoryBytes, keys, budget, template, terms: loadTerms() });
        const dir = opts['--out-dir'];
        try {
          fs.mkdirSync(dir);
        } catch (e) {
          if (e.code === 'EEXIST') throw new Exit(2, { code: 'E-OUT-EXISTS', message: `${dir} exists` });
          throw new Exit(2, { code: 'E-IO', message: `cannot create ${dir}: ${e.code || e.message}` });
        }
        for (const p of prompts) writeNew(path.join(dir, p.file), p.bytes);
        writeNew(path.join(dir, 'prompt-set.jsonld'), canonicalBytes(promptSet));
        return 0;
      }
      case 'check': {
        const skeletonBytes = readInput(positional[0]);
        const promptBytes = readInput(positional[1]);
        const pasteBytes = readInput(positional[2]);
        const report = checkProposal({
          skeletonBytes, promptBytes, pasteBytes,
          proposalSchema: readResourceJson(RES.proposalSchema),
          terms: loadTerms(),
        });
        emit(opts['--out'], canonicalBytes(report));
        return report.status === 'validated' ? 0 : 1;
      }
      case 'repair': {
        const skeletonBytes = readInput(positional[0]);
        const inventoryBytes = readInput(positional[1]);
        const reportBytes = readInput(positional[2]);
        const promptBytes = readInput(positional[3]);
        const template = fromUtf8(readInput(RES.template));
        const { bytes } = buildRepairPrompt({ skeletonBytes, inventoryBytes, reportBytes, promptBytes, template, terms: loadTerms() });
        emit(opts['--out'], bytes);
        return 0;
      }
    }
  } catch (e) {
    if (e instanceof DomainError) throw new Exit(1, { code: e.code, ...e.extra });
    if (e instanceof UsageError) throw new Exit(2, { code: e.code, message: e.detail });
    throw e;
  }
  return 0;
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (e) {
  if (e instanceof Exit) {
    process.stderr.write(JSON.stringify(e.obj) + '\n');
    process.exitCode = e.status;
  } else {
    process.stderr.write(JSON.stringify({ code: 'E-IO', message: String(e && e.stack || e) }) + '\n');
    process.exitCode = 2;
  }
}
