---
phase: 01-cli-foundation
verified: 2026-05-17T09:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 1: CLI Foundation Verification Report

**Phase Goal:** User can install the CLI and discover its surface - commands, flags, help, and verbosity modes are all wired even if no template ships yet.
**Verified:** 2026-05-17
**Status:** passed
**Re-verification:** No - initial verification

---

## Build and Test Suite

All automated checks ran against the live codebase.

| Check | Result |
|-------|--------|
| `npm run typecheck` | exit 0 - zero errors |
| `npm run build` | exit 0 - `dist/cli.js` 8.04 KB with shebang |
| `npx vitest run` | 9 files, 65 passing, 1 skipped (intentional), 0 failed |

---

## Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | `smartc --help` shows every command and flag | VERIFIED | `node dist/cli.js --help` outputs create, list-templates, --newbie, --verbose, --force, --no-color, --json, -V; e2e test SC-1 asserts each field by name |
| SC-2 | `smartc list-templates` shows registered templates | VERIFIED | Default table renders foundation-smoke canary in cli-table3 box; --json emits locked five-field shape; e2e + unit tests cover both renderers |
| SC-3 | Terse output by default; explanatory with --newbie or SMARTC_NEWBIE=1 | VERIFIED | Default mode never emits see: or next: channels; --newbie and SMARTC_NEWBIE env accepted without crash; flag-over-env precedence tested at unit level and e2e level (4 test cases) |
| SC-4 | User prompted before overwriting; --force skips | VERIFIED (unit level) | confirmOverwrite() in src/lib/prompt.ts implements force bypass, yes/no/cancel with CliError(E_FILE_EXISTS) pointing to --force in fix; 6 unit cases in tests/prompt.spec.ts. E2e skip intentional: no Phase 1 command writes files; Phase 2 unskips |
| SC-5 | Failed commands show actionable Error/Why/Fix block | VERIFIED | renderError() in src/lib/errors.ts produces three-part block; smartc create exits 1 with all three labels; smartc bogus exits 2; e2e SC-5 asserts labels; --no-color strips ANSI |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Role | Exists | Lines | Wired | Status |
|----------|------|--------|-------|-------|--------|
| src/cli.ts | Entry: boots registry, dispatches parseAsync, routes errors | Yes | 52 | Imports buildProgram, registerStubTemplates, renderError, makeColor, resolveNewbie | VERIFIED |
| src/program.ts | Commander tree assembly | Yes | 37 | Imported by src/cli.ts; exports buildProgram() | VERIFIED |
| src/commands/create.ts | create stub (discoverability + E_NOT_IMPLEMENTED) | Yes | 25 | Imported into program.ts via createCommandStub() | VERIFIED |
| src/commands/list-templates.ts | Table + JSON renderer for registry | Yes | 45 | Imported into program.ts via listTemplatesCommand() | VERIFIED |
| src/lib/errors.ts | CliError class, renderError(), ERR_* constants | Yes | 49 | Imported by cli.ts, create.ts, prompt.ts | VERIFIED |
| src/lib/env.ts | parseBoolEnv(), resolveNewbie() | Yes | 22 | Imported by cli.ts | VERIFIED |
| src/lib/color.ts | makeColor() factory, --no-color + NO_COLOR env | Yes | 27 | Imported by cli.ts, program.ts, list-templates.ts | VERIFIED |
| src/lib/version.ts | safeReadVersion(), formatVersionLine() | Yes | 87 | Imported by program.ts for -V output | VERIFIED |
| src/lib/output.ts | Output interface, makeOutput() with verbosity routing | Yes | 64 | Newbie-channel gating tested in output.spec.ts | VERIFIED |
| src/lib/prompt.ts | confirmOverwrite() with --force bypass | Yes | 35 | Unit-tested; production wiring in Phase 2 create action | VERIFIED (unit level) |
| src/registry/types.ts | Template interface, TemplateStatus, TemplateChain | Yes | 13 | Imported by registry/index.ts, registry/stub.ts | VERIFIED |
| src/registry/index.ts | register/list/get/clear (insertion-order Map) | Yes | 28 | Imported by list-templates.ts and stub.ts | VERIFIED |
| src/registry/stub.ts | registerStubTemplates(), foundation-smoke canary | Yes | 20 | Imported by cli.ts; called at boot | VERIFIED |
| tests/cli.spec.ts | E2e suite, 14 cases covering all 5 SCs (1 intentional skip) | Yes | 153 | Spawns dist/cli.js via execFileSync | VERIFIED |
| tests/prompt.spec.ts | Unit coverage for SC-4 (6 cases) | Yes | 80 | Tests confirmOverwrite() via vi.mock(@clack/prompts) | VERIFIED |
| tests/commands/list-templates.spec.ts | In-process unit test for list-templates (3 cases) | Yes | 87 | Tests buildProgram() in-process with captured stdout | VERIFIED |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| src/cli.ts | src/program.ts | import { buildProgram } | WIRED |
| src/cli.ts | src/registry/stub.ts | import { registerStubTemplates } | WIRED |
| src/cli.ts | src/lib/errors.ts | import { CliError, renderError } | WIRED |
| src/cli.ts | src/lib/color.ts | import { makeColor } | WIRED |
| src/cli.ts | src/lib/env.ts | import { resolveNewbie } | WIRED |
| src/program.ts | src/commands/create.ts | addCommand(createCommandStub()) | WIRED |
| src/program.ts | src/commands/list-templates.ts | addCommand(listTemplatesCommand()) | WIRED |
| src/program.ts | src/lib/version.ts | .version(formatVersionLine()) | WIRED |
| src/commands/list-templates.ts | src/registry/index.ts | import { list } iterated into table/JSON | WIRED |
| src/commands/create.ts | src/lib/errors.ts | throws CliError(ERR_NOT_IMPLEMENTED) | WIRED |
| src/registry/stub.ts | src/registry/index.ts | import { register, get } | WIRED |
| --no-color flag | makeColor(true) | globalOpts.color === false in cli.ts | WIRED |
| --newbie flag | resolveNewbie({ newbieFlag }) | parsed from program.opts() in cli.ts | WIRED |
| src/lib/prompt.ts | @clack/prompts | import { confirm, isCancel } | WIRED (unit-tested; production call site in Phase 2) |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| CLI-01 | Install globally via npm install -g smartc | Partial (Phase 9 scope) | package.json has bin.smartc -> ./dist/cli.js, type:module, engines:>=20, files:[dist]. Full distribution is Phase 9 per REQUIREMENTS.md traceability. npm link not exercised on Windows (admin shell required) |
| CLI-02 | smartc --help shows all commands and flags | Complete | Verified live; e2e SC-1 asserts every flag by name |
| CLI-03 | smartc create launches wizard | Complete (Phase 1 scope) | create registered and discoverable; action throws E_NOT_IMPLEMENTED pointing to Phase 2; Phase 2 replaces action body |
| CLI-04 | smartc list-templates shows templates with descriptions | Complete | Table and JSON renderers wired; canary visible; 3 unit + 2 e2e tests |
| CLI-05 | smartc create --template skips template picker | Complete (wired) | --template option registered; e2e test confirms option accepted and action reachable |
| CLI-06 | --newbie verbosity modes | Complete | --newbie flag and SMARTC_NEWBIE env wired; makeOutput gates newbie channels; default is terse |
| CLI-07 | Prompted before overwrite; --force skips | Complete (unit level) | confirmOverwrite() fully implemented; 6 unit tests; e2e wiring in Phase 2 |
| CLI-08 | Actionable error messages with next-step guidance | Complete | Three-part Error/Why/Fix block; every CliError includes a fix field; verified live and in e2e SC-5 |

