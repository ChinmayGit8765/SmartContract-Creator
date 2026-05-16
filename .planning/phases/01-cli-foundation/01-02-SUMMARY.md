---
phase: 01-cli-foundation
plan: 02
subsystem: cli
tags: [typescript, esm, vitest, picocolors, clack, error-handling, output-routing]

# Dependency graph
requires:
  - phase: 01-cli-foundation
    provides: scaffold (package.json, tsconfig, tsup, vitest) from plan 01
provides:
  - CliError class with three-part (what/why/fix) error block + stable code constants
  - renderError() that handles CliError, plain Error, and non-Error throws
  - parseBoolEnv() and resolveNewbie() with flag-over-env precedence
  - makeColor() factory respecting --no-color flag AND picocolors detection
  - safeReadVersion() robust against exports-map-restricted packages
  - formatVersionLine() producing Phase-1 "not bundled" version string
  - Output interface with newbie-only and json-silenced channels
  - confirmOverwrite() prompt wrapper with --force bypass
affects:
  - 01-04 (commander wiring consumes all six libs)
  - 02-wizard (Output.explain/reference/nextStep drive the newbie experience)
  - 03-compile-verify (CliError block renders compile diagnostics)
  - 05-deploy-md (Output.result emits DEPLOY.md path / json blob)
  - 08-ai-add-feature (CliError signals Ollama failures with stable codes)

# Tech tracking
tech-stack:
  added: [] # all deps came in via plan 01
  patterns:
    - "Pure-lib first, commander glue later — abstractions in src/lib/, no commander coupling"
    - "Three-part error block (Error/Why/Fix) as load-bearing UX contract"
    - "Verbosity routing: warn/error always; newbie channels gated by newbie+!json"
    - "Flag-over-env precedence with explicit-false honored"
    - "Injectable stdout/stderr streams for testability"
    - "vi.mock(@clack/prompts) + dynamic import() so the SUT picks up the mock"

key-files:
  created:
    - src/lib/errors.ts
    - src/lib/env.ts
    - src/lib/color.ts
    - src/lib/version.ts
    - src/lib/output.ts
    - src/lib/prompt.ts
    - tests/errors.spec.ts
    - tests/env.spec.ts
    - tests/color.spec.ts
    - tests/version.spec.ts
    - tests/output.spec.ts
    - tests/prompt.spec.ts
  modified: []

key-decisions:
  - "safeReadVersion uses dual-strategy resolve (direct + walk-up) — necessary because commander@14 and similar modern packages restrict ./package.json via exports map"
  - "Identity-function pattern for noColor: wrap pc.createColors(enabled) so makeColor(true) is byte-equal to input"
  - "Output.warn always prefixes 'warn:' on stderr — keeps default mode quiet but still surfaces critical signals"
  - "Output.error writes raw stderr (no prefix) — the caller is expected to pass a pre-rendered CliError block from renderError()"
  - "vi.mock + top-level await dynamic import for prompt.spec — the cleanest pattern for hoisting-aware Vitest 4 mocking of an external ESM module"

patterns-established:
  - "Pattern: All Phase 1+ libs live in src/lib/ and have a sibling spec in tests/. No commander coupling."
  - "Pattern: CliError({code, what, why, fix}) is the only sanctioned way to surface user-facing failures. Plan 04 will catch and renderError() in the commander error handler."
  - "Pattern: Newbie channels (explain/reference/nextStep) accept STRING content from the caller; the factory decides whether to write or no-op. Callers never branch on newbie mode."

# Metrics
duration: 5min
completed: 2026-05-16
---

# Phase 1 Plan 02: Core Libs (errors, output, env, color, prompt, version) Summary

**Six pure libraries shipping the load-bearing CliError block, verbosity-routed Output channel, env+flag precedence, color factory, overwrite prompt, and version-line formatter — all testable in isolation without commander.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-16T06:49:22Z
- **Completed:** 2026-05-16T06:54:16Z
- **Tasks:** 2
- **Source files created:** 6
- **Spec files created:** 6
- **Tests:** 42 in this plan / 49 total (Phase 1 suite)

