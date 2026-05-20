---
phase: 02-erc-20-canary-template
plan: 02
subsystem: erc20-template
tags: [erc20, validators, filename, openzeppelin-wizard, snapshots, pure-functions, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-erc-20-canary-template
    plan: 01
    provides: "Erc20Opts/GenerateResult type contracts, @openzeppelin/wizard@0.10.8 pinned, 16 + 8 + 8 it.todo spec skeletons (validators/filename/generate), Wave 0 Probe A (naive import works) + Probe B (premint:'0' passthrough safe) decisions"
provides:
  - "Three @clack/prompts validator callbacks (isSolidityIdentifier / isAsciiSymbol / isNonNegativeDecimal) with UI-SPEC-locked error strings"
  - "contractNameToFilename pure function — derives PascalCase `<Name>.sol` from any user input, fallback `Token.sol`"
  - "generate(opts) thin wrapper around @openzeppelin/wizard erc20.print(); returns { filename, source } per D-04"
  - "Two committed golden snapshot fixtures (bare-default.sol 476 B, all-flags-on.sol 1628 B) — byte-for-byte lock on wizard@0.10.8 output (D-09)"
  - "Six per-flag axis assertions (burnable / mintable+ownable / mintable+roles / pausable+roles / premint>0 / SPDX) — D-09 axis coverage without 2^N snapshots (D-10)"
affects: [02-03-wizard-interactive, 02-04-registry-create-command, 02-05-snapshot-docs, 03-compile-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot fixture lock pattern: `toMatchFileSnapshot('<rel-path>.sol')` writes a real `.sol` file (syntax-highlightable) that Vitest 4 auto-populates on first run; LF-normalized via `.gitattributes eol=lf` + Vitest 4 PR #3164; diff in git is the audit trail for OZ wizard updates"
    - "Per-flag axis assertions: one `it` per behavior axis using `toContain`/`toMatch` against generated source — covers D-09 requirements without exhaustive 2^N snapshot combinations (D-10)"
    - "Verbatim-from-RESEARCH algorithm + bug-fix-when-test-table-disagrees: when a research-locked algorithm contradicts a research-locked test table, the test table wins; document the divergence inline in the source file header"

key-files:
  created:
    - "src/templates/erc20/validators.ts — three @clack validators with locked regex + locked UI-SPEC error strings"
    - "src/templates/erc20/filename.ts — contractNameToFilename pure function (PascalCase + fallback Token)"
    - "src/templates/erc20/generate.ts — thin erc20.print() wrapper returning { filename, source }; naive import per Probe A, passthrough per Probe B"
    - "tests/fixtures/erc20/bare-default.sol — 476-byte golden snapshot (LF), no flags, premint=1000000"
    - "tests/fixtures/erc20/all-flags-on.sol — 1628-byte golden snapshot (LF), all flags + access=roles"
  modified:
    - "tests/templates/erc20/validators.spec.ts — 16 it.todo -> 19 real assertions"
    - "tests/templates/erc20/filename.spec.ts — 8 it.todo -> 10 real assertions"
    - "tests/templates/erc20/generate.spec.ts — 8 it.todo -> 10 real assertions (2 snapshot + 6 per-flag + 2 shape)"

key-decisions:
  - "Naive import form `import { erc20 } from '@openzeppelin/wizard'` is used in generate.ts per Wave 0 Probe A (works under NodeNext + type:module); defensive default-destructure not required."
  - "premint mapping is PASSTHROUGH per Wave 0 Probe B — generate.ts forwards opts.premint unchanged (no `=== '0' ? undefined` remap) because wizard@0.10.8 internally suppresses the `_mint(...)` line when premint is '0'."
  - "generate.ts deliberately does NOT pass `info` to erc20.print() — wizard's default `{ license:'MIT', securityContact:'' }` matches wizard.openzeppelin.com byte-for-byte per Assumption A2."
  - "Snapshot fixtures use premint=1000000 (per CONTEXT D-09 / UI-SPEC UI-12), NOT premint=1000 from RESEARCH §Snapshot Test Mechanics' compact example (Plan 02-02 Task 3 action note explicitly overrides RESEARCH's number)."
  - "filename.ts split regex widened to `/[^A-Za-z0-9]+/` (drops `_` from the keep-class) so `my_token -> MyToken.sol` matches RESEARCH §Filename Derivation's locked test table. RESEARCH's verbatim `[^A-Za-z0-9_]+` would produce `My_token.sol` and fail the table. Test table is authoritative; algorithm body updated. Full rationale documented in `src/templates/erc20/filename.ts` header."

requirements-completed: [ERC20-01, ERC20-02, ERC20-03, ERC20-04, ERC20-05]

# Metrics
duration: ~8min
completed: 2026-05-20
---

# Phase 2 Plan 02: ERC-20 Wizard Pure Functions Summary

**Validators (`isSolidityIdentifier`/`isAsciiSymbol`/`isNonNegativeDecimal` with locked UI-SPEC error strings), `contractNameToFilename` PascalCase pure function, and a thin `generate()` wrapper over `@openzeppelin/wizard@0.10.8` `erc20.print()` returning `{ filename, source }`. Two LF-normalized golden snapshot fixtures (bare-default.sol 476 B, all-flags-on.sol 1628 B) lock byte-for-byte against wizard output; six per-flag axis assertions cover D-09 without 2^N snapshots.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-20T16:54:50Z
- **Completed:** 2026-05-20T17:02:53Z
- **Tasks:** 3 (all TDD: RED -> GREEN)
- **Files modified/created:** 8 (3 src created, 3 spec modified, 2 fixtures created)
- **Tests landed:** 39 new passing assertions (19 validators + 10 filename + 10 generate); full suite 104 passed, 0 failed
- **Lines changed:** roughly +566 / -111 (3 spec files filled; 3 src files + 2 fixtures created)

## Accomplishments

- **Wave 0 → Wave 1 pure-function half of the ERC-20 plugin landed.** Plan 02-03 (wizard) and Plan 02-04 (registry + dispatcher) can now import working `isSolidityIdentifier`/`isAsciiSymbol`/`isNonNegativeDecimal` (validators.ts), `contractNameToFilename` (filename.ts), and `generate(opts)` (generate.ts) without further changes to this layer.
- **All six UI-SPEC-locked error strings landed byte-exact.** "Contract name is required.", "Token symbol is required.", "Initial supply is required (use 0 for no premint).", "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.", "Must be 1-11 ASCII letters/digits, no spaces or punctuation.", "Must be a non-negative decimal number, e.g. 1000000 or 1.5." — Plan 02-03 wizard can now consume these as `validate: isSolidityIdentifier` etc. without re-typing copy.
- **Golden snapshots committed LF-normalized.** `tests/fixtures/erc20/bare-default.sol` (476 bytes) and `tests/fixtures/erc20/all-flags-on.sol` (1628 bytes) — the D-09 byte-for-byte lock against `@openzeppelin/wizard@0.10.8` output. Both inspected by hand: bare-default contains SPDX-MIT + pragma ^0.8.27 + ERC20+ERC20Permit parents + `_mint(recipient, 1000000 * 10 ** decimals())`; all-flags-on adds ERC20Burnable + ERC20Pausable + AccessControl with MINTER_ROLE/PAUSER_ROLE/DEFAULT_ADMIN_ROLE granting in the constructor.
- **Per-flag axis coverage replaces 2^N snapshots per D-10.** Six independent `it` cases (burnable / mintable+ownable / mintable+roles / pausable+roles / premint>0 / SPDX header) prove each requirement (ERC20-01..05) WITHOUT requiring a snapshot per flag combination. Snapshot regen via `vitest -u` becomes a deliberate audit-trail commit.
- **Wave 0 probe decisions applied verbatim.** generate.ts cites `.planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md` in its module header; uses naive `import { erc20 } from "@openzeppelin/wizard"` (Probe A) and forwards `opts.premint` unchanged (Probe B PASSTHROUGH SAFE — no `=== "0" ? undefined` remap).

## Task Commits

Each task followed strict TDD (RED then GREEN). All six commits are individual atomic units.

1. **Task 1 RED:** validators.spec.ts — `d7141a5` (test)
2. **Task 1 GREEN:** validators.ts implementation — `b0931df` (feat)
3. **Task 2 RED:** filename.spec.ts — `eee9e43` (test)
4. **Task 2 GREEN:** filename.ts implementation — `1ebea7a` (feat)
5. **Task 3 RED:** generate.spec.ts — `8b3957f` (test)
6. **Task 3 GREEN:** generate.ts + two snapshot fixtures — `2b3df64` (feat)

_Note: No refactor commits needed — all three GREEN implementations were already minimal (validators is six small regex+message blocks; filename is a six-line algorithm; generate is a twelve-line opts-mapping)._

## Files Created/Modified

**Created (5):**
- `src/templates/erc20/validators.ts` — 50 lines. Three exports + three locked regex constants + locked UI-SPEC error strings.
- `src/templates/erc20/filename.ts` — 28 lines. Single export `contractNameToFilename(contractName: string): string`. Pure, never throws.
- `src/templates/erc20/generate.ts` — 49 lines. Single export `generate(opts: Erc20Opts): GenerateResult`. Cites Probe A + Probe B inline.
- `tests/fixtures/erc20/bare-default.sol` — 476 bytes, LF. Bare ERC-20 with ERC20Permit default.
- `tests/fixtures/erc20/all-flags-on.sol` — 1628 bytes, LF. All flags + access=roles (MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE).

**Modified (3):**
- `tests/templates/erc20/validators.spec.ts` — 16 `it.todo` replaced with 19 real `expect(...).toBe(...)` assertions across three `describe` blocks (one per validator). Conditional-import guard removed (SUT now exists).
- `tests/templates/erc20/filename.spec.ts` — 8 `it.todo` replaced with 10 real assertions (eight RESEARCH table rows + defensive empty-string + no-throw contract). Conditional-import guard removed.
- `tests/templates/erc20/generate.spec.ts` — 8 `it.todo` replaced with 10 real assertions: 2 `toMatchFileSnapshot` golden cases + 6 per-flag `toContain`/`toMatch` cases + 2 return-shape cases. Conditional-import guard removed.

## Decisions Made

- **Naive import form `import { erc20 } from "@openzeppelin/wizard"`** in generate.ts (Probe A confirmed). Defensive default-destructure not needed — wizard@0.10.8 exposes `erc20` as a real ESM named export.
- **Premint passthrough** (Probe B PASSTHROUGH SAFE confirmed). generate.ts forwards `opts.premint` unchanged to `erc20.print()`. Wizard internally suppresses `_mint(...)` when premint is `"0"`.
- **No `info` passed to erc20.print().** The wizard's default `{ license: "MIT", securityContact: "" }` matches wizard.openzeppelin.com byte-for-byte (Assumption A2). Passing `info` explicitly would either be a no-op (same defaults) or diverge (snapshot churn).
- **filename.ts split widened from `[^A-Za-z0-9_]+` to `[^A-Za-z0-9]+`** to satisfy RESEARCH §Filename Derivation's locked test table row `my_token -> MyToken.sol`. The verbatim algorithm in RESEARCH would produce `My_token.sol` (preserving the underscore). When research-locked algorithm and research-locked test table disagree, the test table wins because it directly states the observable behavior. Full rationale documented in `src/templates/erc20/filename.ts` header.
- **Snapshot inputs use premint=1000000 not 1000.** RESEARCH §Snapshot Test Mechanics' code example used `premint:"1000"` for compactness; CONTEXT D-09 and UI-SPEC UI-12 both specify `1000000` as the canonical default. Plan 02-02 Task 3 action note explicitly resolved this — we followed CONTEXT/UI-SPEC.

## Deviations from Plan

Three deviations, all auto-applied per the executor's deviation rules (no Rule 4 architectural decisions required):

### Auto-fixed Issues

**1. [Rule 1 - Bug] filename.ts split regex contradicted its own test table**
- **Found during:** Task 2 GREEN (initial implementation pasted RESEARCH's verbatim `/[^A-Za-z0-9_]+/`)
- **Issue:** With the underscore preserved in the keep-class, `my_token` produced `"My_token"` (single segment), not `"MyToken"` (two PascalCased segments). The RESEARCH §Filename Derivation test-case table row `my_token -> MyToken.sol` is the locked observable contract; the verbatim algorithm could not satisfy it.
- **Fix:** Changed split regex to `/[^A-Za-z0-9]+/` (drops `_` from the keep-class). All other test rows continue to pass.
- **Files modified:** `src/templates/erc20/filename.ts` (header block + body regex)
- **Commit:** `1ebea7a` (single GREEN commit absorbs the correction)

**2. [Rule 3 - Blocking] @openzeppelin/wizard not in worktree's node_modules**
- **Found during:** Task 3 GREEN first `npx vitest run`
- **Issue:** `Error: Cannot find package '@openzeppelin/wizard' imported from src/templates/erc20/generate.ts`. The worktree was forked before Plan 02-01 added `@openzeppelin/wizard@0.10.8` to package.json + package-lock.json; the worktree's node_modules existed but was empty for that package.
- **Fix:** Ran `npm install` (no package name — environment sync against the already-committed lockfile; not a new install). The package was already legitimacy-audited and pinned exactly in Plan 02-01, so this falls outside the Rule 3 package-install exclusion (which is about preventing slopsquatted-package auto-install). 109 packages installed; 0 vulnerabilities.
- **Files modified:** none (only the worktree's node_modules)
- **Commit:** none — environment-only, no source change

**3. [Rule 1 - Bug] Two extra "boundary" assertions added beyond RESEARCH table**
- **Found during:** Task 1 RED test writing
- **Issue:** RESEARCH §Validators table has 11 rows; the plan's `<behavior>` block adds the `"a".repeat(65)` over-length case and an empty-string case for each validator. To cover all `<behavior>` rows the spec ended up with 19 assertions (16 it.todo originally), which exceeds RESEARCH's table-only coverage but exactly matches the plan's `<behavior>` lock.
- **Fix:** This is not really a bug — it's a clarification. The spec covers the plan's `<behavior>` block in full, which is a superset of the RESEARCH table. Documented here for transparency; no plan deviation.
- **Files modified:** `tests/templates/erc20/validators.spec.ts` (intentional)
- **Commit:** `d7141a5`

## Issues Encountered

None during planned work. The plan's three tasks landed in order; each TDD cycle was clean (RED failed for the documented reason, GREEN passed on first try except for the filename split-regex bug noted above). Full suite is 104 passed / 0 failed.

## User Setup Required

None — no external service configuration introduced. The `npm install` to sync the lockfile is one-time per worktree and does not require user intervention.

## Threat Surface Scan

Reviewed against the plan's `<threat_model>`:

- **T-02-03 (Tampering — wizard input injection) → MITIGATED at validator layer.** validators.ts rejects anything outside `^[A-Za-z_][A-Za-z0-9_]{0,63}$` for name and `^[A-Za-z0-9]{1,11}$` for symbol; the second layer (wizard SDK programmatic source construction, never concatenation) is preserved because generate.ts is a thin wrapper that does not post-process the source.
- **T-02-04 (Tampering — snapshot files) → MITIGATED.** Both fixtures committed to git with LF endings (`.gitattributes eol=lf` in effect). Vitest 4's PR #3164 EOL normalization in `toMatchFileSnapshot` means future regen via `vitest -u` will produce LF on every platform.
- **T-02-05 (Mintable+Ownable centralization) → DEFERRED to Plan 02-03 per plan.** This plan does not surface `output.warn` — that lives in `runWizard` (Plan 02-03). generate.ts emits exactly what the user asked for; the warning is a wizard-time UX layer.

No `threat_flag` rows needed — no new surface beyond what the plan anticipated.

## Verification Snapshot

- `npx vitest run tests/templates/erc20/validators.spec.ts` — 19 / 19 passed
- `npx vitest run tests/templates/erc20/filename.spec.ts` — 10 / 10 passed
- `npx vitest run tests/templates/erc20/generate.spec.ts` — 10 / 10 passed (2 snapshots written on first run, then matched)
- `npx vitest run tests/templates/erc20` — 39 passed, 0 failed (the 6 todo are wizard.spec.ts placeholders owned by Plan 02-03)
- `npx vitest run` — 104 passed | 1 skipped | 6 todo | 0 failed
- `npm run typecheck` — exit 0 (strict TS + noUncheckedIndexedAccess clean)
- `npm run build` — `dist/cli.js` 8.04 KB ESM, 50 ms build success
- Both fixtures exist and are LF-only (verified via `for (const x of buffer) if (x === 0x0D) ...` byte scan)
- Both fixtures contain the expected OZ identifiers: bare-default has `SPDX-License-Identifier: MIT` + `contract MyToken`; all-flags-on additionally has `AccessControl` + `MINTER_ROLE` + `PAUSER_ROLE` + `ERC20Burnable` + `ERC20Pausable`
- generate.ts cites Wave 0 probes in its header comment (string `02-WAVE0-PROBES` present)

## Per-Flag Assertion Identifiers (D-09 axis map)

For Plan 02-04 and the verifier:

| Axis | Test name | Coverage |
|------|-----------|----------|
| burnable | `burnable=true includes ERC20Burnable import + parent` | ERC20-03 |
| mintable+ownable | `mintable=true with access=ownable includes Ownable + mint() onlyOwner` | ERC20-02 + ERC20-05 (ownable arm) |
| mintable+roles | `mintable=true with access=roles includes AccessControl + MINTER_ROLE` | ERC20-02 + ERC20-05 (roles arm) |
| pausable+roles | `pausable=true with access=roles includes ERC20Pausable + PAUSER_ROLE` | ERC20-04 + ERC20-05 |
| premint>0 | `premint > 0 emits _mint(recipient, N * 10 ** decimals())` | ERC20-01 |
| SPDX header | `emits SPDX-MIT and OZ-Contracts-5.x compatibility comment` | ROADMAP SC-4 supporting axis |

## Next Plan Readiness

**Plan 02-03 (Interactive Wizard) is unblocked.** It can now:

- `import { isSolidityIdentifier, isAsciiSymbol, isNonNegativeDecimal } from "./validators.js"` and use them as `@clack/prompts` validators — the locked error strings match UI-SPEC byte-exact.
- `import { generate } from "./generate.js"` if it needs to test the wizard's full opts -> source path (though typically Plan 02-04 dispatcher calls it, not the wizard itself).
- Reuse the spec scaffolding pattern (`vi.mock("@clack/prompts", ...)` + top-level `await import(SUT)`) from `tests/prompt.spec.ts` for `tests/templates/erc20/wizard.spec.ts`.

**Plan 02-04 (Registry + create command)** has both `generate()` (returns `{ filename, source }` ready for `fs.writeFile`) and `contractNameToFilename` (for the default `--out` derivation when the flag is absent) ready to import.

**Plan 02-05 (Snapshot Docs)** has the two locked fixtures in place; the snapshot regen workflow documented in CONTEXT D-09 / RESEARCH §Snapshot Test Mechanics is exercised.

No blockers. No follow-up TODOs introduced.

## Self-Check: PASSED

Verified all SUMMARY.md claims against disk + git:

- src/templates/erc20/validators.ts present (50 lines)
- src/templates/erc20/filename.ts present (28 lines)
- src/templates/erc20/generate.ts present (49 lines)
- tests/fixtures/erc20/bare-default.sol present (476 bytes, LF)
- tests/fixtures/erc20/all-flags-on.sol present (1628 bytes, LF)
- Commits d7141a5, b0931df, eee9e43, 1ebea7a, 8b3957f, 2b3df64 all present in `git log`
- Full vitest suite: 104 passed | 1 skipped | 6 todo | 0 failed
- Typecheck + build clean
- Wave 0 probe citations (Probe A + Probe B) present in generate.ts header
- LF-only verified on both fixtures (byte-scan against 0x0D)
- Six per-flag axis tests all named and labelled per D-09

---
*Phase: 02-erc-20-canary-template*
*Plan: 02*
*Completed: 2026-05-20*
