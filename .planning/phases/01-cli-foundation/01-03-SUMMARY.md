---
phase: 01-cli-foundation
plan: 03
subsystem: registry
tags: [typescript, registry, in-memory-store, template-contract, vitest]

# Dependency graph
requires:
  - phase: 01-cli-foundation
    provides: tsconfig (strict + noUncheckedIndexedAccess), vitest runner, ESM/NodeNext module resolution
provides:
  - In-memory template registry (register/list/get/clear)
  - Locked JSON contract for templates ({ id, name, chain, status, description })
  - TemplateStatus / TemplateChain union types
  - foundation-smoke canary template (Phase 1 stub)
  - registerStubTemplates() — idempotent canary registration
affects: [02-erc20, 03-compile-verify, 04-list-templates, all future template additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin model: templates register via side-effecting function call (registerStubTemplates), not central enumeration"
    - "Locked-contract pattern: five required fields established now, future phases ADD optional fields only"
    - "Idempotent registration guard using get() check before register() throw"
    - "Insertion-order Map for deterministic list() output"
    - "clear() exported solely for test isolation, never called in production"

key-files:
  created:
    - src/registry/types.ts
    - src/registry/index.ts
    - src/registry/stub.ts
    - tests/registry.spec.ts
  modified: []

key-decisions:
  - "Map (not array/object) backs the store — O(1) get/has, insertion-order iteration is spec-guaranteed in JS"
  - "register() throws on duplicate id — no silent overwrites; surfaces double-registration bugs immediately"
  - "stub.ts uses get() guard for idempotency rather than catching register()'s throw — explicit > exception-as-control-flow"
  - "Canary description includes 'Not generatable.' so future generate command can refuse it without a special case"

patterns-established:
  - "Phase 1 stub canary pattern: register a non-generatable sentinel template so registry plumbing is exercised end-to-end before any real template exists"
  - "Type-level field lock: Template interface has exactly five readonly fields; runtime test asserts Object.keys matches to catch drift"
  - "Registry is dependency-free: no commander, no output module — pure data layer that any caller can use"

# Metrics
duration: 1min
completed: 2026-05-16
---

# Phase 1 Plan 3: Template Registry Summary

**In-memory template registry with locked five-field JSON contract and idempotent foundation-smoke canary, exercised by seven vitest cases**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-16T06:49:04Z
- **Completed:** 2026-05-16T06:50:18Z
- **Tasks:** 1
- **Files modified:** 4 created, 0 modified

## Accomplishments

- Registry exposes `register()`, `list()`, `get()`, `clear()` backed by an insertion-order `Map`
- Locked JSON contract: `{ id, name, chain, status, description }` enforced at the TypeScript type level and asserted at runtime via `Object.keys` test
- `TemplateStatus` (`stub` | `alpha` | `stable`) and `TemplateChain` (`evm` | `solana` | `any`) union types established for all future templates
- `registerStubTemplates()` registers the `foundation-smoke` canary idempotently — safe across repeated imports
- 7/7 vitest cases green: empty state, single register, insertion order, duplicate throws, shape lock, canary shape, canary idempotency
- End-to-end sanity confirmed: `npx tsx` import of stub + list emits the exact locked JSON shape

## Task Commits

1. **Task 1: Build registry types, store, and stub canary with tests** — `dd976b0` (feat)

**Plan metadata:** (next commit — `docs(01-03): complete registry plan`)

## Files Created/Modified

- `src/registry/types.ts` — `Template`, `TemplateStatus`, `TemplateChain`; locks the five-field contract at the type level
- `src/registry/index.ts` — In-memory `Map`-backed store with `register/list/get/clear`; `register()` throws on duplicate id
- `src/registry/stub.ts` — `FOUNDATION_SMOKE` canary constant and `registerStubTemplates()` with `get()`-guarded idempotency
- `tests/registry.spec.ts` — 7 cases (empty state, register+get, insertion order, duplicate throw, shape lock, canary shape, canary idempotency); uses `beforeEach(() => clear())` for isolation

## Decisions Made

- Map backing store: O(1) get/has plus spec-guaranteed insertion-order iteration — no auxiliary array needed for list determinism
- `register()` throws on duplicate (no silent overwrite) to surface double-registration bugs immediately rather than letting later-registered templates clobber earlier ones
- `registerStubTemplates()` uses an explicit `get()` guard rather than try/catching `register()`'s throw — explicit predicate is clearer than exception-as-control-flow
- `clear()` exported despite being test-only, so tests don't need to reach into module internals; it's documented as test-only

## Deviations from Plan

None — plan executed exactly as written. All four files use the verbatim code blocks from the plan; spec covers all 7 stipulated cases.

## Issues Encountered

None. Parallel plan 01-02 was running concurrently in another agent (touching `src/lib/` and non-registry tests); zero file overlap was observed during execution. STATE.md was unchanged at write time, so no rebase needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 04 (`list-templates` command) can now `import { registerStubTemplates } from "./registry/stub.js"`, call it once at boot, then iterate `list()` for table/JSON rendering — no registry-internal logic needed
- Phase 2 (ERC-20 template) adds a new file `src/registry/erc20.ts` (or similar) exporting a `registerErc20Template()` that calls `register()` with the locked five fields — no changes to registry core
- JSON contract is now load-bearing: any change to the five fields is a breaking change for downstream consumers (CLI, tests, future VS Code extension)

---
*Phase: 01-cli-foundation*
*Completed: 2026-05-16*
