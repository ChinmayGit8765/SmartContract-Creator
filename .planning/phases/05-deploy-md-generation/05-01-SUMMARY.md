---
phase: 05-deploy-md-generation
plan: 01
subsystem: deploy
tags: [deploy, types, warnings, constructor-args, foundation]

requires:
  - phase: 02-erc-20-canary-template
    provides: Erc20Opts shape, wizard centralization warning literals
  - phase: 04-erc-721-and-erc-1155-templates
    provides: Erc721Opts/Erc1155Opts shapes, wizard warning literals, committed .sol fixtures
provides:
  - DeployMeta normalized type contract (DeployMeta, ConstructorArg, DeployFlags, CentralizationWarning + unions)
  - centralizationWarnings({standard,flags}) single source of truth (D-03)
  - fixture-locked erc20/erc721/erc1155 constructor-arg builders
  - readOwnVersion exported from version.ts for the DEPLOY.md provenance header
affects: [05-02, 05-03, 05-04]

tech-stack:
  added: []
  patterns:
    - "Type-only module convention (all readonly fields) mirroring opts.ts"
    - "Single-source computed warnings consumed by both wizard and DEPLOY.md"
    - "Flag-derived constructor-arg builders locked against committed .sol fixtures"

key-files:
  created:
    - src/deploy/types.ts
    - src/deploy/constructorArgs.ts
    - src/deploy/warnings.ts
    - tests/deploy/ctorArgs.spec.ts
    - tests/deploy/warnings.spec.ts
  modified:
    - src/lib/version.ts

key-decisions:
  - "Builders derive args from flags, never parse the .sol at runtime; parsing lives only in the test"
  - "mintable-ownable and pausable-ownable bodies branch per standard to match the per-template wizard literals byte-for-byte"
  - "roles-multi-key is info severity and DEPLOY.md-only (wizard does not emit it, preserving visible behavior)"

patterns-established:
  - "Constructor-arg builders fixture-locked by a test that regex-parses each committed .sol constructor"
  - "centralizationWarnings is the DEPLOY-06 structural guarantee; bodies pinned by warnings.spec.ts"

requirements-completed: [DEPLOY-06]

duration: 12min
completed: 2026-05-29
---

# Phase 5 Plan 01: Deploy Foundation Summary

**Normalized DeployMeta type contract, single-source centralizationWarnings (D-03), and fixture-locked constructor-arg builders verified against all 7 committed .sol constructors.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `src/deploy/types.ts` — the chain-agnostic DeployMeta descriptor every downstream deploy module imports
- `src/deploy/constructorArgs.ts` — erc20/erc721/erc1155 builders locked against the committed fixtures (the #1 footgun guard)
- `src/deploy/warnings.ts` — `centralizationWarnings({standard,flags})` with per-standard body branching; the DEPLOY-06 single source
- `readOwnVersion` exported from `src/lib/version.ts` for the D-11 provenance header

## Task Commits

1. **Task 1: Types + fixture-locked ctor builders** - `684001d` (feat)
2. **Task 2: centralizationWarnings + matrix lock** - `b1c3e97` (feat)
3. **Task 3: export readOwnVersion** - `3834e3d` (feat)

## Files Created/Modified
- `src/deploy/types.ts` - DeployMeta, ConstructorArg, DeployFlags, CentralizationWarning + DeployChain/Standard/AccessMode/WarningSeverity unions
- `src/deploy/constructorArgs.ts` - rolesArgs + erc20/erc721/erc1155 builders
- `src/deploy/warnings.ts` - single-source centralizationWarnings
- `tests/deploy/ctorArgs.spec.ts` - regex-parses each fixture's constructor and asserts builder equality (7 rows + zero-arg edge + no-real-key)
- `tests/deploy/warnings.spec.ts` - DEPLOY-06 matrix + byte-equality lock
- `src/lib/version.ts` - readOwnVersion now exported

## Decisions Made
- Per-standard body branching for both mintable-ownable and pausable-ownable (erc20 "tokens/transfers", erc721 "NFTs", erc1155 "quantities of any token id"/"every token id") — required for the 05-03 wizard parity to be byte-identical.
- The fixture-lock test parses the param NAME (last whitespace token of each comma-split param) rather than full type — robust against formatting.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 1 (05-02) can import DeployMeta, the builders, and centralizationWarnings directly.
- 21 deploy tests green; tsc clean.

---
*Phase: 05-deploy-md-generation*
*Completed: 2026-05-29*
