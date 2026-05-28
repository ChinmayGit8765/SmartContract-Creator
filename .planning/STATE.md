---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 4 complete; pending Phase 5 discuss
last_updated: "2026-05-28T00:00:00.000Z"
last_activity: 2026-05-28 -- Phase 04 complete
progress:
  total_phases: 9
  completed_phases: 4
  total_plans: 17
  completed_plans: 17
  percent: 44
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** Generate a working, compile-verified smart contract file from a wizard — no boilerplate, no remembering EIPs, no scaffolding a full project.
**Current focus:** Phase 05 — deploy-md-generation

## Current Position

Phase: 05 (deploy-md-generation) — PENDING DISCUSS
Plan: (none yet)
Status: Phase 04 complete; awaiting Phase 05 discuss
Last activity: 2026-05-28 -- Phase 04 complete

Progress: [████░░░░░░] ~44% (17 of ~36 plans across roadmap)

## Performance Metrics

**Velocity:**

- Total plans completed: 17
- Average duration: ~28min
- Total execution time: ~5h

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-cli-foundation | 4 | ~21min | ~5min |
| 02-erc-20-canary-template | 5 | ~85min | ~17min |
| 03-compile-verify-safety-net | 4 | ~170min | ~42min |
| 04-erc-721-and-erc-1155-templates | 4 | ~123min | ~31min |

**Recent Trend:**

- Last 5 plans: 03-04 (10min, README + finalization no-op), 04-01 (80min, Wave 0 royalty walker + fixtures), 04-02 (14min, ERC-721 plugin), 04-03 (18min, ERC-1155 plugin), 04-04 (11min, Wave 2 boot wiring + integration/E2E)
- Trend: Wave 0 dominates Phase 4 cost; parallel Wave 1 plugins landed fast

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
- 01-04: Commander 14 usage errors (excessArguments, unknownCommand, unknownOption) map to exit 2 in src/cli.ts per Unix convention; only --help / --version propagate commander's exit code (0). Commander's native default is exit 1 for usage errors — we override
- 01-04: `parseAsync(args, { from: "user" })` expects user-facing positionals only (no node/program prefix) — important for in-process command unit tests
- 01-04: createCommandStub option surface (`--template <id>`, `--out <path>`) is locked from Phase 1; Phase 2 replaces only the `.action()` body
- 03-01: Pin `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` exact (no caret) — golden-fixture stability, deterministic formatVersionLine, supply-chain reproducibility
- 03-01: `ERR_COMPILE_FAILED = "E_COMPILE_FAILED"` added to errors.ts — stable error code from Phase 3 forward, never rename
- 03-01/02: `evmVersion="cancun"` (NOT "paris" per RESEARCH suggestion) — Wave 0 probe found OZ 5.6.1 uses Cancun-only `mcopy` opcode; documented in source, README, summaries
- 03-02: `await import("solc")` with `.default ?? mod` instead of `createRequire("solc")` — Vitest 4 doesn't intercept createRequire mocks; production behavior identical via Node ESM-CJS interop
- 03-02: Per-call cache scope (D-05) for makeImportCallback — no module-level cache; fresh Map per compileVerify invocation; no cross-call leakage in tests
- 03-02: Path-traversal guard uses `normalize(root) + path.sep` prefix check — defends against `/tmp/oz-root` prefix-matching `/tmp/oz-rootEXTRA` confusion attacks
- 03-02: Diagnostic partition collapses solc severity "info" into the warning bucket — closed union `{"error","warning"}` for downstream consumers
- 03-03: `chain !== "evm" && chain !== "solana"` refusal guard in create.ts — TemplateChain includes "any"; typecheck-required AND defense against registration inconsistency
- 03-03: Compile gate runs BEFORE confirmOverwrite (D-07 ordering) — runWizard → generate → compileVerify → confirmOverwrite → writeFile; nothing un-compilable touches disk
- 03-03: Test-only templates use registry clear+register seam (NOT @clack mock entanglement) — cleaner E2E surface; no dist spawn; all run via buildProgram().exitOverride().parseAsync()
- 04-01: EIP-2981 royalty delivered as a 4-anchor bracket-counting post-process (NOT a wizard option — @openzeppelin/wizard@0.10.8 has no royalty field) — the ONE Phase 4 deviation from the no-templating model; each anchor is a single targeted insertion
- 04-01: Anchor 4 is dual-mode — 4a extends an existing supportsInterface override; 4b INJECTS one (override(ERC721, ERC2981)) when the wizard emits none. Corrects RESEARCH §Pitfall 4's no-op claim; the ERC721+ERC2981 diamond requires the explicit override to compile
- 04-01: ERC-1155 generate passes `updatableUri:true` as a hardcoded literal (wizard default, not surfaced as a prompt) — matches wizard.openzeppelin.com byte-for-byte
- 04-02/04-03: cancelGuard + conditional access prompt DUPLICATED inline per template (D-10) — duplication is the additive-model test; no shared-module extraction even with erc721+erc1155 as new consumers
- 04-04: Additive-only model HELD — only `src/cli.ts` (+4 lines boot wiring) and the `src/commands/create.ts` E_USAGE copy changed as source; `src/compiler/`, `src/registry/`, `src/lib/`, `src/templates/erc20/` untouched. The plugin architecture is additive without core changes (the central Phase 4 validation)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 7 research flag: Anchor single-file compile mechanism (likely scratch workspace under the hood) and Windows compatibility — prototype at phase start
- Phase 8 research flag: Default Ollama model recommendation — defer to phase-start benchmarking

## Session Continuity

Last session: 2026-05-28T00:00:00.000Z
Stopped at: Phase 4 complete; pending Phase 5 discuss
Resume file: (none yet — Phase 5 discuss not started)
Next plan: Phase 5 (DEPLOY.md Generation) — see ROADMAP.md. Run `/gsd:discuss-phase 05` to begin.
