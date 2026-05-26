---
phase: 03
slug: compile-verify-safety-net
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Skeleton — planner populates the per-task rows during PLAN.md creation, then the verifier checks coverage.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (Phase 1 stack) |
| **Config file** | `vitest.config.ts` (Phase 1) |
| **Quick run command** | `npx vitest run tests/compiler/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10–15 seconds (Phase 2 baseline ~9s + ~1–3s for new compile integration tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/compiler/` (quick layer, mocked solc; sub-second).
- **After every plan wave:** Run `npx vitest run` (full suite, includes integration tests with real solc).
- **Before `/gsd:verify-work`:** Full suite must be green AND `npm run build` clean.
- **Max feedback latency:** 15 seconds.

---

## Per-Task Verification Map

> Populated by the planner during PLAN.md creation. Each task row maps a requirement (COMP-01..COMP-05) and threat-model reference (from PLAN.md `<threat_model>`) to an automated verification command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | _(planner fills)_ | _(planner fills)_ | COMP-01..05 | T-03-* | _(planner fills)_ | unit / integration / e2e | _(planner fills)_ | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/probe-compile.mjs` — confirms `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` + import-callback compiles `tests/fixtures/erc20/bare-default.sol` clean from an arbitrary cwd (the SC-5 / COMP-05 deliverable).
- [ ] `src/compiler/index.ts` skeleton + `compileVerify(source, chain)` signature for downstream waves to import against.
- [ ] `src/compiler/types.ts` — `CompileDiagnostic` shape.
- [ ] `src/compiler/imports.ts` — bundled-dep import callback + path-traversal guard.
- [ ] `tests/fixtures/broken.sol` — deliberately broken Solidity for failure-path tests.
- [ ] `ERR_COMPILE_FAILED` added to `src/lib/errors.ts`.
- [ ] `package.json` deps include `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` (exact pins).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end compile gate visible to user | SC-5 (visible versions) | The `--version` line is the user-facing surface for COMP-05; visual check confirms wording | Run `node dist/cli.js --version`; expect `solc 0.8.35, @openzeppelin/contracts 5.6.1` in output |

*Note: the manual check is also automated via `tests/version.spec.ts` per Phase 2's locked test pattern — keep it listed manually as the user-facing surface check, automated coverage is also planned.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner populates during PLAN.md)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (verifier flips this once all rows are green)

**Approval:** pending
