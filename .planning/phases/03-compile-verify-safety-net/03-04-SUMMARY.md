---
phase: 03
plan: 04
subsystem: docs
tags: [docs, roadmap, finalization, wave-3]
requires: [03-03]
provides:
  - src/compiler/README.md (one-page architecture + maintenance doc)
  - confirmed ROADMAP + REQUIREMENTS Phase 3 state (already finalized at planning time)
affects:
  - src/compiler/README.md
tech_stack:
  added: []
  patterns:
    - relative-internal-doc-links
key_files:
  created:
    - src/compiler/README.md
  modified: []
decisions:
  - "README documents evmVersion='cancun' as the canonical value (overriding RESEARCH's 'paris' suggestion) with full Wave-0-discovery context — future maintainers reading this won't think the README is stale relative to the source code."
  - "ROADMAP + REQUIREMENTS edits described in Plan 03-04 Task 2 were already finalized at PLANNING time (Plans: 4 plans in 4 waves, 03-XX-PLAN.md listings, Progress table 0/4). No edit needed — the automated verify passes as-is. Per CLAUDE.md and the user's prompt, the orchestrator/verifier handles checkbox flips after execution."
metrics:
  duration: ~10 minutes
  completed_date: 2026-05-27
  tasks: 2
  files_created: 1
  files_modified: 0
---

# Phase 3 Plan 04: Wave 3 — README + Finalization Summary

One-liner: Added `src/compiler/README.md` (76 lines, 9 H2 sections) documenting architecture, evmVersion='cancun' Wave-0 discovery, sync callback rationale, cwd-independence rationale, fixture roles, version-bump procedure, and Phase 4/7/8 forward-looking notes. ROADMAP + REQUIREMENTS Phase 3 state was already finalized at planning time — no edits required.

## What Shipped

### Task 1: src/compiler/README.md

