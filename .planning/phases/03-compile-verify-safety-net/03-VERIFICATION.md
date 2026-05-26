---
phase: 03-compile-verify-safety-net
verified: 2026-05-27T00:38:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 4
overrides:
  - must_have: "evmVersion: \"paris\" per RESEARCH Pitfall 2"
    reason: "Wave 0 probe found OZ 5.6.1 utils/Bytes.sol uses Cancun-only mcopy opcode; paris fails with 4 mcopy-not-available errors. Cancun shipped on mainnet 2024-03-13 and is broadly deployed. Documented in 03-01-SUMMARY, 03-02-SUMMARY, source comments at src/compiler/index.ts:43-46, README.md §evmVersion. Rule 1 (bug avoidance) deviation."
    accepted_by: "user (verify-work directive)"
    accepted_at: "2026-05-27T00:38:00Z"
  - must_have: "createRequire('solc') in src/compiler/index.ts per PATTERNS.md line 41"
    reason: "Vitest 4 does NOT intercept createRequire-based requires (mock function never called); top-level await import('solc') with .default ?? mod unwrap is Vitest-mockable AND handles production CJS-default-export interop identically. Production behavior identical. Rule 3 (blocking issue) deviation."
    accepted_by: "user (verify-work directive)"
    accepted_at: "2026-05-27T00:38:00Z"
  - must_have: "compileVerify(source, tpl.chain) with no chain guard"
    reason: "TemplateChain union is 'evm' | 'solana' | 'any'; compileVerify accepts only 'evm' | 'solana'. Typecheck blocked without chain !== 'evm' && chain !== 'solana' refusal guard in src/commands/create.ts:102-110. Defends against registration inconsistency (template ships generate() while declaring chain='any'). Rule 2 (critical functionality slot) deviation."
    accepted_by: "user (verify-work directive)"
    accepted_at: "2026-05-27T00:38:00Z"
  - must_have: "tests/version.spec.ts is the only --version assertion flip (per Plan 03-03 Task 4 scope)"
    reason: "tests/cli.spec.ts:120-131 --version e2e (spawning dist/cli.js) ALSO held 'not bundled' assertions that would fail after Plan 01 installed deps; leaving them would block 'npx vitest run' exit 0. Out-of-scope fix applied identically. Rule 3 (blocking issue) deviation."
    accepted_by: "user (verify-work directive)"
    accepted_at: "2026-05-27T00:38:00Z"
  - must_have: "Plan 03-04 Task 2 edits ROADMAP/REQUIREMENTS Phase 3 listings during execution"
    reason: "ROADMAP/REQUIREMENTS Phase 3 listings were already finalized at planning time (commits 2b5bed9, 96779eb, 5883a2d, 6766b22 prior to Wave 0 execution). Task 2 ran the automated verify and confirmed correct state; no edit needed. Per CLAUDE.md the orchestrator/verifier handles post-execution checkbox flips."
    accepted_by: "user (verify-work directive)"
    accepted_at: "2026-05-27T00:38:00Z"
---

# Phase 3: Compile-Verify Safety Net Verification Report

**Phase Goal:** User never receives a file that doesn't compile — the Solidity compile gate runs in-process before any source touches disk, against pinned OpenZeppelin and `solc` versions.

