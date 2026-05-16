# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** Generate a working, compile-verified smart contract file from a wizard — no boilerplate, no remembering EIPs, no scaffolding a full project.
**Current focus:** Phase 1 — CLI Foundation

## Current Position

Phase: 1 of 9 (CLI Foundation)
Plan: 3 of 4 complete in current phase (01-01 scaffold, 01-02 libs, 01-03 registry — only 01-04 wiring remains)
Status: In progress
Last activity: 2026-05-16 — Completed 01-02-PLAN.md (core libs)

Progress: [█░░░░░░░░░] ~8% (3 of ~36 plans across roadmap)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 3min
- Total execution time: 9min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-cli-foundation | 3 | 9min | 3min |

**Recent Trend:**
- Last 5 plans: 01-01 (3min), 01-03 (1min), 01-02 (5min)
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: CLI first, VS Code extension later
- Init: TypeScript/Node over Python/Rust/Go for web3 ecosystem support
- Init: Local Ollama for AI (no hosted APIs)
- Init: Pure wizard primary, AI opt-in via separate `add-feature` command
- Init: Single contract file output, not full project scaffold
- Init: Generate-and-compile, not generate-and-deploy
- Roadmap: Compile-verify (Phase 3) gates all subsequent templates; AI (Phase 8) gated on existing safety net
- 01-01: ESM-only project (type:module + NodeNext); shebang via tsup banner (not in source); strict TS + noUncheckedIndexedAccess from day one
- 01-01: vitest `passWithNoTests:true` so empty scaffolds exit 0 (vitest 4.x default is exit 1)
- 01-01: `.gitattributes eol=lf` is load-bearing — Windows CRLF would break the dist/cli.js shebang
- 01-03: Registry JSON contract locked at five fields `{ id, name, chain, status, description }` — future phases ADD optional fields only, never rename or remove
- 01-03: `register()` throws on duplicate id (no silent overwrites); stub uses `get()` guard for idempotency rather than catching the throw
- 01-03: Map backs the store for O(1) get + spec-guaranteed insertion-order iteration; `clear()` exported for test isolation only
- 01-02: Three-part Error/Why/Fix block is the load-bearing UX contract — CliError is the only sanctioned user-facing failure type; stable codes E_FILE_EXISTS/E_NOT_IMPLEMENTED/E_USAGE/E_UNKNOWN shipped in Phase 1
- 01-02: Output channels (`result`/`warn`/`error` always; `explain`/`reference`/`nextStep` gated on newbie AND silenced under `--json`) — Phase 2+ wizard never branches on verbosity, the factory handles it
- 01-02: Newbie precedence: flag > explicit `false` > env `SMARTC_NEWBIE` > absent → false. Plan 04 commander wiring follows the sketch in 01-02-SUMMARY.md
- 01-02: `safeReadVersion` uses dual-strategy resolve (direct + walk-up via entry-point dirname) — required because modern packages (commander@14, future solc) restrict `./package.json` in their exports map; Phase 3 will get correct semver automatically once solc/@oz are installed
- 01-02: Vitest 4 ESM mock pattern locked in: `vi.mock("@clack/prompts", ...)` followed by top-level `await import(SUT)` so the SUT picks up the mock (static import would hoist above and bind to real module)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 research flag: Confirm `solc` import-callback resolves `@openzeppelin/contracts/...` from bundled deps without user install — prototype at phase start
- Phase 7 research flag: Anchor single-file compile mechanism (likely scratch workspace under the hood) and Windows compatibility — prototype at phase start
- Phase 8 research flag: Default Ollama model recommendation — defer to phase-start benchmarking

## Session Continuity

Last session: 2026-05-16
Stopped at: Completed 01-02-PLAN.md (core libs). Plans 01-01, 01-02, 01-03 all complete; only 01-04 remains in Phase 1.
Resume file: None
Next plan: 01-04-PLAN.md (commander wiring — consumes the six libs from 01-02 and the registry from 01-03; see 01-02-SUMMARY.md "Notes for Plan 04" for the wiring sketch)