## Accomplishments

- `CliError` + `renderError()` deliver the three-part Error/Why/Fix block that the entire product UX hangs off of. Stable code constants (`E_FILE_EXISTS`, `E_NOT_IMPLEMENTED`, `E_USAGE`, `E_UNKNOWN`) shipped in Phase 1 as agreed in CONTEXT.
- `Output` interface routes by verbosity: result/warn/error always emit, explain/reference/nextStep gated on newbie mode AND silenced under `--json`. Both streams injectable for tests.
- `parseBoolEnv` / `resolveNewbie` give a single source of truth for "is newbie mode on?" — flag wins over env, explicit `false` wins over env, undefined falls back to env.
- `makeColor(noColorFlag)` honors both the CLI flag and picocolors' own detection (which respects `NO_COLOR` env and isatty).
- `confirmOverwrite` wraps `@clack/prompts.confirm` with the exact spec'd wording, defaults to NO, and bypasses entirely under `--force`. Refusal or Ctrl+C throws `CliError(E_FILE_EXISTS)` with a fix that points to `--force`.
- `formatVersionLine()` reports `solc not bundled, @openzeppelin/contracts not bundled` for Phase 1, and will flip to real semver automatically once Phase 3 installs those deps — no code change needed.

## Task Commits

1. **Task 1: errors, env, color, version libs + 4 specs** — `da7bf29` (feat)
2. **Task 2: output, prompt libs + 2 specs** — `39f1855` (feat)

**Plan metadata commit:** (this commit — `docs(01-02): complete libs plan`)

## Files Created/Modified

### Source (src/lib/)
- `src/lib/errors.ts` — `CliError` class, four `ERR_*` constants, `renderError()` that handles CliError / Error / non-Error
- `src/lib/env.ts` — `parseBoolEnv()` (truthy: 1/true/yes/on, case-insensitive, trimmed), `resolveNewbie()` (flag > env)
- `src/lib/color.ts` — `Colors` interface (6 methods: red/yellow/cyan/green/dim/bold), `makeColor(noColorFlag)` factory
- `src/lib/version.ts` — `safeReadVersion(pkg)` with dual-strategy lookup, `formatVersionLine()` Phase-1 shape
- `src/lib/output.ts` — `Output` interface, `makeOutput({newbie, json, color, stdout?, stderr?})` factory
- `src/lib/prompt.ts` — `confirmOverwrite(path, {force})` wrapping `@clack/prompts.confirm`

### Tests (tests/)
- `tests/errors.spec.ts` — 8 tests covering CliError construction, exitCode default/override, ERR_* constants, renderError on all three input types
- `tests/env.spec.ts` — 7 tests covering truthy/falsy cases, all four precedence paths of resolveNewbie
- `tests/color.spec.ts` — 3 tests covering identity behavior, callable surface, stable shape
- `tests/version.spec.ts` — 6 tests covering null-return for missing pkg, Phase-1 'not bundled' contract, format shape
- `tests/output.spec.ts` — 12 tests covering all four (newbie x json) modes for every channel
- `tests/prompt.spec.ts` — 6 tests covering force-bypass, message contract, yes/no/cancel branches

## Decisions Made

- **`safeReadVersion` dual-strategy.** Original plan-spec code used only `require.resolve("<pkg>/package.json")`, which fails for any package whose `exports` map omits `./package.json` — and most modern packages do. Notably `commander@14` (already a Phase-1 dep) and `solc` (Phase-3 dep). Added a second strategy: resolve the package's entry point, then walk dirname() upward looking for a `package.json` whose `name` matches. Without this, `formatVersionLine` would have shipped "not bundled" forever even after Phase 3 installs solc — defeating its purpose.

- **Wrapped picocolors methods rather than passing them through.** picocolors' types accept `string | number | null | undefined`; our `Colors` interface tightens to `(s: string) => string`. Wrapping each method via arrow gives us a clean call boundary and avoids any contravariance / Formatter-type leakage into call sites.

