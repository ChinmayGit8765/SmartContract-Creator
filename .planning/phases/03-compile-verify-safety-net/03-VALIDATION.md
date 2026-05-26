---
phase: 03
slug: compile-verify-safety-net
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
plans_locked: 2026-05-26
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Planner has populated
> the per-task rows below. Verifier flips `nyquist_compliant: true` after the suite stays green.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (Phase 1 stack) |
| **Config file** | `vitest.config.ts` (Phase 1 — implicit defaults with `passWithNoTests: true`) |
| **Quick run command** | `npx vitest run tests/compiler/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10–15 seconds (Phase 2 baseline ~9s + ~3-5s for new compile integration + 5 e2e tests with real solc) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/compiler/` (quick layer, mocked solc; sub-second).
- **After every plan wave:** Run `npx vitest run` (full suite, includes integration tests with real solc).
- **Before `/gsd:verify-work`:** Full suite must be green AND `npm run build` clean AND `node dist/cli.js --version` surfaces `solc 0.8.35` + `@openzeppelin/contracts 5.6.1`.
- **Max feedback latency:** 15 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 0 | COMP-01, COMP-05 | T-03-01, T-03-02, T-03-SC | Pinned exact versions of solc + @oz/contracts installed via npm; package-lock integrity hashes recorded; ERR_COMPILE_FAILED constant added | smoke (no vitest yet — deps + constant only) | `npm install && node -e "..."` (verifies pkg pins + ERR_COMPILE_FAILED literal) | ❌ W0 | ⬜ pending |
| 03-01-T2 | 03-01 | 0 | COMP-05 | T-03-03 (resolver foundation), T-03-07 (sync callback foundation) | Probe asserts cwd-independence of bundled OZ resolver; sync callback shape proven before any production code consumes it | probe (one-shot node script) | `node scripts/probe-compile.mjs` (must print `PROBE PASSED`, `errors=0`) | ❌ W0 | ⬜ pending |
| 03-01-T3 | 03-01 | 0 | COMP-01, COMP-05 | T-03-03 (skeleton with traversal-guard TODO) | Compiler module skeleton scaffolded with type contracts so downstream plans import from a stable surface; broken/warns fixtures committed | unit (typecheck + node existsSync sanity) | `npm run typecheck && node -e "..."` (verifies 5 files exist + 4 exported types) | ❌ W0 | ⬜ pending |
| 03-02-T1 | 03-02 | 1 | COMP-05 | T-03-03 | Import callback resolves `@openzeppelin/contracts/*` cwd-independently; per-call cache; path-traversal guard blocks `../etc/passwd` style payloads | unit (5 cases, no solc mock needed) | `npx vitest run tests/compiler/compile.spec.ts -t "makeImportCallback"` | ❌ W0 | ⬜ pending |
| 03-02-T2 | 03-02 | 1 | COMP-01, COMP-02 (seam), COMP-03, COMP-04 | T-03-05, T-03-07 | `compileVerify(source, chain)` standard JSON input shape locked; sync callback contract; error→throw mapping; warning pass-through; `chain="solana"` throws E_NOT_IMPLEMENTED with Phase 7 pointer (seam coverage) | unit (mocked solc — 7 cases) | `npx vitest run tests/compiler/compile.spec.ts -t "compileVerify"` | ❌ W0 | ⬜ pending |
| 03-02-T3 | 03-02 | 1 | COMP-01, COMP-03, COMP-04, COMP-05 | T-03-05 | Real solc + real OZ — bare-default + all-flags-on compile clean (OZ-drift canary); broken.sol throws; warns-no-error.sol surfaces warnings without throwing | integration (real solc, 4 cases) | `npx vitest run tests/compiler/compile.integration.spec.ts` | ❌ W0 | ⬜ pending |
| 03-03-T1 | 03-03 | 2 | COMP-01, COMP-03, COMP-04, COMP-05 | T-03-09, T-03-12 | Dispatcher splice at create.ts:95 in the correct order (compile BEFORE confirmOverwrite per D-07); D-12 footer surfaces real pinned versions | unit (source-order + typecheck + Phase 2 suite stays green) | `npm run typecheck && npm run build && npx vitest run tests/commands/create.spec.ts` | ❌ W0 | ⬜ pending |
| 03-03-T2 | 03-03 | 2 | COMP-01, COMP-03, COMP-04, COMP-05 | T-03-11, T-03-12 | E2E happy path with real solc: file written, footer shows real versions; warning fixture surfaces via output.warn; --version line locks real pins | e2e (in-process dispatcher, 3 cases) | `npx vitest run tests/commands/create.compile.spec.ts` | ❌ W0 | ⬜ pending |
| 03-03-T3 | 03-03 | 2 | COMP-03 | T-03-10, T-03-12 | D-15 load-bearing: broken template injected via registry seam; dispatcher throws E_COMPILE_FAILED; NO file on disk; CliError WHY block contains solc ParserError + version tail | e2e (in-process, D-15, 2 cases) | `npx vitest run tests/commands/create.compile-fail.spec.ts` | ❌ W0 | ⬜ pending |
| 03-03-T4 | 03-03 | 2 | COMP-05 | T-03-12 | `tests/version.spec.ts` flipped from Phase 2 "not bundled" assertions to exact-pin assertions (`solc 0.8.35` + `@openzeppelin/contracts 5.6.1`); full suite green | unit (assertion flip) | `npx vitest run tests/version.spec.ts && npx vitest run` | ❌ W0 | ⬜ pending |
| 03-04-T1 | 03-04 | 3 | COMP-01, COMP-03, COMP-04, COMP-05 | T-03-13 | `src/compiler/README.md` documents architecture, pinning rationale, fixture roles, version-bump procedure | docs (structural grep + line-count) | `node -e "..."` (8 section heading checks + version/code constant references) | ❌ W0 | ⬜ pending |
| 03-04-T2 | 03-04 | 3 | COMP-01, COMP-03, COMP-04, COMP-05 | T-03-14 | ROADMAP.md Phase 3 finalized (4 plans, 4 waves); REQUIREMENTS.md traceability mapping preserved | docs (literal-string assertions) | `node -e "..."` (grep ROADMAP for 03-04-PLAN.md + `0/4`; REQUIREMENTS for Phase 3 mapping) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (all delivered by Plan 03-01)

