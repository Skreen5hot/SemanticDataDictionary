// core/prompt (C-S3): Skeleton + Inventory (+ key subset) + term list -> prompts + PromptSet. Pure.
// Rules: R-S11 (construction), R-S12 (batching), R-S16 (context).

import { sha256Hex, toU8, utf8, utf8Length, CONTEXT_IRI } from './canonical.mjs';
import { readJsonLd, DomainError, UsageError } from './skeleton.mjs';

export const DEFAULT_BUDGET = 200000;

/** JSON.stringify with U+2028/U+2029 written as escapes (R-S11): no DATA line holds a line/paragraph separator. */
export function dataLine(obj) {
  return JSON.stringify(obj).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** DATA objects per slot kind, fields exactly as R-S11 lists them. */
function dataObject(slot, typesByKey, attrsByKey, containmentSelector) {
  switch (slot.kind) {
    case 'type': {
      const t = typesByKey.get(slot.key);
      if (!t) throw new UsageError("E-USAGE", `slot ${slot.key} is not in the inventory`);
      return { key: slot.key, kind: 'type', name: t.name, description: t.description, parent: t.parent, selectors: t.selectors };
    }
    case 'attribute': {
      const a = attrsByKey.get(slot.key);
      if (!a) throw new UsageError("E-USAGE", `slot ${slot.key} is not in the inventory`);
      return { key: slot.key, kind: 'attribute', name: a.name, description: a.description, owner: a.owner, jiraType: slot.jiraType };
    }
    case 'reference': {
      const a = attrsByKey.get(slot.key);
      if (!a) throw new UsageError("E-USAGE", `slot ${slot.key} is not in the inventory`);
      return { key: slot.key, kind: 'reference', name: a.name, description: a.description, owner: a.owner, target: slot.target };
    }
    case 'containment':
      return { key: slot.key, kind: 'containment', child: slot.child, container: slot.container, selector: containmentSelector(slot) };
    default:
      throw new UsageError('E-USAGE', `skeleton slot ${slot.key} has unknown kind ${slot.kind}`);
  }
}

/** CATALOGUE text (R-S11): ICE classes, other classes, object properties; permitted only; sorted by CURIE. */
export function catalogueText(terms) {
  const { ice, other, props } = terms.catalogue();
  const lines = (xs) => xs.map((t) => `${t.curie}\t${t.label}\n`).join('');
  return (
    '# Information Content Entity classes (recordClass, iceClass)\n' + lines(ice) +
    '# Other classes (referentClass)\n' + lines(other) +
    '# Object properties (relation)\n' + lines(props)
  );
}

/** Fill the template in a single pass, so placeholder-like text inside DATA is never re-expanded. */
export function renderPrompt(template, { skeletonSha256, termsSha256, batch, round, errors, dataLines, catalogue }) {
  const vals = {
    SKELETON: skeletonSha256,
    SKELETON2: skeletonSha256,
    TERMS: termsSha256,
    BATCH: batch,
    BATCH2: batch,
    ROUND: String(round),
    ERRORS: errors,
    DATA: dataLines.map((l) => l + '\n').join(''),
    CATALOGUE: catalogue,
  };
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, name) => (name in vals ? vals[name] : m));
}

/**
 * Data lines of a skeleton, grouped by object type (R-S12 group = a type slot followed by its
 * attribute, reference and containment slots).
 */
export function slotLines(skeleton, inventory) {
  const typesByKey = new Map(inventory.objectTypes.map((t) => [t.key, t]));
  const attrsByKey = new Map(inventory.attributes.map((a) => [a.key, a]));
  const ctFlags = inventory.flags.filter((f) => f.code === 'FL-CONTAINMENT');
  const containmentSelector = (slot) => {
    const f = ctFlags.find((x) => x.key === slot.child && x.container === slot.container);
    if (!f) throw new UsageError('E-USAGE', `no containment flag for ${slot.key} in the inventory`);
    return f.selector;
  };
  const groups = [];
  for (const slot of skeleton.slots) {
    if (slot.kind === 'type' || groups.length === 0) groups.push({ key: slot.key, slots: [] });
    const obj = dataObject(slot, typesByKey, attrsByKey, containmentSelector);
    groups[groups.length - 1].slots.push({ key: slot.key, line: dataLine(obj) });
  }
  return groups;
}

