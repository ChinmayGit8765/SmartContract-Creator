---
phase: 04
slug: erc-721-and-erc-1155-templates
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Skeleton — planner populates the per-task rows during PLAN.md creation, then the verifier checks coverage.

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

> Planner populates per-task rows during PLAN.md creation.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | _(planner fills)_ | _(planner fills)_ | ERC721-01..05 / ERC1155-01..05 | T-04-* | _(planner fills)_ | unit / integration / e2e | _(planner fills)_ | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Wave 0 royalty post-process probe (4-anchor bracket-counting walker) — Plan 04-01.
- [ ] 5 golden fixtures committed: `tests/fixtures/erc721/bare-default.sol`, `all-flags-on.sol`, `all-flags-on-with-royalty.sol`, `tests/fixtures/erc1155/bare-default.sol`, `all-flags-on.sol`.
- [ ] `src/commands/create.ts` E_USAGE fix-copy line updated to list `<erc20|erc721|erc1155>`.
- [ ] `tests/registry.spec.ts` (or equivalent) extended to verify all three templates register without collision.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `smartc list-templates` shows three templates | ERC721-01, ERC1155-01 | User-facing surface confirmation | `node dist/cli.js list-templates` — expect erc20, erc721, erc1155 rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 18s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
