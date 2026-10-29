// site/session: the operator session (SDD-operator §6) over the unchanged core. Pure: no DOM, network, clock or
// randomness. The view supplies bytes, the person's acts and the time of each act; every artifact comes from
// src/core exactly as the CLI makes it (same functions, same canonical bytes).
//
// State (§6): schema/inventory/skeleton, prompts[], pastes[] and reports[] (append-only),
// decisions{skeletonSha -> {key -> record}},
// acceptorName, nullEquivalents{key -> text}, savedFiles[]. Only the CV-O2 methods (setName, decide, acceptAll,
// setNullEquivalents) write decisions, acceptorName or nullEquivalents (RV-O2).

import { canonicalBytes, fromUtf8, utf8, sha256Hex, toU8 } from '../src/core/canonical.mjs';
import { parseSchema, SOURCE_FORMAT } from '../src/core/parse.mjs';
import { buildSkeleton, DomainError, UsageError } from '../src/core/skeleton.mjs';
import { buildPrompts, DEFAULT_BUDGET } from '../src/core/prompt.mjs';
import { checkProposal, extractAnswer } from '../src/core/check.mjs';
import { buildRepairPrompt } from '../src/core/repair.mjs';
import { indexTerms } from '../src/core/terms.mjs';
import { acceptMappings, readPrevious } from '../src/core/accept.mjs';
import { rerunPlan } from '../src/core/rerun.mjs';

/** RV-O1 status texts. */
export const VALIDATED_TEXT =
  'Validated: structure, coverage, terms and categories checked. Meaning not yet reviewed: accept or reject each mapping.';
export const rejectedText = (n) => `Rejected: ${n} problem(s). Nothing from this reply can be used.`;
export const bulkConfirmText = (n, name) => `Accept all ${n} validated mappings as ${name}?`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** RV-O1 summary template. */
export const summaryText = (t, a, r, f) =>
  `${plural(t, 'object type')} · ${plural(a, 'attribute')} · ${plural(r, 'reference')} · ${plural(f, 'flag')}`;

// Refusals whose core error carries no message (R-S21 defines none): fixed tool texts.
const FIXED_MESSAGES = {
  'E-PROMPT-BUDGET': 'The budget is smaller than a prompt with no DATA lines.',
  'E-SKEL-ERRORED': 'The schema has source errors, so no skeleton can be made.',
};

/** A refusal (DomainError / UsageError) as an RV-O4 row {code, key, field, value, rule, message}. */
export function refusalRow(e) {
  if (e instanceof DomainError) {
    const x = e.extra || {};
    return {
      code: e.code, key: x.key ?? null, field: x.field ?? null, value: x.value ?? null, rule: x.rule ?? null,
      message: x.message ?? FIXED_MESSAGES[e.code] ?? null,
    };
  }
  if (e instanceof UsageError) return { code: e.code, key: null, field: null, value: null, rule: null, message: e.detail ?? null };
  throw e;
}

/** RV-O4 row text (the view renders the same parts, each artifact part as a quoted element). */
export function rowText(row) {
  const part = (v) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
  return [row.code, row.key, row.field, row.value, row.rule].map(part).join(' · ') + ' — ' + part(row.message);
}

/** An Inventory source error (R-S3) as an RV-O4 row. */
function sourceErrorRow(err) {
  return {
    code: err.code, key: err.key ?? null, field: err.keyword ?? null,
    value: err.value !== undefined ? err.value : err.detail ?? null,
    rule: 'R-S3', message: err.pointer ? err.pointer : null,
  };
}

