---
phase: 04-erc-721-and-erc-1155-templates
plan: 03
subsystem: templates
tags: [erc1155, multi-token, openzeppelin-wizard, plugin, wizard, golden-snapshot, parallel]

# Dependency graph
requires:
  - phase: 02-erc-20-canary-template
    provides: plugin contract (runWizard → generate), golden-snapshot strategy, cancelGuard + validator patterns, registry register/get
  - plan: 04-01
    provides: committed erc1155 fixtures (bare-default, all-flags-on), Wizard→Opts mapping table, updatableUri:true finding
provides:
  - registerErc1155Template() — registers id=erc1155, chain=evm, status=alpha (NOT yet booted; plan 04-04 wires src/cli.ts)
  - Erc1155Opts type contract (name/uri/mintable/burnable/supply/pausable/access — NO royalty, NO updatableUri field)
  - runWizard(io) — 7-prompt ERC-1155 wizard with 3 centralization warnings
  - generate(opts) — thin erc1155.print wrapper, updatableUri:true literal, no post-process
  - isNonEmptyUri validator (new) + isSolidityIdentifier (cloned)
affects: [04-04]

# Tech tracking
tech-stack:
  added: []   # zero new packages — reuses @openzeppelin/wizard@0.10.8
  patterns:
    - "ERC-1155 wizard default updatableUri:true passed as a hardcoded literal in generate.ts (not surfaced as a prompt) — RESEARCH Pitfall 3"
    - "always-on centralization warning (updatableUri owner-controlled) fires on EVERY wizard completion, in addition to 2 conditional Ownable warnings"
    - "it.each-parametrized cancel-at-each-prompt coverage (7 prompt indices)"

key-files:
  created:
    - src/templates/erc1155/opts.ts
    - src/templates/erc1155/validators.ts
    - src/templates/erc1155/filename.ts
    - src/templates/erc1155/index.ts
    - src/templates/erc1155/wizard.ts
    - src/templates/erc1155/generate.ts
    - src/templates/erc1155/README.md
    - tests/templates/erc1155/wizard.spec.ts
    - tests/templates/erc1155/generate.spec.ts
    - tests/templates/erc1155/validators.spec.ts
  modified: []

key-decisions:
  - "No royalty surface anywhere in src/templates/erc1155/ (CONTEXT D-08 — EIP-2981 on ERC-1155 deferred to v2)."
  - "updatableUri is NOT an Erc1155Opts field — the wizard default true is a literal in generate.ts (RESEARCH Pitfall 3), matching wizard.openzeppelin.com and the committed bare-default fixture (Ownable + setURI)."
  - "Conditional access prompt + cancelGuard duplicated verbatim from erc20/wizard.ts (CONTEXT D-10 — no shared-module extraction)."

requirements-completed: [ERC1155-01, ERC1155-02, ERC1155-03, ERC1155-04, ERC1155-05]

# Metrics
duration: ~18min
completed: 2026-05-28
---

# Phase 4 Plan 03: ERC-1155 Multi-Token Template Summary

**Shipped the complete ERC-1155 multi-token plugin (7-prompt wizard, thin `erc1155.print` generate wrapper with `updatableUri:true` literal, no royalty per D-08) plus 32 passing tests — both golden snapshots match the committed plan-04-01 fixtures byte-for-byte.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-28T13:10:00Z
- **Completed:** 2026-05-28T13:27:39Z
- **Tasks:** 3 / 3
- **Files created:** 10 (7 source/README under `src/templates/erc1155/`, 3 specs under `tests/templates/erc1155/`)

## Task Commits

1. **Task 1: type contracts + validators + filename + barrel** — `6b67eda` (feat)
2. **Task 2: wizard (7 prompts, 3 warnings) + generate** — `f82df29` (feat)
3. **Task 3: 3 specs + README** — `b744774` (test)

## Files Created (line counts)

| File | Lines |
|------|-------|
| `src/templates/erc1155/filename.ts` | 6 |
| `src/templates/erc1155/generate.ts` | 43 |
| `src/templates/erc1155/index.ts` | 40 |
| `src/templates/erc1155/opts.ts` | 54 |
| `src/templates/erc1155/validators.ts` | 36 |
| `src/templates/erc1155/wizard.ts` | 176 |
| `src/templates/erc1155/README.md` | 50 |
| `tests/templates/erc1155/generate.spec.ts` | 147 |
| `tests/templates/erc1155/validators.spec.ts` | 69 |
| `tests/templates/erc1155/wizard.spec.ts` | 350 |

## Happy-Path Prompt Sequence (LOCKED — clone for plan 04-04's E2E test)

The wizard asks prompts in this exact order. Prompt 7 (access) fires ONLY when mintable OR pausable is true.

| # | Prompt message | Type | Default | Validator |
|---|----------------|------|---------|-----------|
| preamble | `explain("ERC-1155 is the multi-token standard — one contract holds multiple token IDs (fungible OR non-fungible).")` + `reference("EIP-1155", "https://eips.ethereum.org/EIPS/eip-1155")` + `reference("OpenZeppelin ERC1155 docs", "https://docs.openzeppelin.com/contracts/5.x/erc1155")` | — | — | — |
| 1 | `Contract name (Solidity identifier)` | text | `MyMulti` | `isSolidityIdentifier` |
| 2 | `URI template (use the literal {id} placeholder)` | text | `https://example.com/api/token/{id}.json` | `isNonEmptyUri` |
| 3 | `Enable Mintable? (an authorized account can mint new token IDs / quantities after deploy)` | confirm | `false` | — |
| 4 | `Enable Burnable? (holders can burn their own balances)` | confirm | `false` | — |
| 5 | `Enable Supply tracking? (adds totalSupply(id) + totalSupply())` | confirm | `false` | — |
| 6 | `Enable Pausable? (an authorized account can freeze all transfers)` | confirm | `false` | — |
| 7 | `Access control style:` (select `ownable`/`roles`, initialValue `ownable`) | select | `ownable` | — |