/**
 * C-S3. Returns {promptSet, prompts: [{file, text, bytes(Uint8Array)}]}.
 * Throws DomainError (E-CTX-EXTERNAL, E-PROMPT-BUDGET) or UsageError.
 */
export function buildPrompts({ skeletonBytes, inventoryBytes, keys = null, budget = DEFAULT_BUDGET, template, terms }) {
  const skeleton = readJsonLd(skeletonBytes, 'skeleton');
  const inventory = readJsonLd(inventoryBytes, 'inventory');
  if (!Array.isArray(skeleton.slots)) throw new UsageError('E-USAGE', 'skeleton is not a Skeleton');
  if (!Array.isArray(inventory.objectTypes) || !Array.isArray(inventory.attributes) || !Array.isArray(inventory.flags)) {
    throw new UsageError('E-USAGE', 'inventory is not an Inventory');
  }
  if (skeleton.inventorySha256 !== sha256Hex(toU8(inventoryBytes))) {
    throw new UsageError('E-USAGE', 'the skeleton was not built from this inventory (inventorySha256 differs)');
  }
  if (skeleton.termListSha256 !== terms.termsSha256) {
    throw new UsageError('E-USAGE', 'the skeleton cites a different term list (termListSha256 differs)');
  }
  const skeletonSha256 = sha256Hex(toU8(skeletonBytes));

  let groups = slotLines(skeleton, inventory);
  if (keys !== null) {
    if (!Array.isArray(keys) || keys.length === 0 || !keys.every((k) => typeof k === 'string')) {
      throw new UsageError('E-USAGE', '--keys must be a non-empty JSON array of slot keys');
    }
    const all = new Set(groups.flatMap((g) => g.slots.map((s) => s.key)));
    const unknown = keys.filter((k) => !all.has(k));
    if (unknown.length) throw new UsageError('E-USAGE', `--keys names keys that are not slots: ${unknown.join(', ')}`);
    const want = new Set(keys);
    groups = groups
      .map((g) => ({ key: g.key, slots: g.slots.filter((s) => want.has(s.key)) }))
      .filter((g) => g.slots.length > 0);
  }

  const catalogue = catalogueText(terms);
  const base = { skeletonSha256, termsSha256: terms.termsSha256, errors: '', catalogue };
  // R-S12: size = byte length of the prompt rendered with label 1/1 and round 1. DATA is a plain
  // concatenation, so a batch's size is the empty-DATA size plus its lines' bytes (+1 LF each).
  const emptySize = utf8Length(renderPrompt(template, { ...base, batch: '1/1', round: 1, dataLines: [] }));
  if (emptySize > budget) {
    throw new DomainError('E-PROMPT-BUDGET', { key: null, field: null, value: String(budget), rule: 'R-S12' });
  }
  const groupBytes = (g) => g.slots.reduce((n, s) => n + utf8Length(s.line) + 1, 0);

  const batches = [];
  const warnings = [];
  let cur = null;
  for (const g of groups) {
    const gb = groupBytes(g);
    if (emptySize + gb > budget) {
      if (cur) { batches.push(cur); cur = null; }
      batches.push({ groups: [g], size: emptySize + gb });
      warnings.push({ code: 'W-PROMPT-OVERSIZE', key: g.key, bytes: emptySize + gb, budget });
      continue;
    }
    if (cur && cur.size + gb <= budget) {
      cur.groups.push(g);
      cur.size += gb;
    } else {
      if (cur) batches.push(cur);
      cur = { groups: [g], size: emptySize + gb };
    }
  }
  if (cur) batches.push(cur);

  const n = batches.length;
  const prompts = batches.map((b, i) => {
    const label = `${i + 1}/${n}`;
    const text = renderPrompt(template, {
      ...base, batch: label, round: 1, dataLines: b.groups.flatMap((g) => g.slots.map((s) => s.line)),
    });
    const bytes = utf8(text);
    return { file: `prompt-${i + 1}-of-${n}.txt`, batch: label, text, bytes, sha256: sha256Hex(bytes) };
  });

  const promptSet = {
    '@context': CONTEXT_IRI,
    '@type': 'PromptSet',
    skeletonSha256,
    round: 1,
    budget,
    prompts: prompts.map((p) => ({ batch: p.batch, file: p.file, bytes: p.bytes.length, sha256: p.sha256 })),
    warnings,
  };
  return { promptSet, prompts };
}
