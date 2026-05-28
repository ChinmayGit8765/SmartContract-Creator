---
phase: 04-erc-721-and-erc-1155-templates
plan: 02
subsystem: templates
tags: [erc721, nft, eip-2981, royalty, wizard, clack, snapshot, plugin, parallel, wave-1]

# Dependency graph
requires:
  - phase: 04-erc-721-and-erc-1155-templates
    plan: 01
    provides: injectRoyalty 4-anchor post-process, Erc721RoyaltyOpts type, 3 committed erc721 fixtures, E_USAGE 3-template copy
  - phase: 02-erc-20-canary-template
    provides: plugin 4-file pattern (index/wizard/generate/opts), cancelGuard, validator shape, Vitest 4 ESM mock pattern, toMatchFileSnapshot
provides:
  - registerErc721Template() — registers id=erc721, chain=evm, status=alpha
  - Full Erc721Opts surface (name/symbol/baseUri/mintable/enumerable/burnable/pausable/uriStorage/royalty/access) + WizardIo + GenerateResult + Erc721Template
  - runWizard (9 base + 2 royalty + 1 access prompts, 3 centralization warnings)
  - generate (erc721.print + conditional injectRoyalty)
  - isEthAddress / isRoyaltyBps / isValidBaseUriOrEmpty validators
  - Happy-path prompt sequence (locked for plan 04-04 E2E priming — see below)
affects: [04-04]

# Tech tracking
tech-stack:
  added: []   # zero new packages — reuses @openzeppelin/wizard@0.10.8, @openzeppelin/contracts@5.6.1, @clack/prompts
  patterns:
    - "9+2+1 prompt wizard: base prompts + conditional royalty pair + conditional access select"
    - "conditional royalty injection: generate.ts calls injectRoyalty ONLY when opts.royalty.enabled (D-06 opt-out = byte-for-byte wizard output)"
    - "it.each cancel-at-each-prompt parametrization across 11 prompt indices (3 text + 5 confirm + 2 conditional text + 1 conditional select)"

key-files:
  created:
    - src/templates/erc721/index.ts
    - src/templates/erc721/validators.ts
    - src/templates/erc721/filename.ts
    - src/templates/erc721/wizard.ts
    - src/templates/erc721/generate.ts
    - src/templates/erc721/README.md
    - tests/templates/erc721/wizard.spec.ts
    - tests/templates/erc721/generate.spec.ts
    - tests/templates/erc721/validators.spec.ts
  modified:
    - src/templates/erc721/opts.ts   # extended Wave-0 minimal surface to full Erc721Opts

key-decisions:
  - "cancelGuard + conditional access prompt DUPLICATED inline (CONTEXT D-10) — no shared-module extraction even with erc721+erc1155 as new consumers."
  - "filename.ts is a 1-line re-export of erc20's contractNameToFilename (RESEARCH A5 — pure utility, not the duplicate-don't-extract target)."
  - "generate.ts passes uriStorage:opts.uriStorage (always false) and never passes info — wizard defaults {license:MIT, securityContact:\"\"} apply, matching committed fixtures byte-for-byte."
  - "royalty disabled branch uses all-zero sentinel receiver for type completeness; receiver is unused when enabled=false (generate skips injectRoyalty)."

requirements-completed: [ERC721-01, ERC721-02, ERC721-03, ERC721-04, ERC721-05]

# Metrics
duration: ~14min
completed: 2026-05-28
---

# Phase 4 Plan 02: ERC-721 NFT Template Plugin Summary

**Shipped the complete ERC-721 NFT template plugin (barrel + wizard + generate + opts + validators + filename + README) wired into the plan-04-01 EIP-2981 royalty post-process via a conditional `injectRoyalty` call, with 52 passing tests across 4 spec files — including 3 golden snapshots matching the committed Wave-0 fixtures byte-for-byte.**

## Performance
- **Duration:** ~14 min
- **Started:** 2026-05-28T13:14:11Z
- **Completed:** 2026-05-28T13:27:50Z
- **Tasks:** 3 / 3
- **Files created/modified:** 10 (9 created + opts.ts extended)

## Task Commits
1. **Task 1: type contracts + validators + filename re-export + barrel** — `d8d590b` (feat)
2. **Task 2: wizard (9+2+1 prompts, 3 warnings) + generate (conditional royalty)** — `82158b0` (feat)
3. **Task 3: 3 specs + README** — `5b3c490` (test)

## Files (line counts)
| File | Lines | Role |
|------|-------|------|
| `src/templates/erc721/opts.ts` | 88 | extended Wave-0 surface to full `Erc721Opts` + WizardIo + GenerateResult + Erc721Template |
| `src/templates/erc721/validators.ts` | 78 | clones isSolidityIdentifier/isAsciiSymbol + adds isEthAddress/isRoyaltyBps/isValidBaseUriOrEmpty |
| `src/templates/erc721/filename.ts` | 5 | re-export of erc20 contractNameToFilename |
| `src/templates/erc721/index.ts` | 38 | registerErc721Template barrel |
| `src/templates/erc721/wizard.ts` | 250 | runWizard — 9 base + 2 royalty + 1 access prompts, 3 warnings |
| `src/templates/erc721/generate.ts` | 53 | erc721.print + conditional injectRoyalty |
| `src/templates/erc721/README.md` | 61 | plugin surface docs |
| `tests/templates/erc721/wizard.spec.ts` | 312 | 4 happy + preamble/validator-wiring + 11 cancel (it.each) |
| `tests/templates/erc721/generate.spec.ts` | 144 | 3 snapshots + 7 per-flag + return-shape |
| `tests/templates/erc721/validators.spec.ts` | 137 | boundary tables for 5 validators |