- **Output factory pre-computes channel functions at construction time.** `makeOutput` decides at construction whether `explain/reference/nextStep` are real or no-op functions, rather than branching per-call. Cheaper, and forces the design: a caller can't accidentally bypass the gating.

- **Two separate noop helpers in output.ts.** `noopOne(t)` for `explain`/`nextStep` (one arg) and `noopTwo(label, url)` for `reference` (two args). Avoids the `_` parameter unused-var lint warning under `noUnusedParameters` and keeps signatures honest.

- **Prompt spec uses `vi.mock` + top-level dynamic `await import()`.** This is the cleanest pattern for Vitest 4 ESM mocking: declare the mock, then dynamic-import the SUT so it picks up the mocked module. A static import of `../src/lib/prompt.js` would hoist above the mock and bind to the real `@clack/prompts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `safeReadVersion` returned null for installed packages with restricted exports maps**

- **Found during:** Task 1 verification (`tests/version.spec.ts` — the "returns a semver-shaped string for an installed dependency" case against `commander`)
- **Issue:** The plan-spec code used `require.resolve(\`${pkgName}/package.json\`)`. Under Node's ESM/exports semantics, this throws `ERR_PACKAGE_PATH_NOT_EXPORTED` for any package whose `exports` field doesn't list `./package.json`. `commander@14` (Phase-1 dep) is exactly such a package — its exports map only exposes `.` and `./esm.mjs`. The plan's chosen smoke-test target therefore failed, but worse, this same bug would have hidden solc and `@openzeppelin/contracts` versions in Phase 3 even after they were installed.
- **Fix:** Added a second resolution strategy in `safeReadVersion`: if the direct `pkgName/package.json` resolve fails, try `require.resolve(pkgName)` to find the entry point, then walk `dirname()` up to ten levels looking for a `package.json` whose `name` field matches the requested package. Bounded loop, exits when `dirname(dir) === dir` (filesystem root).
- **Files modified:** `src/lib/version.ts`
- **Verification:** `tests/version.spec.ts` now green; `safeReadVersion("commander")` returns `"14.0.3"`; `safeReadVersion("solc")` and `safeReadVersion("@openzeppelin/contracts")` correctly return `null` (Phase-1 contract preserved); `formatVersionLine()` matches the spec'd regex.
- **Committed in:** `da7bf29` (Task 1 commit)

**2. [Rule 1 — Bug] `_` unused-parameter `noop` helper in output.ts would not typecheck under `noUnusedParameters`**

- **Found during:** Task 2 typecheck (the plan-spec code used `const noop = (_: string, __?: string) => {...}` as a shared no-op for both 1-arg and 2-arg channels)
- **Issue:** Even without `noUnusedParameters`, the single shared `noop` signature `(_:string, __?:string)` is structurally lying — it claims 2 params when assigned to `explain`'s 1-param signature. Cleaner to have two purpose-built noops with the exact arity of each channel.
- **Fix:** Split into `noopOne(_t: string)` for explain/nextStep and `noopTwo(_label: string, _url: string)` for reference. Both prefixed with `_` so they're tolerated by strict unused-param lints in any future config tightening.
- **Files modified:** `src/lib/output.ts`
- **Verification:** `npm run typecheck` clean; output.spec.ts all 12 tests green.
- **Committed in:** `39f1855` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — Bug)
**Impact on plan:** No scope creep. Both fixes are corrections to plan-supplied code that would have shipped broken or fragile. The version-lookup fix is load-bearing for Phase 3 (where real solc/OZ versions are expected to appear automatically).

## Issues Encountered

- **Parallel-agent race on git index.** When committing Task 1, `git status --short` showed only my staged files plus an unstaged `M .planning/STATE.md` and untracked `?? .planning/phases/01-cli-foundation/01-03-SUMMARY.md`. Between `git add` and `git commit`, the parallel Plan 01-03 agent appears to have staged those files into the index, and my `git commit` swept them up — resulting in a Task 1 commit that includes Plan 01-03's STATE.md update and SUMMARY.md. **Resolution:** Left as-is; semantically harmless (STATE.md will be re-updated by this plan's metadata commit, and the SUMMARY belongs to a sibling plan that is in fact complete). Documented here so the bookkeeping is unambiguous. **Lesson for future parallel plans:** orchestrator should serialize STATE.md/SUMMARY.md commits, OR each agent should commit immediately after `git add` without delay.