- 76 lines (within 30-200 budget)
- All 9 required H2 sections present:
  1. Overview (names COMP-01/03/04/05 + Phase 7 COMP-02 cross-phase note)
  2. Architecture (per-file ownership + locked seam signature as a fenced code block)
  3. Why solc-js + Standard JSON (pure-JS, no native binary, official EF distribution)
  4. Why we pin evmVersion: "cancun" (Wave-0 discovery — OZ 5.6.1 uses Cancun-only mcopy in utils/Bytes.sol)
  5. Why the import callback is synchronous (Pitfall 1 lock)
  6. Why cwd-independence matters (require.resolve from smartc's install root; probe is the regression canary; path-traversal guard mentioned)
  7. Test fixtures (Phase 2 goldens + broken.sol + warns-no-error.sol with swap-strategy note)
  8. Bumping pinned versions (6-step procedure: package.json → probe → integration tests → version.spec → cli.spec → commit)
  9. Phase forward-looking notes (4 reuses gate as-is; 7 plugs into chain==='solana' branch; 8 reuses for AI sandbox-compile)
- Mentions all required strings: `0.8.35`, `5.6.1`, `E_COMPILE_FAILED`, `EVM_VERSION = "cancun"`
- Relative links to sibling files: `./index.ts`, `./imports.ts`, `./types.ts`, `../../scripts/probe-compile.mjs`, `../../tests/compiler/compile.integration.spec.ts`
- Commit: `f6ceb4c`

### Task 2: ROADMAP + REQUIREMENTS state

Plan 03-04 Task 2 action items had **already been done at planning time** (commits prior to Wave 0 execution):
- ROADMAP Phase 3 entry already shows `**Plans**: 4 plans in 4 waves`
- All four PLAN.md filenames listed as unchecked `- [ ]` items
- Progress table Phase 3 row shows `0/4` (replaces `0/TBD`)
- REQUIREMENTS traceability rows preserved: COMP-01/03/04/05 at Phase 3 Pending; COMP-02 at Phase 7 Pending (cross-phase per existing note)

**Per CLAUDE.md + user prompt: do NOT mark ROADMAP/REQUIREMENTS checkboxes `[x]` here — the orchestrator/verifier flips those during `/gsd:verify-work` after phase completion.** This task verifies the state is correct, NOT that it transitions.

The automated verify from Plan 03-04 Task 2 was run and exits 0:
```
node -e "...['03-01-PLAN.md','03-02-PLAN.md','03-03-PLAN.md','03-04-PLAN.md'].forEach...
  '| COMP-01 | Phase 3'... '| COMP-03 | Phase 3'... etc"
→ OK
```

## Phase-Level Verification (Final)

After all four plans complete:

```
npx vitest run                                   → 157 passed / 1 skipped / 0 failed (10.70s)
npm run typecheck                                → exit 0
npm run build                                    → exit 0 (dist/cli.js 22.32 KB)
node dist/cli.js --version                       → smartc 0.1.0 (solc 0.8.35, @openzeppelin/contracts 5.6.1, @openzeppelin/wizard 0.10.8)
node scripts/probe-compile.mjs                   → PROBE PASSED, errors=0, warnings=5, elapsed=552ms
grep -c "| 3. Compile-Verify Safety Net | 0/4 |" .planning/ROADMAP.md → 1
```

All SC-1 through SC-5 deliverables green:
- SC-1: `smartc create --template erc20` compile-verifies before file write — proven by `tests/commands/create.compile.spec.ts` test 1
- SC-2: compile fail → user sees diagnostics → no file on disk — proven by `tests/commands/create.compile-fail.spec.ts` test 1 (D-15 (a)+(b))
- SC-3: compile warns → user sees warnings → file IS written — proven by `tests/commands/create.compile.spec.ts` test 2
- SC-4: imports resolve from bundled deps — proven by `tests/compiler/compile.integration.spec.ts` tests 1+2 and `tests/compiler/compile.spec.ts` test "resolves from any cwd"
- SC-5: pinned versions visible user-facing — proven by `tests/version.spec.ts` + `tests/cli.spec.ts` --version e2e

## Deviations from Plan

### Plan 03-04 Task 2 was effectively a no-op

- **Found during:** Task 2 verify
- **Issue:** Plan 03-04 Task 2 specified edits to ROADMAP.md + REQUIREMENTS.md that were already applied during the planning phase (visible in commits prior to Wave 0 execution: `2b5bed9 docs(03-01)`, `96779eb docs(03-02)`, `5883a2d docs(03-03)`, `6766b22 docs(03-04)`).
- **Fix:** Ran the Task 2 automated verify; it passed. Documented in this SUMMARY that no edit was needed. Per CLAUDE.md + user prompt, the orchestrator/verifier handles the post-execution checkbox flip (`[x]`) — that is NOT this executor's responsibility.

### README evmVersion documentation override

- **Found during:** Task 1 authoring
- **Issue:** Plan 03-04 Task 1 behavior section step 4 says "Why we pin evmVersion: \"paris\"". Code reality is `"cancun"` (Wave 0 discovery from Plan 03-01).
- **Fix:** Wrote the README section as "Why we pin evmVersion: \"cancun\"" with full Wave 0 historical context (paris attempted first → 4 mcopy errors → bumped to cancun → probe passed). Documenting the historical decision is more valuable than literal compliance with a stale plan instruction.
- **Files modified:** `src/compiler/README.md`
- **Commit:** `f6ceb4c`

## Authentication Gates

None.

## Threat Flags

None — Plan 03-04 ships documentation and confirms planning artifacts only. No new threat surface.

## CLAUDE.md Phase-Completion Push Reminder

Per the project's CLAUDE.md `## Workflow → Push after each phase completes` directive: after this plan lands AND Phase 3 is marked complete in `.planning/ROADMAP.md` / `.planning/STATE.md` by the orchestrator/verifier, the orchestrator runs `git push` to publish all Phase 3 commits to `origin`. **This executor does NOT push.** Intermediate task commits stay local until the phase wraps.

## Self-Check: PASSED

- FOUND: `src/compiler/README.md` (76 lines, all 9 H2 sections, all required strings)
- FOUND commit: `f6ceb4c` (docs: README)
- ROADMAP automated verify (Task 2) → OK
- REQUIREMENTS automated verify (Task 2) → OK
- Full vitest suite → 157/158 passing (1 skipped pre-existing)
- `node dist/cli.js --version` → contains "solc 0.8.35" and "@openzeppelin/contracts 5.6.1"
- `node scripts/probe-compile.mjs` → PROBE PASSED (still works)