/** CV-O2 null-equivalents entry: comma-separated, each value trimmed, empty values dropped (sorted by C-S6 on save). */
export function parseNullEquivalents(text) {
  return String(text).split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/** UTC time of an act, whole seconds, as C-S6 records it. */
export function actTime(date) {
  return date.toISOString().replace(/\.[0-9]{3}Z$/, 'Z');
}
/** CV-O3 download name for a save at `date`. */
export function saveFileName(date) {
  return `sdd-${actTime(date).replace(/[-:]/g, '')}.jsonld`;
}

export function createSession({ termList, template, proposalSchema, atlassianSchema }) {
  const terms = indexTerms(termList);

  const s = {
    schemaBytes: null, inventory: null, inventoryBytes: null,
    skeleton: null, skeletonBytes: null, skeletonSha: null,
    previousBytes: null, previous: null, plan: null,
    prompts: [], // {id, kind: 'prompt'|'repair', setId, batch, index, count, round, text, bytes, sha256, skeletonSha}
    promptSets: [], // {id, promptIds, warnings, skeletonSha}
    repairIds: [], // repair prompts built since the last prompt set
    recency: [], // prompt ids, most recently built or copied last
    pastes: [], // Uint8Array, append-only
    reports: [], // {id, report, reportBytes, pasteIdx, promptId, answer}, append-only
    decisions: new Map(), // skeletonSha -> Map(key -> {decision, by, at, reportId}); RV-O2: one skeleton's acts never touch another's
    acceptorName: '',
    nullEquivalents: new Map(), // key -> entered text
    savedFiles: [],
    outcome: null, // {kind: 'check', reportId} | {kind: 'refusal', rows}
  };

  const refuse = (rows) => { s.outcome = { kind: 'refusal', rows }; return { rows }; };

  // ---------- CV-O3: files ----------

  function loadSchema(bytes, previousBytes) {
    let inventory = null, plan = null, rows = null, previousRefused = false;
    if (previousBytes) {
      try {
        ({ inventory, plan } = rerunPlan({ schemaBytes: bytes, previousBytes, atlassianSchema, terms }));
      } catch (e) {
        rows = [refusalRow(e)];
        previousRefused = true;
      }
    }
    if (!inventory) inventory = parseSchema(bytes, atlassianSchema);
    const inventoryBytes = canonicalBytes(inventory);
    let skeleton = null, skeletonBytes = null;
    if (inventory.errors.length === 0) {
      skeleton = buildSkeleton(inventoryBytes, terms.termsSha256);
      skeletonBytes = canonicalBytes(skeleton);
    } else {
      rows = [...(rows || []), ...inventory.errors.map(sourceErrorRow)];
    }
    return { inventory, inventoryBytes, skeleton, skeletonBytes, plan, rows, previousRefused };
  }

  /** Open a schema. With a previous SDD open, this is C-S7 (rerun plan). */
  function openSchema(bytes) {
    bytes = toU8(bytes);
    const r = loadSchema(bytes, s.previousBytes);
    s.schemaBytes = bytes;
    s.inventory = r.inventory;
    s.inventoryBytes = r.inventoryBytes;
    s.skeleton = r.skeleton;
    s.skeletonBytes = r.skeletonBytes;
    s.skeletonSha = r.skeletonBytes ? sha256Hex(r.skeletonBytes) : null;
    s.plan = r.plan;
    if (r.previousRefused) {
      // The previous SDD cannot be used with this schema: it is set aside (the refusal row says why).
      s.previousBytes = null;
      s.previous = null;
    }
    s.outcome = r.rows ? { kind: 'refusal', rows: r.rows } : null;
    return { rows: r.rows || [] };
  }

  /** Open a previous SDD (R-S16: a foreign @context is refused, never fetched). A refused file changes nothing. */
  function openPrevious(bytes) {
    bytes = toU8(bytes);
    let previous, plan = null;
    try {
      previous = readPrevious(bytes);
      if (previous.source.format !== SOURCE_FORMAT) {
        throw new UsageError('E-USAGE', `the previous SDD was made from another source format (${previous.source.format})`);
      }
      if (s.schemaBytes && s.inventory && s.inventory.errors.length === 0) {
        plan = rerunPlan({ schemaBytes: s.schemaBytes, previousBytes: bytes, atlassianSchema, terms }).plan;
      }
    } catch (e) {
      return refuse([refusalRow(e)]);
    }
    s.previousBytes = bytes;
    s.previous = previous;
    s.plan = plan;
    s.outcome = null;
    return { rows: [] };
  }

  // ---------- derived views ----------

  const slots = () => (s.skeleton ? s.skeleton.slots : []);
  const reportOf = (id) => s.reports[id];
  const current = (r) => s.skeletonSha !== null && r.report.skeletonSha256 === s.skeletonSha;

  /** Carried mappings (R-S17): the plan's unchanged keys, with their records from the previous SDD. */
  function carried() {
    const out = new Map();
    if (!s.plan || !s.previous) return out;
    const byKey = new Map(s.previous.mappings.map((m) => [m.key, m]));
    for (const k of s.plan.unchanged) if (byKey.has(k)) out.set(k, byKey.get(k));
    return out;
  }

  /** The decisions held under the current skeleton (RV-O2). Others are kept as they are, neither shown nor saved. */
  const held = () => (s.skeletonSha !== null && s.decisions.get(s.skeletonSha)) || new Map();
  /** The current skeleton's decisions, for an act to write (created on the first act under that skeleton). */
  function heldForAct() {
    if (!s.decisions.has(s.skeletonSha)) s.decisions.set(s.skeletonSha, new Map());
    return s.decisions.get(s.skeletonSha);
  }

  /** Decisions that apply to the current skeleton (each is bound to the report it was made on). */
  function effectiveDecision(key) {
    const d = held().get(key);
    if (!d) return null;
    const r = reportOf(d.reportId);
    return r && current(r) ? d : null;
  }

  function mappingIn(reportId, key) {
    const a = reportOf(reportId).answer;
    return a && Array.isArray(a.mappings) ? a.mappings.find((m) => m && m.key === key) : undefined;
  }

  function latestValidatedFor(key) {
    for (let i = s.reports.length - 1; i >= 0; i--) {
      const r = s.reports[i];
      if (current(r) && r.report.status === 'validated' && mappingIn(i, key)) return i;
    }
    return null;
  }

  /** The proposal an item shows (and an act on it binds to). */
  function proposalReportFor(key) {
    const d = effectiveDecision(key);
    if (d && d.decision === 'accept') return d.reportId;
    return latestValidatedFor(key);
  }

  function items() {
    const carry = carried();
    const out = [];
    for (const slot of slots()) {
      const key = slot.key;
      const d = effectiveDecision(key);
      const reportId = proposalReportFor(key);
      const c = carry.get(key);
      if (!d && reportId === null && !c) continue;
      let decision = null;
      if (d) decision = { decision: d.decision, by: d.by, carried: false };
      else if (c) decision = { decision: 'accept', by: c.acceptance && c.acceptance.by, carried: true, record: c };
      out.push({
        key, kind: slot.kind, slot,
        reportId, mapping: reportId === null ? null : mappingIn(reportId, key),
        decision,
        canDecide: reportId !== null,
        nullEquivalentsText: s.nullEquivalents.get(key) ?? '',
      });
    }
    return out;
  }

  /** Keys still open: slots that are neither carried nor accepted in this session. */
  function openKeys() {
    const carry = carried();
    return slots().map((x) => x.key).filter((k) => {
      const d = effectiveDecision(k);
      if (d && d.decision === 'accept') return false;
      return !(carry.has(k) && !d);
    });
  }

  function summary() {
    const inv = s.inventory;
    if (!inv) return null;
    const refs = inv.attributes.filter((a) => a.type === 'referenced_object').length;
    return summaryText(inv.objectTypes.length, inv.attributes.length - refs, refs, inv.flags.length);
  }

  function outcomeView() {
    if (!s.outcome) return null;
    if (s.outcome.kind === 'refusal') return { status: null, rows: s.outcome.rows, itemRows: new Map(), report: null };
    const r = reportOf(s.outcome.reportId);
    const rep = r.report;
    const itemRows = new Map();
    const rows = [...rep.errors];
    if (rep.status === 'validated') {
      for (const w of rep.warnings) {
        if (w.key !== null && proposalReportFor(w.key) === s.outcome.reportId) {
          if (!itemRows.has(w.key)) itemRows.set(w.key, []);
          itemRows.get(w.key).push(w);
        } else rows.push(w);
      }
    } else rows.push(...rep.warnings);
    return {
      status: rep.status === 'validated' ? VALIDATED_TEXT : rejectedText(rep.errors.length),
      rows, itemRows, report: rep, reportId: s.outcome.reportId,
      canRepair: rep.status === 'rejected',
    };
  }

  function batches() {
    const set = s.promptSets.length ? s.promptSets[s.promptSets.length - 1] : null;
    const list = [];
    if (set && set.skeletonSha === s.skeletonSha) for (const id of set.promptIds) list.push(s.prompts[id]);
    for (const id of s.repairIds) if (s.prompts[id].skeletonSha === s.skeletonSha) list.push(s.prompts[id]);
    return { prompts: list, warnings: set && set.skeletonSha === s.skeletonSha ? set.warnings : [] };
  }

  // ---------- CV-O1: relay ----------

  function addPrompt(p) {
    p.id = s.prompts.length;
    s.prompts.push(p);
    s.recency.push(p.id);
    return p;
  }

  /** Build prompt(s) for the open keys. `budgetText` empty = the default (R-S12). */
  function buildPromptSet(budgetText = '') {
    if (!s.skeleton) return { message: 'Open a schema first.' };
    let budget = DEFAULT_BUDGET;
    const bt = String(budgetText).trim();
    if (bt !== '') {
      if (!/^[1-9][0-9]*$/.test(bt)) return { message: 'The budget must be a whole number of bytes, greater than 0.' };
      budget = Number(bt);
    }
    const open = openKeys();
    if (open.length === 0) return { message: 'No open slots: there is nothing to put in a prompt.' };
    const keys = open.length === slots().length ? null : open;
    let result;
    try {
      result = buildPrompts({ skeletonBytes: s.skeletonBytes, inventoryBytes: s.inventoryBytes, keys, budget, template, terms });
    } catch (e) {
      return refuse([refusalRow(e)]);
    }
    const setId = s.promptSets.length;
    const n = result.prompts.length;
    const ids = result.prompts.map((p, i) => addPrompt({
      kind: 'prompt', setId, batch: p.batch, index: i + 1, count: n, round: 1,
      text: p.text, bytes: p.bytes, sha256: p.sha256, skeletonSha: s.skeletonSha,
    }).id);
    s.promptSets.push({ id: setId, promptIds: ids, warnings: result.promptSet.warnings, skeletonSha: s.skeletonSha, promptSet: result.promptSet });
    s.repairIds = [];
    return { prompts: ids.map((id) => s.prompts[id]) };
  }

  /** Copying a prompt makes it the one the next paste answers (unless the paste names another batch). */
  function activate(promptId) {
    const i = s.recency.lastIndexOf(promptId);
    if (i >= 0) s.recency.splice(i, 1);
    s.recency.push(promptId);
    return s.prompts[promptId];
  }

  function targetPrompt(answer) {
    const live = s.recency.filter((id) => s.prompts[id].skeletonSha === s.skeletonSha);
    if (live.length === 0) return null;
    const batch = answer && typeof answer.batch === 'string' ? answer.batch : null;
    if (batch !== null) {
      for (let i = live.length - 1; i >= 0; i--) if (s.prompts[live[i]].batch === batch) return s.prompts[live[i]];
    }
    return s.prompts[live[live.length - 1]];
  }

  /** Check a pasted reply (C-S4). Appends the paste and its report; changes no decision (PR-O3, RV-O2). */
  function checkPaste(text) {
    if (!s.skeleton) return { message: 'Open a schema first.' };
    const pasteBytes = utf8(String(text));
    const answer = extractAnswer(fromUtf8(pasteBytes));
    const prompt = targetPrompt(answer);
    if (!prompt) return { message: 'Build a prompt first.' };
    let report;
    try {
      report = checkProposal({ skeletonBytes: s.skeletonBytes, promptBytes: prompt.bytes, pasteBytes, proposalSchema, terms });
    } catch (e) {
      return refuse([refusalRow(e)]);
    }
    const pasteIdx = s.pastes.length;
    s.pastes.push(pasteBytes);
    const id = s.reports.length;
    s.reports.push({ id, report, reportBytes: canonicalBytes(report), pasteIdx, promptId: prompt.id, answer: report.status === 'validated' ? answer : null });
    s.outcome = { kind: 'check', reportId: id };
    return { report, reportId: id };
  }

  /** Build the repair prompt (C-S5) for the rejected report on screen. */
  function buildRepair() {
    const o = s.outcome;
    if (!o || o.kind !== 'check') return { message: 'There is no rejected reply to repair.' };
    const r = reportOf(o.reportId);
    if (r.report.status !== 'rejected') return { message: 'There is no rejected reply to repair.' };
    const prompt = s.prompts[r.promptId];
    let out;
    try {
      out = buildRepairPrompt({ skeletonBytes: s.skeletonBytes, inventoryBytes: s.inventoryBytes, reportBytes: r.reportBytes, promptBytes: prompt.bytes, template, terms });
    } catch (e) {
      return refuse([refusalRow(e)]);
    }
    const p = addPrompt({
      kind: 'repair', setId: prompt.setId, batch: out.batch, index: prompt.index, count: prompt.count, round: out.round,
      text: out.text, bytes: out.bytes, sha256: sha256Hex(out.bytes), skeletonSha: s.skeletonSha,
    });
    s.repairIds.push(p.id);
    return { prompt: p };
  }

  // ---------- CV-O2: decide (the only writers of decisions, acceptorName, nullEquivalents) ----------

  function setName(name) {
    s.acceptorName = String(name);
  }

  const nameReady = () => s.acceptorName.trim().length > 0;

  /** Per-item Accept / Reject. `at` is the time of this click (YYYY-MM-DDTHH:MM:SSZ). */
  function decide(key, decision, at) {
    if (decision !== 'accept' && decision !== 'reject') throw new TypeError('decision');
    if (!nameReady()) return { message: 'Type your name first.' };
    const reportId = proposalReportFor(key);
    if (reportId === null) return { message: 'This item has no validated mapping to decide on.' };
    const prev = effectiveDecision(key);
    if (prev && prev.decision === decision && prev.by === s.acceptorName && prev.reportId === reportId) return { unchanged: true };
    heldForAct().set(key, { decision, by: s.acceptorName, at, reportId });
    return { ok: true };
  }

  /** Items the bulk act would accept: validated and undecided. */
  function bulkKeys() {
    return items().filter((it) => it.canDecide && !effectiveDecision(it.key)).map((it) => it.key);
  }

  /** Accept all N validated (after the person confirms). `n` must be the N the person was shown. */
  function acceptAll(n, at) {
    if (!nameReady()) return { message: 'Type your name first.' };
    const keys = bulkKeys();
    if (keys.length !== n) return { message: 'The list changed; nothing was done.' };
    const h = keys.length ? heldForAct() : null;
    for (const k of keys) h.set(k, { decision: 'accept', by: s.acceptorName, at, reportId: proposalReportFor(k) });
    return { ok: true, keys };
  }

  function setNullEquivalents(key, text) {
    s.nullEquivalents.set(key, String(text));
  }

  // ---------- CV-O3: save ----------

  /**
   * The SDD for the current decisions (C-S6). Each decision is applied with the report it was made on, its own
   * name and its own click time: decisions are grouped by (report, by, at) and folded through acceptMappings,
   * each step taking the previous step's SDD as `previous` (the R-S17 merge carries earlier steps' mappings
   * byte-identical). The first step takes the opened previous SDD, if any (sdd accept --previous).
   */
  function buildSdd() {
    if (!s.skeleton) return { message: 'Open a schema first.' };
    const slotKind = new Map(slots().map((x) => [x.key, x.kind]));
    const effective = [];
    for (const [key, d] of held()) if (slotKind.has(key) && effectiveDecision(key)) effective.push({ key, ...d });

    const groups = new Map();
    for (const d of effective) {
      const g = JSON.stringify([d.reportId, d.by, d.at]);
      if (!groups.has(g)) groups.set(g, { reportId: d.reportId, by: d.by, at: d.at, decisions: [] });
      groups.get(g).decisions.push(d);
    }
    const order = [...groups.values()].sort((a, b) => a.reportId - b.reportId || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || (a.by < b.by ? -1 : a.by > b.by ? 1 : 0));
    const slotOrder = new Map(slots().map((x, i) => [x.key, i]));

    const pair = (id) => ({ reportBytes: s.reports[id].reportBytes, pasteBytes: s.pastes[s.reports[id].pasteIdx] });
    const steps = order.map((g) => {
      const ds = g.decisions.sort((a, b) => slotOrder.get(a.key) - slotOrder.get(b.key));
      const ne = {};
      for (const d of ds) {
        if (d.decision !== 'accept' || slotKind.get(d.key) !== 'attribute') continue;
        const values = parseNullEquivalents(s.nullEquivalents.get(d.key) ?? '');
        if (values.length) ne[d.key] = values;
      }
      return {
        decisionsBytes: utf8(JSON.stringify({ by: g.by, decisions: ds.map((d) => ({ key: d.key, decision: d.decision })), nullEquivalents: ne })),
        checked: [pair(g.reportId)],
        at: g.at,
      };
    });
    if (steps.length === 0) {
      const v = latestValidated();
      if (v === null) return { message: 'Check a reply that validates before saving.' };
      steps.push({ decisionsBytes: utf8(JSON.stringify({ by: '-', decisions: [], nullEquivalents: {} })), checked: [pair(v)], at: '1970-01-01T00:00:00Z' });
    }

    let previousBytes = s.previousBytes || undefined;
    let value;
    try {
      for (const st of steps) {
        value = acceptMappings({
          skeletonBytes: s.skeletonBytes, inventoryBytes: s.inventoryBytes, decisionsBytes: st.decisionsBytes,
          checked: st.checked, previousBytes, terms, at: st.at,
        });
        previousBytes = canonicalBytes(value);
      }
    } catch (e) {
      return { rows: [refusalRow(e)] };
    }
    return { bytes: previousBytes, value };
  }

  function latestValidated() {
    for (let i = s.reports.length - 1; i >= 0; i--) if (current(s.reports[i]) && s.reports[i].report.status === 'validated') return i;
    return null;
  }

  function recordSaved(name, bytes) {
    s.savedFiles.push({ name, sha256: sha256Hex(bytes) });
  }

  return {
    state: s, terms,
    openSchema, openPrevious,
    summary, items, carried, openKeys, outcomeView, batches,
    buildPromptSet, activate, checkPaste, buildRepair,
    setName, decide, bulkKeys, acceptAll, setNullEquivalents,
    buildSdd, recordSaved,
  };
}
