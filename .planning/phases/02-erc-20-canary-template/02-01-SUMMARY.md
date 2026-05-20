---
phase: 02-erc-20-canary-template
plan: 01
subsystem: scaffolding
tags: [openzeppelin, wizard, types, error-codes, tdd, vitest, spec-skeletons, npm-audit]

# Dependency graph
requires:
  - phase: 01-cli-foundation
    provides: "Template interface (5 locked fields), CliError class + stable error codes (E_FILE_EXISTS/E_NOT_IMPLEMENTED/E_USAGE/E_UNKNOWN), Output interface, registry with insertion-order list/get, Vitest 4 ESM mock pattern"
provides:
  - "@openzeppelin/wizard@0.10.8 exact-pinned and resolvable from src/"
  - "Recorded Wave 0 probe outcomes (naive-import works; premint:'0' passthrough safe) in 02-WAVE0-PROBES.md"
  - "Generic Template<TOpts = unknown> with optional readonly runWizard?/generate? — five Phase 1 fields preserved"
  - "Stable codes ERR_WIZARD_CANCEL (E_WIZARD_CANCEL) + ERR_INVALID_INPUT (E_INVALID_INPUT) shipped"
  - "Erc20Opts/WizardIo/GenerateResult/Erc20Template type contracts in src/templates/erc20/opts.ts"
  - "Four spec skeletons under tests/templates/erc20/ with 38 it.todo placeholders covering VALIDATION.md's per-task verification map"
  - "Relaxed registry canary (5 required data keys + extras-must-be-functions) so Plan 02-04 can attach runWizard/generate methods without breaking the canary"
affects: [02-02-wizard-validators, 02-03-generate-filename, 02-04-registry-create-command, 02-05-snapshot-docs, 03-compile-verify]

# Tech tracking
tech-stack:
  added:
    - "@openzeppelin/wizard@0.10.8 (exact-pinned, official OpenZeppelin maintainer, no postinstall scripts, sole runtime dep ethereum-cryptography)"
  patterns:
    - "Wave 0 probe document: record literal stdout + decision in `.planning/phases/XX/XX-WAVE0-PROBES.md` so downstream plans cite a single source of truth for resolved LOW-confidence assumptions"
    - "Conditional SUT import in spec skeletons (existsSync-guarded await import) — lets specs collect at Wave 0 even when SUT modules don't exist yet; it.todo placeholders become real assertions in later waves"
    - "Relaxed-canary pattern: 'required-keys-present + extras-must-be-functions' protects data contracts while permitting method-field additions"

key-files:
  created:
    - "src/templates/erc20/opts.ts — type-only module: Erc20Opts/WizardIo/GenerateResult/Erc20Template"
    - "tests/templates/erc20/wizard.spec.ts — 6 it.todo for prompts/cancel/centralization/newbie preamble"
    - "tests/templates/erc20/generate.spec.ts — 2 golden-snapshot + 6 per-flag it.todo"
    - "tests/templates/erc20/filename.spec.ts — 8 it.todo covering filename derivation table"
    - "tests/templates/erc20/validators.spec.ts — 16 it.todo across isSolidityIdentifier/isAsciiSymbol/isNonNegativeDecimal"
    - ".planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md — recorded Probe A + Probe B"
  modified:
    - "package.json — add @openzeppelin/wizard@0.10.8 (exact)"
    - "package-lock.json — 109 transitive packages added"
    - "src/registry/types.ts — Template → Template<TOpts>, add optional runWizard?/generate? fields"
    - "src/lib/errors.ts — append ERR_WIZARD_CANCEL + ERR_INVALID_INPUT"
    - "tests/errors.spec.ts — assert two new stable codes"
    - "tests/registry.spec.ts — rewrite lines-58-68 canary to required-keys + extras-must-be-functions"

