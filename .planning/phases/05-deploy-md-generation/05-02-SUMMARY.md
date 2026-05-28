---
phase: 05-deploy-md-generation
plan: 02
subsystem: deploy
tags: [deploy, sections, renderers, assembler, golden-snapshots]

requires:
  - phase: 05-deploy-md-generation
    provides: DeployMeta types, constructor-arg builders, centralizationWarnings, readOwnVersion
provides:
  - eight pure (meta)=>string section renderers under src/deploy/sections/
  - chain-keyed sectionsFor(chain, now?) registry (Phase 7 solana seam)
  - generateDeployDoc(meta,{now?}) assembler + deployDocPath(solPath)
  - four committed golden DEPLOY.md fixtures
affects: [05-03, 05-04]

tech-stack:
  added: []
  patterns:
    - "Pure section renderers assembled by a chain-keyed registry (no giant template string)"
    - "Injectable freezable `now` Date threaded to the header for deterministic golden snapshots"
    - "Full solc version derived from solc.version() at runtime, not hardcoded"

key-files:
  created:
    - src/deploy/sections/header.ts
    - src/deploy/sections/warnings.ts
    - src/deploy/sections/safety-checklist.ts
    - src/deploy/sections/remix.ts
    - src/deploy/sections/hardhat.ts
    - src/deploy/sections/foundry.ts
    - src/deploy/sections/etherscan.ts
    - src/deploy/sections/constructor-args.ts
    - src/deploy/sections/index.ts
    - src/deploy/index.ts
    - tests/deploy/generate.spec.ts
    - tests/fixtures/deploy/erc20-bare.DEPLOY.md
    - tests/fixtures/deploy/erc20-all-flags.DEPLOY.md
    - tests/fixtures/deploy/erc721-all-flags-with-royalty.DEPLOY.md
    - tests/fixtures/deploy/erc1155-all-flags.DEPLOY.md
  modified: []

key-decisions:
  - "sectionsFor(chain, now?) binds the frozen date into the header wrapper so the registry's Section type stays uniform `(meta)=>string`"
  - "Foundry always emits --broadcast; --constructor-args line omitted entirely for no-arg ctors; etherscan omits the cast abi-encode line likewise"
  - "Etherscan compiler-version read from solc.version() and normalized to v0.8.35+commit.47b9dedd"
  - "Sections joined with a blank line (\\n\\n) for readable Markdown spacing"

patterns-established:
  - "Each DEPLOY.md section is an independently-testable pure function"
  - "Golden snapshots via await toMatchFileSnapshot with a frozen now"

requirements-completed: [DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-06, DEPLOY-07, DEPLOY-08]

duration: 15min
completed: 2026-05-29
---

# Phase 5 Plan 02: Section Renderers + Assembler Summary

**Eight composable DEPLOY.md section renderers, a chain-keyed registry (Phase 7 seam), and generateDeployDoc that assembles a deterministic, fixture-snapshotted deployment guide with Hardhat/Foundry/Remix/Etherscan commands carrying the exact constructor args.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 15 created

## Accomplishments
- All 8 EVM sections render per the snippet specs (forge create --broadcast, full solc version, Remix open+paste, classic Hardhat script, option-derived checklist)
- `sectionsFor("evm")` returns them in D-04 order; throws for unregistered chains (the Phase 7 solana seam)
- `generateDeployDoc(meta,{now?})` + `deployDocPath(solPath)` with frozen-date determinism
- 4 golden fixtures committed and snapshot-locked; no `0x`-address leaks (T-05-01)

## Task Commits

1. **Task 1: 8 section renderers + chain-keyed registry** - `375b7c5` (feat)
2. **Task 2: assembler + golden snapshots + per-section assertions** - `85e6ae3` (feat)

## Files Created/Modified
- `src/deploy/sections/*.ts` (8 renderers + index registry)
- `src/deploy/index.ts` - generateDeployDoc + deployDocPath
- `tests/deploy/generate.spec.ts` - golden + per-section + deployDocPath + security
- `tests/fixtures/deploy/*.DEPLOY.md` (4 golden files)

## Decisions Made
- The header's `now` is bound by partial application inside `sectionsFor` (the recommended approach in the plan), keeping the `Section` type a uniform `(meta)=>string` and the assembler simple.
- Etherscan version is normalized via regex from `solc.version()` so it tracks a solc bump automatically.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- 05-03 can import generateDeployDoc + deployDocPath and wire them into create.ts.
- 39 deploy tests green; tsc clean.

---
*Phase: 05-deploy-md-generation*
*Completed: 2026-05-29*
