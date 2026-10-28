// core/repair (C-S5): Skeleton + Inventory + rejected CheckReport + the prompt it checked -> repair prompt. Pure.
// Rules: R-S11 (construction, single-pass fill), R-S16 (context), R-S22 (repair), R-S23 (inputs that belong together).

import { sha256Hex, toU8, utf8 } from './canonical.mjs';
import { readJsonLd, DomainError, UsageError } from './skeleton.mjs';
import { renderPrompt, catalogueText, slotLines, dataLine } from './prompt.mjs';
import { parsePrompt } from './check.mjs';

export const ERRORS_HEADER =
  '\nERRORS IN YOUR PREVIOUS REPLY\n' +
  'Your previous reply for this batch was rejected for the reasons below. ' +
  'Return the complete corrected mapping set for every DATA line, not only the lines named here.\n';

/** R-S22 ERRORS block: header, then one JSON line per error in report order, then "\n". */
export function errorsBlock(errors) {
  return ERRORS_HEADER + errors.map((e) => dataLine(e)).join('\n') + '\n';
}

const isStr = (v) => typeof v === 'string';
const mismatch = (detail) => new UsageError('E-USAGE', detail);

/**
 * C-S5. Inputs are bytes plus the template text and a term index.
 * Returns {text, bytes, round, batch}. Throws DomainError (E-CTX-EXTERNAL, E-REPAIR-NOTHING) or
 * UsageError (E-USAGE: inputs that are not of their kind or do not belong together; E-IO: not JSON).
 */
export function buildRepairPrompt({ skeletonBytes, inventoryBytes, reportBytes, promptBytes, template, terms }) {
  // R-S16 on every JSON-LD input, without dereferencing.
  const skeleton = readJsonLd(skeletonBytes, 'skeleton');
  const inventory = readJsonLd(inventoryBytes, 'inventory');
  const report = readJsonLd(reportBytes, 'report');

  // Each input is of its kind.
  if (skeleton['@type'] !== 'Skeleton' || !Array.isArray(skeleton.slots)) throw mismatch('skeleton is not a Skeleton');
  if (inventory['@type'] !== 'Inventory' || !Array.isArray(inventory.objectTypes) || !Array.isArray(inventory.attributes) ||
      !Array.isArray(inventory.flags)) {
    throw mismatch('inventory is not an Inventory');
  }
  if (report['@type'] !== 'CheckReport' || !Array.isArray(report.errors) || !Number.isInteger(report.round) || report.round < 1 ||
      !isStr(report.batch) || !isStr(report.promptSha256) || !isStr(report.skeletonSha256) ||
      (report.status !== 'validated' && report.status !== 'rejected') ||
      (report.status === 'validated') !== (report.errors.length === 0)) {
    throw mismatch('report is not a CheckReport');
  }

  // R-S22: a validated report has nothing to repair.
  if (report.status === 'validated') {
    throw new DomainError('E-REPAIR-NOTHING', {
      key: null, field: null, value: null, rule: 'R-S22', message: 'The report has no errors; there is nothing to repair.',
    });
  }

  // R-S23: the inputs must belong together: inventory -> skeleton -> prompt -> report.
  const skeletonSha256 = sha256Hex(toU8(skeletonBytes));
  if (skeleton.inventorySha256 !== sha256Hex(toU8(inventoryBytes))) {
    throw mismatch('the skeleton was not built from this inventory (inventorySha256 differs)');
  }
  if (skeleton.termListSha256 !== terms.termsSha256) {
    throw mismatch('the skeleton cites a different term list (termListSha256 differs)');
  }
  const prompt = parsePrompt(promptBytes);
  if (prompt.skeletonSha256 !== skeletonSha256) throw mismatch('the prompt was not built from this skeleton');
  if (prompt.termsSha256 !== terms.termsSha256) throw mismatch('the prompt cites a different term list');
  // The prompt's DATA lines must be exactly the lines this skeleton and inventory give for those keys (skeleton order).
  const promptKeys = new Set(prompt.data.map((d) => d.key));
  const expected = slotLines(skeleton, inventory).flatMap((g) => g.slots).filter((s) => promptKeys.has(s.key)).map((s) => s.line);
  if (prompt.dataLines.length === 0 || expected.length !== prompt.dataLines.length ||
      expected.some((l, i) => l !== prompt.dataLines[i])) {
    throw mismatch('the prompt DATA lines were not built from this skeleton and inventory');
  }
  if (report.promptSha256 !== sha256Hex(toU8(promptBytes))) throw mismatch('the report does not answer this prompt (promptSha256 differs)');
  if (report.skeletonSha256 !== skeletonSha256 || report.batch !== prompt.batch || report.round !== prompt.round ||
      report.termListSha256 !== terms.termsSha256) {
    throw mismatch('the report does not answer this prompt (skeleton, batch, round or term list differs)');
  }

  // R-S11 + R-S22: same DATA lines, round + 1, ERRORS block; single-pass fill.
  const round = report.round + 1;
  const text = renderPrompt(template, {
    skeletonSha256,
    termsSha256: terms.termsSha256,
    batch: prompt.batch,
    round,
    errors: errorsBlock(report.errors),
    dataLines: prompt.dataLines,
    catalogue: catalogueText(terms),
  });
  return { text, bytes: utf8(text), round, batch: prompt.batch };
}
