---
phase: 05
slug: deploy-md-generation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-29
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Planner-populated per-task rows below.

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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 0 | (ctor matrix) | T-05-01, T-05-02 | Ctor builders fixture-locked; no real key/address in source | unit | `npx vitest run tests/deploy/ctorArgs.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-T2 | 05-01 | 0 | DEPLOY-06 | T-05-03 | Single-source warnings; per-standard byte-locked bodies; critical subset == wizard | unit | `npx vitest run tests/deploy/warnings.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-T3 | 05-01 | 0 | (provenance) | — | readOwnVersion exported; no behavior change | unit | `npx vitest run tests/commands/create.compile.spec.ts -t "version line"` | ✅ | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | DEPLOY-02,03,04,07,08 | T-05-01, T-05-04 | Renderers emit placeholders only; --broadcast + full solc version; no local deep-link | unit (tsc) | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-02-T2 | 05-02 | 1 | DEPLOY-01,02,03,04,06,07,08 | T-05-01, T-05-03 | Deterministic golden snapshots; no 0x-address in any rendered doc | unit + snapshot | `npx vitest run tests/deploy/generate.spec.ts` | ❌ W0 | ⬜ pending |
| 05-03-T1 | 05-03 | 2 | DEPLOY-06 | T-05-03 | Wizard critical warnings byte-identical (parity lock); deployMeta? additive | unit | `npx vitest run tests/deploy/wizard-parity.spec.ts tests/templates` | ❌ W0 | ⬜ pending |
| 05-03-T2 | 05-03 | 2 | DEPLOY-01,02,03,04,06,07,08 | T-05-04, T-05-05, T-05-06, T-05-07 | Both files written only post-compile; both-file gate; no artifact on failure | e2e | `npx vitest run tests/commands/create.compile.spec.ts` | ❌ W0 | ⬜ pending |
| 05-04-T1 | 05-04 | 3 | (docs) | — | README traces to shipped files | unit (grep) | `node -e "..."` (in plan) | ❌ W0 | ⬜ pending |
| 05-04-T2 | 05-04 | 3 | DEPLOY-01..08 status | T-05-08 | DEPLOY-05 stays Pending; 7 ids Complete | unit (grep) | `node -e "..."` (in plan) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/deploy/types.ts` — `DeployMeta` + `CentralizationWarning` shapes (05-01 T1).
- [x] `src/deploy/warnings.ts` — `centralizationWarnings(meta)` single source of truth, D-03 hybrid (05-01 T2).
- [x] Constructor-arg builders verified against committed `.sol` fixtures (05-01 T1 — `tests/deploy/ctorArgs.spec.ts`).
- [x] DEPLOY.md golden fixtures under `tests/fixtures/deploy/` (05-02 T2 — generated then committed).
- [x] Freezable `now` injection (`generateDeployDoc(meta, { now })`) + exported `readOwnVersion` for deterministic snapshots (05-01 T3 + 05-02 T2).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DEPLOY.md written alongside .sol (real CLI run) | DEPLOY-01 | User-facing artifact confirmation | After `node dist/cli.js create --template erc20 --out /tmp/MyToken.sol`, confirm `MyToken.sol` and `MyToken.DEPLOY.md` both exist; open the DEPLOY.md and confirm Hardhat/Foundry/Remix/Etherscan sections + centralization warnings + provenance header present. (Automated coverage exists in 05-03 T2 E2E; this manual run is the human eyeball pass before `/gsd:verify-work`.) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-05-29