**Verified:** 2026-05-27T00:38:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (SC-1..SC-5 from ROADMAP.md)

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | SC-1: User runs `smartc create` for ERC-20 and the generated file is compile-verified BEFORE being written | ✓ VERIFIED | `src/commands/create.ts:111` — `const { warnings } = await compileVerify(source, tpl.chain);` runs at line 111 (AFTER `tpl.generate(opts)` at line 95 but BEFORE `existsSync(outPath)` at line 125 and `writeFile(outPath, ...)` at line 130) — D-07 ordering confirmed via source-line inspection. E2E test `tests/commands/create.compile.spec.ts:111-140` "happy path with real solc" exercises the full dispatcher with real `solc@0.8.35` and asserts file content + footer + version surface. |
| 2   | SC-2: When compile fails, user sees compiler diagnostics and no file is left on disk | ✓ VERIFIED | `tests/commands/create.compile-fail.spec.ts:60-83` (D-15 (a)+(b)) registers a test-only `brokenTemplate` returning `tests/fixtures/broken.sol` (contains `uint256 x = ;` ParserError), asserts `.rejects.toMatchObject({ code: "E_COMPILE_FAILED", exitCode: 1 })` AND `expect(existsSync(outPath)).toBe(false)`. Test `D-15 (c)` (lines 85-122) asserts `err.what === "Generated source failed to compile."`, `err.why.includes("ParserError")`, `err.why.includes("Compile errors come from solc")`, `err.fix.includes("please report this")`. Both tests pass in latest run (157 passed). |
| 3   | SC-3: When compile warns (but does not error), user sees warnings and the file is still written | ✓ VERIFIED | `src/commands/create.ts:112-119` — `for (const w of warnings) { output.warn(w.formattedMessage); }` surfaces warnings via the locked `output.warn` channel BEFORE the `writeFile` call at line 130. E2E test `tests/commands/create.compile.spec.ts:142-165` "warning pass-through" registers a `warnsTemplate` returning `tests/fixtures/warns-no-error.sol` (unused-local trigger), asserts `existsSync(outPath) === true` (file IS written) AND captured stderr contains `warn:` prefix. Integration test `tests/compiler/compile.integration.spec.ts:58-66` confirms compileVerify itself returns warnings without throwing. |
| 4   | SC-4: User does not need to install OpenZeppelin contracts locally — imports resolve from the tool's bundled dependencies | ✓ VERIFIED | `src/compiler/imports.ts:42` — `require.resolve("@openzeppelin/contracts/package.json")` finds smartc's bundled OZ via Node's module resolution (NOT cwd). `scripts/probe-compile.mjs` chdirs to a temp dir BEFORE resolving and confirms `PROBE PASSED` (verified live: `errors=0 warnings=5 elapsed=206ms`). Unit test `tests/compiler/compile.spec.ts:28-44` "resolves @openzeppelin/contracts/token/ERC20/ERC20.sol from any cwd" chdirs to temp and asserts contents contains `contract ERC20`. Integration test confirms bare-default + all-flags-on fixtures compile clean with real OZ resolution. |
| 5   | SC-5: The pinned `solc` and `@openzeppelin/contracts` versions are visible somewhere user-facing (banner, `--version`, or doctor) | ✓ VERIFIED | Live invocation `node dist/cli.js --version` returns `smartc 0.1.0 (solc 0.8.35, @openzeppelin/contracts 5.6.1, @openzeppelin/wizard 0.10.8)`. Footer surface: `src/commands/create.ts:134-138` interpolates `safeReadVersion("solc")` + `safeReadVersion("@openzeppelin/contracts")` into the `Compile-verified against solc X + @openzeppelin/contracts Y.` nextStep line (D-12). Three test layers lock this: `tests/version.spec.ts:44-52` (formatVersionLine unit), `tests/cli.spec.ts:128-129` (--version e2e spawning dist/cli.js), `tests/commands/create.compile.spec.ts:167-175` (in-process E2E mirror). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `package.json` | Exact pins `"solc": "0.8.35"` + `"@openzeppelin/contracts": "5.6.1"` | ✓ VERIFIED | Lines 24, 29 of package.json contain exact pins (no caret). Alpha-sorted in deps block per Phase 2 convention. |
| `src/lib/errors.ts` | Contains `ERR_COMPILE_FAILED = "E_COMPILE_FAILED" as const` | ✓ VERIFIED | Line 11. Stable from this commit forward per Phase 3 contract. Existing constants untouched (verified byte-for-byte). |
| `src/compiler/types.ts` | Exports `Severity`, `CompileDiagnostic`, `StandardJsonInput`, `SolcOutput` (all readonly) | ✓ VERIFIED | All four symbols exported (lines 17, 19, 28, 38). `CompileDiagnostic.severity` is closed union `"error" \| "warning"`. `StandardJsonInput.language` is literal type `"Solidity"`. |
| `src/compiler/imports.ts` | `makeImportCallback()` with OZ resolver, per-call cache, path-traversal guard, sync return | ✓ VERIFIED | Lines 32-92: resolveOzRoot() (lazy, via require.resolve), per-call Map cache (line 37), path-traversal guard (lines 77-79 — `normalize(root) + sep` prefix check defends against `/tmp/oz-rootEXTRA` confusion attack), synchronous return shape (no `async`, no `Promise`). |
| `src/compiler/index.ts` | `compileVerify(source, chain)` with full evm body, solana branch throws E_NOT_IMPLEMENTED | ✓ VERIFIED | Lines 95-158. Solana branch throws ERR_NOT_IMPLEMENTED with Phase 7 pointer (locked per D-06). EVM branch builds StandardJsonInput with `evmVersion="cancun"` (line 117), calls `solc.compile`, partitions diagnostics with CRLF→LF normalization + info→warning collapse, throws CliError(ERR_COMPILE_FAILED) on errors with multi-line WHY (formattedMessages + version tail), returns `{ warnings }` on success. |
| `src/compiler/README.md` | 30-200 lines documenting architecture, evmVersion rationale, sync callback, cwd-independence, fixtures, bumping procedure, phase forward-looking | ✓ VERIFIED | 76 lines (within budget). All 8 required section headings present. Mentions `0.8.35`, `5.6.1`, `E_COMPILE_FAILED`, `EVM_VERSION = "cancun"`. Relative links to sibling files. README documents `"cancun"` (current code reality), NOT the stale `"paris"` plan suggestion — Wave 0 discovery captured. |
| `src/commands/create.ts` | compileVerify spliced at former marker location BEFORE confirmOverwrite + D-12 footer | ✓ VERIFIED | Two new imports at lines 11-12 (compileVerify, safeReadVersion). PHASE 3 SPLICE POINT marker REMOVED (grep finds zero occurrences). compileVerify call at line 111. D-07 ordering: line 111 (compile) precedes line 125 (existsSync) precedes line 130 (writeFile). D-12 footer at lines 134-138 surfaces real versions. Chain guard (lines 102-110) refuses chain='any' templates with generate (Rule 2 deviation — documented above). |
| `scripts/probe-compile.mjs` | Cwd-independent probe; exits 0; PROBE PASSED with errors=0 | ✓ VERIFIED | 101 lines (`.mjs` extension per Plan 01 spec). mkdtempSync + chdir BEFORE require.resolve (line 40). Synchronous readFileSync in import callback. evmVersion `"cancun"` (line 75). Live run: `PROBE PASSED`, `errors=0 warnings=5 elapsed=206ms`. Restores cwd in finally block. |
| `tests/fixtures/broken.sol` | ParserError fixture with `uint256 x = ;` | ✓ VERIFIED | 7 lines. Contains literal `uint256 x = ; // ParserError: expected expression`. SPDX header, pragma `^0.8.27`. LF endings (no `\r` bytes). |
| `tests/fixtures/warns-no-error.sol` | Unused-local warning fixture with `uint256 dead;` | ✓ VERIFIED | 10 lines. Contains literal `uint256 dead;  // Warning: unused local variable`. SPDX header, pragma `^0.8.27`. LF endings. Integration test confirms solc 0.8.35 surfaces a warning here. |
| `tests/compiler/compile.spec.ts` | 12 unit tests (5 makeImportCallback + 7 compileVerify with mocked solc) | ✓ VERIFIED | 264 lines, 12 `it()` blocks. Plan 02 SUMMARY claim of 12 tests matches actual count. Full suite passes. |
| `tests/compiler/compile.integration.spec.ts` | 4 integration tests with real solc + real OZ (OZ-drift canary) | ✓ VERIFIED | 67 lines, 4 `it()` blocks (no `vi.mock`). Tests: bare-default clean, all-flags-on clean, broken.sol throws E_COMPILE_FAILED with ParserError in WHY, warns-no-error returns warnings. Full suite passes. |
| `tests/commands/create.compile.spec.ts` | 3 E2E tests: happy + warning pass-through + --version surface | ✓ VERIFIED | 177 lines, 3 `it()` blocks. Real solc happy path, warnsTemplate registry-injection seam for warning test, formatVersionLine direct assertion. Full suite passes. |
| `tests/commands/create.compile-fail.spec.ts` | 2 D-15 load-bearing E2E tests (no file written + CliError shape) | ✓ VERIFIED | 124 lines, 2 `it()` blocks. brokenTemplate registry-injection seam. Both tests assert `existsSync(outPath) === false`. Test 2 asserts five field-shape checks on CliError. Full suite passes. |
| `tests/version.spec.ts` | Flipped from "not bundled" to real pinned version assertions | ✓ VERIFIED | Lines 15-21 (solc/oz null → match semver shape) and lines 44-52 (formatVersionLine contains "solc 0.8.35" + "@openzeppelin/contracts 5.6.1", negates "not bundled" sentinels). Old assertions removed (grep for "returns null for solc" finds zero matches). |
| `tests/cli.spec.ts` | --version e2e flipped to real pinned versions (out-of-scope but blocking) | ✓ VERIFIED | Lines 128-129 contain `expect(line).toContain("solc 0.8.35")` and `expect(line).toContain("@openzeppelin/contracts 5.6.1")`. Override #4 applies — necessary to unblock full-suite green. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/commands/create.ts:11` | `src/compiler/index.ts` | `import { compileVerify } from "../compiler/index.js";` | ✓ WIRED | Import present + call site at line 111 + warning loop at lines 112-114 + newbie-gated explain at lines 115-119. |
| `src/commands/create.ts:12` | `src/lib/version.ts` | `import { safeReadVersion } from "../lib/version.js";` | ✓ WIRED | Import present + call sites at lines 134-135 interpolated into footer nextStep at lines 136-138. |
| `src/compiler/index.ts:35-36` | `src/compiler/imports.ts` | `import { makeImportCallback } from "./imports.js";` | ✓ WIRED | Fresh callback created per compileVerify invocation at line 123 (D-05 per-call cache). |
| `src/compiler/index.ts:62` | `node_modules/solc` | `await import("solc")` with `.default ?? mod` unwrap | ✓ WIRED | Override #2 applies — top-level dynamic import replaced createRequire for Vitest mockability. Production behavior identical. |
| `src/compiler/imports.ts:42` | `node_modules/@openzeppelin/contracts` | `require.resolve("@openzeppelin/contracts/package.json")` → `dirname` → `ozRoot` | ✓ WIRED | Lazy resolution on first OZ hit. Probe confirms cwd-independence. |
| `src/commands/create.ts:111` | `src/lib/errors.ts (ERR_COMPILE_FAILED)` | Throw bubbles up through dispatcher → renderError → exit 1 | ✓ WIRED | CliError caught at src/cli.ts entry; renderError emits WHAT/WHY/FIX block. D-15 (c) test asserts the rendered shape. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `src/commands/create.ts` footer | `solcVer`, `ozVer` | `safeReadVersion("solc")` / `safeReadVersion("@openzeppelin/contracts")` | Yes — live invocation returns `solc 0.8.35`, `@openzeppelin/contracts 5.6.1` | ✓ FLOWING |
| `src/commands/create.ts` warnings | `warnings` array | `compileVerify()` partitioned output | Yes — integration test confirms ≥1 warning for warns-no-error fixture | ✓ FLOWING |
| `src/compiler/index.ts` errors WHY | `formatted` (joined formattedMessages) | solc-js partitioned output | Yes — D-15 (c) test confirms `err.why.includes("ParserError")` + `err.why.includes("Compile errors come from solc")` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Probe runs cwd-independently and prints PROBE PASSED with errors=0 | `node scripts/probe-compile.mjs` | `solc 0.8.35+commit.47b9dedd.Emscripten.clang (cwd=...) bare-default.sol: errors=0 warnings=5 elapsed=206ms PROBE PASSED` | ✓ PASS |
| --version surface contains pinned solc + OZ versions | `node dist/cli.js --version` | `smartc 0.1.0 (solc 0.8.35, @openzeppelin/contracts 5.6.1, @openzeppelin/wizard 0.10.8)` | ✓ PASS |
| TypeScript compile clean (strict mode) | `npm run typecheck` | exit 0 (no output) | ✓ PASS |
| tsup build clean | `npm run build` | `dist\cli.js 22.32 KB` build success in 25ms | ✓ PASS |
| Full vitest suite green | `npx vitest run` | `Test Files 19 passed (19); Tests 157 passed \| 1 skipped (158); Duration 9.45s` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/probe-compile.mjs` | `node scripts/probe-compile.mjs` | exit 0, `PROBE PASSED`, errors=0, warnings=5, elapsed=206ms | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| COMP-01 | 03-01, 03-02, 03-03, 03-04 | Solidity contracts compiled in-process via solc npm against pinned @oz/contracts | ✓ SATISFIED | compileVerify implemented end-to-end (Plan 02); dispatcher wired (Plan 03); integration tests with real solc green. |
| COMP-02 | 03-02 (seam only) | Solana contracts compiled via `anchor build` when Anchor present | ✓ SATISFIED (seam only) | Plan 02 ships SEAM SHAPE: `chain="solana"` throws ERR_NOT_IMPLEMENTED with Phase 7 pointer. Unit test locks the contract. Per ROADMAP, full implementation defers to Phase 7 (mapped accordingly in REQUIREMENTS.md). |
| COMP-03 | 03-02, 03-03 | When compile fails, file NOT written; user sees diagnostics | ✓ SATISFIED | D-15 (a)+(b) E2E test asserts `existsSync(outPath) === false` on compile failure. D-15 (c) asserts CliError shape with formattedMessage in WHY. |
| COMP-04 | 03-02, 03-03 | Compile warnings surface but do not block writing | ✓ SATISFIED | "warning pass-through" E2E test asserts file IS written AND `warn:` prefix in captured stderr. Integration test confirms compileVerify returns warnings without throwing. |
| COMP-05 | 03-01, 03-02, 03-03 | Import callback resolves @oz/contracts from bundled deps; no user install | ✓ SATISFIED | Probe demonstrates cwd-independent resolution. Unit test "resolves from any cwd" locks behavior. `--version` line surfaces pinned versions as user-facing visibility. |

All five COMP-* requirements satisfied. COMP-02 satisfies the seam-only scope (full implementation correctly deferred to Phase 7 per the long-standing cross-phase mapping at REQUIREMENTS.md:211).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No debt markers (TBD/FIXME/XXX/TODO/HACK) in any modified Phase 3 source file. All Plan 01 `TODO(03-02)` insertion points were consumed by Plan 02's GREEN implementation. |

Plan 01 SUMMARY mentioned `TODO(03-02)` placeholder comments in the skeleton, but Plan 02 confirms these were removed during GREEN implementation. Grep for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER` in `src/compiler/` returns zero matches. Grep in `src/commands/create.ts` returns zero matches.