## Golden Snapshot Match Status
All three matched the plan-04-01 committed fixtures byte-for-byte (run without `-u`; any drift fails):

| Fixture | Status |
|---------|--------|
| `tests/fixtures/erc721/bare-default.sol` | MATCH |
| `tests/fixtures/erc721/all-flags-on.sol` | MATCH |
| `tests/fixtures/erc721/all-flags-on-with-royalty.sol` | MATCH |

## Warning-Emission Test Results
| Scenario | Expected warns | Verified |
|----------|----------------|----------|
| No flags | 0 | PASS (happy path A) |
| Mintable + Ownable | 1 (Mintable+Ownable) | PASS (happy path B) |
| Royalty + Mintable + Ownable | 2 (Mintable+Ownable, Royalty+Ownable) | PASS (happy path C) |
| All flags + roles | 0 (no Ownable trigger) | PASS (happy path D) |
| Pausable + Ownable (no mintable) | 1 (Pausable+Ownable) | PASS |

## Locked Happy-Path Prompt Sequence (for plan 04-04 E2E priming)
Clone this exact priming order in `primeErc721HappyPathMocks()`. Prompt order:
`name → symbol → baseUri → mintable → enumerable → burnable → pausable → royalty → (if royalty) bps + receiver → (if mintable||pausable) access`.

Bare-default E2E priming (no flags, no royalty, no access prompt):
```
textMock.mockResolvedValueOnce("MyNFT");   // 1 contract name
textMock.mockResolvedValueOnce("MNFT");    // 2 token symbol
textMock.mockResolvedValueOnce("");        // 3 base URI (empty)
confirmMock.mockResolvedValueOnce(false);  // 4 mintable
confirmMock.mockResolvedValueOnce(false);  // 5 enumerable
confirmMock.mockResolvedValueOnce(false);  // 6 burnable
confirmMock.mockResolvedValueOnce(false);  // 7 pausable
confirmMock.mockResolvedValueOnce(false);  // 8 royalty-confirm
// no royalty pair (8 was false); no access select (mintable=pausable=false)
```
- Cancel-prompt labels (the WHAT string is `Wizard cancelled at: <label>.`): `contract name`, `token symbol`, `base URI`, `mintable`, `enumerable`, `burnable`, `pausable`, `royalty`, `royalty basis points`, `royalty recipient`, `access control`.
- Royalty branch adds two text prompts after prompt 8: bps (`"250"`) then receiver (`"0x000…0"`).
- Access branch adds one `selectMock.mockResolvedValueOnce("ownable"|"roles")` after the royalty prompts when mintable or pausable is true.
- Returned shape: `{ name, symbol, baseUri, mintable, enumerable, burnable, pausable, uriStorage:false, royalty, access }`.

## Requirements Completed
- **ERC721-01** — name/symbol/baseUri collected; bare-default snapshot matches.
- **ERC721-02** — Mintable/Enumerable/Burnable wire into erc721.print (per-flag assertions).
- **ERC721-03** — royalty pair wired through wizard + generate + injectRoyalty; all-flags-on-with-royalty snapshot matches; bps/receiver validators wired.
- **ERC721-04** — Pausable opt-in propagates; per-flag + warning assertions.
- **ERC721-05** — conditional access prompt fires on mintable||pausable; both ownable and roles branches tested.

## Deviations from Plan
**None for Tasks 1-3 logic.** Two process notes:
- A transient cross-plan typecheck error (`src/templates/erc721/index.ts` could not resolve `./wizard.js`/`./generate.js`) existed only between Task 1 and Task 2 because index.ts imports the wizard/generate created in Task 2. Resolved by completing Task 2 before the gating typecheck. The parallel plan 04-03 agent logged this in `deferred-items.md` (it observed the error while my Task 2 files were not yet committed to the shared tree). It is now resolved — full `npm run typecheck` is clean. `deferred-items.md` is NOT my file; left untouched.

## Scope Confirmation
- My three commits (`d8d590b`, `82158b0`, `5b3c490`) touch ONLY `src/templates/erc721/*` (incl. README.md) and `tests/templates/erc721/*`.
- Zero modifications to `src/cli.ts`, `src/commands/create.ts`, `src/compiler/*`, `src/registry/*`, `src/lib/*`, `src/templates/erc20/*`, `src/templates/erc1155/*`, `tests/compiler/*`, `tests/commands/*`.
- `src/templates/erc721/royalty.ts` (plan 04-01) NOT modified — consumed unchanged by generate.ts.
- No new packages installed. No new error codes (reuses ERR_WIZARD_CANCEL).

## Verification Results
- `npx vitest run tests/templates/erc721/` — **52 passed (4 files)**: wizard.spec, generate.spec, validators.spec, royalty.spec (04-01).
- `npm run typecheck` — clean (tsc --noEmit, 0 errors).
- 3 golden snapshots matched committed fixtures byte-for-byte (no `-u`).

## Self-Check: PASSED
- All 9 created files + extended opts.ts verified present on disk.
- All 3 task commit hashes verified in git log.
- 52/52 erc721 tests green; typecheck clean.
