# Project Instructions

## Workflow

### Push after each phase completes

When a phase finishes via `/gsd:execute-phase` (and the phase is marked complete in `.planning/ROADMAP.md` / `.planning/STATE.md`), run `git push` to publish the phase's commits to `origin`.

- **Trigger:** phase marked complete after execution. Not on intermediate commits (CONTEXT.md, PLAN.md, individual task commits) — those stay local until the phase wraps.
- **Branch:** push the current branch (typically `main`) to `origin`.
- **On failure:** if the push is rejected (non-fast-forward, auth, etc.), surface the error and stop — do not force-push.
