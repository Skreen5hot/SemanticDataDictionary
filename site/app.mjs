// site/app: the view (SDD-operator CV-O1–CV-O3) over site/session.mjs. Reads the clock only for the time of an
// act (acceptance.at at each Accept click) and the download name. No network access of any kind (PR-O2): the
// resources are bundled into the page; files arrive through file inputs and leave as downloads.
//
// Every string copied from an artifact is set as text (never markup) inside an element carrying `data-quoted`
// (RV-O3, RV-O4); every other text is a fixed label or an RV-O1 template.

import { RESOURCES } from 'sdd:resources';
import { createSession, actTime, saveFileName, bulkConfirmText } from './session.mjs';

const session = createSession(RESOURCES);
const S = session.state;
let messageText = '';
let dialog = null; // {n, name}

// ---------- DOM helpers (text only; no innerHTML anywhere) ----------

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}
const asText = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
/** A quoted inline element holding artifact text. */
const q = (v, cls) => h('span', { 'data-quoted': true, class: cls ? `q ${cls}` : 'q' }, asText(v));
const qOrDash = (v) => (v === null || v === undefined ? '—' : q(v));
const sep = (list, s) => list.flatMap((x, i) => (i ? [s, x] : [x]));
const $ = (id) => document.getElementById(id);
const fill = (id, ...children) => { const el = $(id); el.replaceChildren(...children.flat().filter(Boolean)); return el; };

/** RV-O4: `{code} · {key} · {field or —} · {value or —} · {rule} — {message}`. */
function problemRow(row) {
  return h('div', { 'data-testid': 'problem-row', class: 'problem-row' },
    sep([qOrDash(row.code), qOrDash(row.key), qOrDash(row.field), qOrDash(row.value), qOrDash(row.rule)], ' · '),
    ' — ', qOrDash(row.message));
}

function flagEl(flag) {
  const parts = [q(flag.code), qOrDash(flag.key)];
  for (const [k, v] of Object.entries(flag)) {
    if (k === 'code' || k === 'key') continue;
    const values = Array.isArray(v) ? v.map((x) => q(x)) : [qOrDash(v)];
    parts.push(h('span', { class: 'flag-field' }, q(k, 'field-name'), ' ', sep(values, ' ')));
  }
  return h('li', { 'data-testid': 'flag', class: 'flag' }, sep(parts, ' · '));
}

// ---------- rendering ----------

function renderInventory() {
  const inv = S.inventory;
  const out = [];
  if (S.previous) {
    out.push(h('p', { class: 'note' }, 'Previous SDD open: ', q(S.previous.source.schemaName ?? '—'), ', ',
      `${S.previous.mappings.length} mapping(s), ${S.previous.open.length} open, ${S.previous.retired.length} retired.`));
  }
  if (inv) {
    out.push(h('p', { 'data-testid': 'summary', class: 'summary' }, session.summary()));
    if (inv.flags.length) out.push(h('ul', { class: 'flags' }, inv.flags.map(flagEl)));
  }
  if (S.plan) out.push(renderPlan(S.plan));
  if (inv && (inv.objectTypes.length || inv.attributes.length)) out.push(renderSource(inv));
  fill('inventory', out);
}

function renderPlan(plan) {
  const list = (id, title, keys) => h('div', { class: 'plan-list' },
    h('h4', {}, `${title} (${keys.length})`),
    h('ul', { 'data-testid': id }, keys.map((k) => h('li', {}, q(k)))));
  return h('div', { 'data-testid': 'plan', class: 'plan' },
    h('h3', {}, 'Rerun plan'),
    h('p', { class: 'note' }, 'Unchanged mappings are carried with their original records. Changed and added slots go into the next prompt.'),
    h('div', { class: 'plan-grid' },
      list('plan-unchanged', 'Unchanged', plan.unchanged), list('plan-changed', 'Changed', plan.changed),
      list('plan-added', 'Added', plan.added), list('plan-removed', 'Removed', plan.removed)),
    plan.flags.length ? h('ul', { class: 'flags' }, plan.flags.map(flagEl)) : null);
}

function renderSource(inv) {
  const attrsOf = (t) => inv.attributes.filter((a) => a.owner === t.key);
  return h('section', { 'aria-label': 'From the source schema', class: 'source' },
    h('h3', {}, 'From the source schema'),
    h('p', {}, q(inv.source.schemaName ?? '—')),
    h('ul', { class: 'source-types' }, inv.objectTypes.map((t) => h('li', {},
      h('div', {}, q(t.name, 'name'), ' ', q(t.key, 'key')),
      t.description ? h('div', { class: 'desc' }, q(t.description)) : null,
      h('ul', {}, attrsOf(t).map((a) => h('li', {},
        q(a.name, 'name'), ' ', q(a.type), a.target ? [' → ', q(a.target)] : null,
        a.description ? [' ', q(a.description, 'desc')] : null)))))));
}

