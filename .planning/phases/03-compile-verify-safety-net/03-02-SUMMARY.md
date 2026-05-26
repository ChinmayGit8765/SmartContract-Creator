---
phase: 03
plan: 02
subsystem: compiler
tags: [compile, solc, imports, tests, tdd, wave-1]
requires: [03-01]
provides:
  - compileVerify(source, chain) — full evm body
  - makeImportCallback() — bundled OZ resolver + per-call cache + path-traversal guard
  - tests/compiler/compile.spec.ts (12 unit tests)
  - tests/compiler/compile.integration.spec.ts (4 integration tests, OZ-drift canary)
  - evmVersion="cancun" lock-in (overrides RESEARCH Pitfall 2 "paris" suggestion)
affects:
  - src/compiler/index.ts (placeholder throw replaced with real body)
  - src/compiler/imports.ts (skeleton replaced with resolver + guard)
tech_stack:
  added: []
  patterns:
    - top-level-dynamic-import-for-vitest-mocking
    - createRequire-resolver
    - per-call-closure-cache
    - normalize-sep-suffix-traversal-guard
    - CRLF-LF-normalization
key_files:
  created:
    - tests/compiler/compile.spec.ts
    - tests/compiler/compile.integration.spec.ts
  modified:
    - src/compiler/index.ts
    - src/compiler/imports.ts
decisions:
  - "evmVersion='cancun' (NOT 'paris') — confirmed in Plan 02 implementation; OZ 5.6.1 utils/Bytes.sol uses mcopy (Cancun-only opcode). The unit test 'calls solc.compile with the locked standard JSON shape' locks the literal string 'cancun' in StandardJsonInput.settings.evmVersion."
  - "Switch from createRequire('solc') to top-level await import('solc') in src/compiler/index.ts — empirically, Vitest 4's vi.mock('solc') does NOT intercept createRequire-based requires (the mock function was never called and real solc ran during the first test attempt). Top-level dynamic import with .default unwrap is Vitest-mockable AND production-CJS-interop-correct."
  - "Path-traversal guard uses normalize(root) + path.sep prefix check — the explicit sep suffix prevents '/tmp/oz-root' from prefix-matching '/tmp/oz-rootEXTRA' (defense-in-depth idiom)."
  - "Diagnostic partition collapses solc severity 'info' into the warning bucket (RESEARCH Pattern 3 line 379) — CompileDiagnostic.severity is the closed union {'error','warning'}; downstream consumers don't need to handle a third value."
  - "Per-call cache scope (D-05) locked by 'fresh instance has independent cache' unit test — different makeImportCallback() instances return different cached objects for the same path; no module-level cache means no cross-call leakage in tests."
metrics:
  duration: ~45 minutes
  completed_date: 2026-05-27
  tasks: 3
  files_created: 2
  files_modified: 2
  test_count: 16 (12 unit + 4 integration)
  test_runtime: ~2s
---

# Phase 3 Plan 02: Wave 1 — compileVerify Implementation Summary

One-liner: Implemented `compileVerify(source, chain)` and `makeImportCallback()` against real `solc@0.8.35` + `@openzeppelin/contracts@5.6.1`; 12 unit + 4 integration tests green; evmVersion="cancun" locked per Wave 0 discovery.

## What Shipped

### Task 1 (TDD RED→GREEN): makeImportCallback resolver

- `src/compiler/imports.ts` — placeholder skeleton replaced with full body:
  - `require.resolve("@openzeppelin/contracts/package.json")` → `dirname` → `ozRoot` (lazy, cached per instance)
  - Per-call `Map<string, {contents}>` cache (D-05)
  - **Path-traversal guard**: `if (fullPath !== normRoot && !fullPath.startsWith(normRoot + sep)) return { error: "Path traversal blocked: <path>" };` — T-03-03 mitigation
  - Synchronous return shape: `{ contents } | { error }` (Pitfall 1 lock)
- `tests/compiler/compile.spec.ts` — `describe("makeImportCallback")` block with 5 tests:
  1. resolves OZ paths from a temp cwd (Pitfall 3 proof)
  2. caches within instance (reference equality on second call)
  3. blocks `@openzeppelin/contracts/../../etc/passwd`-style traversal
  4. rejects unknown import prefixes
  5. fresh instance has independent cache (no module-level leakage)
- Commits: `1b0895c` (test RED) + `2de6b6b` (feat GREEN)

### Task 2 (TDD RED→GREEN): compileVerify evm body

