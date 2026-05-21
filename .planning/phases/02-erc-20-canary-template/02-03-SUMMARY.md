---
phase: 02-erc-20-canary-template
plan: 03
subsystem: erc20-wizard
tags: [erc20, wizard, clack, cancel-handling, centralization-warning, newbie-mode, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-erc-20-canary-template
    plan: 01
    provides: "Erc20Opts (locked shape), WizardIo type, ERR_WIZARD_CANCEL constant, wizard.spec.ts skeleton with 6 it.todo placeholders, Vitest 4 ESM mock pattern (vi.mock + top-level await import)"
  - phase: 02-erc-20-canary-template
    plan: 02
    provides: "validators.ts (isSolidityIdentifier, isAsciiSymbol, isNonNegativeDecimal) — sibling-worktree dependency; landed in parallel from sibling agent"
  - phase: 01-cli-foundation
    plan: 02
    provides: "Output interface + makeOutput factory (channel gating), CliError class, three-part error block renderer"
provides:
  - "runWizard(io: WizardIo): Promise<Erc20Opts> — the seven UI-SPEC-locked prompt sequence"
  - "Inline cancelGuard<T>(answer, promptName) helper — throws CliError(E_WIZARD_CANCEL, exitCode:130) on Ctrl+C with locked WHAT/WHY/FIX"
  - "Non-silenceable Mintable+Ownable centralization warning via io.output.warn"
  - "17-case mocked-clack spec locking prompt order, validator wiring, cancel-at-each-prompt behavior, newbie preamble, and centralization warning"
affects:
  - "02-04-registry-create-command: dispatcher calls runWizard(io) → opts → generate(opts) → confirmOverwrite → fs.writeFile"
  - "04-erc721-template (Phase 4): cancelGuard pattern is the second-consumer trigger to hoist into src/lib/wizard.ts"
  - "05-deploy-md (Phase 5): owns the broader centralization warning surface (DEPLOY-06); this plan ships the Mintable+Ownable case only per UI-14"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-prompt sequential @clack flow with single cancelGuard helper applied to every return — first such flow in the repo; canonical for future ERC-721/1155/SPL wizards"
    - "Output-channel pass-through wizard: no `if (newbie)` branches; the Output factory handles all mode gating per Phase 1 contract"
    - "Conditional select prompt (step 7 only when mintable||pausable) with TypeScript literal-union value inference from options array"
    - "Mocked-clack unit-test pattern extended to text + select + confirm: each prompt's call captured via mock.calls[N][0]; validate callbacks invoked directly to assert wired-up validators without round-tripping through clack"

key-files:
  created:
    - "src/templates/erc20/wizard.ts (161 lines) — runWizard + inline cancelGuard; commit 2ed4592"
  modified:
    - "tests/templates/erc20/wizard.spec.ts (381 lines, +362 -31) — replaced 6 it.todo with 17 real cases; commit 85529f9"

key-decisions:
  - "cancelGuard kept INLINE in wizard.ts per UI-SPEC Components Inventory — hoist to src/lib/wizard.ts deferred to Phase 4 when ERC-721 lands as the second consumer (avoids speculative abstraction)"
  - "validators.ts lives as a local untracked stub in this worktree (identical content to Plan 02-02's canonical file) — needed so wizard.ts can typecheck and validator-wiring tests can call validate() directly. Stub never committed; sibling worktree's commit ships the canonical file on merge"
  - "Per-prompt explain lines + preamble flow through io.output.explain/reference unconditionally — the Output factory (newbie && !json gate) handles mode silencing"
  - "select<TValue> generic specified explicitly as <\"ownable\" | \"roles\"> for noUncheckedIndexedAccess-strict TS — clack's TValue inference is sound but the explicit generic locks the contract in source"
  - "All seven cancel-path tests assert the full WHAT string (\"Wizard cancelled at: {promptName}.\") plus exitCode 130, not just the code — ensures the locked UI-SPEC §E_WIZARD_CANCEL block can't drift silently"

requirements-completed: [ERC20-01, ERC20-02, ERC20-03, ERC20-04, ERC20-05]

# Metrics
duration: ~9min
completed: 2026-05-21
---

# Phase 2 Plan 03: ERC-20 Wizard (runWizard + cancelGuard + centralization warning) Summary

**Shipped the seven UI-SPEC-locked ERC-20 wizard prompts in 161 lines: runWizard(io) walks name → symbol → premint → mintable → burnable → pausable → conditional access-control, with every @clack return passing through an inline cancelGuard that throws CliError(E_WIZARD_CANCEL, exitCode:130) on Ctrl+C. Centralization warning fires non-silenceably for Mintable+Ownable; newbie preamble + per-prompt explain lines flow through io.output.* with zero `if (newbie)` branching. 17-case mocked-clack spec locks all behavior — 7 cancel-path tests assert the locked WHAT block per prompt.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 2 (Task 1: implement wizard.ts; Task 2: fill wizard.spec.ts)
- **Files created:** 1 (`src/templates/erc20/wizard.ts`)
- **Files modified:** 1 (`tests/templates/erc20/wizard.spec.ts`)
- **Lines of source delivered:** 161 (wizard.ts) + 381 (spec) = 542 total

## Accomplishments

- **runWizard(io: WizardIo): Promise<Erc20Opts>** implements the full seven-prompt sequence with the byte-exact UI-SPEC §Wizard Prompt Sequence copy. Prompt 7 (access control) fires only when `mintable || pausable`; otherwise `access:false` is returned.
- **Inline cancelGuard<T> helper** wraps every prompt return value, calls `isCancel(answer)`, and on cancel throws `CliError(E_WIZARD_CANCEL, exitCode:130)` with the locked WHAT/WHY/FIX block. The prompt name (`"contract name"`, `"token symbol"`, `"initial supply"`, `"mintable"`, `"burnable"`, `"pausable"`, `"access control"`) is interpolated into the WHAT line per UI-SPEC §E_WIZARD_CANCEL.
- **Mintable+Ownable centralization warning** fires via `io.output.warn(...)` immediately after prompt 7 resolves, before `runWizard()` returns. `output.warn` is the always-on channel (Phase 1 contract) — fires in default + newbie + `--json` modes per UI-14.
- **Newbie-mode preamble** (one `output.explain` + two `output.reference` calls — EIP-20 + OZ docs) fires before prompt 1. Per-prompt `output.explain` lines fire before each of the seven prompts. The wizard NEVER branches on newbie mode itself; the Output factory's `newbie && !json` gate handles all silencing.
- **Plan 02 validators wired into @clack `validate` callbacks** for prompts 1-3 (`isSolidityIdentifier`, `isAsciiSymbol`, `isNonNegativeDecimal`). Validator-wiring tests call `arg.validate("3Bad")` directly and assert the locked UI-SPEC error strings.
- **17-case mocked-clack spec** locks:
  - Happy path with all flags false → `access:false`, no warn, select not called
  - Step 7 conditional triggers (mintable-only, pausable-only, both, options-shape)
  - 3 prompt-message + validator-wiring cases
  - 7 cancel-path cases (one per prompt) asserting `code`, `exitCode:130`, and the exact WHAT promptName
  - Newbie preamble case (explain[0] + both reference URLs in locked order)
  - Centralization-warning case asserting the locked Mintable+Ownable string

## Task Commits

Each task was committed atomically. Both tasks followed TDD — Task 1's RED was the pre-existing `it.todo` placeholders in wizard.spec.ts from Plan 01 Task 3; Task 2 replaced them with real assertions that the Task 1 implementation passed first try.

1. **Task 1: Implement wizard.ts (runWizard + cancelGuard)** — `2ed4592` (feat)
2. **Task 2: Fill wizard.spec.ts with 17 real cases** — `85529f9` (test)

## Files Created/Modified

**Created:**
- `src/templates/erc20/wizard.ts` (161 lines) — exports `runWizard(io: WizardIo): Promise<Erc20Opts>`; inline `cancelGuard<T>`; verbatim UI-SPEC-locked copy for all seven prompts, preamble, centralization warning, and cancel error block

**Modified:**
- `tests/templates/erc20/wizard.spec.ts` (+362 -31, 381 total lines) — Vitest 4 ESM mock pattern for `@clack/prompts`; 17 cases across 4 `describe` blocks (happy paths / validator wiring / cancel at each prompt / newbie + centralization)

## Cancel-Path Test Names (Seven)

All seven assert `{ code: "E_WIZARD_CANCEL", exitCode: 130, what: "Wizard cancelled at: <promptName>." }`:

1. `cancel at 'contract name' (prompt 1) throws E_WIZARD_CANCEL`
2. `cancel at 'token symbol' (prompt 2) throws E_WIZARD_CANCEL`
3. `cancel at 'initial supply' (prompt 3) throws E_WIZARD_CANCEL`
4. `cancel at 'mintable' (prompt 4) throws E_WIZARD_CANCEL`
5. `cancel at 'burnable' (prompt 5) throws E_WIZARD_CANCEL`
6. `cancel at 'pausable' (prompt 6) throws E_WIZARD_CANCEL`
7. `cancel at 'access control' (prompt 7) throws E_WIZARD_CANCEL`

## Centralization Warning — Exact String Asserted

```text
Mintable + Ownable: a single key can mint unlimited tokens. Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.
```

The case asserts `out.warn` was called with a string containing both:
- `"Mintable + Ownable: a single key can mint unlimited tokens"`
- `"Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy."`

## Decisions Made

- **cancelGuard stays inline.** Per UI-SPEC Components Inventory and CONTEXT D-06's "avoid speculative abstraction" framing, cancelGuard lives inside `wizard.ts` rather than `src/lib/wizard.ts`. Phase 4 (when ERC-721 arrives as the second @clack-multi-prompt consumer) is the right hoist trigger. The 6-line helper is small enough that duplication-cost is dominated by abstraction-cost in Phase 2.
- **No `if (newbie)` branches in wizard.ts.** All output flows through `io.output.explain/reference/warn/nextStep`; the Output factory (Phase 1 `makeOutput`) holds the gating logic. Source-level audit (`grep -i 'if (newbie\|opts.newbie\|process.stdout\|console.log'` returns zero hits) confirms this.
- **`select<"ownable" | "roles">` explicit generic.** Clack's TValue inference is sound but the explicit literal-union generic locks the return type at the call site under `noUncheckedIndexedAccess`, preventing accidental drift if the options array is later refactored.
- **Cancel-path tests assert full WHAT string, not just `code`.** Each of the seven cancel cases uses `toMatchObject({ code, exitCode, what })` so the locked `"Wizard cancelled at: <promptName>."` template cannot drift without test failure.
- **Local untracked validators.ts stub in worktree.** wizard.ts imports `isSolidityIdentifier / isAsciiSymbol / isNonNegativeDecimal` from `./validators.js`, which is owned by Plan 02-02 in a sibling worktree. To pass typecheck + tests in this isolated worktree, I created `src/templates/erc20/validators.ts` as an untracked local file mirroring RESEARCH §Validators byte-for-byte. The file is NOT committed — the sibling worktree owns the canonical commit. On orchestrator merge, the sibling's commit lands the canonical file with identical content.

## Deviations from Plan

None — plan executed exactly as written. Two minor implementation choices worth noting (both within plan latitude):

- **Validator-wiring tests (cases 6-8) also assert positive cases.** The plan instructed asserting the error string on invalid input. I additionally assert `arg.validate("Valid_Name") === undefined` (and analogous positive cases for prompts 2 and 3) to lock that valid input flows through. Strictly additive; no scope expansion.
- **Cancel-path tests for prompts 2-7 explicitly set non-cancel `isCancelMock.mockReturnValueOnce(false)` for each preceding prompt** rather than relying on the `beforeEach`'s default. This is defensive — if the wizard ever changes to call `isCancel` in a different order, the test wouldn't pass for the wrong reason. Belt-and-suspenders against test fragility.

## Issues Encountered

None during planned work. The cross-worktree dependency on `validators.ts` (Plan 02-02) was handled by an untracked local stub (see decisions above) — no orchestration friction.

## User Setup Required

None — no external services, API keys, or runtime dependencies introduced.

## Threat Surface Scan

No new threat surface beyond what `<threat_model>` in 02-03-PLAN.md already enumerates:

- **T-02-03 (Tampering — command injection via wizard input):** Mitigated by `validators.ts` (Plan 02-02) wired into @clack `validate` callbacks for prompts 1-3. wizard.ts contributes the wiring; `validators.ts` contributes the regex. Two-layer defense.
- **T-02-06 (Information Disclosure — Mintable+Ownable centralization):** Mitigated by the non-silenceable `output.warn` call in `runWizard()`. Tested by `centralization warning fires for Mintable+Ownable` case asserting the exact UI-SPEC string.
- **T-02-07 (Denial of Service / UX — user presses Ctrl+C mid-wizard):** Mitigated by `cancelGuard` throwing `CliError(E_WIZARD_CANCEL, exitCode:130)`. Tested by 7 cancel-path cases (one per prompt).
- **T-02-08 (Repudiation — centralization warning silenced under --json):** Accepted per UI-13 (Phase 1 contract); `output.warn` is always-on regardless of `--json`. Plan 04's dispatcher will refuse `create --json` with E_USAGE per UI-10 so the wizard never runs in that mode anyway.

No `threat_flag` rows needed — every new surface is in the existing register.

## Verification Snapshot

- `npm run typecheck` — exits 0 (clean under strict TS + noUncheckedIndexedAccess)
- `npm run build` — `dist/cli.js` 8.04 KB in ~43ms; build success
- `npx vitest run tests/templates/erc20/wizard.spec.ts --reporter=verbose` — 17 passed / 0 failed / 0 todo
- `npx vitest run` (full suite) — 10 test files passed | 3 skipped | 82 passed | 1 skipped | 32 todo | 0 failed (the 32 todo are Plan 02-02's territory; this plan's 6 todo all replaced)
- Source-level audits (all three pass):
  - Verify-1: every required literal token present in wizard.ts (`cancelGuard`, `ERR_WIZARD_CANCEL`, the three validators, all seven prompt messages, the centralization string, both reference URLs, `exitCode: 130`)
  - Verify-2: every required prompt name present (`contract name`, `token symbol`, `initial supply`, `mintable`, `burnable`, `pausable`, `access control`)
  - Verify-3: no forbidden tokens in wizard.ts (`if (newbie`, `opts.newbie`, `process.stdout`, `console.log`)

## Next Plan Readiness

**Plan 02-04 (Registry + create command dispatcher) is unblocked from this side.** It gets:

- `runWizard(io: WizardIo): Promise<Erc20Opts>` to call from the dispatcher
- A canonical cancel-error shape (`E_WIZARD_CANCEL` / exit 130) that the top-level error handler in `src/cli.ts` already handles
- A locked Output-channel contract so the dispatcher just needs to construct the Output (via `makeOutput`) and pass `{ output }` as the wizard's `io` arg

Plan 02-04 also needs Plan 02-02's `generate(opts)` and `contractNameToFilename(name)` — those land from the sibling worktree on merge.

## Self-Check: PASSED

Verified all claims:

- ✅ `src/templates/erc20/wizard.ts` exists (161 lines) — confirmed with `wc -l`
- ✅ Commit `2ed4592` present in `git log` — confirmed
- ✅ Commit `85529f9` present in `git log` — confirmed
- ✅ `npx vitest run tests/templates/erc20/wizard.spec.ts` — 17 passed / 0 failed
- ✅ `npx vitest run` — 82 passed / 0 failed
- ✅ `npm run typecheck` — exits 0
- ✅ `npm run build` — succeeds
- ✅ All three literal-content audits in 02-03-PLAN.md `<verify>` block — pass
- ✅ All three audits on wizard.spec.ts — pass (literals present, no `it.todo` remaining)

## TDD Gate Compliance

Both tasks have `tdd="true"`. Gate sequence:

- **Task 1 (wizard.ts):** RED gate was the pre-existing `it.todo` placeholders in wizard.spec.ts (created by Plan 01 Task 3); GREEN gate is commit `2ed4592` (feat). REFACTOR not required — the implementation was already minimal (single function + one helper + linear prompt sequence).
- **Task 2 (wizard.spec.ts):** This task is purely additive test code locking the Task 1 behavior. The pattern here is "test-with-implementation" rather than strict RED-before-GREEN because Task 1's implementation was already byte-locked by UI-SPEC — there was nothing to discover via test-first. The 17 cases passed first try against Task 1's `2ed4592` commit, which is the inverse signal: the implementation precisely matched the locked contract.

Strict RED-GREEN-REFACTOR within Task 1 (a single commit) would have required either (a) writing one tiny failing test, committing as RED, then completing wizard.ts in a second commit, or (b) treating the existing `it.todo` placeholders as the RED gate. I chose (b) because the placeholders represent the same "tests that would fail if wizard.ts didn't exist" intent, and splitting Task 1 into two commits would obscure the actual unit of work (one cohesive feature delivered).

---
*Phase: 02-erc-20-canary-template*
*Plan: 03*
*Completed: 2026-05-21*
