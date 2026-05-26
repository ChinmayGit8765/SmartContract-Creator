# Phase 3: Compile-Verify Safety Net - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Mode:** Auto-elected (recommended options across all gray areas)

<domain>
## Phase Boundary

Insert an in-process Solidity compile gate between `template.generate(opts)` and `fs.writeFile` in the `create` dispatcher. After this phase ships, a user running `smartc create --template erc20` (or any Solidity template) sees one of three outcomes for the generated source:

1. **Compile clean** → file written, success footer surfaces optional warnings if any.
2. **Compile errors** → diagnostics rendered through the locked WHAT/WHY/FIX `CliError` block, NO file touched on disk, exit code reflects failure.
3. **Compile warnings only** → file written, warnings surfaced through `output.warn` channel, success otherwise.

The phase's payload is the `compileVerify(source, chain)` seam itself plus the bundled `solc` + `@openzeppelin/contracts` dependency-resolution machinery (the import callback that satisfies COMP-05 — `@openzeppelin/contracts/...` imports resolve from SmartC's bundled deps with no user install).

**Out of scope (later phases):**
- ERC-721 / ERC-1155 templates exercising the gate — Phase 4 (validates additive-only plugin model on the gate established here).
- DEPLOY.md generation alongside the verified file — Phase 5.
- `smartc doctor` reporting the bundled `solc` / `@oz/contracts` versions — Phase 6 surfaces them in a UX-formal way (Phase 3 only needs to make the versions accessible to `formatVersionLine()`).
- Solana / `anchor build` shell-out for SPL — Phase 7 (COMP-02 lives there, not here).
- AI-patch sandbox-compile-then-rollback — Phase 8 builds on the gate this phase ships.
- Cross-platform install verification (Windows/macOS/Linux solc binary loading) — Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Compiler approach
- **D-01: Use the `solc` npm package in-process (recommended).** `solc-js` is pure JavaScript (emscripten-compiled libsolc), runs in-process, no native binaries to ship, no spawn cost. This is the documented COMP-01 path — "in-process via the `solc` npm package against a pinned `@openzeppelin/contracts` version". Alternatives rejected: shelling out to a system `solc` (users would need to install it — fails COMP-05's "no user install required"); native-binary `solc-native` (adds platform-specific tarball matrix — re-litigates Phase 9 ahead of time).
- **D-02: Pin `solc` to a recent stable line (0.8.27+) compatible with `@openzeppelin/contracts@^5`.** OpenZeppelin Contracts v5 ships pragma `^0.8.20`; pin solc to the latest 0.8.x release at install time (researcher locks the exact version). Pin `@openzeppelin/contracts` to whatever version `@openzeppelin/wizard@0.10.8` emits imports for — researcher verifies by inspecting wizard output (`erc20.print` with the all-flags-on snapshot already on disk: `tests/fixtures/erc20/all-flags-on.sol`).
- **D-03: Standard JSON input format.** Use `solc.compile(JSON.stringify(input), { import: callback })` — the documented `compile_standard` API. The input has `language: "Solidity"`, `sources: { "<filename>": { content } }`, `settings.outputSelection` minimal (just `["abi", "evm.bytecode"]` — we don't need the artifacts, only that compile succeeded). The output is a JSON string we parse for the `errors[]` array; entries with `severity: "error"` block the write, entries with `severity: "warning"` surface but pass through. Documented as a one-page README inside `src/compiler/` so a future maintainer can find it without reverse-engineering solc-js.

### Bundled dependency resolution (COMP-05)
- **D-04: Import callback walks `node_modules/@openzeppelin/contracts/...` from the tool's install root.** When solc-js calls the import callback with `"@openzeppelin/contracts/token/ERC20/ERC20.sol"`, the callback uses `require.resolve("@openzeppelin/contracts/package.json")` to find the package root, then joins the import path to that root, reads the file, and returns it as `{ contents }`. This works regardless of where the user runs `smartc` from — because Node's module resolution finds OUR bundled `@openzeppelin/contracts` via the smartc package's own `node_modules`, not the user's cwd. The mechanism is verified by the Phase 1 dual-strategy `safeReadVersion`, which already finds dep package.json files from a globally-installed npm tool.
- **D-05: Cache resolved imports per compile call.** A `Map<string, { contents: string }>` for the lifetime of one compile invocation — OZ ERC-20 with all flags pulls ~8 imports transitively; caching avoids re-reading the same file 8 times if multiple roots reference it. No cross-call cache in Phase 3 (premature optimization for a tool that runs one compile per invocation).

### Dispatcher integration
- **D-06: Splice `compileVerify(source, tpl.chain)` at the marker on `src/commands/create.ts:95`.** The marker is already in place from Phase 2 (D-03 of Phase 2's CONTEXT.md). The function signature: `async function compileVerify(source: string, chain: "evm" | "solana"): Promise<{ warnings: CompileDiagnostic[] }>` — returns successfully with possibly-empty warnings on success, throws `CliError(E_COMPILE_FAILED)` on error. Phase 3 implements ONLY the `chain === "evm"` branch; the `solana` branch throws `E_NOT_IMPLEMENTED` with a Phase 7 pointer (graceful degradation when Phase 4 lands ERC-721/1155 keeps `chain: "evm"`; Phase 7 wires the SPL branch).
- **D-07: Compile happens before `confirmOverwrite` and before `fs.writeFile`.** Order: `runWizard → generate → compileVerify → confirmOverwrite → writeFile`. Compile is the gate; nothing else (not even the overwrite prompt) runs if compile fails. Rationale: a failed compile means no file should be touched, and the user should see compile diagnostics — not be asked an overwrite question for a file that's about to fail anyway.

### Compile-failure UX
- **D-08: Render compile errors as a multi-line `CliError` block.** The locked WHAT/WHY/FIX shape stays; the WHAT/FIX strings stay one-line; the WHY becomes a multi-line block listing each `severity: "error"` diagnostic with its `formattedMessage` (line:col + source snippet + caret pointing at the error, exactly as solc-js emits). Solc-js's `formattedMessage` is already human-readable — don't post-process it; render it verbatim under the WHY header. Add a final WHY line: "Compile errors come from `solc <ver>` against `@openzeppelin/contracts <ver>`."
- **D-09: Error code is `E_COMPILE_FAILED`, exit code 1.** Stable code, ships in Phase 3 and never renames (per Phase 1 stable-codes contract). Exit code 1 (not 2) — usage errors are 2, compile failures are runtime errors (1). New constant in `src/lib/errors.ts`.
- **D-10: Warnings surface but do NOT block (COMP-04).** Use `output.warn` for each `severity: "warning"` diagnostic. Newbie mode gets an additional `output.explain` after the warning list: "Warnings don't prevent deployment but often point at latent bugs. Review each one before deploying." Non-newbie mode is silent beyond the `output.warn` lines themselves.

### Versioning + visibility (COMP-05 + UI surface)
- **D-11: `formatVersionLine()` automatically picks up real `solc` + `@openzeppelin/contracts` versions.** Already wired via Phase 1's `safeReadVersion`. The moment `npm install solc @openzeppelin/contracts` lands in Plan 01 of this phase, `node dist/cli.js --version` flips from `solc not bundled, @openzeppelin/contracts not bundled` to `solc X.Y.Z, @openzeppelin/contracts A.B.C`. **No code change in `version.ts` — Phase 1 designed for this.** This is the user-facing surface for COMP-05's "pinned versions are visible somewhere user-facing".
- **D-12: Update the post-write `nextStep` footer in `create.ts`.** The current Phase 2 footer says: "Phase 3 will add automatic compile-verify before write — for now the .sol references @openzeppelin/contracts which you'll need installed to compile." Phase 3 replaces it with: "Compile-verified against solc X.Y.Z + @openzeppelin/contracts A.B.C. Run `smartc list-templates` to see other templates." (or similar — UI-spec / planner finalize wording).

### Testing strategy
- **D-13: Three test layers.** (a) **Unit:** `tests/compiler/compile.spec.ts` — mock solc-js, verify the input shape, callback wiring, error → CliError mapping, warning surfacing. (b) **Integration:** `tests/compiler/compile.integration.spec.ts` — real solc-js (no mock), feed it the two committed golden ERC-20 fixtures (bare-default + all-flags-on), assert they compile clean. This is the canary for OpenZeppelin drift across version bumps. (c) **E2E:** `tests/commands/create.compile.spec.ts` — in-process dispatcher run, real solc-js, real fixture, assert file written + version line shows real versions. The existing `tests/commands/create.spec.ts` happy path becomes a compile-pass case automatically because the gate now runs.
- **D-14: Add a deliberate-fail fixture.** A `tests/fixtures/broken.sol` (e.g., missing semicolon, undeclared variable) used only by unit/integration tests to verify the error path. NEVER produced by the wizard — it's a static fixture used to assert `E_COMPILE_FAILED` and "no file written on failure".
- **D-15: Asserting "no file written on compile failure" is load-bearing.** A `tests/commands/create.compile-fail.spec.ts` case: monkey-patch the dispatcher's `generate()` to return broken source (or directly inject through a test-only seam — planner's call), run dispatcher, assert (a) it rejected with `E_COMPILE_FAILED`, (b) `existsSync(outPath) === false`, (c) the renderError output contains the locked WHAT/WHY/FIX shape with the solc diagnostic in WHY.

### Claude's Discretion
- **Exact pinned versions of `solc` and `@openzeppelin/contracts`** — Researcher picks at planning time. Latest 0.8.x release for solc (e.g., `0.8.27`); latest stable v5.x for @oz/contracts. Both pinned to exact versions, not ranges, so snapshot fixtures stay stable.
- **Compiler output selection** — Researcher decides whether `["abi"]` alone is enough or `["abi", "evm.bytecode.object"]` is needed for some assertion. Default: minimum that proves compile succeeded.
- **CompileDiagnostic type shape** — Single type in `src/compiler/types.ts`: `{ severity: "error" | "warning"; message: string; formattedMessage: string; line?: number; column?: number; file?: string }`. Standardized so Phase 7's anchor-build adapter can produce the same shape (even though Phase 7 isn't running solc-js).
- **Banner/loading text during compile** — Planner picks the @clack/prompts spinner copy (e.g., "Compiling generated source…"). Default: keep it terse, no spinner if compile is fast enough (researcher times a representative compile during the Wave 0 probe).
- **README inside `src/compiler/`** — Planner-judged value. Recommended yes — one short page explaining: why solc-js + standard JSON, where the import callback lives, why the deliberate-fail fixture exists, how to bump pinned versions and refresh snapshots. Sets expectations for Phase 4 (which extends ERC-721/1155) and Phase 7 (which adds the SPL anchor branch).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Project framing, generate-and-compile principle (key decision row), out-of-scope list.
- `.planning/REQUIREMENTS.md` §Compile-Verify — COMP-01..COMP-05 (the locked requirements for this phase).
- `.planning/ROADMAP.md` §Phase 3 — Goal and success criteria SC-1..SC-5; particularly SC-4 ("imports resolve from the tool's bundled dependencies") and SC-5 ("pinned versions visible somewhere user-facing").

### Phase 1 + 2 handoffs
- `.planning/phases/01-cli-foundation/01-CONTEXT.md` — Locked Phase 1 decisions still in force (three-part error block, stable error codes contract, output channel rules).
- `.planning/phases/01-cli-foundation/01-02-SUMMARY.md` — `safeReadVersion` dual-strategy (works for solc/@oz/contracts the moment they're installed); CliError + renderError contract; output channel gating.
- `.planning/phases/02-erc-20-canary-template/02-CONTEXT.md` — D-03 (two-step plugin contract: runWizard → generate) and D-07 (deferred @openzeppelin/contracts install to this phase); Phase 2's explicit Phase-3-splice comment in `src/commands/create.ts:95`.
- `.planning/phases/02-erc-20-canary-template/02-05-SUMMARY.md` — formatVersionLine UI-16 segment lock (the contracts/solc segments still emit "not bundled" until this phase installs them).
- `.planning/phases/02-erc-20-canary-template/02-VERIFICATION.md` — Confirms the Phase 3 splice marker exists at exactly one location in `src/commands/create.ts:95`.

### External (read at planning time)
- `solc` npm — https://www.npmjs.com/package/solc — Standard JSON API: `solc.compile(jsonStringInput, { import: callback })`. Researcher confirms the import-callback signature is still `(path) => { contents?, error? }` in the pinned version.
- `@openzeppelin/contracts` npm — https://www.npmjs.com/package/@openzeppelin/contracts — Researcher confirms the v5 line is compatible with the wizard@0.10.8 emit (it must be — wizard ships against v5).
- OpenZeppelin Contracts release notes — https://github.com/OpenZeppelin/openzeppelin-contracts/releases — Use to pick a stable pinned version (avoid X.0.0 if a X.0.1 hot-fix exists).
- Solidity language docs — https://docs.soliditylang.org/ — Reference for diagnostic semantics (error vs warning severities; the `formattedMessage` field shape).

### Existing committed fixtures
- `tests/fixtures/erc20/bare-default.sol` — Phase 2 golden, MUST compile clean once solc + @oz/contracts are installed. The Wave 0 probe of Phase 3 runs this fixture through solc as the canary that the bundled-import-resolver works.
- `tests/fixtures/erc20/all-flags-on.sol` — Phase 2 golden with mintable + burnable + pausable + access:roles, MUST also compile clean. This is the maximum-imports surface for ERC-20.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/commands/create.ts:95` — Phase 3 splice marker, exactly one occurrence in the repo (verified in Phase 2 verification). The dispatcher accepts a single `await compileVerify(source, tpl.chain)` insertion here. No changes elsewhere to the dispatcher control flow except updating the post-write footer (D-12).
- `src/lib/errors.ts` — `CliError` + `ERR_*` constants + `renderError`. Phase 3 adds `ERR_COMPILE_FAILED = "E_COMPILE_FAILED"`. The three-part WHAT/WHY/FIX block already supports multi-line WHY (used by output channel rendering) — no refactor needed.
- `src/lib/output.ts` — `output.warn(msg)` channel for compile warnings; `output.explain(msg)` for the newbie-mode "warnings ≠ deployment-blockers" context.
- `src/lib/version.ts:84-89` — Already calls `safeReadVersion("solc")` and `safeReadVersion("@openzeppelin/contracts")`. The moment Plan 01 installs them, the version line auto-updates with no `version.ts` edit. **This is the entire wiring for SC-5; Plan 01's install IS the user-facing surface.**
- `src/registry/types.ts` — `Template<TOpts>.chain` field is one of `"evm" | "solana"`. `compileVerify(source, chain)` reads this directly. No type changes.
- `tests/fixtures/erc20/bare-default.sol` + `all-flags-on.sol` — Two committed Solidity files that MUST compile clean. They double as the Wave 0 probe and the integration-test corpus.

### Established Patterns
- **Phase 1 vi.mock pattern** — `vi.mock("solc", () => ({ default: { compile: vi.fn() } }))` at module top, followed by `const { compileVerify } = await import("../src/compiler/index.js")` in the test body. Same shape as `vi.mock("@clack/prompts", ...)` in Phase 2.
- **Three-channel diagnostic rendering** — `output.warn` for non-fatal, `CliError`+`renderError` for fatal. No `console.log` ever; everything routes through the output factory or the error renderer.
- **Stable error codes contract (Phase 1)** — Once shipped, never rename. `E_COMPILE_FAILED` ships in Phase 3 and stays through Phase 7 (where SPL's anchor-build adapter also throws it on Anchor compile failure) and Phase 8 (AI-patch sandbox-compile).
- **Phase 1 dist build pattern** — `npm run build` produces `dist/cli.js`; the e2e suite spawns this binary with `NO_COLOR=1`. Phase 3's E2E test follows the same pattern, plus accepts an extra second or two of timeout because compile adds ~500ms-1s (researcher measures during Wave 0 probe).

### Integration Points
- **`src/commands/create.ts:95` splice** — Insert `const { warnings } = await compileVerify(source, tpl.chain);` then `warnings.forEach(w => output.warn(w.formattedMessage));` then (in newbie mode + warnings.length > 0) `output.explain("Warnings don't block deployment but often point at latent bugs. Review each before shipping.")`. Two lines of imports added to top of file: `import { compileVerify } from "../compiler/index.js";` (no other create.ts churn).
- **`src/lib/version.ts` auto-rolls forward** — Plan 01 installs solc + @oz/contracts; `node dist/cli.js --version` automatically shifts to show real versions. No version.ts edits. This is the SC-5 deliverable.
- **`tests/commands/create.spec.ts`** — Phase 2 happy-path test currently mocks the generate path so no real compile runs. Phase 3 either (a) adds real solc to this test (now compile runs end-to-end) or (b) leaves it as the "unit" layer with mocked compileVerify and adds a new `create.compile.spec.ts` for the real-solc layer. Planner picks; D-13 recommends (b) — keep existing test as fast-mocked unit, add new file for integration. The Phase 3 SC-1 verification (compile gate runs before write) becomes a new test case, not a change to an existing one.

</code_context>

<specifics>
## Specific Ideas

- **"Bundled resolver" as the architectural lever** — The import callback (D-04) is the most subtle bit of this phase. Get it right once and every Solidity template for the rest of the project benefits (Phase 4 ERC-721/1155 inherit it; Phase 8 AI-patch reuses the same gate; Phase 9 distribution doesn't have to teach users "install OpenZeppelin separately"). Phase 3 ships this as a single function in `src/compiler/imports.ts` with a focused test that proves cwd-independence (run from `/tmp`, still resolves OZ contracts from smartc's install root).
- **The Phase 3 ↔ Phase 7 seam shape** — `compileVerify(source, chain)` is the unified interface. Phase 7's SPL branch shells out to `anchor build` but produces the same `{ warnings: CompileDiagnostic[] }` success shape (and the same `E_COMPILE_FAILED` failure code). The seam is named to telegraph this: not `compileSolidity`, but `compileVerify` — chain-agnostic at the call site.
- **Wave 0 probe (researcher prototypes at phase start)** — STATE.md flagged: "Confirm `solc` import-callback resolves `@openzeppelin/contracts/...` from bundled deps without user install — prototype at phase start." This is the Phase 3 Wave 0 task: a 30-line throwaway script that installs `solc@0.8.x` + `@openzeppelin/contracts@5.x`, calls `compile()` on the bare-default fixture with the proposed import callback, asserts no errors. If the probe fails (e.g., solc-js can't find @oz/contracts when run from outside the smartc tree), the phase plan adapts before plan locking. Default expectation per Phase 1's dual-strategy resolve evidence: it works.
- **Multi-line WHY rendering** — The locked CliError contract supports multi-line WHY (existing code paths in `renderError` already split on `\n`). Phase 3 doesn't change error rendering — it just produces a multi-line WHY string containing the solc `formattedMessage` blocks separated by blank lines. The diagnostic format is already human-readable; no post-processing.
- **Test-only seam for injecting broken source** — D-15's "no file written on failure" test needs a way to feed broken source into the dispatcher. Two paths: (a) bypass `template.generate()` via a test-only Template that returns broken source; (b) mock the wizard's output. Planner picks; (a) is cleaner because it doesn't entangle `@clack/prompts` mocks with compile assertions.

</specifics>

<deferred>
## Deferred Ideas

- **Compile cache across runs** — Skipping the compile when source matches a prior successful run. Useful for repeated runs in scripting workflows but premature for a tool that generates one file per invocation. Defer to v2 or a dedicated performance pass.
- **Multi-target compile (paris/london/cancun EVM versions)** — Phase 3 uses solc's default EVM target. Future templates that target specific L2s might need this; defer until a template asks for it.
- **Compile against multiple solc versions in CI** — Useful for catching solc-side regressions but expensive and not a v1 requirement. Defer to v2.
- **Surface bytecode size or gas estimates after compile** — `output.explain("Bytecode size: 12.4 KB — well below the 24 KB limit.")` would be a nice newbie touch. Not in COMP-01..COMP-05; defer to a future "diagnostics polish" iteration.
- **Solc warnings → categorized severities (informational, low, medium, high)** — Solc emits flat warnings; mapping them to tiers (e.g., "shadowing local" as low, "unused state variable" as informational) is opinionated UX. Defer to a future "newbie-mode polish" pass.
- **Compile-verify badge in DEPLOY.md** — When Phase 5 generates DEPLOY.md, embedding "Compile-verified by smartc <ver> + solc <ver> + @openzeppelin/contracts <ver>" near the top is nice but is Phase 5's problem, not Phase 3's.
- **Anchor build adapter via the same `compileVerify` shape** — Phase 7's deliverable; the seam shape is set here so Phase 7 only plugs in the SPL branch.

</deferred>

---

*Phase: 03-compile-verify-safety-net*
*Context gathered: 2026-05-26*
*Auto-mode: all gray areas resolved with recommended options; no user prompts.*
