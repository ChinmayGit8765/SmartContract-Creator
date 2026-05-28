---
phase: 04-erc-721-and-erc-1155-templates
plan: 01
subsystem: templates
tags: [erc721, erc1155, eip-2981, royalty, fixtures, openzeppelin-wizard, solc, post-process]

# Dependency graph
requires:
  - phase: 02-erc-20-canary-template
    provides: plugin contract (runWizard → generate), golden-snapshot strategy, validator/cancelGuard patterns, registry register/get/list
  - phase: 03-compile-verify-safety-net
    provides: compileVerify(source, "evm") gate with evmVersion "cancun" + bundled OZ resolver
provides:
  - injectRoyalty(source, Erc721RoyaltyOpts) — 4-anchor EIP-2981 post-process (bracket-counting walker)
  - Erc721RoyaltyOpts type (enabled / feeNumerator / receiver)
  - 5 golden fixtures (3 erc721 + 2 erc1155) — all compile clean under the Phase 3 gate
  - D-14 E_USAGE fix-copy listing all three templates
  - it.skip three-template no-collision registry stub (plan 04-04 flips to live)
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []   # zero new packages — reuses @openzeppelin/wizard@0.10.8, @openzeppelin/contracts@5.6.1, solc@0.8.35
  patterns:
    - "4-anchor royalty post-process (bracket-counting walker, NOT regex, for the ctor-body anchor)"
    - "anchor 4 dual-mode: extend existing supportsInterface override (4a) OR inject one for the ERC721+ERC2981 diamond (4b)"
    - "throwaway fixture-generation script (not committed) per RESEARCH §Specifics"

key-files:
  created:
    - src/templates/erc721/royalty.ts
    - src/templates/erc721/opts.ts
    - tests/fixtures/erc721/bare-default.sol
    - tests/fixtures/erc721/all-flags-on.sol
    - tests/fixtures/erc721/all-flags-on-with-royalty.sol
    - tests/fixtures/erc1155/bare-default.sol
    - tests/fixtures/erc1155/all-flags-on.sol
    - tests/templates/erc721/royalty.spec.ts
  modified:
    - src/commands/create.ts
    - tests/registry.spec.ts
    - tests/commands/create.spec.ts

key-decisions:
  - "Anchor 4 must INJECT a supportsInterface(ERC721, ERC2981) override when the wizard emits none (bare/Ownable-only) — RESEARCH §Pitfall 4 was wrong that ERC2981's ERC165-inherited impl is sufficient; the diamond requires an explicit override."
  - "ERC-1155 bare-default includes Ownable + setURI (wizard default updatableUri:true) per RESEARCH Pitfall 3 — matches wizard.openzeppelin.com byte-for-byte."
  - "Fixtures generated via a throwaway scripts/gen-phase4-fixtures.mts (tsx), deleted after commit — regeneration script deferred to v2."

patterns-established:
  - "injectRoyalty 4-anchor walker — the ONE Phase 4 deviation from Phase 2 D-02 (no string templating); each anchor is a single string.replace or a bracket-counting walk, never a template body."
  - "Royalty opt-out invariant (D-06): injectRoyalty({enabled:false,...}) returns input by reference identity."

requirements-completed: [ERC721-01, ERC721-02, ERC721-03, ERC721-04, ERC1155-01, ERC1155-02, ERC1155-03, ERC1155-04]

# Metrics
duration: ~80min
completed: 2026-05-28
---

# Phase 4 Plan 01: ERC-721 + ERC-1155 Wave 0 Foundation Summary

**Shipped the EIP-2981 royalty post-process (4-anchor bracket-counting walker), 5 golden wizard fixtures that all compile clean through the Phase 3 gate, and the registry/E_USAGE foundation that unblocks the two parallel template plans (04-02 / 04-03).**

## Performance