- `src/compiler/index.ts` — placeholder `ERR_NOT_IMPLEMENTED` throw replaced with real implementation:
  - `loadSolc()` helper: `await import("solc")` then `.default ?? mod` for CJS-default interop AND vi.mock-ability
  - StandardJsonInput: `language: "Solidity"`, `sources: { "Contract.sol": { content: source } }`, `settings: { evmVersion: "cancun", outputSelection: { "*": { "*": ["abi"] } } }`
  - `normalizeDiagnostic`: CRLF→LF replace + severity collapse (`info`→`warning`)
  - Fresh `makeImportCallback()` per call (D-05)
  - Errors → `CliError({ code: ERR_COMPILE_FAILED, what: "Generated source failed to compile.", why: <joined formattedMessages> + version tail, fix: "...please report this...", exitCode: 1 })`
  - Warnings → `return { warnings }`
- `tests/compiler/compile.spec.ts` — `describe("compileVerify (mocked solc)")` block with 7 tests:
  1. chain='solana' throws E_NOT_IMPLEMENTED with Phase 7 pointer
  2. chain='evm' calls solc.compile with locked StandardJsonInput (asserts `evmVersion === "cancun"`)
  3. chain='evm' passes synchronous import callback (NOT a Promise — Pitfall 1)
  4. chain='evm' throws E_COMPILE_FAILED with ParserError + `Compile errors come from solc` tail in WHY
  5. chain='evm' returns warnings (no throw) for severity='warning' diagnostics
  6. chain='evm' normalizes CRLF→LF in formattedMessage (Pitfall 5)
  7. chain='evm' collapses severity 'info' into warning bucket
- Commits: `1540bb5` (test RED) + `a2fb59a` (feat GREEN)

### Task 3: Integration tests (real solc + real OZ)

- `tests/compiler/compile.integration.spec.ts` — 4 tests under one `describe`:
  1. `bare-default.sol` compiles clean (real OZ ERC20 import resolution)
  2. `all-flags-on.sol` compiles clean (Mintable/Burnable/Pausable/AccessControl)
  3. `broken.sol` throws E_COMPILE_FAILED with ParserError in WHY
  4. `warns-no-error.sol` surfaces ≥1 warning without throwing
- No `vi.mock` — this is the OZ-version drift canary (D-13 layer b)
- Runtime: 1.46s — under 5s budget; well within RESEARCH §Sampling Rate target
- Commit: `2a65faf`

## Pitfall 2 Lock-In: evmVersion="cancun" (Final)

Plan 03-01 SUMMARY documented the Wave-0 probe discovery that OZ 5.6.1 `utils/Bytes.sol` uses the Cancun-only `mcopy` opcode. Plan 02 made this the production lock:

- `src/compiler/index.ts` line 27: `const EVM_VERSION = "cancun" as const;` (top-level constant)
- Unit test 2 (compileVerify locked-shape): asserts `parsed.settings.evmVersion === "cancun"`
- Integration test 1+2: real solc with bundled "cancun" compiles both Phase 2 goldens with zero errors

**Plan 03 and beyond inherit "cancun"**. The RESEARCH §Pitfall 2 "paris" suggestion is officially superseded.

## Pitfall 6 Lock-In: warns-no-error.sol triggers a warning under solc 0.8.35

Plan 01 shipped `tests/fixtures/warns-no-error.sol` with `uint256 dead;` as the unused-local trigger. Integration test 4 confirms:

- `warnings.length >= 1`
- `warnings[0].severity === "warning"`
- `warnings[0].formattedMessage` contains the substring "warning" (case-insensitive)

**No fixture swap needed** — the unused-local trigger works under 0.8.35. Plan 03's E2E test design can rely on this fixture as the canonical warning-emitting input.

## Compile-time Measurements (informs Plan 03 spinner decision)

Integration suite total runtime: **1.46s** for 4 compile-verify invocations (~365ms per compile on average). The all-flags-on fixture (Mintable + Burnable + Pausable + AccessControl, ~10 OZ imports) is the heaviest case.

**Recommendation for Plan 03's E2E task**: spinner not strictly required at ~365–700ms per compile (the Wave 0 probe was 554ms; bare-default is faster, all-flags-on slightly slower). The wizard's own status output suffices. Re-evaluate if Phase 4 grows the template surface (e.g., AccessControlEnumerable, ERC4626) — those will push compile time past 1s and warrant a `@clack` spinner per the original CONTEXT discretion.

## Deviations from Plan

### Auto-applied during implementation

