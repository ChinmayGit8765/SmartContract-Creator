---
phase: 03
plan: 01
subsystem: compiler
tags: [compile, solc, openzeppelin, wave-0, dependencies, scaffold]
requires: []
provides:
  - solc-0.8.35 dependency pinned
  - "@openzeppelin/contracts-5.6.1 dependency pinned"
  - ERR_COMPILE_FAILED error code constant
  - compileVerify(source, chain) seam (skeleton)
  - makeImportCallback() seam (skeleton)
  - CompileDiagnostic / StandardJsonInput / SolcOutput types
  - scripts/probe-compile.mjs (cwd-independence validator)
  - tests/fixtures/broken.sol (ParserError fixture)
  - tests/fixtures/warns-no-error.sol (unused-local warning fixture)
  - evmVersion-cancun discovery (overrides RESEARCH Pitfall 2 "paris" guess)
affects:
  - src/lib/errors.ts (additive)
  - package.json + package-lock.json
tech_stack:
  added: [solc@0.8.35, @openzeppelin/contracts@5.6.1]
  patterns: [createRequire-ESM-bridge, dual-strategy-resolver, synchronous-import-callback, readonly-type-discipline]
key_files:
  created:
    - src/compiler/index.ts
    - src/compiler/imports.ts
    - src/compiler/types.ts
    - scripts/probe-compile.mjs
    - tests/fixtures/broken.sol
    - tests/fixtures/warns-no-error.sol
  modified:
    - package.json
    - package-lock.json
    - src/lib/errors.ts
decisions:
  - "Pin solc@0.8.35 exact (no caret) — golden-fixture stability, deterministic formatVersionLine, predictable EVM defaults"
  - "Pin @openzeppelin/contracts@5.6.1 exact — supply-chain audit + reproducibility"
  - "evmVersion: 'cancun' (NOT 'paris' as RESEARCH initially suggested) — OZ 5.6.1 utils/Bytes.sol uses mcopy (Cancun-only opcode); Wave 0 probe attempts with 'paris' produced 4 mcopy-not-available errors. Cancun shipped on mainnet 2024-03-13 and is broadly deployed across L1+L2. This is the Wave-0-discovered EVM-target floor; plans 02+ inherit this constant."
  - "Plan 01 evm branch throws CliError(ERR_NOT_IMPLEMENTED) intentionally — NOT a silent return — so Plan 02 must consciously remove the placeholder rather than accidentally ship a no-op compile gate"
  - "Cache scope: per-CALL closure (D-05) — new compileVerify() invocation creates fresh cache, no cross-call leakage in tests"
metrics:
  duration: ~75 minutes (resumed)
  completed_date: 2026-05-26
  tasks: 3
  files_created: 6
  files_modified: 3
---

# Phase 3 Plan 01: Wave 0 — Compile-Verify Foundation Summary

One-liner: Installed `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` at exact pins, validated cwd-independent compile via Wave 0 probe (errors=0, warnings=5, elapsed=554ms), and scaffolded `src/compiler/` module with locked seams + TODO(03-02) insertion points.

## What Shipped

### Dependencies (Task 1)

- `package.json` `dependencies` now contains exact pins (no `^`):
  - `@openzeppelin/contracts: "5.6.1"`
  - `solc: "0.8.35"`
- `package-lock.json` regenerated and committed; integrity hashes captured.
- `src/lib/errors.ts` gained one additive constant: `ERR_COMPILE_FAILED = "E_COMPILE_FAILED" as const` (Phase 3 addition block; existing constants byte-identical).
- Threat T-03-SC (supply-chain): mitigated — both packages [VERIFIED] via official upstream repos per RESEARCH §Package Legitimacy Audit; no blocking-human checkpoint required.

### Wave 0 Probe (Task 2)

- `scripts/probe-compile.mjs` — 100-line cwd-independent probe; `mkdtempSync` + `chdir` BEFORE `require.resolve("@openzeppelin/contracts/package.json")` per Pitfall 3.
- Probe output (latest run):
  ```
  solc 0.8.35+commit.47b9dedd.Emscripten.clang (cwd=C:\Users\chinm\AppData\Local\Temp\smartc-probe-f4agGq)
    bare-default.sol: errors=0 warnings=5 elapsed=554ms
  PROBE PASSED
  ```
- **Measured elapsed: ~554ms** (range observed across runs: 554–700ms). This is the key data point for Plan 03's spinner decision: ≥500ms threshold suggests a `compiling…` spinner during `smartc create`. Plan 03 task list assumes spinner-not-required (the wizard already prints status); revisit if Phase 3 UX testing shows the half-second pause feels stuttery.
- **Measured warnings: 5** (non-zero). These are the well-known SPDX/version-pragma reminders + OZ deprecation notes that solc 0.8.31+ surfaces. They are not flooded (limit is 1–5 per AC) and inform Pitfall 6 fixture choice — Plan 02 integration test for `warns-no-error.sol` is expected to detect the `uint256 dead;` unused-local; if 0.8.35 surprises us (no warning emitted from the warns fixture), swap to `assert(false)` per Plan 01 task action note.

### Compiler Module Scaffold (Task 3)