- [x] `scripts/probe-compile.mjs` — confirms `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` + import-callback compiles `tests/fixtures/erc20/bare-default.sol` clean from an arbitrary cwd (Plan 03-01 Task 2)
- [x] `src/compiler/index.ts` skeleton + `compileVerify(source, chain)` signature for downstream waves to import against (Plan 03-01 Task 3)
- [x] `src/compiler/types.ts` — `CompileDiagnostic` shape (Plan 03-01 Task 3)
- [x] `src/compiler/imports.ts` skeleton with TODO insertion point — Plan 03-02 Task 1 implements full resolver + path-traversal guard (Plan 03-01 Task 3 ships skeleton)
- [x] `tests/fixtures/broken.sol` (Plan 03-01 Task 3)
- [x] `tests/fixtures/warns-no-error.sol` (Plan 03-01 Task 3)
- [x] `ERR_COMPILE_FAILED` added to `src/lib/errors.ts` (Plan 03-01 Task 1)
- [x] `package.json` deps include `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` (Plan 03-01 Task 1)

Note: checkboxes marked [x] indicate the requirement is COVERED BY A PLANNED TASK; execution actually flips `File Exists` from ❌ to ✅ as tasks ship.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end compile gate visible to user via `--version` | SC-5 (visible versions) | The user-facing surface for COMP-05; visual check confirms wording matches D-12 | After Plan 03-03 completes: `node dist/cli.js --version`; expect output to contain `solc 0.8.35` and `@openzeppelin/contracts 5.6.1` (also auto-locked by `tests/version.spec.ts` per 03-03 Task 4 — manual entry preserved as the user-facing confirmation) |

---

## Sampling Continuity Check

Verifying no 3-task gap without automated coverage:

- 03-01-T1: smoke (npm install + literal check)
- 03-01-T2: probe (node script)
- 03-01-T3: unit-shaped (typecheck + existsSync)
- 03-02-T1: unit (5 cases)
- 03-02-T2: unit (7 cases)
- 03-02-T3: integration (4 cases)
- 03-03-T1: unit + typecheck + Phase 2 suite
- 03-03-T2: e2e (3 cases)
- 03-03-T3: e2e (2 cases, D-15)
- 03-03-T4: unit (assertion flip) + full suite
- 03-04-T1: docs (structural grep)
- 03-04-T2: docs (literal grep)

No gap exceeds 1 task without an automated check. Pass.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner populated)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 03-01 ships every deliverable downstream depends on)
- [x] No watch-mode flags
- [x] Feedback latency < 15s (full suite estimated 10-15s including new real-solc layers)
- [ ] `nyquist_compliant: true` set in frontmatter (verifier flips this once all rows are green)

**Approval:** planner-locked; awaiting execution.
