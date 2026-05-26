---
phase: 03
plan: 03
subsystem: dispatcher
tags: [dispatcher, splice, e2e, tdd, wave-2]
requires: [03-02]
provides:
  - src/commands/create.ts spliced with compileVerify gate at line 95+
  - D-12 footer surfacing real solc + @oz/contracts versions
  - chain='any' refusal guard (Rule 2 — registration inconsistency safety)
  - tests/commands/create.compile.spec.ts (E2E happy path, 3 tests)
  - tests/commands/create.compile-fail.spec.ts (E2E D-15 load-bearing, 2 tests)
  - tests/version.spec.ts flipped to real pinned versions
  - tests/cli.spec.ts --version e2e flipped to real pinned versions (out-of-scope fix)
affects:
  - src/commands/create.ts
  - tests/commands/create.spec.ts (splice-marker test rewritten)
tech_stack:
  added: []
  patterns:
    - registry-injection-test-only-template
    - dual-rejects-toMatchObject-plus-try-catch
    - in-process-program-parseAsync-no-dist-spawn
    - stdout+stderr-capture-helper
key_files:
  created:
    - tests/commands/create.compile.spec.ts
    - tests/commands/create.compile-fail.spec.ts
  modified:
    - src/commands/create.ts
    - tests/commands/create.spec.ts
    - tests/version.spec.ts
    - tests/cli.spec.ts
decisions:
  - "chain='any' templates with generate() defined are explicitly refused at the splice point — discovery-only templates (no generate) never reach this branch. Phase 1's TemplateChain union allows 'any' for non-generatable entries; this guard treats a generatable+any template as a registration bug."
  - "Test-only templates (warns-test-only, broken-test-only) use the registry-injection seam (clear+register) per RESEARCH Open Question 1 — cleaner than entangling @clack mocks with broken-source content. No dist spawn; all E2E tests run in-process via buildProgram().exitOverride().parseAsync()."
  - "captureStdio helper spans both stdout AND stderr — Phase 2's captureStdout only captured stdout, but Phase 3's output.warn (warnings) writes to stderr. Both surfaces are part of the E2E contract under test."
  - "tests/cli.spec.ts --version assertions flipped here even though Plan 03-03 only named tests/version.spec.ts — Rule 3 (blocking issue): leaving 'not bundled' assertions would have blocked `npx vitest run` exit 0 success criterion."
metrics:
  duration: ~40 minutes
  completed_date: 2026-05-27
  tasks: 4
  files_created: 2
  files_modified: 4
  test_count_added: 5 (3 happy + 2 fail)
  full_suite_runtime: 9.12s
---

# Phase 3 Plan 03: Wave 2 — Dispatcher Splice + E2E Summary

One-liner: Spliced `compileVerify(source, tpl.chain)` into `src/commands/create.ts` (D-07 order, D-10 warning channel, D-12 footer), added 5 E2E tests covering happy/warning/D-15-fail paths, flipped 2 version-surface specs to assert the real pinned `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` strings.

## What Shipped

### Task 1: Dispatcher splice + D-12 footer

- `src/commands/create.ts`:
  - 2 new imports: `compileVerify` (`../compiler/index.js`) + `safeReadVersion` (`../lib/version.js`)
  - Marker `// ◄─── PHASE 3 SPLICE POINT ...` replaced at former line 95 with:
    - `chain !== "evm" && chain !== "solana"` refusal guard (Rule 2 — see Deviations)
    - `const { warnings } = await compileVerify(source, tpl.chain);`
    - `for (const w of warnings) { output.warn(w.formattedMessage); }`
    - Newbie-gated `output.explain("Warnings don't block deployment...")`
  - Footer: replaced Phase 2's "Phase 3 will add..." placeholder with the D-12 wording: `Compile-verified against solc <ver> + @openzeppelin/contracts <ver>.` followed by the existing `Run 'smartc list-templates'...` line
- `tests/commands/create.spec.ts` splice-marker test rewritten: asserts ZERO `PHASE 3 SPLICE POINT` occurrences + ≥1 `compileVerify(source, tpl.chain)` occurrence
- All 9 tests in `tests/commands/create.spec.ts` green (happy path now exercises real solc against bare-default — compiles clean per Plan 02 Task 3)
- Commit: `8bd8320`

### Task 2: E2E happy path (`tests/commands/create.compile.spec.ts`)

- 3 `it()` blocks under `describe("create dispatcher — compile-verify E2E")`:
  1. **happy path** — primes wizard mocks, runs `create --template erc20 --newbie --out <tmp>`, asserts file written + content contains `contract MyToken` + captured output contains `Compile-verified against solc` + `@openzeppelin/contracts` + no `unknown` fallbacks
  2. **warning pass-through** — registers `warnsTemplate` (test-only) returning `warns-no-error.sol` content; runs create; asserts file IS written AND captured stderr contains `warn:` prefix (the locked `output.warn` prefix per `output.ts:51`)
  3. **--version surface** — direct `safeReadVersion("solc") === "0.8.35"` + `"@openzeppelin/contracts" === "5.6.1"` + `formatVersionLine()` contains both real-version strings, negates both "not bundled" sentinels
- `captureStdio` helper spans stdout + stderr (Phase 3's warnings go to stderr; Phase 2's captureStdout only saw stdout)
- 3/3 passing in 1.88s
- Commit: `b0ef891`

### Task 3: E2E D-15 load-bearing fail path (`tests/commands/create.compile-fail.spec.ts`)

- 2 `it()` blocks:
  1. **D-15 (a)+(b)** — registers `brokenTemplate` (test-only) returning `broken.sol` content; asserts `rejects.toMatchObject({ code: "E_COMPILE_FAILED", exitCode: 1 })` AND `existsSync(outPath) === false` (file MUST NOT exist on compile failure)
  2. **D-15 (c)** — try/catch wrap; asserts CliError shape: `code === "E_COMPILE_FAILED"`, `what === "Generated source failed to compile."`, `why.includes("ParserError")`, `why.includes("Compile errors come from solc")`, `fix.includes("please report this")`
