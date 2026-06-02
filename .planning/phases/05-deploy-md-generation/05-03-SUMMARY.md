---
phase: 05-deploy-md-generation
plan: 03
subsystem: deploy
tags: [deploy, dispatcher, wizard-refactor, overwrite-gate, e2e, wave-2]

requires:
  - phase: 05-deploy-md-generation
    provides: generateDeployDoc, deployDocPath, centralizationWarnings, constructor-arg builders, DeployMeta types
provides:
  - optional deployMeta?(opts): DeployMeta on Template<TOpts> (D-01 interface seam)
  - three per-template deployMeta.ts mappings (erc20/erc721/erc1155)
  - confirmOverwriteMany(paths, opts) two-file overwrite gate
  - create.ts deploy-doc write spliced after compile-verify (D-09/D-10)
  - D-03 wizard refactor onto single-source centralizationWarnings (byte-parity locked)
affects: [05-04]

tech-stack:
  added: []
  patterns:
    - "Optional Template.deployMeta? mirrors runWizard?/generate? — additive interface extension, no core change"
    - "Wizard centralization warnings sourced from centralizationWarnings() filtered to severity:critical (byte-identical to prior literals)"
    - "Both-file overwrite gate checked up front before any write; --force bypasses; decline throws E_FILE_EXISTS"

key-files:
  created:
    - src/templates/erc20/deployMeta.ts
    - src/templates/erc721/deployMeta.ts
    - src/templates/erc1155/deployMeta.ts
    - tests/deploy/wizard-parity.spec.ts
  modified:
    - src/registry/types.ts
    - src/templates/erc20/index.ts
    - src/templates/erc721/index.ts
    - src/templates/erc1155/index.ts
    - src/templates/erc20/wizard.ts
    - src/templates/erc721/wizard.ts
    - src/templates/erc1155/wizard.ts
    - src/lib/prompt.ts
    - src/commands/create.ts
    - tests/commands/create.compile.spec.ts
    - tests/prompt.spec.ts

key-decisions:
  - "D-03 hybrid taken via the refactor path (not the duplication fallback): each wizard builds the same flags object deployMeta uses and emits centralizationWarnings filtered to critical; wizard-parity.spec.ts locks byte-identical output"
  - "deployPath is a pure suffix-swap (deployDocPath) on the already-resolved .sol outPath — no new path.join, no new traversal surface (T-05-05)"
  - "DEPLOY.md write is strictly after the compile-verify gate; a compile failure throws before any write so neither file lands (D-10 / T-05-07)"
  - "confirmOverwrite kept unchanged for back-compat; confirmOverwriteMany added alongside it"

patterns-established:
  - "deployMeta(opts) maps validated wizard opts → normalized DeployMeta, delegating constructorArgs + warnings to the single-source deploy builders"
  - "create flow: runWizard → generate → compileVerify → confirmOverwriteMany([sol, deploy]) → writeFile(sol) → writeFile(deploy)"

requirements-completed: [DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-06, DEPLOY-07, DEPLOY-08]

duration: 20min
completed: 2026-05-29
---

# Phase 5 Plan 03: Dispatcher Integration + Wizard Refactor Summary

**Wired deploy-doc generation into the live `create` flow: every EVM template now exposes `deployMeta(opts)`, the dispatcher writes a matching `<Name>.DEPLOY.md` after compile-verify behind a both-file overwrite gate, and all three wizards now draw their centralization warnings from the single-source `centralizationWarnings()` — byte-identical to the old inline literals, locked by a parity test.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 4 created, 11 modified

## Accomplishments
- `Template<TOpts>` gained an optional `deployMeta?(opts): DeployMeta` (additive, mirrors `runWizard?`/`generate?`) — no core dispatcher change required to support templates that don't opt in.
- Three `deployMeta.ts` mappings: erc20 (premintNonZero derivation), erc721 (enumerable + royalty flags), erc1155 (supply + hardcoded updatableUri:true). Each delegates constructorArgs + warnings to the 05-01 single source.
- `confirmOverwriteMany([sol, deploy])` checks both targets up front, prompts once listing existing files, throws `E_FILE_EXISTS` on decline; `--force` bypasses.
- `create.ts` splice: deploy-doc write happens only when `tpl.deployMeta` is present AND after compile-verify succeeds; stdout reports `Wrote <Name>.DEPLOY.md` and a nextStep points the user to it.
- D-03 wizard refactor done via the refactor path (not the duplication fallback) — wizards emit `centralizationWarnings({ standard, flags })` filtered to `severity:"critical"`, byte-identical to the prior literals.

## Task Commits

1. **Task 1: deployMeta? interface + 3 per-template mappings + D-03 wizard refactor** - `7bdedcd` (feat)
2. **Task 2: confirmOverwriteMany + dispatcher deploy-doc wiring + E2E** - `7ed905f` (feat)

## Files Created/Modified
- `src/registry/types.ts` — `deployMeta?` optional field + type-only DeployMeta import
- `src/templates/{erc20,erc721,erc1155}/deployMeta.ts` — opts→DeployMeta mappings
- `src/templates/{erc20,erc721,erc1155}/index.ts` — `deployMeta:` binding on the Template literal
- `src/templates/{erc20,erc721,erc1155}/wizard.ts` — warn blocks refactored onto centralizationWarnings
- `src/lib/prompt.ts` — `confirmOverwriteMany`
- `src/commands/create.ts` — deploy-doc write spliced after compile-verify, both-file gate
- `tests/deploy/wizard-parity.spec.ts` — D-03 byte-parity drift lock
- `tests/commands/create.compile.spec.ts` — both-file existence + content E2E + warning E2E
- `tests/prompt.spec.ts` — confirmOverwriteMany force/no-existing/decline cases

## Decisions Made
- Refactor path chosen for D-03 (the wizard warn blocks were self-contained as RESEARCH predicted), so there is one source of truth for centralization warnings instead of duplicated literals.
- nextStep copy references the DEPLOY.md path only when a deploy doc was actually written (templates without `deployMeta` are unaffected).

## Deviations from Plan

None — plan executed as written; the refactor path (preferred over the duplication fallback) was viable.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- DEPLOY-01 is true end-to-end: `smartc create --template <id>` writes both `<Name>.sol` and `<Name>.DEPLOY.md`.
- Only Wave 3 (05-04: module README + ROADMAP/REQUIREMENTS finalization) remains in Phase 5.
- Full suite green; tsc clean.

---
*Phase: 05-deploy-md-generation*
*Completed: 2026-05-29*
