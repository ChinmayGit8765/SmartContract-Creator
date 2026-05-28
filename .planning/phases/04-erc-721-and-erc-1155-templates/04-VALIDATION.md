---
phase: 04
slug: erc-721-and-erc-1155-templates
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
updated: 2026-05-28
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Planner has populated the per-task rows below. Verifier checks coverage during `/gsd:verify-work`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (Phase 1 stack) |
| **Config file** | `vitest.config.ts` (Phase 1) |
| **Quick run command** | `npx vitest run tests/templates/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~12–18 seconds (Phase 3 baseline ~10s + 5 new fixtures + 2 template suites) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/templates/` for template work, `npx vitest run tests/compiler/` for compile integration extensions.
- **After every plan wave:** Run `npx vitest run` (full suite).
- **Before `/gsd:verify-work`:** Full suite must be green AND `npm run build` clean AND `node dist/cli.js list-templates` shows 3 rows (erc20, erc721, erc1155).
- **Max feedback latency:** 18 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 0 | ERC721-03 | T-04-01-01 | injectRoyalty bracket-counting walker — anchors 1/2/3/4 fire correctly across bare/ownable/all-flags wizard outputs | unit (TS strict) | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 04-01-T2 | 04-01 | 0 | ERC721-01..04, ERC1155-01..04 | T-04-01-03 | 5 fixtures generated via wizard + LF-encoded; E_USAGE copy lists three templates; registry test has stub for three-template assertion | integration | `npx vitest run tests/registry.spec.ts tests/commands/create.spec.ts` | ❌ W0 | ⬜ pending |
| 04-01-T3 | 04-01 | 0 | ERC721-03 | T-04-01-01, T-04-01-02 | royalty.spec.ts validates injectRoyalty against three real wizard outputs + Phase 3 compile gate | integration (real solc) | `npx vitest run tests/templates/erc721/royalty.spec.ts` | ❌ W0 | ⬜ pending |
| 04-02-T1 | 04-02 | 1 | ERC721-01..05 | T-04-02-01 | Erc721Opts + 5 validators + filename re-export + barrel — typecheck clean | unit (TS strict) | `npm run typecheck` | ❌ W1 | ⬜ pending |
| 04-02-T2 | 04-02 | 1 | ERC721-01..05 | T-04-02-01..07 | wizard 9+2+1 prompts; generate.ts wires injectRoyalty conditionally; 3 centralization warnings | unit (TS strict) | `npm run typecheck` | ❌ W1 | ⬜ pending |
| 04-02-T3 | 04-02 | 1 | ERC721-01..05 | T-04-02-01..07 | wizard.spec.ts (mocked clack, happy + cancel), generate.spec.ts (3 snapshots + per-flag), validators.spec.ts (boundary cases) | unit + snapshot | `npx vitest run tests/templates/erc721/` | ❌ W1 | ⬜ pending |
| 04-03-T1 | 04-03 | 1 | ERC1155-01..05 | T-04-03-01 | Erc1155Opts + 2 validators + filename re-export + barrel — typecheck clean | unit (TS strict) | `npm run typecheck` | ❌ W1 | ⬜ pending |
| 04-03-T2 | 04-03 | 1 | ERC1155-01..05 | T-04-03-01..06 | wizard 7 prompts; generate.ts passes updatableUri:true literal; 3 warnings (2 conditional + 1 always-on) | unit (TS strict) | `npm run typecheck` | ❌ W1 | ⬜ pending |
| 04-03-T3 | 04-03 | 1 | ERC1155-01..05 | T-04-03-01..06 | wizard.spec.ts (mocked clack), generate.spec.ts (2 snapshots + per-flag), validators.spec.ts (isNonEmptyUri boundaries) | unit + snapshot | `npx vitest run tests/templates/erc1155/` | ❌ W1 | ⬜ pending |
| 04-04-T1 | 04-04 | 2 | ERC721-01, ERC1155-01 | T-04-04-01 | src/cli.ts +4 lines (2 imports + 2 register calls); tests/registry.spec.ts flips it.skip → it; build succeeds | integration | `npx vitest run tests/registry.spec.ts && npm run build` | ❌ W2 | ⬜ pending |
| 04-04-T2 | 04-04 | 2 | ERC721-01..04, ERC1155-01..04 (SC-5) | T-04-04-02 | compile.integration.spec.ts refactored to describe.each(FIXTURES) with 7 happy-path rows; 2 error-path rows preserved | integration (real solc) | `npx vitest run tests/compiler/compile.integration.spec.ts` | ❌ W2 | ⬜ pending |
| 04-04-T3 | 04-04 | 2 | ERC721-01, ERC1155-01 (SC-1, SC-3) | T-04-04-04 | 2 new E2E happy-path tests via primeErc721 + primeErc1155 helpers; full dispatcher pipeline exercised | E2E | `npx vitest run tests/commands/create.compile.spec.ts` | ❌ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Wave 0 royalty post-process probe (4-anchor bracket-counting walker) — Plan 04-01 Task 1.
- [ ] 5 golden fixtures committed: `tests/fixtures/erc721/bare-default.sol`, `all-flags-on.sol`, `all-flags-on-with-royalty.sol`, `tests/fixtures/erc1155/bare-default.sol`, `all-flags-on.sol` — Plan 04-01 Task 2.
- [ ] `src/commands/create.ts` E_USAGE fix-copy line updated to list `<erc20|erc721|erc1155>` — Plan 04-01 Task 2.
- [ ] `tests/registry.spec.ts` three-template registration test stub (it.skip from plan 04-01 Task 2; flipped to live in plan 04-04 Task 1).
- [ ] `tests/templates/erc721/royalty.spec.ts` validates 4-anchor walker against 3 real wizard outputs + Phase 3 gate — Plan 04-01 Task 3.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `smartc list-templates` shows three templates after boot wiring | ERC721-01, ERC1155-01 | User-facing surface confirmation — exits via `process.exit`, not testable in-process | `npm run build && node dist/cli.js list-templates` — expect erc20, erc721, erc1155 rows (Plan 04-04 Task 1 verification) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 18s (est ~12-18s full suite after Phase 4)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner — 2026-05-28