- **Duration:** ~80 min
- **Started:** 2026-05-28T05:48:25Z
- **Completed:** 2026-05-28T~07:10Z
- **Tasks:** 3 / 3
- **Files created/modified:** 11

## Accomplishments
- `injectRoyalty` lands all four EIP-2981 anchors correctly across bare, Ownable+mintable, and all-flags+roles wizard outputs; each result compiles clean under `compileVerify(source, "evm")`.
- All 5 committed fixtures compile clean under the Phase 3 gate (evmVersion `cancun`).
- Discovered + fixed an architectural correctness gap (anchor 4b — see Deviations) that RESEARCH had marked as a no-op; the fix keeps the post-process within the D-05 "targeted insertion" model.
- Full suite green: **161 passed, 2 skipped (163)**; build clean.

## Task Commits

1. **Task 1: royalty.ts (4-anchor walker) + Erc721RoyaltyOpts** — `488a8f3` (feat)
2. **Task 2: 5 fixtures + D-14 E_USAGE copy + registry it.skip stub** — `1b0a250` (feat)
3. **Task 3: royalty.spec.ts (4 cases) + anchor 4b override fix** — `79b49fa` (test)

## Files Created/Modified
- `src/templates/erc721/royalty.ts` — `injectRoyalty` 4-anchor post-process + `insertAtConstructorBodyEnd` + `insertAtContractBodyEnd` (anchor 4b helper).
- `src/templates/erc721/opts.ts` — minimal `Erc721RoyaltyOpts` type (full `Erc721Opts` arrives in 04-02).
- `tests/fixtures/erc721/{bare-default,all-flags-on,all-flags-on-with-royalty}.sol` — committed LF-encoded wizard outputs.
- `tests/fixtures/erc1155/{bare-default,all-flags-on}.sol` — committed LF-encoded wizard outputs.
- `tests/templates/erc721/royalty.spec.ts` — 4 `it()` cases, no mocks, real solc compile gate.
- `src/commands/create.ts` — E_USAGE fix-copy only (D-14).
- `tests/registry.spec.ts` — `it.skip` three-template no-collision stub.
- `tests/commands/create.spec.ts` — updated stale E_USAGE fix-hint assertion (Rule 1, see Deviations).

## Anchor-by-anchor Validation Table (from royalty.spec.ts, real solc 0.8.35 + OZ 5.6.1)

| Scenario | A1 import | A2 `is` list | A3 ctor body | A4 supportsInterface | compiles |
|----------|-----------|--------------|--------------|----------------------|----------|
| bare ERC-721 + 250bps | fires | fires (`, ERC2981`) | fires into empty `{}` body | **4b** — injects `override(ERC721, ERC2981)` | clean (0 warn) |
| Ownable + mintable + 500bps | fires | fires | fires after Ownable init | **4b** — injects override | clean (0 warn) |
| all-flags + roles + 250bps | fires | fires | fires after `_grantRole` calls | **4a** — extends `override(ERC721, ERC721Enumerable, AccessControl)` → `, ERC2981` | clean (0 warn) |
| `enabled:false` (opt-out, D-06) | — | — | — | — | n/a (returns input by reference identity) |

## Fixture Byte Counts (LF-encoded)

| Fixture | Bytes |
|---------|-------|
| `tests/fixtures/erc721/bare-default.sol` | 254 |
| `tests/fixtures/erc721/all-flags-on.sol` | 2155 |
| `tests/fixtures/erc721/all-flags-on-with-royalty.sol` | 2320 |
| `tests/fixtures/erc1155/bare-default.sol` | 519 |
| `tests/fixtures/erc1155/all-flags-on.sol` | 2309 |

## Wizard → Opts Prompt Mapping (CRITICAL for Waves 1 & 2)

Downstream plans 04-02 (erc721) and 04-03 (erc1155) MUST use these exact `*.print()` argument shapes so their `generate.spec.ts` snapshots match the committed fixtures. Import form is the namespaced `import { erc721, erc1155 } from "@openzeppelin/wizard";`.

