---
phase: 04-erc-721-and-erc-1155-templates
plan: 04
subsystem: boot-and-integration
tags: [erc721, erc1155, boot, registry, integration, e2e, wave-2, plugin]

# Dependency graph
requires:
  - plan: 04-01
    provides: 5 committed fixtures, royalty.ts, E_USAGE 3-template copy, it.skip registry stub
  - plan: 04-02
    provides: registerErc721Template(), happy-path prompt sequence (3 text + 5 confirm)
  - plan: 04-03
    provides: registerErc1155Template(), happy-path prompt sequence (2 text + 4 confirm)
provides:
  - Booted three-template CLI — `smartc list-templates` shows erc20, erc721, erc1155
  - Live three-template no-collision registry test (it.skip flipped to it)
  - 7-fixture describe.each compile-integration corpus (SC-5)
  - ERC-721 + ERC-1155 happy-path E2E coverage through the full dispatcher pipeline
affects: []

# Tech tracking
tech-stack:
  added: []   # zero new packages
  patterns:
    - "describe.each(FIXTURES) parametrized compile-integration corpus (Vitest 4 nested describe.each)"
    - "prime-helper-per-template E2E priming pattern (primeErcNNNHappyPathMocks)"

key-files:
  created:
    - .planning/phases/04-erc-721-and-erc-1155-templates/04-04-SUMMARY.md
  modified:
    - src/cli.ts
    - tests/registry.spec.ts
    - tests/compiler/compile.integration.spec.ts
    - tests/commands/create.compile.spec.ts

key-decisions:
  - "src/cli.ts is the ONLY non-test source file modified — exactly +4 lines (2 imports + 2 register calls), 0 removed (D-12 additive-only)."
  - "compile-integration refactor used option (a): one outer describe wraps the nested describe.each + the 2 unchanged error-path it blocks (cohesion)."
  - "Added an erc721 idempotency test mirroring the existing erc20 idempotency test (optional per plan action) — registry.spec.ts now 10 live tests."

requirements-completed: [ERC721-01, ERC721-02, ERC721-03, ERC721-04, ERC721-05, ERC1155-01, ERC1155-02, ERC1155-03, ERC1155-04, ERC1155-05]

# Metrics
duration: ~11min
completed: 2026-05-28
---

# Phase 4 Plan 04: Wave 2 Integration — Boot Wiring + Cross-Cutting Tests Summary

**Wired both new template plugins into `src/cli.ts` boot (exactly +4 lines), flipped the three-template no-collision registry test live, extended the compile-integration spec to a 7-fixture `describe.each` corpus, and added ERC-721 + ERC-1155 happy-path E2E cases — the full suite is now 250 passed / 1 skipped (251) with a clean build and `list-templates` showing three rows.**

## Performance
- **Duration:** ~11 min
- **Started:** 2026-05-28T13:32:13Z
- **Completed:** 2026-05-28T13:42:52Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (1 source boot wiring + 3 test files)

## Task Commits
1. **Task 1: boot wiring (src/cli.ts) + flip registry three-template test** — `298da15` (feat)
2. **Task 2: compile-integration describe.each 7-fixture corpus** — `381577b` (test)
3. **Task 3: ERC-721 + ERC-1155 happy-path E2E cases** — `702d86e` (test)

## Phase-Wide Additive-Only File-Set Verification

The plugin model claim (SC: additive-only) holds across all of Phase 4. Directories TOUCHED vs. NOT TOUCHED:

| Path | Phase 4 disposition |
|------|---------------------|
| `src/cli.ts` | MODIFIED — 4 lines (this plan, boot wiring) |
| `src/commands/create.ts` | MODIFIED — 1 line E_USAGE copy (plan 04-01, D-14) |
| `src/templates/erc721/` | NEW (plans 04-01 royalty/opts, 04-02 plugin) |
| `src/templates/erc1155/` | NEW (plan 04-03 plugin) |
| `src/compiler/` | **NOT TOUCHED** (D-12) |
| `src/registry/` | **NOT TOUCHED** (D-12) |
| `src/lib/` | **NOT TOUCHED** (D-12) |
| `src/program.ts` | **NOT TOUCHED** |
| `src/commands/list-templates.ts` | **NOT TOUCHED** |
| `src/templates/erc20/` | **NOT TOUCHED** |
| `tests/*` | additive — new specs + the 4 cross-cutting files extended |

This plan's `git diff --name-only` over its 3 task commits shows exactly the 4 `files_modified` from the plan frontmatter — no out-of-scope source changes.

## Full-Suite Test Count: Phase 3 baseline → Phase 4 final

| Milestone | Passed | Skipped | Total | Test files |
|-----------|--------|---------|-------|------------|
| Phase 1 (plan 04-01 baseline) | 161 | 2 | 163 | 20 |
| **Phase 4 final (this plan)** | **250** | **1** | **251** | **26** |

- The registry three-template skip (was `registry.spec.ts:109`) is now a **live passing test** — skip count dropped 2 → 1.
- The single remaining skip is the **pre-existing overwrite-e2e placeholder** at `tests/cli.spec.ts:111` (e2e deferred to a future plan; unit coverage exists in `tests/commands/create.spec.ts`). It was skipped before Phase 4 and is unrelated to this work.

