---
phase: 02-erc-20-canary-template
verified: 2026-05-26T16:36:00Z
status: passed
score: 4/4 success_criteria + 5/5 requirements verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 2: ERC-20 Canary Template — Verification Report

**Phase Goal:** User can run `smartc create --template erc20` and walk through the wizard to produce a working `.sol` file on disk, proving the entire plugin + builder pipeline on the simplest template.

**Verified:** 2026-05-26T16:36:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| #   | Truth                                                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | User can generate an ERC-20 with their own name, symbol, and initial supply                                                            | VERIFIED   | `src/templates/erc20/wizard.ts` lines 46-82 — three text prompts collect name (validated by `isSolidityIdentifier`), symbol (`isAsciiSymbol`), and premint (`isNonNegativeDecimal`); flow into `Erc20Opts` → `generate()` → `erc20.print()` (`src/templates/erc20/generate.ts:36-44`). Verified by `tests/commands/create.spec.ts` "happy path" (file written contains `contract MyToken`, `SPDX-License-Identifier: MIT`). |
| SC-2 | User can opt in to Mintable, Burnable, and Pausable independently                                                                      | VERIFIED   | `src/templates/erc20/wizard.ts` lines 88-118 — three independent confirm prompts return booleans for mintable/burnable/pausable, all default false. Per-flag generate tests (`tests/templates/erc20/generate.spec.ts`) lock each axis: burnable→`ERC20Burnable`, mintable→`mint`, pausable→`ERC20Pausable`. 10 generate tests pass.        |
| SC-3 | When Mintable or Pausable is selected, user is asked to choose Ownable or AccessControl                                                | VERIFIED   | `src/templates/erc20/wizard.ts` lines 121-141 — conditional `if (mintable || pausable)` gates the prompt-7 select with exactly the two options `"ownable"` and `"roles"`. Verified by `tests/templates/erc20/wizard.spec.ts` cases for happy path (no prompt 7 when neither set), mintable→ownable, pausable→roles, and both→roles. 17 wizard tests pass. |
| SC-4 | The generated `.sol` file matches OpenZeppelin Wizard output conventions (no syntax-corrupting template hacks)                         | VERIFIED   | `generate.ts:36` calls `erc20.print(mapped)` with no string templating or sentinels (CONTEXT D-02 honored). Two golden fixtures (`tests/fixtures/erc20/bare-default.sol`, `all-flags-on.sol`) lock byte-for-byte against `@openzeppelin/wizard@0.10.8` output, with SPDX-MIT, pragma ^0.8.27, ERC20Permit, ERC20Burnable, ERC20Pausable, AccessControl, MINTER_ROLE, PAUSER_ROLE all present. Both fixtures are LF-only. |

**Score:** 4/4 ROADMAP success criteria verified

### Required Artifacts