- **No actual blocker** — every test passed on first or second attempt; both deviations were caught by the spec suite (which is exactly what specs are for).

## User Setup Required

None — no external service configuration required.

## Notes for Plan 04 (commander wiring)

Plan 04 should consume these libs as follows; nothing in them needs modification:

```ts
import { Command } from "commander";
import { CliError, renderError, ERR_NOT_IMPLEMENTED } from "./lib/errors.js";
import { makeColor } from "./lib/color.js";
import { makeOutput } from "./lib/output.js";
import { resolveNewbie } from "./lib/env.js";
import { formatVersionLine } from "./lib/version.js";

const program = new Command()
  .name("smartc")
  .version(formatVersionLine())
  .option("--newbie", "show explanations / references / next steps")
  .option("--no-color", "disable ANSI colors")
  .option("--json", "machine-readable output (silences newbie channels)")
  .option("--force", "skip all confirmation prompts");

program.command("create").action(() => {
  const opts = program.opts();
  const color = makeColor(Boolean(opts.color === false));
  const newbie = resolveNewbie({ newbieFlag: opts.newbie });
  const output = makeOutput({ newbie, json: Boolean(opts.json), color });

  // Phase 1 stub:
  throw new CliError({
    code: ERR_NOT_IMPLEMENTED,
    what: "The `create` command is not yet implemented.",
    why: "Phase 2 will wire the wizard; Phase 1 ships only the foundation.",
    fix: "Track progress at .planning/STATE.md or run --help to see available commands.",
  });
});

// Top-level error handler:
try {
  await program.parseAsync(process.argv);
} catch (e) {
  const color = makeColor(false); // no flag yet at this point; fall back to env-detection
  process.stderr.write(renderError(e, color) + "\n");
  process.exit(e instanceof CliError ? e.exitCode : 1);
}
```

Key wiring rules:

- **`--no-color` from commander surfaces as `opts.color === false`** (commander negates `--no-` flags). The `makeColor` call should be `makeColor(opts.color === false)`.
- **`--newbie` may be `undefined` (absent) or `true` (present).** Commander does not set `false` by default unless `--no-newbie` is declared. So `resolveNewbie({ newbieFlag: opts.newbie })` handles all three cases correctly.
- **The error handler is the ONLY place that calls `renderError`.** Library code throws `CliError`; commander action wrappers never catch — they let it bubble.
- **`--force` is read by `create` (and future) actions and passed to `confirmOverwrite({ force: opts.force })`**, NOT into `makeOutput`. Force is a prompt-skip concern, not an output-verbosity concern.

## Next Phase Readiness

- **Plan 03 (registry)** — already complete in parallel (commit `dd976b0`). Plan 04 has both libs and registry available.
- **Plan 04 (commander wiring)** — ready to start. All six libs exposed, all 42 unit tests green; commander only needs to glue them. See "Notes for Plan 04" above for the exact wiring sketch.
- **Phase 2 (wizard)** — `Output.explain/reference/nextStep` are designed to drive the newbie wizard transcript. The "see EIP-20 (url)" reference format is intentionally Phase-2-shaped.
- **Phase 3 (compile-verify)** — `formatVersionLine` will automatically pick up `solc` and `@openzeppelin/contracts` versions once installed; no code change. `CliError(ERR_COMPILE_FAIL, ...)` will use the same three-part block to surface compile diagnostics.
- **No blockers, no concerns.** Phase-1 research flags (Phase 3 solc-callback, Phase 7 Anchor, Phase 8 Ollama) remain open and unaffected by this plan.

---
*Phase: 01-cli-foundation*
*Completed: 2026-05-16*
