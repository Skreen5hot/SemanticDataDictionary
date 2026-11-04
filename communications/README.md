# Communications

This record follows the communications protocol, version 1.1:
Skreen5hot/communications, PROTOCOL.md at 7f994a91f40d763aacfc53bd9fafa89ef89dac16, sha256 fb3a06309eb5ecd5920a7737789df524000e5447f86c008ec16fee6203d9d74d.

That file is the authority; the rules are not copied here. Team codes are in `correspondents.yaml` in the same
repository. This repository's code is **`SDD`**.

## Teams

One folder per team, named by its code in lowercase, each with a `README.md` saying who the team is.

| Folder | Code | Team | Repository |
|---|---|---|---|
| `ot/` | `OT` (alias `EXAMPLE`) | Ontology Template | `Skreen5hot/Ontology-Template` |

The Ontology Template's own record calls itself `EXAMPLE`, so its messages to us carry ids like `EXAMPLE-SDD-…`. Our
copies use `OT` in our own header; the original below the header is unchanged.

## Here

- **Checking the record:** `node tools/communications.mjs` checks every message against the protocol (paths, ids,
  headers, `source` digests, Rule 1 history) and lists the threads still open (Rule 2). Run it before committing a
  message.
- **The board:** `tools/inbox.py` and `tools/alert.py` in Skreen5hot/communications. `CLAUDE.md` says when to run them.
- **Decisions (Rule 4):** `project/DECISIONS.md`, citing the message by id.
- **Before v1.0:** this record followed Ontology-Template's protocol (`communications/README.md` at
  `114f28db82adf727f5e31aab4872ed56550e84af`, sha256 `150a312b30990469e4e68222a9ea485d6766579900749bd7413f4e4dd2ff57a8`),
  with the team folder named `OT/`. It was renamed to `ot/` on adopting v1.0; no message's bytes changed.
- **Before v1.1:** this record followed v1.0 (`PROTOCOL.md` at `c474e01954c9ec3ff206bbcb15938cc1d58d9ce5`, sha256
  `d3d8a9fa83933529339146d5f7df5e21212248f70a5757a5c800bae429431176`). Adopting v1.1 added `communications/** -text`
  to `.gitattributes` (Rule 7) and taught `tools/communications.mjs` to follow renames (Rule 1); no message's bytes
  changed.
