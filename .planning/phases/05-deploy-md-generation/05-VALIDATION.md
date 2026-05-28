---
phase: 05
slug: deploy-md-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Skeleton — planner populates the per-task rows during PLAN.md creation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (Phase 1 stack) |
| **Config file** | `vitest.config.ts` (Phase 1) |
| **Quick run command** | `npx vitest run tests/deploy/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~14–20 seconds (Phase 4 baseline + deploy section tests + DEPLOY.md golden snapshots) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/deploy/` for deploy-module work.
- **After every plan wave:** Run `npx vitest run` (full suite).
- **Before `/gsd:verify-work`:** Full suite green AND `npm run build` clean AND a real `create` run produces both `<Name>.sol` and `<Name>.DEPLOY.md`.
- **Max feedback latency:** 20 seconds.

---

## Per-Task Verification Map

> Planner populates per-task rows during PLAN.md creation.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | _(planner fills)_ | _(planner fills)_ | DEPLOY-01..08 | T-05-* | _(planner fills)_ | unit / integration / e2e | _(planner fills)_ | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/deploy/types.ts` — `DeployMeta` + `CentralizationWarning` shapes.
- [ ] `src/deploy/warnings.ts` — `centralizationWarnings(meta)` single source of truth (D-03 hybrid refactor).
- [ ] Constructor-arg builders verified against committed `.sol` fixtures (RESEARCH constructor matrix).
- [ ] DEPLOY.md golden fixtures under `tests/fixtures/deploy/`.
- [ ] Freezable `now` injection + exported `readOwnVersion` for deterministic snapshots (RESEARCH open question).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DEPLOY.md written alongside .sol | DEPLOY-01 | User-facing artifact confirmation | After a `create` run, confirm `<Name>.sol` and `<Name>.DEPLOY.md` both exist; open the DEPLOY.md and confirm Hardhat/Foundry/Remix/Etherscan sections + centralization warnings present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
