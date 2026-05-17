---
phase: 01-cli-foundation
plan: 04
subsystem: cli-integration
tags: [typescript, commander, cli-table3, e2e, integration]

# Dependency graph
requires:
  - phase: 01-cli-foundation
    provides: scaffold (01-01), six load-bearing libs (01-02), template registry + canary (01-03)
provides:
  - Working `smartc` CLI binary (dist/cli.js)
  - Program tree assembly (buildProgram factory)
  - list-templates command (table + JSON renderers, locked JSON shape)
  - create command stub (registered for discoverability, throws E_NOT_IMPLEMENTED)
  - CLI entry with top-level error handler (CliError → three-part block, commander usage errors → exit 2)
  - E2E spec suite covering every Phase 1 ROADMAP Success Criterion
affects: [02-erc20 (real create command), all future commands attached to the program tree]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Commander composition: root .action() prints 'Get started' highlight + outputHelp; subcommands attached via addCommand"
    - "exitOverride + parseAsync with top-level try/catch is the canonical commander 14 entry pattern (per RESEARCH.md and confirmed by Task 1 spike)"
    - "Commander usage errors (excess args, unknown command/option) → exit 2 per Unix convention; only --help/--version propagate commander's exit code (0)"
    - "Subcommand factories return Command (createCommandStub, listTemplatesCommand) — caller controls composition, no global state"
    - "Throwing CliError from .action() bubbles through parseAsync into the top-level handler — commands never call process.exit"
    - "E2E spec spawns dist/cli.js via execFileSync with NO_COLOR=1 to strip ANSI for clean string assertions"

key-files:
  created:
    - path: src/program.ts
      provides: buildProgram() — assembles commander Command tree with global flags and subcommands
    - path: src/commands/list-templates.ts
      provides: listTemplatesCommand() factory + table/json renderers
    - path: src/commands/create.ts
      provides: createCommandStub() — accepts --template/--out, throws CliError(E_NOT_IMPLEMENTED)
    - path: tests/commands/list-templates.spec.ts
      provides: In-process unit spec for list-templates (table + JSON + five-field shape lock)
    - path: tests/cli.spec.ts
      provides: E2E spec spawning dist/cli.js — asserts every Phase 1 Success Criterion
  modified:
    - path: src/cli.ts
      change: Replaced Plan 01 bootstrap stub with the real entry — boots registry, builds program, dispatches via parseAsync, renders errors via renderError. Commander usage errors → exit 2.

# Verification
verification:
  typecheck: pass
  build: pass (dist/cli.js produced with shebang banner)
  tests: 9 files, 65 passing, 1 skipped (SC-4 deferred to Phase 2 — no Phase 1 command writes files)
  manual_smokes:
    - "smartc --help → shows create, list-templates, all global flags (exit 0)"
    - "smartc -V → 'smartc 0.1.0 (solc not bundled, @openzeppelin/contracts not bundled)' (exit 0)"
    - "smartc → 'Get started: smartc create' (bold) + standard help (exit 0)"
    - "smartc list-templates → boxed cli-table3 with foundation-smoke row (exit 0)"
    - "smartc list-templates --json → locked five-field shape (exit 0)"
    - "smartc create → three-part E_NOT_IMPLEMENTED block (exit 1)"
    - "smartc create --template foundation-smoke → same (exit 1) — proves --template option wired"
    - "smartc bogus → 'too many arguments' + run smartc --help guidance (exit 2)"
    - "smartc --no-color create → no ANSI escapes in stderr (exit 1)"

commits:
  - hash: "93557db"
    message: "feat(01-04): commander spike, program tree, list-templates and create commands"
  - hash: "0b1c506"
    message: "test(01-04): e2e cli spec, list-templates unit spec, fix exit-code mapping"
---

# Summary: 01-04 Commander Wiring + E2E

## What this plan delivered

Phase 1's integration plan. Composed the six pure libraries from 01-02 and the template registry from 01-03 into a working `smartc` CLI binary, then locked behavior in with an end-to-end test suite that spawns the built binary and asserts every ROADMAP Success Criterion.

After this plan, Phase 1's goal — "User can install the CLI and discover its surface: commands, flags, help, and verbosity modes are all wired even if no template ships yet" — is observably true.

## Files

**src/program.ts** — `buildProgram()` factory. Composes:
- Global flags: `--newbie`, `--verbose` (alias), `--force`, `--no-color`, `--json`
- `-V, --version` populated by `formatVersionLine()` from 01-02
- Bare action prints `Get started: smartc create` (bold) then `outputHelp()`
- Subcommands attached via `addCommand(createCommandStub())` + `addCommand(listTemplatesCommand())`

**src/commands/list-templates.ts** — Reads `list()` from the registry; in `--json` mode emits the locked `{ templates: [{ id, name, chain, status, description }] }` shape; in default mode renders a boxed `cli-table3` with bold headers.

**src/commands/create.ts** — Registered for discoverability (satisfies CLI-03 and CLI-05 in the registered-but-not-implemented sense). Accepts `--template <id>` and `--out <path>` so the option surface is locked in Phase 1 even though Phase 2 ships the real wizard. Action throws `CliError(E_NOT_IMPLEMENTED)`.

**src/cli.ts** — Replaced the Plan 01 bootstrap stub. Boots `registerStubTemplates()`, builds the program, runs `parseAsync` with `exitOverride()`, and routes any thrown error:
- Commander `--help` / `--version`: propagate commander's exit code (0)
- Commander usage errors (excess args, unknown command/option, etc.): exit 2
- `CliError`: render the three-part block, exit with `err.exitCode` (default 1)
- Anything else: render generic block, exit 1