**1. [Rule 3 — Blocking issue] Switched from createRequire("solc") to top-level await import("solc")**
- **Found during:** Task 2 first GREEN attempt
- **Issue:** PATTERNS.md line 41 + plan action step 2 specified `const require = createRequire(import.meta.url); const solc = require("solc")`. Vitest 4's `vi.mock("solc", () => ({ default: { compile: vi.fn() } }))` did NOT intercept this — the mock function was never called and real solc ran. Test 2 (`calls solc.compile`) reported "expected vi.fn() to be called 1 times, but got 0 times".
- **Fix:** Refactored `src/compiler/index.ts` to use `async function loadSolc(): Promise<SolcModule> { const mod = (await import("solc")); return mod.default ?? mod; }` — top-level dynamic import that Vitest's module loader reliably intercepts AND that handles production CJS-default-export interop via the `.default ?? mod` fallback.
- **Production behavior:** Identical — solc-js's CJS module is loaded the same way Node's ESM-CJS interop layer handles `import()`.
- **Files modified:** `src/compiler/index.ts`
- **Commit:** `a2fb59a`

**2. [Rule 1 — Bug avoidance] evmVersion='cancun' instead of 'paris'**
- **Found during:** Plan 03-01 Wave 0 probe (already documented in 03-01-SUMMARY); propagated through Plan 02 explicitly.
- **Issue:** Plan 03-02 action lines 240, 262, 284, 291, 391 reference `evmVersion: "paris"` per RESEARCH Pitfall 2. Wave 0 probe proved "paris" fails with 4 mcopy-not-available errors.
- **Fix:** Locked `EVM_VERSION = "cancun"` as a named module-level constant in `src/compiler/index.ts`; unit test 2 asserts the literal string "cancun".
- **Files modified:** `src/compiler/index.ts`, `tests/compiler/compile.spec.ts`
- **Commit:** `a2fb59a`

**3. [Verify-block escape mismatch — non-blocking] Plan's Task 2 automated verify regex `/\\\\r\\\\n/` does not match the source's `/\r\n/g` regex literal**
- **Found during:** Task 2 verify run
- **Issue:** The verify line `node -e "...if(!/\\\\r\\\\n/.test(s)) process.exit(1)..."` after bash + node parses to a regex that matches the 2-byte sequence `<CR><LF>` (actual carriage-return + line-feed bytes), not the 4-character text `\r\n`. Source files written with LF endings never contain literal CRLF bytes, so the regex never matches even when CRLF normalization IS present (as confirmed by grep `\\r\\n` matching lines 76 and 79 of `src/compiler/index.ts`).
- **Fix:** No fix needed — the actual CRLF normalization is implemented and tested (unit test 6 verifies it works at runtime). This is a planner-side escape-quoting bug in the verify command, not a code bug. Documented here for the verifier; do not block on it.
- **Files modified:** none

## Authentication Gates

None.

## Threat Flags

T-03-03 (path-traversal) mitigation IS implemented in `src/compiler/imports.ts` lines 71-74, locked by unit test 3 (`blocks path traversal attempts`). No new threat surface introduced.

## Test Suite Delta

- Before Plan 02: 132 passed, 4 failed, 1 skipped (137 total)
- After Plan 02: 148 passed, 4 failed, 1 skipped (153 total)
- New: 16 tests in `tests/compiler/`
- Same 4 failures: `tests/version.spec.ts` "solc not bundled" / "@openzeppelin/contracts not bundled" assertions — Plan 03 Task 4 flips these per Plan 01 expected-delta note

## Self-Check: PASSED

- FOUND: `src/compiler/imports.ts` (with require.resolve + traversal guard)
- FOUND: `src/compiler/index.ts` (with loadSolc + evmVersion="cancun" + CliError)
- FOUND: `tests/compiler/compile.spec.ts` (12 tests passing)
- FOUND: `tests/compiler/compile.integration.spec.ts` (4 tests passing)
- FOUND commit: `1b0895c` (test: makeImportCallback RED)
- FOUND commit: `2de6b6b` (feat: makeImportCallback GREEN)
- FOUND commit: `1540bb5` (test: compileVerify RED)
- FOUND commit: `a2fb59a` (feat: compileVerify GREEN)
- FOUND commit: `2a65faf` (test: integration)
- `npm run typecheck` → exit 0
- `npm run build` → exit 0 (dist/cli.js 17.59 KB)
- `npx vitest run tests/compiler/` → 16/16 passing
- `npx vitest run` → 148 passing / 4 known-expected failing (version.spec.ts) / 1 skipped