| Artifact                                | Expected                                                | Status     | Details                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                          | `"@openzeppelin/wizard": "0.10.8"` (exact)              | VERIFIED   | Confirmed via `node -e "p=require('./package.json'); p.dependencies['@openzeppelin/wizard'] === '0.10.8'"` → true                                              |
| `src/registry/types.ts`                 | `Template<TOpts>` with optional `runWizard` / `generate` | VERIFIED   | Line 10: `interface Template<TOpts = unknown>`; lines 16-19: `runWizard?` and `generate?` optional fields appended; five required fields preserved readonly      |
| `src/lib/errors.ts`                     | `ERR_WIZARD_CANCEL`, `ERR_INVALID_INPUT` constants       | VERIFIED   | Lines 8-9 export both as `as const` literal types                                                                                                                |
| `src/templates/erc20/opts.ts`           | Erc20Opts/WizardIo/GenerateResult/Erc20Template types   | VERIFIED   | All four interfaces exported; `access: false \| "ownable" \| "roles"` excludes "managed" per A6; readonly fields throughout                                       |
| `src/templates/erc20/validators.ts`     | Three @clack-shaped validators                          | VERIFIED   | `isSolidityIdentifier`, `isAsciiSymbol`, `isNonNegativeDecimal` exported with locked regexes + UI-SPEC-locked error strings                                       |
| `src/templates/erc20/filename.ts`       | `contractNameToFilename` pure function                  | VERIFIED   | Defensive on empty/symbol-only input (returns `"Token.sol"`); never throws; PascalCases segments, strips leading digits                                          |
| `src/templates/erc20/generate.ts`       | Thin wrapper around `erc20.print()`                     | VERIFIED   | Uses naive named import per Probe A; passthrough premint per Probe B; returns `{ filename, source }`; no string templating                                       |
| `src/templates/erc20/wizard.ts`         | `runWizard(io)` seven-prompt flow + cancelGuard         | VERIFIED   | 162 lines; inline `cancelGuard<T>` (lines 20-31); seven prompts with newbie explain lines; centralization warning conditional on `mintable && access === "ownable"` |
| `src/templates/erc20/index.ts`          | `registerErc20Template()` factory                       | VERIFIED   | Idempotent (line 23: `if (get("erc20")) return`); five-field literal matches UI-09 byte-exact; registers `runWizard` and `generate` methods                       |
| `src/commands/create.ts`                | Dispatcher .action() with full pipeline                 | VERIFIED   | 115 lines; renamed from `createCommandStub` → `createCommand`; --json refusal first, --template required-flag check, registry lookup, runWizard, generate, splice point comment present at line 95, confirmOverwrite, writeFile, UI-05 footer |
| `src/cli.ts`                            | Boots via `registerErc20Template()`                     | VERIFIED   | Line 3 imports `registerErc20Template`; line 9 calls it; no references to `registerStubTemplates`                                                                |
| `src/lib/version.ts`                    | Three-segment version line incl. `@openzeppelin/wizard` | VERIFIED   | Line 86: `safeReadVersion("@openzeppelin/wizard")`; line 89: `wizStr`; line 90: returns `smartc <ver> (..., ..., ...)`                                            |
| `tests/fixtures/erc20/bare-default.sol` | Golden snapshot — bare ERC-20                           | VERIFIED   | 16 lines; contains `contract MyToken`, `ERC20Permit`, `_mint(recipient, 1000000 * 10 ** decimals())`; LF endings                                                  |
| `tests/fixtures/erc20/all-flags-on.sol` | Golden snapshot — all flags + AccessControl             | VERIFIED   | 46 lines; contains `AccessControl`, `MINTER_ROLE`, `PAUSER_ROLE`, `ERC20Burnable`, `ERC20Pausable`, override `_update(...)`; LF endings                           |
| `tests/templates/erc20/wizard.spec.ts`  | Full wizard spec — happy + cancel + warning + newbie    | VERIFIED   | 17 cases, all passing; zero `it.todo` remaining; covers all seven cancel paths                                                                                   |
| `tests/templates/erc20/generate.spec.ts`| Golden + per-flag assertions                            | VERIFIED   | 10 cases passing                                                                                                                                                 |
| `tests/templates/erc20/validators.spec.ts` | Three validator suites                                | VERIFIED   | Suite green                                                                                                                                                      |
| `tests/templates/erc20/filename.spec.ts` | Eight derivation cases                                 | VERIFIED   | Suite green                                                                                                                                                      |
| `tests/commands/create.spec.ts`         | In-process dispatcher spec                              | VERIFIED   | 9 cases passing: happy path writes valid Solidity to disk, --template unknown, --json refusal, missing --template, wizard cancel, overwrite refusal, --force overwrite, splice-point comment present, registry sanity |
| `tests/cli.sc4.spec.ts`                 | SC-4 end-to-end coverage                                | VERIFIED   | 3 cases passing: --force, accept-overwrite, decline-overwrite                                                                                                    |
| `tests/registry.spec.ts`                | Foundation-smoke + ERC-20 registration tests            | VERIFIED   | 8 cases passing — including the relaxed-canary "five required keys + extras must be functions" test (line 59), foundation-smoke verbatim (lines 74-86), and new ERC-20 registration test (line 88) |

### Key Link Verification