**Bare happy path** (all defaults, no flags): name=`MyMulti`, uri=default, mintable/burnable/supply/pausable=`false` → prompt 7 SKIPPED → returns `{ name:"MyMulti", uri:"https://example.com/api/token/{id}.json", mintable:false, burnable:false, supply:false, pausable:false, access:false }`. The bare-default generated contract still includes `Ownable` + `setURI` because `updatableUri:true` is passed as a literal.

## Centralization Warnings (post-prompt, via `output.warn`)

| Warning | Condition | Test result |
|---------|-----------|-------------|
| `Mintable + Ownable: a single key can mint unlimited quantities of any token id. ...` | `mintable && access==="ownable"` | conditional — verified (happy path B) |
| `Pausable + Ownable: a single key can halt all transfers across every token id. ...` | `pausable && access==="ownable"` | conditional — verified |
| `ERC-1155 default-URI setter is owner-controlled (wizard default updatableUri:true). ...` | **always** (every wizard completion) | verified in EVERY happy path (A=1 warn, B=2 warns, C=1 warn) |

## Snapshot-Match Status (golden, against committed plan-04-01 fixtures)

| Fixture | Bytes | `toMatchFileSnapshot` |
|---------|-------|-----------------------|
| `tests/fixtures/erc1155/bare-default.sol` | 519 | PASS (byte-for-byte; fixture unmodified by test) |
| `tests/fixtures/erc1155/all-flags-on.sol` | 2309 | PASS (byte-for-byte; fixture unmodified by test) |

`git status tests/fixtures/erc1155/` is clean after the run — confirms a true match, not a snapshot rewrite.

## Verification Results

- `npx vitest run tests/templates/erc1155/` — **32 passed (3 files)**. Breakdown: wizard.spec 5 happy/wiring + 7 cancel; generate.spec 2 snapshots + 6 per-flag/shape; validators.spec 9.
- `npm run typecheck` — **clean for all `src/templates/erc1155/` files** (verified `tsc --noEmit | grep erc1155` → no matches). See Deviations for the out-of-scope erc721 typecheck noise.
- Additive-only check PASS: each of the 3 commits (`6b67eda`, `f82df29`, `b744774`) touches ONLY `src/templates/erc1155/` + `tests/templates/erc1155/`. No modifications to `src/cli.ts`, `src/commands/create.ts`, `src/compiler/*`, `src/registry/*`, `src/lib/*`, `src/templates/erc20/*`, or `src/templates/erc721/*`.
- No royalty references anywhere in `src/templates/erc1155/`.

## Requirements Completed

- **ERC1155-01** — wizard collects name + uri; bare-default snapshot validates emitted Solidity.
- **ERC1155-02** — per-flag assertions confirm Mintable / Burnable wire into `erc1155.print()`.
- **ERC1155-03** — Supply opt-in propagates; per-flag assertion confirms `ERC1155Supply`.
- **ERC1155-04** — Pausable opt-in propagates; per-flag assertion confirms `ERC1155Pausable`.
- **ERC1155-05** — conditional access prompt fires when mintable OR pausable; both `ownable` and `roles` branches covered.

## Deviations from Plan

### Out-of-scope (logged, NOT fixed)

**1. [Scope boundary] `npm run typecheck` reports 2 TS2307 errors in `src/templates/erc721/index.ts`**
- **Found during:** Task 1 verify (`npm run typecheck`).
- **Issue:** `src/templates/erc721/index.ts` imports `./wizard.js` / `./generate.js`, which had not yet landed in the shared working tree when 04-03 ran. These belong to the parallel Wave 1 plan **04-02 (ERC-721)** — out of scope per the strict file-scope mandate.
- **Action:** NOT fixed. Logged to `.planning/phases/04-erc-721-and-erc-1155-templates/deferred-items.md`. All `src/templates/erc1155/` files typecheck clean (the only scope I own). The interleaved erc721 commits (`d8d590b`, `82158b0`) confirm 04-02 was committing into the same tree concurrently; subsequent commits resolve the erc721 errors.

No other deviations — the ERC-1155 plugin executed exactly as planned (Rules 1-4 not triggered for in-scope work).

## Constraints Honored

- ZERO modifications outside `src/templates/erc1155/` + `tests/templates/erc1155/`.
- Did NOT register the template in `src/cli.ts` (plan 04-04's job).
- Did NOT touch `tests/registry.spec.ts` (the `it.skip` stub stays skipped).
- Did NOT update STATE.md / ROADMAP.md / push (per orchestrator instructions).
- generate.ts is a thin `erc1155.print` wrapper with `updatableUri:true` literal — no post-process, no royalty.
- Reused `ERR_WIZARD_CANCEL`; no new error codes.

## Self-Check: PASSED
- All 10 created files verified present on disk.
- All 3 task commits + hashes verified in git log.
- Both golden snapshots compile-match the committed fixtures (the stop condition).