- Registry-injection seam (clear+register) per RESEARCH Open Question 1 — no @clack mock entanglement, no dist spawn
- 2/2 passing in 867ms
- Commit: `16257dc`

### Task 4: Version-surface flip

- `tests/version.spec.ts`:
  - Lines 15-21: `safeReadVersion("solc") === null` → `not.toBeNull() && match(/^\d+\.\d+\.\d+/)`
  - Lines 15-21 (mirror for @oz/contracts): same flip
  - Lines 40-44 (`formatVersionLine` "not bundled"): replaced with `toContain("solc 0.8.35")` + `toContain("@openzeppelin/contracts 5.6.1")` + negative assertions for the Phase 2 sentinels
- `tests/cli.spec.ts` (line 120-131, OUT-OF-SCOPE FIX — see Deviations): mirrored the same flip for the `--version` e2e spawning `dist/cli.js`
- Commit: `2ba5fe1`

## --version Output (SC-5 User-Facing Surface — Pasted Verbatim)

```
smartc 0.1.0 (solc 0.8.35, @openzeppelin/contracts 5.6.1, @openzeppelin/wizard 0.10.8)
```

Three pinned-segments: smartc itself + the three deps that drive output (solc compiler, OZ contracts library, OZ wizard SDK). Matches the SC-5 deliverable contract: pinned versions visible somewhere user-facing.

## Test Suite Delta

- Before Plan 03-03: 16 compile tests + 132 (Phase 1/2) + 4 expected-failing = 148/153 with 4 known failures
- After Plan 03-03: 19 test files / **157 passing / 1 skipped / 0 failed** in 9.12s total runtime
- New: 5 tests (3 happy E2E + 2 D-15 fail E2E) + splice-marker test rewrite + version assertions flipped
- All Phase 1/2/3 acceptance criteria green; no flakes observed

## Build Status

- `npm run typecheck` exit 0
- `npm run build` exit 0
- `dist/cli.js`: 22.32 KB (up from 17.59 KB after Plan 02 — added the splice + footer + version-tail interpolation)

## Deviations from Plan

### Auto-applied during implementation

**1. [Rule 2 — Critical functionality] chain='any' refusal guard at splice point**
- **Found during:** Task 1 first typecheck
- **Issue:** `Template.chain: TemplateChain` is `"evm" | "solana" | "any"` (Phase 1 contract). `compileVerify` accepts only `"evm" | "solana"` (narrower). Without a guard, `compileVerify(source, tpl.chain)` produces TS2345: `'any' is not assignable to type '"evm" | "solana"'`.
- **Fix:** Added an explicit `if (tpl.chain !== "evm" && tpl.chain !== "solana") throw new CliError(...)` guard immediately before the compileVerify call. Refuses templates that ship a `generate()` AND `chain="any"` (registration inconsistency — discovery-only templates without `generate()` are already filtered out by the earlier `!tpl.generate` check).
- **Files modified:** `src/commands/create.ts`
- **Commit:** `8bd8320`

**2. [Rule 3 — Blocking issue] Out-of-scope flip in tests/cli.spec.ts --version e2e**
- **Found during:** Task 4 full-suite run after flipping tests/version.spec.ts
- **Issue:** Task 4 only mentioned `tests/version.spec.ts`. After flipping it, `tests/cli.spec.ts:120-131` (the `--version` e2e that spawns `dist/cli.js`) still asserted `toContain("solc not bundled")` and `toContain("@openzeppelin/contracts not bundled")` — these assertions now fail because the real version line surfaces real strings. This blocks the plan's success criterion (`npx vitest run` exit 0).
- **Fix:** Applied the same flip pattern to `tests/cli.spec.ts:120-131` — positive assertions for `"solc 0.8.35"` and `"@openzeppelin/contracts 5.6.1"`; negative assertions for the Phase 2 sentinels. Test renamed to "...with all pinned segments (UI-16 + SC-5)".
- **Files modified:** `tests/cli.spec.ts`
- **Commit:** `2ba5fe1`

## Authentication Gates

None.

## Threat Flags

T-03-12 (compile-error reports omit version provenance) — MITIGATED. Both the dispatcher footer AND the compileVerify CliError WHY tail line now interpolate `safeReadVersion("solc")` + `safeReadVersion("@openzeppelin/contracts")` for reproducible bug reports. Task 2 test 1 and Task 3 test 2 both assert these strings appear in the user-facing output.

## Self-Check: PASSED

- FOUND: `src/commands/create.ts` (with compileVerify call + footer + chain guard)
- FOUND: `tests/commands/create.compile.spec.ts` (3/3 passing)
- FOUND: `tests/commands/create.compile-fail.spec.ts` (2/2 passing)
- FOUND: `tests/version.spec.ts` (flipped, 5/5 passing)
- FOUND: `tests/cli.spec.ts` (flipped, e2e passing)
- FOUND commit: `8bd8320` (feat: splice + footer)
- FOUND commit: `b0ef891` (test: E2E happy)
- FOUND commit: `16257dc` (test: D-15 fail)
- FOUND commit: `2ba5fe1` (test: version flip)
- `npm run typecheck` → exit 0
- `npm run build` → exit 0 (dist/cli.js 22.32 KB)
- `npx vitest run` → 157 passing / 1 skipped / 0 failed (9.12s)
- `node dist/cli.js --version` → `smartc 0.1.0 (solc 0.8.35, @openzeppelin/contracts 5.6.1, @openzeppelin/wizard 0.10.8)`
