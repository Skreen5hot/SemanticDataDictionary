# Communications

The record of what this repository has said to, and heard from, the teams it depends on or that depend on it.

This repository follows the **Ontology-Template communications protocol** as published at
`Skreen5hot/Ontology-Template` commit `114f28db82adf727f5e31aab4872ed56550e84af`, path `communications/README.md`
(sha256 `150a312b30990469e4e68222a9ea485d6766579900749bd7413f4e4dd2ff57a8`): one folder per team with `incoming/` and
`outgoing/`; one Markdown file per message with a YAML header; committed messages never change; status is derived
from replies; every ref is bound to a commit and a sha256; a message is not a decision; agents are named as agents;
sending happens outside the repository.

This repository's code is **`SDD`**.

| Team code | Team | Repository |
|---|---|---|
| `OT` | Ontology-Template maintainers | `Skreen5hot/Ontology-Template` |

Ontology-Template's own `config/project.yaml` carries the template placeholder code `EXAMPLE` and an empty
`correspondents` list by design. This record therefore names it `OT`, and does not ask the template to register
`SDD` as a correspondent, which would propagate into every project initialised from it.

No checker runs here yet. Ontology-Template's `tools/communications.py` defines the rules this record is written to.