### ERC-721 — `erc721.print(opts)` argument mapping (Erc721Opts → wizard)

| Erc721Opts field (04-02 type) | wizard `erc721.print` key | bare-default value | all-flags-on value |
|-------------------------------|---------------------------|--------------------|--------------------|
| `name` | `name` | `"MyNFT"` | `"MyNFT"` |
| `symbol` | `symbol` | `"MNFT"` | `"MNFT"` |
| `baseUri` | `baseUri` | `""` (omit / empty) | `"https://example.com/api/token/"` |
| `mintable` | `mintable` | `false` | `true` |
| `enumerable` | `enumerable` | `false` | `true` |
| `burnable` | `burnable` | `false` | `true` |
| `pausable` | `pausable` | `false` | `true` |
| `uriStorage` | `uriStorage` | `false` | `false` (reserved, NOT surfaced in wizard — RESEARCH Open Q3) |
| `access` | `access` | `false` | `"roles"` |
| `royalty` | (NONE — not a wizard key) | n/a | n/a — applied via `injectRoyalty` AFTER `print` |

- bare-default = `erc721.print({ name:"MyNFT", symbol:"MNFT" })` — every other field is the wizard default.
- Royalty is NEVER a `print` key (D-04). `generate.ts` (04-02) does: `let source = erc721.print(map(opts)); if (opts.royalty.enabled) source = injectRoyalty(source, opts.royalty);`.
- The committed `all-flags-on-with-royalty.sol` = `all-flags-on` piped through `injectRoyalty({ enabled:true, feeNumerator:250, receiver:"0x"+"0".repeat(40) })`.

### ERC-1155 — `erc1155.print(opts)` argument mapping (Erc1155Opts → wizard)

| Erc1155Opts field (04-03 type) | wizard `erc1155.print` key | bare-default value | all-flags-on value |
|--------------------------------|----------------------------|--------------------|--------------------|
| `name` | `name` | `"MyMulti"` | `"MyMulti"` |
| `uri` | `uri` | `"https://example.com/api/token/{id}.json"` | same |
| `mintable` | `mintable` | `false` | `true` |
| `burnable` | `burnable` | `false` | `true` |
| `supply` | `supply` | `false` | `true` |
| `pausable` | `pausable` | `false` | `true` |
| (always-on) | `updatableUri` | `true` (wizard default — pass explicitly per RESEARCH Pattern 4) | `true` |
| `access` | `access` | `false` | `"roles"` |

- bare-default = `erc1155.print({ name:"MyMulti", uri:"https://example.com/api/token/{id}.json" })` — wizard default `updatableUri:true` adds `Ownable + setURI(...)` (Pitfall 3; this is correct, matches wizard.openzeppelin.com).
- 04-03's `generate.ts` should pass `updatableUri: true` explicitly to mirror RESEARCH §Pattern 4.

## Literal new E_USAGE copy (for plan 04-04 reference)

`src/commands/create.ts`, the `!globalOpts.template` CliError branch (D-14):

```
what: "Missing --template flag.",
why:  "`smartc create` requires --template. Three templates ship in Phase 4: erc20, erc721, erc1155. The interactive multi-template picker is deferred.",
fix:  "Re-run with `--template <erc20|erc721|erc1155>`. Run `smartc list-templates` to see available templates.",
exitCode: 2,
```

`what`, `code` (`E_USAGE`), and `exitCode` (2) are UNCHANGED — only `why` and `fix` changed (D-12: dispatcher otherwise untouched).

## Registry stub (for plan 04-04)