| From                                  | To                                              | Via                                                      | Status | Details                                                                                            |
| ------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `src/cli.ts`                          | `src/templates/erc20/index.ts`                  | `registerErc20Template()` call at boot                   | WIRED  | Line 3 import + line 9 call in `main()`; runtime-confirmed by `node dist/cli.js list-templates --json` showing exactly one entry (erc20) |
| `src/commands/create.ts`              | `src/templates/erc20/index.ts` (via registry)   | `getTemplate(templateId)` → calls `tpl.runWizard` + `tpl.generate` | WIRED  | Lines 69, 90, 93 — registry lookup then dispatcher calls; verified by `create.spec.ts` happy-path test writing valid Solidity file |
| `src/commands/create.ts`              | `src/lib/prompt.ts`                             | `confirmOverwrite(outPath, { force })`                   | WIRED  | Line 102 — called when `existsSync(outPath)`; verified by `cli.sc4.spec.ts` overwrite tests        |
| `src/templates/erc20/wizard.ts`       | `@clack/prompts`                                | `text`, `select`, `confirm`, `isCancel`                  | WIRED  | Named imports at line 11; called for all seven prompts with locked messages                        |
| `src/templates/erc20/wizard.ts`       | `src/templates/erc20/validators.ts`             | `validate: isSolidityIdentifier` etc.                    | WIRED  | Lines 51, 65, 79 — validators wired into @clack `validate` callbacks                               |
| `src/templates/erc20/wizard.ts`       | `src/lib/errors.ts`                             | `CliError({ code: ERR_WIZARD_CANCEL, exitCode: 130 })`   | WIRED  | Line 22-29 inside `cancelGuard`; verified by 7 cancel-path tests in `wizard.spec.ts`               |
| `src/templates/erc20/wizard.ts`       | `src/lib/output.ts`                             | `io.output.explain / reference / warn`                   | WIRED  | Lines 36-40 (preamble), per-prompt explain, line 146 centralization warning                        |
| `src/templates/erc20/generate.ts`     | `@openzeppelin/wizard`                          | `erc20.print(mapped)`                                    | WIRED  | Line 36 — only call site; output is returned verbatim as `source`                                  |
| `src/templates/erc20/generate.ts`     | `src/templates/erc20/filename.ts`               | `contractNameToFilename(opts.name)`                      | WIRED  | Line 46                                                                                            |
| `src/lib/version.ts`                  | `@openzeppelin/wizard`                          | `safeReadVersion("@openzeppelin/wizard")`                | WIRED  | Line 86; runtime-confirmed: `node dist/cli.js --version` outputs `... @openzeppelin/wizard 0.10.8` |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable    | Source                                                                  | Produces Real Data | Status   |
| --------------------------------- | ---------------- | ----------------------------------------------------------------------- | ------------------ | -------- |
| `dist/cli.js list-templates --json` | `templates`     | `registry.list()` → `registerErc20Template()` populated at boot          | Yes                | FLOWING  |
| `create` command happy path       | `source` (.sol) | `tpl.generate(opts)` → `erc20.print(mapped)` from `@openzeppelin/wizard` | Yes                | FLOWING  |
| `--version` output                | `wiz` segment   | `safeReadVersion("@openzeppelin/wizard")` → npm-installed pkg version    | Yes                | FLOWING  |

All dynamic-data artifacts flow real data: list-templates is populated by the live registry, `create` writes wizard-generated Solidity to disk, and `--version` reads the installed package version.

### Behavioral Spot-Checks

| Behavior                                                                            | Command                                            | Result                                                                                          | Status |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| `--version` includes wizard segment                                                 | `node dist/cli.js --version`                       | `smartc 0.1.0 (solc not bundled, @openzeppelin/contracts not bundled, @openzeppelin/wizard 0.10.8)` | PASS   |
| `list-templates --json` shows exactly one entry (erc20/alpha)                       | `node dist/cli.js list-templates --json`           | One entry with `id: "erc20"`, `status: "alpha"`, locked UI-09 description                       | PASS   |
| `create --json` refused with E_USAGE exit 2                                         | `node dist/cli.js create --json`                   | exit 2, locked UI-10 WHAT/WHY/FIX block printed                                                  | PASS   |
| Missing `--template` refused with E_USAGE exit 2                                    | `node dist/cli.js create`                          | exit 2, "Missing --template flag." block                                                         | PASS   |
| Unknown `--template` refused with E_USAGE exit 2                                    | `node dist/cli.js create --template foo`           | exit 2, "Template 'foo' was not found in the registry." block                                    | PASS   |
| Full vitest suite green                                                             | `npx vitest run`                                   | 15 files, 136 passed, 1 skipped (cli.spec.ts SC-4 pointer placeholder), 7.20s                    | PASS   |
| Build clean                                                                         | `npm run build`                                    | tsup builds `dist/cli.js` (17.59 KB) with no errors                                              | PASS   |
| End-to-end create happy-path produces valid .sol                                    | `npx vitest run tests/commands/create.spec.ts -t "happy path"` | File at `--out` path exists, contains `contract MyToken` + `SPDX-License-Identifier: MIT`         | PASS   |
| Golden fixtures are LF-encoded                                                      | byte-scan for `\r` in both fixtures                | No CRLF found                                                                                    | PASS   |

### Requirements Coverage

