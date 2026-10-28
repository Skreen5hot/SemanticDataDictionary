# UI locator contract (test interface only)

The operator spec (`spec/sdd-operator.md`) defines what the page does. This file only fixes **how the H-O1 harness
finds things**, so the implementation and the independent harness can be written separately. It adds no behaviour.
Visible label texts are the spec's own (CV-O1–CV-O3, RV-O1, RV-O4).

| Thing | Locator |
|---|---|
| Open a schema | `<input type="file" aria-label="Open schema">` |
| Open a previous SDD | `<input type="file" aria-label="Open previous SDD">` |
| Inventory summary line (S-O5, RV-O1 template) | element `data-testid="summary"`, its text exactly the template |
| Flags | each flag in an element `data-testid="flag"` |
| Rerun plan (previous SDD + schema) | element `data-testid="plan"`; inside it lists `data-testid="plan-unchanged"`, `plan-changed`, `plan-added`, `plan-removed`, each holding one quoted element per key; plan flags as `data-testid="flag"` |
| Prompt budget | `<input aria-label="Budget (bytes)">`, empty = the default |
| Build prompt | button, accessible name `Build prompt` |
| One batch | element `data-testid="batch"`, containing the text `Batch i of n`, the 8-hex sha256 prefix, and a button `Copy prompt` |
| Paste box | `<textarea aria-label="Paste reply">` and button `Check reply` |
| Check status | element `data-testid="status"`, its text exactly the RV-O1 status |
| Problem rows | each row `data-testid="problem-row"`, its text exactly RV-O4's format |
| Repair | button `Build repair prompt`; the result appears as a `data-testid="batch"` element whose copy button is named `Copy repair prompt` |
| Acceptor name | `<input aria-label="Your name">` |
| An item | element `data-testid="item"` with `data-key="<slot key>"`; buttons `Accept` and `Reject`; decision text in `data-testid="decision"` (`Accepted by {name}` / `Rejected by {name}`, empty when undecided); for attributes `<input aria-label="Null-equivalents">` |
| Bulk accept | button named `Accept all {N} validated`; confirmation `role="dialog"` with the RV-O1 text and buttons `Confirm` and `Cancel` |
| Save | button `Save SDD`, a download named `sdd-YYYYMMDDTHHMMSSZ.jsonld` |
| Quoted text (RV-O3, RV-O4) | every string copied from an artifact (keys, values, names, descriptions, rationales, codes and messages in rows) is inside an element carrying the attribute `data-quoted`. Rationales sit in a region `aria-label="From the LLM's reply"`, source names and descriptions in a region `aria-label="From the source schema"` |
| Refusal outside a report (e.g. E-CTX-EXTERNAL on open) | a `data-testid="problem-row"` in RV-O4 format |