function renderBatches() {
  const { prompts, warnings } = session.batches();
  fill('batches',
    prompts.map((p) => {
      const repair = p.kind === 'repair';
      return h('div', { 'data-testid': 'batch', class: repair ? 'batch repair' : 'batch' },
        repair ? [h('span', { class: 'tag' }, `Repair prompt, round ${p.round}`), ' · '] : null,
        h('span', { class: 'batch-label' }, `Batch ${p.index} of ${p.count}`),
        ' · ',
        h('code', { class: 'hash', title: 'sha256 (first 8 hex characters)' }, p.sha256.slice(0, 8)),
        ' · ',
        h('span', { class: 'bytes' }, `${p.bytes.length} bytes`),
        ' ',
        h('button', { type: 'button', onclick: () => copyPrompt(p.id) }, repair ? 'Copy repair prompt' : 'Copy prompt'));
    }),
    warnings.map((w) => h('div', { 'data-testid': 'prompt-warning', class: 'prompt-warning' },
      sep([q(w.code), q(w.key), h('span', {}, q(w.bytes), ' bytes'), h('span', {}, 'budget ', q(w.budget))], ' · '))));
}

function renderOutcome() {
  const o = session.outcomeView();
  if (!o) { fill('outcome'); return o; }
  fill('outcome',
    o.status ? h('p', { 'data-testid': 'status', class: o.report.status === 'validated' ? 'status ok' : 'status bad' }, o.status) : null,
    o.rows.length ? h('div', { class: 'rows' }, o.rows.map(problemRow)) : null,
    o.canRepair ? h('button', { type: 'button', onclick: onRepair }, 'Build repair prompt') : null);
  return o;
}

const FIELDS = ['recordClass', 'referentClass', 'iceClass', 'relation'];

function renderItems(o) {
  const items = session.items();
  const itemRows = o ? o.itemRows : new Map();
  const n = session.bulkKeys().length;
  fill('bulk', n > 0 ? h('button', { type: 'button', onclick: () => openDialog(n) }, `Accept all ${n} validated`) : null);
  fill('items', items.map((it) => {
    const m = it.mapping || (it.decision && it.decision.carried ? it.decision.record : null);
    const decisionText = it.decision
      ? [it.decision.decision === 'accept' ? 'Accepted by ' : 'Rejected by ', q(it.decision.by ?? '—')]
      : [];
    return h('div', { 'data-testid': 'item', 'data-key': it.key, class: `item ${it.decision ? it.decision.decision : 'undecided'}` },
      h('div', { class: 'item-head' }, q(it.key, 'key'), ' ', q(it.kind, 'kind'),
        h('span', { 'data-testid': 'decision', class: 'decision' }, decisionText)),
      m ? h('div', { role: 'region', 'aria-label': "From the LLM's reply", class: 'reply' },
        h('div', { class: 'reply-label' }, "From the LLM's reply"),
        FIELDS.filter((f) => typeof m[f] === 'string').map((f) => {
          const label = session.terms.label(m[f]);
          return h('div', { class: 'field' }, q(f, 'field-name'), ' ', q(m[f]), label ? [' ', q(label, 'label')] : null);
        }),
        typeof m.rationale === 'string' ? h('p', { 'data-quoted': true, class: 'q rationale' }, m.rationale) : null) : null,
      it.canDecide ? h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'accept', onclick: () => act(it.key, 'accept') }, 'Accept'),
        h('button', { type: 'button', class: 'reject', onclick: () => act(it.key, 'reject') }, 'Reject'),
        it.kind === 'attribute' ? h('label', { class: 'ne' }, 'Null-equivalents ',
          h('input', { type: 'text', 'aria-label': 'Null-equivalents', autocomplete: 'off', spellcheck: 'false', placeholder: 'e.g. N/A, -',
            value: it.nullEquivalentsText, oninput: (e) => session.setNullEquivalents(it.key, e.target.value) })) : null) : null,
      (itemRows.get(it.key) || []).map(problemRow));
  }));
}

function renderSaved() {
  fill('saved', S.savedFiles.length ? h('ul', {}, S.savedFiles.map((f) => h('li', {}, f.name, ' ', h('code', { class: 'hash' }, f.sha256.slice(0, 8))))) : null);
}