key-decisions:
  - "Naive named import `import { erc20 } from '@openzeppelin/wizard'` works under NodeNext + type:module (Probe A) — no defensive default-destructure needed"
  - "premint:'0' is passthrough-safe (Probe B) — wizard@0.10.8 emits no `_mint(...)` for the zero case, so generate.ts does NOT need to map '0' → undefined"
  - "@openzeppelin/wizard pinned EXACT (no caret) per Threat T-02-01/T-02-SC mitigation; AGPL-3.0-only acknowledged for Phase 9 (CLI MIT)"
  - "Template<TOpts = unknown> generic with optional runWizard?/generate? — keeps Phase 1 stub (canary) compatible while Phase 2 attaches methods; five required data fields stay readonly"
  - "Erc20Template extends Template<Erc20Opts> narrows runWizard/generate from optional to required — concrete bindings carry the methods; generic stub does not"
  - "Erc20Opts.access excludes 'managed' (only `false | \"ownable\" | \"roles\"`) per Assumption A6 / UI-SPEC Prompt 7 — managed access deferred"
  - "Spec-skeleton SUT imports are existsSync-guarded so Wave 0 lands without RED transitively on missing files; Wave 1/2 just delete the guard once the SUT exists"

patterns-established:
  - "Wave 0 probe document: literal command + literal stdout + one-sentence decision per probe; single file per phase under .planning/phases/XX/XX-WAVE0-PROBES.md"
  - "Spec-skeleton with conditional SUT import: pre-stages VALIDATION.md test IDs without coupling to SUT existence"
  - "Stable error codes are append-only as const strings in src/lib/errors.ts (E_-prefixed); never rename or remove once shipped"
  - "Registry canary widening: when adding optional method fields to Template, relax the keys-canary to '5 required data keys present + extras must be typeof function' so accidental future data-key additions still fail"

requirements-completed: [ERC20-01, ERC20-02, ERC20-03, ERC20-04, ERC20-05]

# Metrics
duration: ~12min
completed: 2026-05-20
---

# Phase 2 Plan 01: Wave 0 Spike & Scaffolding Summary

**Pinned @openzeppelin/wizard@0.10.8 (naive named import works; premint:'0' passthrough safe per probes); widened Template<TOpts> with optional runWizard/generate; shipped ERR_WIZARD_CANCEL/ERR_INVALID_INPUT stable codes; scaffolded Erc20Opts/WizardIo/GenerateResult/Erc20Template type contracts; collected 38 it.todo placeholders across four spec skeletons covering VALIDATION.md's per-task map.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-20T16:36:38Z
- **Completed:** 2026-05-20T16:48:39Z
- **Tasks:** 3
- **Files modified/created:** 11 (2 modified — `package.json`, `package-lock.json`; 3 src/test modified — `src/registry/types.ts`, `src/lib/errors.ts`, `tests/errors.spec.ts`, `tests/registry.spec.ts`; 6 created — `02-WAVE0-PROBES.md`, `src/templates/erc20/opts.ts`, four `tests/templates/erc20/*.spec.ts`)

## Accomplishments

- **Wave 0 probes resolved both LOW-confidence Assumptions** (A1 import-form, A7 premint:"0") in `.planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md`. Decisions recorded with literal command + literal stdout: naive named import works, premint:"0" passthrough is safe. Plans 02-02 / 02-03 can now write production code without remaining unknowns.
- **Generic `Template<TOpts>` with optional runWizard/generate landed without breaking Phase 1.** The five required data fields (`id`/`name`/`chain`/`status`/`description`) stay `readonly`; the two new fields are optional so the Phase 1 foundation-smoke canary still registers cleanly.
- **`ERR_WIZARD_CANCEL` (E_WIZARD_CANCEL) and `ERR_INVALID_INPUT` (E_INVALID_INPUT) shipped as stable codes.** Wizard cancel (Ctrl+C / ESC) and validator failures in Plans 02-02 / 02-03 can now `throw new CliError({ code: ERR_WIZARD_CANCEL, ... })` immediately without code-naming churn.
- **Four spec skeletons collected 38 it.todo placeholders** covering every row of VALIDATION.md's per-task verification map. Plans 02-02 and 02-03 can now run `npx vitest run tests/templates/erc20/<file>` and watch RED→GREEN as they fill in todos — the scaffolding work is already done.
- **Registry canary relaxed from "exactly 5 keys" to "5 required data keys + extras-must-be-functions"** so Plan 02-04 can register the real ERC-20 template (which carries `runWizard`/`generate` methods) without breaking the canary; accidental future *data* keys (e.g., `decimals: 18`) still fail the canary because `typeof 18 !== "function"`.

## Task Commits

Each task was committed atomically. Task 2 followed TDD (RED → GREEN).

1. **Task 1: Install @openzeppelin/wizard@0.10.8 + record Wave 0 probes** — `a01683c` (chore)
2. **Task 2 RED: extend errors canary + relax registry canary** — `f262189` (test)
3. **Task 2 GREEN: widen Template<TOpts>, add error codes, scaffold Erc20Opts** — `9146871` (feat)
4. **Task 3: scaffold ERC-20 spec skeletons** — `463f620` (test)