`tests/registry.spec.ts` has an `it.skip("registers all three Phase 4 templates without collision and exposes runWizard/generate")` with a `TODO(plan 04-04)` comment. To activate in 04-04:
1. Add imports: `registerErc721Template` from `../src/templates/erc721/index.js`, `registerErc1155Template` from `../src/templates/erc1155/index.js` (documented at the top of the file).
2. Flip `it.skip` → `it`.
3. Uncomment the two `register*Template()` calls inside the body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Anchor 4 must inject a supportsInterface override for the ERC721+ERC2981 diamond**
- **Found during:** Task 3 (royalty.spec.ts — bare + Ownable-only cases failed `compileVerify`).
- **Issue:** RESEARCH §Pitfall 4 + §Probe C asserted anchor 4 "no-ops correctly" for bare/Ownable-only outputs and the result compiles, claiming ERC2981 "implements its own supportsInterface via inheritance from ERC165." This is incorrect: `ERC721` AND `ERC2981` BOTH declare `supportsInterface`, so adding ERC2981 to the `is` list (anchor 2) creates a diamond that Solidity refuses to compile (`TypeError: Derived contract must override function "supportsInterface". Two or more base classes define function with same name`).
- **Fix:** Anchor 4 is now dual-mode. **4a** (override present): extend the existing `override(...)` list — unchanged behavior, used by all-flags+roles. **4b** (override absent): inject a minimal `function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) { return super.supportsInterface(interfaceId); }` before the contract's closing brace via a new `insertAtContractBodyEnd` bracket-counting helper. This stays within the D-05 "single targeted insertion" model — no new template body.
- **Impact on downstream:** Wave 1 plan 04-02's `generate.ts` consumes `injectRoyalty` unchanged. Any 04-02 `generate.spec.ts` snapshot for a **bare-or-Ownable ERC-721 WITH royalty** will now contain an injected `supportsInterface(ERC721, ERC2981)` block — expect it. The committed `all-flags-on-with-royalty.sol` fixture (4a path) is **unchanged** (verified by regenerating and diffing against the current royalty.ts output: exact match).
- **Files modified:** `src/templates/erc721/royalty.ts`, `tests/templates/erc721/royalty.spec.ts` (cases 1 & 2 now assert the injected override rather than its absence).
- **Commit:** `79b49fa`

**2. [Rule 1 - Bug] Stale E_USAGE fix-hint assertion in tests/commands/create.spec.ts**
- **Found during:** Task 2 (the D-14 copy change broke an existing assertion at `create.spec.ts:151`).
- **Issue:** `create.spec.ts` asserted `err.fix` `toContain("--template erc20")` against the OLD Phase 2 copy. The D-14 copy change (which the plan mandates) makes that substring no longer present.
- **Fix:** Updated the assertion to `toContain("--template <erc20|erc721|erc1155>")` — matches the new locked D-14 copy. Directly caused by this task's E_USAGE edit, so in-scope.
- **Files modified:** `tests/commands/create.spec.ts`
- **Commit:** `1b0a250`

## Verification Results
- `npm run typecheck` — clean.
- `npx vitest run` — **161 passed, 2 skipped (163 total)** across 20 test files. The 2 skips are the new registry three-template stub (`registry.spec.ts:109`) + a pre-existing overwrite-e2e skip (`cli.spec.ts:111`).
- `npm run build` (tsup) — clean (`dist/cli.js 22.35 KB`, build success).
- All 5 fixtures verified ASCII / LF (no CRLF) and compiled clean via the Phase 3 gate.
- `grep "<erc20|erc721|erc1155>" src/commands/create.ts` — exactly 1 match.
- `scripts/gen-phase4-fixtures.mts` deleted (throwaway, not committed).

## Constraints Honored
- ZERO modifications to `src/compiler/`, `src/registry/`, `src/lib/`, or `src/templates/erc20/`. `ERR_INVALID_INPUT` confirmed present at `src/lib/errors.ts` — no new code.
- `src/commands/create.ts` — only the E_USAGE `why`/`fix` lines changed (D-12).
- Zero new packages installed.

## Self-Check: PASSED
- All 8 created files verified present on disk.
- All 3 task commits + their hashes verified in git log.
- Royalty fixture (the stop-condition) compiles clean.
