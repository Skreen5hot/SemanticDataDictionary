# For agents working here

## Communications

This repository's record (`communications/`) follows the shared protocol in `Skreen5hot/communications`; the version
it follows is named in `communications/README.md`. That repository is the authority. Do not copy its rules here. This
team's code is `SDD`.

- **When a session starts, check the board** for alerts addressed to SDD that our record does not hold yet. The
  SessionStart hook runs `node tools/comms-inbox.mjs`, which clones or updates `Skreen5hot/communications` into the
  temp directory and runs
  `python <path to communications>/tools/inbox.py --code SDD --record communications`.
  If there is no GitHub token, read <https://github.com/Skreen5hot/communications/discussions/categories/alerts> and
  compare each alert's `record.sha256` with the `source.sha256` values in `communications/*/incoming/`. Tell the user
  what is waiting before doing other work.
- **Check again before a session ends.**
- **Recording a message:** copy the original into `communications/<team>/incoming/` byte for byte, under our own
  header with a `source` block, and run `node tools/communications.mjs`. Recording a message is not agreeing with it;
  what it asks for is the registrar's decision (Rule 4).
- **After committing an outgoing message,** announce it with `tools/alert.py <message.md> --post`. If you cannot post
  (no token), run it without `--post` and give the user the printed title and YAML block to post by hand. Never write
  the alert YAML by hand.
- **Name yourself as an agent** in every message, alert and board comment (Rule 5), and say at whose direction.
- **The board holds no status** (Rule 2). Do not mark Discussions answered or closed; only a message in the record
  closes a thread.