| Requirement | Source Plan(s)              | Description                                                                                                                              | Status     | Evidence                                                                                                                                                                                                                          |
| ----------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ERC20-01    | 02-01..05                   | User can generate an ERC-20 contract with configurable name, symbol, and initial supply                                                  | SATISFIED  | Wizard collects via prompts 1-3 with locked validators; `generate()` forwards to `erc20.print()`; verified by `bare-default.sol` golden fixture + `create.spec.ts` happy path + 10 generate tests                                  |
| ERC20-02    | 02-01..05                   | User can opt in to Mintable (post-deploy minting by an authorized account)                                                               | SATISFIED  | Confirm prompt 4 → `mintable:true` → `erc20.print` emits `mint(address to, uint256 amount)` with `onlyOwner` or `onlyRole(MINTER_ROLE)`; verified by `all-flags-on.sol` fixture (line 33) + per-flag generate test                |
| ERC20-03    | 02-01..05                   | User can opt in to Burnable (holders can burn their own tokens)                                                                          | SATISFIED  | Confirm prompt 5 → `burnable:true` → adds `ERC20Burnable` parent; verified by `all-flags-on.sol` (line 7,11) + per-flag generate test                                                                                              |
| ERC20-04    | 02-01..05                   | User can opt in to Pausable (authorized account can pause transfers)                                                                     | SATISFIED  | Confirm prompt 6 → `pausable:true` → adds `ERC20Pausable` + `pause()`/`unpause()` methods + `_update` override; verified by `all-flags-on.sol` (lines 8,11,25-31,39-44) + per-flag generate test                                  |
| ERC20-05    | 02-01..05                   | When Mintable or Pausable is selected, user picks access control style: Ownable (single owner) or AccessControl (multi-role)             | SATISFIED  | `wizard.ts` lines 121-141 — conditional `if (mintable \|\| pausable)` gates the select with `"ownable"` and `"roles"` options; verified by wizard.spec.ts cases for happy path (no prompt 7), mintable→ownable, pausable→roles, both→roles |

### Anti-Patterns Found

| File             | Line     | Pattern                                          | Severity | Impact                                                                                                          |
| ---------------- | -------- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------- |
| `wizard.ts`      | 49,63,77 | "placeholder" string                              | Info     | False positive: `placeholder` is a @clack/prompts UI property (placeholder text for input fields), not a stub marker |
| `tests/cli.spec.ts` | ~106  | `it.skip("SC-4: overwrite prompt + --force")`    | Info     | Intentional — moved to `tests/cli.sc4.spec.ts` per W5 (avoids module-top `vi.mock("@clack/prompts")` hoisting interfering with spawn-based suite); pointer comment present |

**No blockers or warnings.** No `TBD`/`FIXME`/`XXX` markers in any modified file. No `TODO`/`HACK` markers. No empty-implementation patterns (`return null`, `return []`, etc.) used as stubs. No `console.log`-only handlers. No newbie-mode branching in wizard.ts. No `if (newbie)` or direct stdout writes outside the Output factory.

### Human Verification Required

**None for this phase.** All success criteria are observably verified via automated checks:

- SC-1 through SC-3 are unit-tested via mocked-clack flows that exercise the same code paths a real user would hit (the same `runWizard`, same `generate`, same dispatcher).
- SC-4 is locked byte-for-byte against `@openzeppelin/wizard@0.10.8` output via two committed golden fixtures.
- End-to-end CLI behavior (`--version`, `list-templates`, error paths) was verified by running the actual built `dist/cli.js`.

True interactive-TTY testing (a real human pressing keys through @clack/prompts) is deferred to a later cross-platform-distribution hardening phase per RESEARCH §e2e Test Strategy Pitfall 4 (TTY/stdin piping is fragile and not the right gate for Phase 2).

### Probe Execution

Not applicable — Phase 2 has no probe scripts under `scripts/*/tests/probe-*.sh`. The Wave 0 spike probes (`02-WAVE0-PROBES.md`) documented decisions consumed by Plans 02-02/03 (already verified at the source-comment level in `opts.ts:5-7` and `generate.ts:7-14`).

### Gaps Summary

**No gaps.** Every ROADMAP success criterion is observably verified, every declared artifact exists and is wired, every key link flows real data, every behavioral spot-check passes, every requirement is satisfied with evidence, and the full vitest suite (15 files, 136 passing, 1 intentional skip with pointer comment) is green.

The phase delivered exactly what its goal promised: a user can run `smartc create --template erc20`, walk the wizard, and produce a working `.sol` file on disk. The entire plugin + builder pipeline is proven on the simplest template, and the Phase 3 splice point is locked at exactly one line in `src/commands/create.ts:95` ready for compile-verify to insert.

Notable strengths observed in execution:
- TDD discipline: RED → GREEN commits for every behavioral task across all five plans
- Honesty framing in UI-05 footer: tells user `@openzeppelin/contracts` must be installed locally (Phase 3 will bundle)
- Pure-function discipline: `generate.ts` is a thin wrapper with zero string templating (D-02 honored)
- Plugin opacity: dispatcher only depends on registry-returned `Template` shape (D-05 honored)
- Idempotent registration prevents test-isolation footguns

---

_Verified: 2026-05-26T16:36:00Z_
_Verifier: Claude (gsd-verifier, Opus 4.7 1M)_
