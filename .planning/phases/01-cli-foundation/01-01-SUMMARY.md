---
phase: 01-cli-foundation
plan: 01
subsystem: infra
tags: [typescript, esm, node, tsup, vitest, commander, scaffold]

# Dependency graph
requires: []
provides:
  - Installable Node 20+ ESM project with bin.smartc -> dist/cli.js
  - Build pipeline: tsup produces single ESM bundle with shebang banner
  - Typecheck: tsc --noEmit against strict + noUncheckedIndexedAccess
  - Test runner: vitest configured for tests/**/*.spec.ts (passWithNoTests)
  - Dev runner: tsx for direct TS execution
  - Cross-platform LF enforcement via .gitattributes (shebang safety on Windows)
affects:
  - 01-02-libs (will add filesystem/output utilities on this scaffold)
  - 01-03-registry (will add template registry plumbing)
  - 01-04-commander (will replace stub src/cli.ts with real dispatch)
  - all subsequent phases (every plan compiles + tests via this pipeline)

# Tech tracking
tech-stack:
  added:
    - commander@^14.0.3
    - "@clack/prompts@^0.11.0"
    - picocolors@^1.1.1
    - cli-table3@^0.6.5
    - typescript@^5.9.3
    - tsup@^8.5.1
    - tsx@^4.22.0
    - vitest@^4.1.6
    - "@types/node@^22.19.19"
  patterns:
    - "ESM-only project (type: module + NodeNext resolution)"
    - "Shebang via tsup banner (not in source) - keeps tsx dev clean"
    - "Single-bundle CLI output to dist/cli.js"
    - "Strict TS + noUncheckedIndexedAccess from day one"
    - "LF enforced via .gitattributes for cross-platform shebang"

key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - tsup.config.ts
    - vitest.config.ts
    - src/cli.ts
    - .gitignore
    - .gitattributes
    - .npmrc
    - README.md
  modified: []

key-decisions:
  - "Vitest passWithNoTests:true so npm test exits 0 on empty scaffold"
  - "tsup banner injects shebang at bundle time (source stays clean for tsx)"
  - "Stub src/cli.ts kept to 2 lines so build is end-to-end verifiable from Plan 01"

patterns-established:
  - "ESM imports require .js extension under NodeNext (even though source is .ts)"
  - "Per-task atomic commits, individually staged (never git add -A)"
  - "Conventional commits scoped to phase-plan: chore(01-01): ..."

# Metrics
duration: 3min
completed: 2026-05-16
---

# Phase 1 Plan 01: CLI Scaffold Summary

**Installable Node 20+ ESM project with tsup bundle, strict TypeScript, vitest, and a 2-line stub entry that builds end-to-end to `dist/cli.js` with shebang.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-16T06:43:29Z
- **Completed:** 2026-05-16T06:46:02Z
- **Tasks:** 2
- **Files created:** 10

## Accomplishments

- `package.json` with `type: module`, `bin.smartc -> ./dist/cli.js`, engines `>=20`, and all five scripts (`dev`, `build`, `test`, `test:watch`, `typecheck`)
- Runtime dependencies installed: commander, @clack/prompts, picocolors, cli-table3
- Dev dependencies installed: typescript, tsup, tsx, vitest, @types/node
- `tsconfig.json` with strict mode, `noUncheckedIndexedAccess`, NodeNext module/resolution, ES2023 lib
- `tsup.config.ts` producing single ESM bundle to `dist/cli.js` with `#!/usr/bin/env node` banner
- `vitest.config.ts` scoped to `tests/**/*.spec.ts` with `passWithNoTests:true`
- `src/cli.ts` 2-line stub printing `smartc bootstrap ok` (Plan 04 will replace)
- `.gitattributes` enforcing LF endings (load-bearing for shebang safety on Windows)
- `README.md` with install/dev/build/test instructions

## Task Commits

1. **Task 1: Initialize package.json and install dependencies** - `cd042de` (chore)
2. **Task 2: Configure TypeScript, tsup, vitest, and stub entry** - `e7dbbda` (chore)

**Plan metadata:** to be committed after this SUMMARY.

## Files Created/Modified

- `package.json` - Project manifest (type:module, bin.smartc, scripts, deps)
- `package-lock.json` - Locked dependency tree
- `tsconfig.json` - Strict TypeScript config, NodeNext, ES2023
- `tsup.config.ts` - Bundler config (single ESM bundle, shebang banner)
- `vitest.config.ts` - Test runner config (passWithNoTests for empty scaffold)
- `src/cli.ts` - 2-line stub entry, replaced by Plan 04
- `.gitignore` - node_modules, dist, coverage, logs
- `.gitattributes` - `* text=auto eol=lf` for cross-platform shebang safety
- `.npmrc` - engine-strict, non-exact saves
- `README.md` - Install / dev / build / test instructions

## Decisions Made

- **`passWithNoTests: true` in vitest config** — required because vitest 4.x exits 1 when no specs match. Without this, `npm test` would fail on a clean scaffold before any tests exist. Standard practice for fresh projects; specs land in later plans.
- **Stub `src/cli.ts` kept to 2 lines (no commander, no abstractions)** — preserves the plan's intent that scaffolding be pure runway. Plan 04 will replace this with real commander dispatch.
- **Used latest available minors of pinned majors** — installed versions slightly exceed plan's example pins (commander 14.0.3, vitest 4.1.6, typescript 5.9.3, tsup 8.5.1, @types/node 22.19.19, picocolors 1.1.1, @clack/prompts 0.11.0). All within the `^` ranges specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `passWithNoTests: true` to vitest config**

- **Found during:** Task 2 (verify step 5: `npm test` must exit 0)
- **Issue:** Vitest 4.x exits with code 1 when no test files match the include pattern. The plan's success criterion explicitly requires `npm test` to exit 0 with zero tests; without `passWithNoTests`, the command failed at the verify step.
- **Fix:** Added `passWithNoTests: true` inside the `test` block of `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npm test` now prints `No test files found, exiting with code 0` and returns exit code 0.
- **Committed in:** `e7dbbda` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the plan's stated success criterion (`npm test` exits 0). Zero scope creep — purely a config flag.

## Issues Encountered

- Initial `npm test` run exited 1 due to vitest 4.x's default behavior when no tests exist. Resolved via `passWithNoTests` flag (documented above under Deviations).

## User Setup Required

None — no external services configured this plan.

## Next Phase Readiness

- Scaffold is installable, buildable, and testable on Node 20+.
- `npm run typecheck`, `npm run build`, `node dist/cli.js`, and `npm test` all exit 0.
- `dist/cli.js` carries the `#!/usr/bin/env node` shebang and runs end-to-end.
- Plan 01-02 (libs) can immediately add files under `src/lib/` with no scaffolding work.
- Plan 01-03 (registry) and 01-04 (commander) have a stable target — `src/cli.ts` will be replaced wholesale.
- Note: `npm link` not exercised (requires elevated shell on Windows). Verified equivalent path via `node dist/cli.js`. To be tested manually in Phase 9 (packaging/distribution).

---
*Phase: 01-cli-foundation*
*Completed: 2026-05-16*