### Human Verification Required

None. All five Success Criteria are observably true via grep, file inspection, test execution, and live CLI invocation. SC-5 visual confirmation is automated by both `tests/version.spec.ts` (unit) and `tests/cli.spec.ts` (e2e spawning dist/cli.js), plus the live `node dist/cli.js --version` run during verification.

### Deviations Acknowledged (Overrides)

Five documented deviations from the original PLAN have been accepted as Rule 1/2/3 corrections per the user directive in the verify-work prompt:

1. **evmVersion="cancun" instead of "paris"** (Rule 1 — bug avoidance) — Wave 0 probe proved paris fails with OZ 5.6.1's `mcopy` opcode. Documented in 03-01-SUMMARY, 03-02-SUMMARY, source comments, and README.md.
2. **`await import("solc")` instead of `createRequire("solc")`** (Rule 3 — blocking issue) — Vitest 4 doesn't intercept createRequire-based mocks. Production behavior identical (Node ESM-CJS interop preserved via `.default ?? mod`).
3. **`chain !== "evm" && chain !== "solana"` refusal guard in create.ts:102-110** (Rule 2 — critical functionality) — `TemplateChain` union includes `"any"`; typecheck blocked without the guard. Acts as defense against registration inconsistency.
4. **`tests/cli.spec.ts:120-131` --version e2e ALSO flipped** (Rule 3 — blocking issue) — Plan named only `tests/version.spec.ts`; cli.spec held identical "not bundled" assertions that would have blocked full-suite green.
5. **Plan 03-04 Task 2 ROADMAP/REQUIREMENTS edits were no-op** — Already finalized at planning time; Task 2 verified state and exited per CLAUDE.md (orchestrator owns post-execution checkbox flips).

All five overrides have full documentation in 03-01-SUMMARY, 03-02-SUMMARY, 03-03-SUMMARY, 03-04-SUMMARY, source comments where applicable, and the README.

### Gaps Summary

No gaps. Phase 3 goal "User never receives a file that doesn't compile" is observably true:
- The compile gate runs in-process (`src/compiler/index.ts` + `await compileVerify(source, tpl.chain)` in `src/commands/create.ts:111`)
- BEFORE any source touches disk (compile at line 111, writeFile at line 130, with `existsSync` at line 125 between them per D-07)
- Against pinned OpenZeppelin (`5.6.1` exact) and solc (`0.8.35` exact) versions (`package.json:24, 29`)
- With user-facing visibility via `--version` and the post-write footer

All 5 ROADMAP Success Criteria SATISFIED. All 5 COMP-* requirements SATISFIED (with COMP-02 correctly scoped to seam-only). 157 tests passing, 0 failing, 1 skipped (pre-existing). Build clean. Typecheck clean. Probe green. Live `--version` surfaces the pinned versions.

---

_Verified: 2026-05-27T00:38:00Z_
_Verifier: Claude (gsd-verifier)_