Per-file verification this plan:
- `tests/registry.spec.ts` — 10 passed (was 8 live + 1 skip; now 10 live incl. new erc721 idempotency test).
- `tests/compiler/compile.integration.spec.ts` — 9 passed (7 happy-path fixtures + 2 error-path).
- `tests/commands/create.compile.spec.ts` — 5 passed (3 existing + 2 new ERC-721/ERC-1155).

## `node dist/cli.js list-templates` Output Snapshot

After `npm run build` (clean, `dist/cli.js 39.30 KB`):

```
┌──────────┬───────────────────────┬───────┬────────┬─────────────────────────────────────────────┐
│ ID       │ Name                  │ Chain │ Status │ Description                                   │
├──────────┼───────────────────────┼───────┼────────┼─────────────────────────────────────────────┤
│ erc20    │ ERC-20 Token          │ evm   │ alpha  │ Fungible token (ERC-20)… Mintable/Burnable/…  │
│ erc721   │ ERC-721 NFT           │ evm   │ alpha  │ Non-fungible token (ERC-721)… + EIP-2981 roy. │
│ erc1155  │ ERC-1155 Multi-Token  │ evm   │ alpha  │ Multi-token (ERC-1155)… Mintable/Burnable/…   │
└──────────┴───────────────────────┴───────┴────────┴─────────────────────────────────────────────┘
```

Three rows: erc20, erc721, erc1155 — all chain=evm, status=alpha (D-15 satisfied).

## Requirements + Success Criteria Traceability

| ID | Satisfied by | Verified in this plan |
|----|--------------|------------------------|
| ERC721-01 (name/symbol/baseUri) | 04-02 wizard + 04-01 fixture | E2E writes `contract MyNFT`; erc721 bare-default fixture compiles |
| ERC721-02 (Mintable/Enumerable/Burnable) | 04-02 generate | erc721 all-flags-on fixture compiles |
| ERC721-03 (EIP-2981 royalty) | 04-01 royalty.ts + 04-02 generate | erc721 all-flags-on-with-royalty fixture compiles (SC-2) |
| ERC721-04 (Pausable) | 04-02 wizard | erc721 all-flags-on fixture compiles |
| ERC721-05 (conditional access) | 04-02 wizard.spec | unit-tested in 04-02 |
| ERC1155-01 (name/uri) | 04-03 wizard + 04-01 fixture | E2E writes `contract MyMulti`; erc1155 bare-default compiles |
| ERC1155-02 (Mintable/Burnable) | 04-03 generate | erc1155 all-flags-on fixture compiles |
| ERC1155-03 (Supply) | 04-03 generate | erc1155 all-flags-on fixture compiles |
| ERC1155-04 (Pausable) | 04-03 generate | erc1155 all-flags-on fixture compiles |
| ERC1155-05 (conditional access) | 04-03 wizard.spec | unit-tested in 04-03 |
| SC-1 (generate ERC-721) | this plan | ERC-721 happy-path E2E test |
| SC-2 (EIP-2981 opt-in) | 04-01/04-02/this plan | with-royalty fixture in compile-integration |
| SC-3 (generate ERC-1155) | this plan | ERC-1155 happy-path E2E test |
| SC-4 (conditional access prompts) | 04-02/04-03 wizard.spec | not re-tested here (complex mock priming) |
| SC-5 (all 3 templates compile-verify) | this plan | 7-fixture describe.each, all clean |

## Deviations from Plan

None — plan executed exactly as written. Rules 1-4 not triggered.

Two notes (not deviations):
- Took the optional `it("is idempotent when registerErc721Template() is called twice")` test the plan's Task 1 action permitted; this is why `registry.spec.ts` reports 10 live tests rather than 9.
- The full-suite run prints expected `E_USAGE` stderr blocks (captured by negative-path assertions in `cli.spec.ts` / `create.spec.ts`) — these are asserted output, not failures.

## Verification Results
- `npx vitest run tests/registry.spec.ts` — 10 passed.
- `npx vitest run tests/compiler/compile.integration.spec.ts` — 9 passed.
- `npx vitest run tests/commands/create.compile.spec.ts` — 5 passed.
- `npx vitest run` (full suite) — **250 passed, 1 skipped (251)**, 26 files.
- `npm run typecheck` — clean (tsc --noEmit, 0 errors).
- `npm run build` (tsup) — clean (`dist/cli.js 39.30 KB`).
- `node dist/cli.js list-templates` — 3 rows (erc20, erc721, erc1155).
- `git diff src/cli.ts` — +4 lines, -0 lines.
- `git diff --name-only` over task commits — exactly the 4 plan `files_modified`.

## Constraints Honored
- D-12 additive-only: only `src/cli.ts` modified as source (boot wiring). No changes to `src/compiler/`, `src/registry/`, `src/lib/`, `src/commands/create.ts`, or any `src/templates/` file.
- All 7 integration fixtures compile clean via the unchanged Phase 3 gate (`evmVersion: cancun`).
- Vitest 4 ESM mock pattern reused verbatim for E2E cases.
- Did NOT push, update STATE.md/ROADMAP.md, or mark plan checkboxes (orchestrator handles at phase wrap).

## Self-Check: PASSED
- `04-04-SUMMARY.md` written and present on disk.
- Task commits `298da15`, `381577b`, `702d86e` all verified in git log.
- All 4 modified files present with the documented changes; full suite green.