---

## Anti-Patterns Scan

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| src/commands/create.ts | Throws E_NOT_IMPLEMENTED | Info | Expected Phase 1 stub, documented and intentional. Phase 2 replaces the action body. Not a blocker. |
| tests/cli.spec.ts line 106 | it.skip for SC-4 overwrite | Info | Intentional documented skip. Unit coverage exists in prompt.spec.ts. Phase 2 unskips. Not a blocker. |
| src/registry/stub.ts | status: stub, description contains Not generatable | Info | Intentional Phase 1 canary. Not a blocker. |

No blockers. No unintentional stubs.

---

## Human Verification Required

### 1. npm link global install path

**Test:** In an admin/elevated shell, run npm link in the project root, then run smartc --help from a different directory.
**Expected:** The smartc binary resolves to dist/cli.js and prints the help page with exit 0.
**Why human:** npm link requires write access to the global npm prefix. On Windows this typically requires an elevated shell. The executor confirmed this was not exercised. The underlying wiring is confirmed correct (package.json bin entry, shebang in dist/cli.js, dist in files). This is a deployment-path sanity check, not a code-correctness gap. Phase 9 verifies this in CI on all three platforms.

---

## SC-4 Disposition

SC-4 is fully satisfied for Phase 1. The confirmOverwrite() function in src/lib/prompt.ts is a complete, non-stub implementation: it calls @clack/prompts.confirm with the specified message and initialValue: false, handles yes/no/cancel, throws CliError(E_FILE_EXISTS) with --force in the fix text, and bypasses entirely when force: true. Six unit tests in tests/prompt.spec.ts cover every branch. The e2e skip is intentional: no Phase 1 command writes files to disk. Phase 2 wires confirmOverwrite() into the real create action and unskips the placeholder test case.

---

## Final Verdict

**Status: passed**

Phase 1 goal is observably true in the codebase:

- dist/cli.js builds successfully (8.04 KB, shebang present)
- smartc --help exposes every command and flag with descriptions (SC-1)
- smartc list-templates shows the canary template in table and JSON forms (SC-2)
- Terse default and --newbie/SMARTC_NEWBIE verbosity are wired and tested (SC-3)
- confirmOverwrite() plus --force bypass fully implemented and unit-tested (SC-4)
- All failures render Error/Why/Fix blocks; unknown commands exit 2 (SC-5)
- TypeScript clean; 65/66 tests pass (1 intentional skip); no blocker anti-patterns

One human verification item (npm link global path) is flagged but is not a code gap. It is a deployment-convenience test that Phase 9 will exercise in CI.

Phase 2 can begin.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_