_Note: Task 2 refactor step was unnecessary — the GREEN implementation was already minimal (append-only delta to errors.ts, append-only delta to types.ts, single new types file)._

## Files Created/Modified

**Created:**
- `.planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md` — recorded Probe A (import form) + Probe B (premint:"0") with literal stdout and decisions
- `src/templates/erc20/opts.ts` — type-only module exporting `Erc20Opts`, `WizardIo`, `GenerateResult`, `Erc20Template`; documents Probe A/B decisions inline above the import comment
- `tests/templates/erc20/wizard.spec.ts` — Vitest 4 ESM mock factory for `@clack/prompts` (text/select/multiselect/confirm/isCancel/cancel); conditional SUT import; 6 `it.todo`
- `tests/templates/erc20/generate.spec.ts` — 2 describe blocks (golden snapshots / per-flag); 8 `it.todo`
- `tests/templates/erc20/filename.spec.ts` — table-driven shape; 8 `it.todo` for filename derivation
- `tests/templates/erc20/validators.spec.ts` — 3 describe blocks; 16 `it.todo` for `isSolidityIdentifier`/`isAsciiSymbol`/`isNonNegativeDecimal`

**Modified:**
- `package.json` — `@openzeppelin/wizard: "0.10.8"` (exact-pinned, alphabetical) added to dependencies
- `package-lock.json` — 109 transitive packages added; lockfile committed for reproducible install
- `src/registry/types.ts` — `Template` → `Template<TOpts = unknown>` with optional readonly `runWizard?` and `generate?`; `import type { Output }` added; JSDoc comment updated to call out Phase 2 additions
- `src/lib/errors.ts` — append `ERR_WIZARD_CANCEL = "E_WIZARD_CANCEL"` + `ERR_INVALID_INPUT = "E_INVALID_INPUT"` after `ERR_UNKNOWN`; CliError class, renderError, existing constants untouched
- `tests/errors.spec.ts` — extend "exposes stable error code constants" block with assertions for the two new codes; imports updated
- `tests/registry.spec.ts` — rewrite the lines-58-68 canary from `toEqual([...5 keys])` to `toContain(...)` + extras-must-be-functions; foundation-smoke tests at lines 70-82 untouched (verified by automated check)

## Decisions Made

- **Naive named-import wins (Probe A).** Wizard@0.10.8 ships a real ESM `erc20` named export resolvable under NodeNext from `type:module` — the defensive `import wizard from ...; const { erc20 } = wizard;` workaround is not required. Documented inline in `src/templates/erc20/opts.ts` and cited from `02-WAVE0-PROBES.md`.
- **premint:"0" is passthrough-safe (Probe B).** Wizard internally suppresses the `_mint(...)` constructor line when premint is `"0"`. Plans 02-02 / 02-03 can pass the user's string straight to `erc20.print(...)` without remapping. The validator (`isNonNegativeDecimal`) is the only gate between user input and the wizard for the premint field.
- **Generic Template<TOpts = unknown> with optional method fields** — the default `unknown` keeps Phase 1's stub canary compatible (it carries no methods, no opts type); the optional readonly `runWizard?`/`generate?` fields let Phase 2 extend the registered template. The concrete `Erc20Template extends Template<Erc20Opts>` narrows both methods to required.
- **Erc20Opts.access excludes "managed"** per Assumption A6 / UI-SPEC Prompt 7. Only `false | "ownable" | "roles"`. Managed access is out of v1 scope.
- **Spec-skeleton SUT imports are existsSync-guarded.** Wave 0 has no SUT modules yet, so conditional imports prevent collection failures. When Plans 02-02 / 02-03 land the SUT, they remove the guard inline — the it.todo placeholders become real assertions.

## Deviations from Plan

None — plan executed exactly as written. The plan's three tasks, five edits in Task 2, and four spec skeletons in Task 3 all landed as specified. No Rule 1/2/3 auto-fixes were needed. Two minor implementation choices worth noting (both within plan latitude):