- `src/compiler/types.ts` — `Severity`, `CompileDiagnostic`, `StandardJsonInput`, `SolcOutput`. All fields `readonly`; `StandardJsonInput.language` is literal `"Solidity"`; `CompileDiagnostic.severity` is closed union `"error" | "warning"`.
- `src/compiler/index.ts` — `compileVerify(source, chain)` skeleton:
  - **solana branch FINAL**: `throw new CliError({ code: ERR_NOT_IMPLEMENTED, what: "Solana compile-verify is not implemented yet.", why: "SPL templates ship in Phase 7…", fix: "Generate an EVM template…", exitCode: 1 })` — locked per CONTEXT D-06.
  - **evm branch SKELETON**: explicit `throw new CliError({ code: ERR_NOT_IMPLEMENTED, what: "EVM compile-verify body lands in Plan 02." …})` — NOT a silent return. Plan 02 must consciously replace.
  - Inline TODO(03-02) comment with the full solc.compile body sketch + the `evmVersion: "cancun"` Wave-0 discovery callout.
- `src/compiler/imports.ts` — `makeImportCallback()` skeleton:
  - createRequire bridge, per-call `ozRoot` + `cache` closure (D-05).
  - Returns `(_path) => ({ error: "Plan 02 not yet implemented" })` for all inputs.
  - TODO(03-02) insertion point with explicit path-traversal guard sketch: `normalize(join(ozRoot, sub)).startsWith(normalize(ozRoot))` (T-03-03 mitigation slot).
- `tests/fixtures/broken.sol` — 7-line LF-only ParserError fixture with `uint256 x = ;`.
- `tests/fixtures/warns-no-error.sol` — 10-line LF-only unused-local warning fixture.

## Pitfall 2 Lock-In Override (Wave-0 Discovery)

RESEARCH §Pitfall 2 originally recommended `evmVersion: "paris"`. The Wave 0 probe attempted this and produced **4 mcopy-not-available errors** sourced from `@openzeppelin/contracts/utils/Bytes.sol` (the `mcopy` opcode is Cancun-only). Bumped to `evmVersion: "cancun"` — probe immediately passed (errors=0).

**Implication for Plan 02:** The locked `StandardJsonInput.settings.evmVersion` value is `"cancun"`, NOT `"paris"`. Cancun shipped on mainnet 2024-03-13 and is broadly deployed across L1+L2 — this is a safe floor. The discovery is documented inline in:
- `scripts/probe-compile.mjs` lines 15–20 (full explanation)
- `src/compiler/index.ts` lines 76–78 (TODO(03-02) precondition note)

Plan 02 MUST pin `"cancun"` in the StandardJsonInput; downstream plans inherit this constant.

## Expected Test-Suite Delta

Per Plan 01 AC + RESEARCH §Code Examples lines 559-577: installing solc + @openzeppelin/contracts flips `safeReadVersion("solc")` and `safeReadVersion("@openzeppelin/contracts")` from `null` to `"0.8.35"` / `"5.6.1"`. This means three `tests/version.spec.ts` assertions WILL FAIL after this plan:

- Line 15–17: `returns null for solc in Phase 1`
- Line 19–21: `returns null for @openzeppelin/contracts`
- Lines 40–44: `reports the two Phase-3-gated deps as 'not bundled'`

**THIS IS EXPECTED**. Plan 03 Task 4 (Wave 2) flips these assertions to assert the real pinned versions. Do NOT edit `tests/version.spec.ts` until Plan 03.

## Deviations from Plan

### Auto-applied during scaffold authoring

**1. [Rule 1 — Bug avoidance] evmVersion: "cancun" instead of "paris"**
- **Found during:** Task 2 (Wave 0 probe execution)
- **Issue:** RESEARCH Pitfall 2 recommended `"paris"`, but OZ 5.6.1's `utils/Bytes.sol` uses `mcopy` (Cancun-only). Probe with `"paris"` produced 4 compile errors.
- **Fix:** Locked in `"cancun"` in `scripts/probe-compile.mjs`; documented in `src/compiler/index.ts` TODO(03-02) so Plan 02 inherits the corrected constant.
- **Files modified:** `scripts/probe-compile.mjs`, `src/compiler/index.ts`
- **Commit:** `ef9b2ac` (probe), `5a3d21f` (scaffold)

**2. [Rule 2 — Critical functionality slot] Plan 01 evm branch is an explicit `throw`, not a return-empty stub**
- **Found during:** Task 3 (skeleton authoring)
- **Issue:** A return-`{ warnings: [] }` stub would silently pass through bad source code, breaking the compile gate's load-bearing role for the 02-03 wave (E2E happy/fail tests need a real refusal point).
- **Fix:** Explicit `throw new CliError(ERR_NOT_IMPLEMENTED)` so any premature caller (test or dispatcher) fails loudly until Plan 02 removes the placeholder.
- **Commit:** `5a3d21f`

## Authentication Gates

None.

## Threat Flags

None — Plan 01 ships only structural skeletons. Plan 02 implements the path-traversal guard (T-03-03 mitigation slot) before any real `readFileSync` lands.

## Self-Check: PASSED

- FOUND: `src/compiler/index.ts`
- FOUND: `src/compiler/imports.ts`
- FOUND: `src/compiler/types.ts`
- FOUND: `scripts/probe-compile.mjs`
- FOUND: `tests/fixtures/broken.sol`
- FOUND: `tests/fixtures/warns-no-error.sol`
- FOUND commit: `35490b2` (chore: pin deps + ERR_COMPILE_FAILED)
- FOUND commit: `ef9b2ac` (feat: Wave 0 probe)
- FOUND commit: `5a3d21f` (feat: compiler skeleton + fixtures)
- `npm run typecheck` → exit 0
- `node scripts/probe-compile.mjs` → exit 0, "PROBE PASSED", errors=0, warnings=5, elapsed=554ms
- `package.json` deps: `solc: "0.8.35"`, `@openzeppelin/contracts: "5.6.1"` (verified via inspection)