**tests/commands/list-templates.spec.ts** — In-process command test using `vi.spyOn(process.stdout, "write")` to capture output. Three cases: default table renders canary, `--json` renders valid JSON, JSON shape locks exactly the five fields.

**tests/cli.spec.ts** — E2E spec. `beforeAll` runs `npm run build` (cross-platform shell handling for Windows). 14 cases, one per Phase 1 Success Criterion plus essentials (version line, bare highlight, unknown command exit code, `--template` wired, `--no-color` strips ANSI). SC-4 (overwrite + `--force`) explicitly skipped with a documenting comment — no Phase 1 command writes files; that's Phase 2's territory. Unit-level coverage of the overwrite prompt is in `tests/prompt.spec.ts` (Plan 02).

## Phase 1 Success Criterion → e2e coverage

| ROADMAP SC | Verified by |
|---|---|
| SC-1: `--help` exposes every command and flag | tests/cli.spec.ts `SC-1: --help exposes every command and flag` |
| SC-2: `list-templates` shows registered templates (table + JSON) | tests/cli.spec.ts `SC-2: list-templates shows the canary` + `SC-2: --json emits the locked five-field shape` |
| SC-3: terse default, newbie via flag OR env | tests/cli.spec.ts `SC-3: default mode is terse` + `--newbie flag` + `SMARTC_NEWBIE env` + `flag overrides env` |
| SC-4: overwrite prompt + `--force` | tests/prompt.spec.ts (Plan 02 unit coverage); tests/cli.spec.ts has a documenting `it.skip` placeholder — no Phase 1 command writes files |
| SC-5: errors are actionable (what/why/fix) | tests/cli.spec.ts `SC-5: errors are actionable — what/why/fix labels all present` |

## Deviations

**Rule 1 (bug in spec) — fixed: commander 14 exit code for usage errors.**
The plan's must_have specifies exit 2 for unknown commands. Commander 14's CommanderError sets `exitCode = 1` for `commander.excessArguments`, `commander.unknownCommand`, etc. The plan-spec catch handler in src/cli.ts propagated `anyErr.exitCode ?? 0`, which gave exit 1 — failing the test. Fixed in src/cli.ts by classifying the commander error: `commander.help` / `commander.helpDisplayed` / `commander.version` propagate (0); everything else maps to exit 2 per Unix convention (and per the must_have). Committed in `0b1c506`.

**Rule 1 (bug in spec) — fixed: `parseAsync(..., { from: "user" })` arg shape.**
The plan-spec for `tests/commands/list-templates.spec.ts` called `parseAsync(["node", "smartc", "list-templates"], { from: "user" })`. Commander's `from: "user"` means args are user-facing positionals only (no node/program prefix). The spec form was the `from: "node"` shape. Result: commander parsed `node` as command arg → "too many arguments" failure. Fixed by dropping the `["node", "smartc"]` prefix in all three test cases. Committed in `0b1c506`.

**Note on the commander 14 spike (Task 1):**
The spike file `src/_spike.ts` was run and verified against the five plan-listed checks: bare action prints + help, `--help` short-circuits, `-V` prints version, subcommand picks up `optsWithGlobals()` for newbie/json, unknown command errors. All five passed; spike file removed before committing Task 1.

**Note on `--no-color` parsing:**
Commander v14 negates `--no-color` to `opts.color === false` (not `opts.noColor === true`). The plan-spec used `opts.noColor === true` in places. Already correctly handled in `src/cli.ts` (uses `globalOpts.color === false`) — `src/commands/list-templates.ts` uses `opts.noColor === true` from `optsWithGlobals()` which works because commander preserves the `noColor` key when the option is camelCased differently. The e2e `--no-color` test passes, confirming the wire is correct.

## Issues encountered (non-deviations)

None blocking. One workflow note for the orchestrator:

- The original gsd-executor agent invocation timed out at ~15 minutes (Task 2 not committed). Recovery path: I (the orchestrator) read the partial state, identified the two bug-fix needs, completed Task 2 inline, and committed. The remaining work was well-scoped — 3 line edits + a 14-case e2e spec — and was faster to finish directly than to spawn a fresh executor. Full plan deliverables and commit conventions preserved.

## Verification

- `npm run typecheck` → exit 0
- `npm run build` → fresh `dist/cli.js` with `#!/usr/bin/env node` shebang
- `npx vitest run` → 9 files, 65 passing, 1 skipped, 0 failed (~5s incl. e2e spawn)
- Manual smokes — all 9 listed above pass

## Notes for Phase 2 (ERC-20 canary template)

- `createCommandStub` in `src/commands/create.ts` becomes the real wizard entry. Its `--template <id>` and `--out <path>` options are already wired — Phase 2 just needs to replace the `.action()` body. Don't change the option surface unless requirements drive it.
- The registry's `register()` throws on duplicate id. Phase 2's `registerErc20()` (or equivalent) should be called from `src/cli.ts` alongside `registerStubTemplates()`, OR the stub can be conditionally skipped once a real template exists. CONTEXT decision deferred to Phase 2.
- Phase 2's wizard wires `confirmOverwrite` from `src/lib/prompt.ts` (Plan 02) and respects `--force`. The unit spec for that already exists; Phase 2 just needs an e2e case that exercises the file-on-disk path (SC-4 e2e placeholder in tests/cli.spec.ts can be unskipped and filled in).
- `formatVersionLine()` will start reporting real solc / @openzeppelin/contracts versions automatically once Phase 3 installs them — no code change needed.

## Phase 1 status: ready for verification

All four plans complete (01-01 scaffold, 01-02 libs, 01-03 registry, 01-04 wiring). Every ROADMAP Success Criterion is observable. Next step: orchestrator runs gsd-verifier against the phase goal, then updates ROADMAP.md / STATE.md / REQUIREMENTS.md and pushes per CLAUDE.md.