function renderDialog() {
  if (!dialog) { fill('dialog-host'); return; }
  const text = bulkConfirmText(dialog.n, '\u0000').split('\u0000');
  const el = h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialog-text', class: 'dialog' },
    h('p', { id: 'dialog-text' }, text[0], q(dialog.name), text[1]),
    h('div', { class: 'acts' },
      h('button', { type: 'button', id: 'dialog-confirm', onclick: confirmBulk }, 'Confirm'),
      h('button', { type: 'button', onclick: () => { dialog = null; render(); } }, 'Cancel')));
  fill('dialog-host', h('div', { class: 'backdrop' }, el));
  const c = document.getElementById('dialog-confirm');
  if (c) c.focus();
}

function render() {
  renderInventory();
  renderBatches();
  const o = renderOutcome();
  renderItems(o);
  renderSaved();
  renderDialog();
  $('message').textContent = messageText;
}

function say(text) {
  messageText = text || '';
}

// ---------- acts ----------

async function readFile(input) {
  const f = input.files && input.files[0];
  if (!f) return null;
  const buf = new Uint8Array(await f.arrayBuffer());
  input.value = '';
  return buf;
}

async function onOpenSchema(e) {
  const bytes = await readFile(e.target);
  if (!bytes) return;
  session.openSchema(bytes);
  say('');
  render();
}

async function onOpenPrevious(e) {
  const bytes = await readFile(e.target);
  if (!bytes) return;
  const r = session.openPrevious(bytes);
  say(r.rows && r.rows.length ? 'The file was refused; nothing changed.' : '');
  render();
}

function onBuild() {
  const r = session.buildPromptSet($('budget').value);
  say(r.message || '');
  render();
}

// PR-O6(a): the clipboard must hold the prompt's exact bytes. The async Clipboard API is used, except on Windows:
// there Chromium's async writeText / ClipboardItem write every LF as CRLF (measured: readText returns CR LF pairs
// for a text with LF only), while a copy event whose clipboardData is set explicitly keeps the bytes. Each path
// falls back to the other if the browser refuses it.
const WINDOWS = /win/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');

function copyViaEvent(text) {
  let set = false;
  const onCopy = (e) => { e.clipboardData.setData('text/plain', text); e.preventDefault(); set = true; };
  document.addEventListener('copy', onCopy);
  try {
    document.execCommand('copy');
  } catch {
    set = false;
  } finally {
    document.removeEventListener('copy', onCopy);
  }
  return set;
}

function copyViaAsyncApi(text) {
  try {
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

function copyPrompt(id) {
  const p = session.activate(id);
  const done = (ok) => { say(ok ? 'Copied to the clipboard.' : 'The browser did not allow copying to the clipboard.'); render(); };
  if (WINDOWS) {
    if (copyViaEvent(p.text)) done(true);
    else copyViaAsyncApi(p.text).then(done);
    return;
  }
  copyViaAsyncApi(p.text).then((ok) => done(ok || copyViaEvent(p.text)));
}

function onCheck() {
  const r = session.checkPaste($('paste').value);
  say(r.message || '');
  render();
}

function onRepair() {
  const r = session.buildRepair();
  say(r.message || '');
  render();
}

function act(key, decision) {
  const r = session.decide(key, decision, actTime(new Date()));
  say(r.message || '');
  render();
}

function openDialog(n) {
  const name = S.acceptorName;
  if (name.trim().length === 0) { say('Type your name first.'); render(); return; }
  dialog = { n, name };
  render();
}

function confirmBulk() {
  if (!dialog) return;
  const r = session.acceptAll(dialog.n, actTime(new Date()));
  dialog = null;
  say(r.message || '');
  render();
}

function download(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/ld+json' }));
  const a = h('a', { download: name, style: 'display:none' });
  a.href = url;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function onSave() {
  const r = session.buildSdd();
  if (!r.bytes) {
    say(r.message || 'Nothing was saved.');
    if (r.rows) S.outcome = { kind: 'refusal', rows: r.rows };
    render();
    return;
  }
  const name = saveFileName(new Date());
  download(name, r.bytes);
  session.recordSaved(name, r.bytes);
  say(`Saved as a new download: ${name}`);
  render();
}

function init() {
  $('open-schema').addEventListener('change', onOpenSchema);
  $('open-previous').addEventListener('change', onOpenPrevious);
  $('build').addEventListener('click', onBuild);
  $('check').addEventListener('click', onCheck);
  $('name').addEventListener('input', (e) => session.setName(e.target.value));
  $('save').addEventListener('click', onSave);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialog) { dialog = null; render(); }
  });
  // The name field starts empty and is never filled by the tool (PR-O1(c)).
  $('name').value = '';
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