- Probe B's command used `import { erc20 }` directly (the form Probe A picked) instead of the more defensive `(wiz.erc20||wiz.default?.erc20)` recipe — this is exactly what the plan instructed ("use whichever import form Probe A picked").
- Spec skeleton conditional-import guard uses `existsSync` + `fileURLToPath(new URL(...))` rather than a try/catch around the `await import(...)`. The plan said "try/catch OR conditional `if (existsSync(...))`; planner's preference is the try/catch" — both forms were explicitly sanctioned; I picked the existsSync form because it is fail-fast (no swallowed import errors once the SUT lands) and the URL-resolution gives an unambiguous filesystem check from the spec file's location. The behavior matches the plan's intent: spec collection succeeds at Wave 0, real tests run once the SUT lands.

## Issues Encountered

None during planned work. The full `npx vitest run` outputs CliError "create command not implemented" lines to stderr — these are from Phase 1's `tests/cli.spec.ts` exercising the foundation-smoke create stub (expected and unchanged from Phase 1). All 65 non-todo tests still pass.

## User Setup Required

None — no external service configuration introduced in this plan. `@openzeppelin/wizard` is a pure-JS dependency with no API keys, runtime services, or external accounts.

## Threat Surface Scan

No new threat surface beyond what Plans 02-02 / 02-03 will introduce. Plan 02-01 added:

- **`@openzeppelin/wizard` dependency** — already in `<threat_model>` as T-02-01 / T-02-SC; mitigated by exact pin + lockfile commit (Threat T-02-01 marked **Mitigated**).
- **`E_WIZARD_CANCEL` / `E_INVALID_INPUT` error codes** — internal error-channel naming; no new trust boundary.

No `threat_flag` rows needed.

## Verification Snapshot

- `npm run typecheck` — exits 0 (strict TS + noUncheckedIndexedAccess clean with widened Template generic)
- `npm run build` — produces `dist/cli.js` (8.04 KB ESM) in ~98ms; build success
- `npx vitest run` — 9 test files passed | 4 skipped (the new it.todo-only files are reported as "skipped" because they contain zero non-todo tests) | 65 passed | 38 todo | 1 skipped | 0 failed
- `npx vitest run tests/templates/erc20 --reporter=verbose` — 38 todo, 0 failed (every row of VALIDATION.md's per-task map represented)
- `npx vitest run tests/errors.spec.ts tests/registry.spec.ts` — 14 passed, 0 failed
- `node -e "require.resolve('@openzeppelin/wizard')"` — resolvable; exact pin `0.10.8` confirmed in package.json

## Next Plan Readiness

**Plan 02-02 (Wizard + Validators) and Plan 02-03 (Generate + Filename) are unblocked.** Both have:

- Locked type contracts in `src/templates/erc20/opts.ts` to import from
- Stable error codes in `src/lib/errors.ts` to throw
- Pre-collected spec skeletons under `tests/templates/erc20/` to fill in (RED→GREEN per todo)
- A resolved import form (naive) and a resolved premint:"0" rule (passthrough) — no remaining LOW-confidence assumptions for Wave 1
- `02-WAVE0-PROBES.md` to cite from inline comments

**Plan 02-04 (Registry + create command)** has its widened `Template<TOpts>` ready and the relaxed registry canary in place — the new ERC-20 registration will pass through both the data-keys-present check and the extras-must-be-functions check.

No blockers or concerns.

## Self-Check: PASSED

Verified all claims:

- ✅ `package.json` has `"@openzeppelin/wizard": "0.10.8"` (exact)
- ✅ `package-lock.json` committed with 109 transitive packages
- ✅ `.planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md` exists with Probe A + Probe B
- ✅ `src/registry/types.ts` carries `Template<TOpts = unknown>` + optional `runWizard?`/`generate?`
- ✅ `src/lib/errors.ts` exports `ERR_WIZARD_CANCEL` + `ERR_INVALID_INPUT` as const
- ✅ `src/templates/erc20/opts.ts` exports `Erc20Opts`, `WizardIo`, `GenerateResult`, `Erc20Template`
- ✅ All four `tests/templates/erc20/*.spec.ts` files exist and Vitest collects 38 it.todo (0 failed)
- ✅ `tests/registry.spec.ts` foundation-smoke tests at lines 70-82 untouched (Plan 02-04 owns that change)
- ✅ Commits `a01683c`, `f262189`, `9146871`, `463f620` all present in `git log`
- ✅ `npm run typecheck` clean; `npm run build` succeeds; full `npx vitest run` clean (0 failed)

---
*Phase: 02-erc-20-canary-template*
*Plan: 01*
*Completed: 2026-05-20*
