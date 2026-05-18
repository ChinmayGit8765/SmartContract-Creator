# Phase 2: ERC-20 Canary Template - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

First template end-to-end. User can run `smartc create --template erc20`, walk through the wizard (name, symbol, initial supply, opt-in Mintable/Burnable/Pausable, conditional Ownable-vs-AccessControl when Mintable or Pausable is selected), and get a single `.sol` file on disk that follows OpenZeppelin Wizard conventions.

The phase's *real* payload is the **plugin + builder pipeline** — the shape established by ERC-20 here is what ERC-721, ERC-1155 (Phase 4) and SPL (Phase 7) will plug into. ERC-20 is the canary; the architecture is the deliverable.

**Out of scope (later phases):**
- Compile-verify of generated source — Phase 3 sandwiches it between wizard and file write
- @openzeppelin/contracts as a bundled dep — Phase 3 installs the pinned version
- DEPLOY.md alongside the .sol — Phase 5
- ERC-721 / ERC-1155 / SPL — Phases 4 and 7
- AI add-feature on generated files — Phase 8

</domain>

<decisions>
## Implementation Decisions

### Code-gen strategy
- **D-01: Use `@openzeppelin/wizard` directly.** Phase 2's ERC-20 generator is a thin wrapper that calls `erc20.print(opts)` and returns the source string. OpenZeppelin owns the generator + contract evolution; SmartC owns the wizard UI, plugin contract, and (later) DEPLOY.md. This is the *literal* satisfaction of ROADMAP success criterion 4 ("matches OpenZeppelin Wizard output conventions (no syntax-corrupting template hacks)") — we delegate to the same engine that powers wizard.openzeppelin.com.
- **D-02: No string templating with sentinels, ever.** Anywhere a future template needs to inject project-specific content around OZ output (headers, banners), do it as a post-process step on the *complete* string, not by interpolating into a template body. This rule survives Phase 2 — applies to all future template plugins.

### Plugin contract shape
- **D-03: Two-step `Template` interface — `runWizard(io)` → `generate(opts)`.** The locked Phase 1 five-field shape (`id`, `name`, `chain`, `status`, `description`) is preserved; Phase 2 *adds* two optional method fields for the functional behavior. The dispatcher in `src/commands/create.ts` orchestrates: wizard → (Phase 3 splices compile-verify here) → write. This seam exists explicitly so Phase 3 can insert the compile gate without changing the plugin contract.
- **D-04: `generate()` returns `{ filename, source }`, not raw string.** Filename derivation (`MyToken` → `MyToken.sol`) lives in the template, not the dispatcher — because SPL output is a Rust file with different naming conventions, and the plugin owns its conventions. The dispatcher only knows `--out <path>` overrides the suggested filename.
- **D-05: Template plugin is typed-per-template, not generic-with-schema.** Each template owns its `Opts` type (`Erc20Opts`, future `Erc721Opts`, `SplOpts`). `Template<TOpts>` is generic but `registry.get(id)` returns `Template<unknown>` — the dispatcher accepts that opacity and templates round-trip their own opts between `runWizard` and `generate`. No runtime opts schema in Phase 2.
- **D-06: No third `validate(opts)` method.** Wizard-time validators (in @clack/prompts callbacks) cover input shape. Phase 3 owns real validation (compile-verify). Adding a Phase 2 `validate()` would be a premature abstraction with no work to do.

### Dependency timing
- **D-07: `@openzeppelin/wizard` installs in Phase 2; `@openzeppelin/contracts` waits for Phase 3.** Phase 2 emits `.sol` files that *reference* `@openzeppelin/contracts/...` imports, but those imports won't resolve until Phase 3 installs the pinned version. The file lands on disk — it just isn't compilable through SmartC's bundled toolchain until Phase 3. This keeps the phase boundary clean ("Phase 2 = source generation; Phase 3 = compile-verified source generation") and the `--version` line stays honest (`@openzeppelin/contracts not bundled`) until Phase 3 changes that.
- **D-08: `formatVersionLine` is not modified in Phase 2.** It auto-detects @openzeppelin/wizard *only if* we choose to surface it in the banner. Default: leave it untouched. Phase 3 will swap in the contracts version. (Open: whether to also surface the wizard version — defer to planner's judgment.)

### Test-lock strategy
- **D-09: Hybrid golden-snapshot + per-flag assertion.** Two committed snapshots: (a) bare-default ERC-20 (`name`/`symbol`/`supply`, no flags), (b) all-flags-on canonical (`mintable + burnable + pausable + access:roles`). Plus per-flag assertions: `expect(source).toContain("ERC20Burnable")` when burnable=true; `expect(source).toContain("AccessControl")` when access=roles; etc. Snapshots catch silent @openzeppelin/wizard drift across versions; assertions catch our own option-mapping bugs.
- **D-10: No exhaustive option-combinatorial snapshots.** ~32 fixtures per template is unmaintainable across four templates. The two snapshots above are sufficient breakage detectors; the per-flag assertions provide axis-by-axis coverage.

### Claude's Discretion
- **Wizard flow & validation** — Question order, prompt styles (`@clack/prompts` `text`/`select`/`confirm`/`multiselect`), validator rules for Solidity identifier safety on `name`, validator for ASCII-only `symbol`, validator for `initialSupply` as a non-negative integer that fits in `uint256`. Standard approach: sequential single-question prompts in the natural reading order (name → symbol → initial supply → mintable → burnable → pausable → access-control if any of mintable/pausable). Researcher/planner picks the exact validator regexes.
- **Generated file conventions** — Whatever `@openzeppelin/wizard` emits (SPDX, pragma version, contract name normalization, decimals, initial-supply scaling). We do not second-guess OZ's choices in Phase 2. If we want to add a SmartC-attribution header, it goes *above* the SPDX line as a `// ` comment block — but only if planner judges it valuable; default is no header so output matches wizard.openzeppelin.com byte-for-byte.
- **Canary stub fate** — `foundation-smoke (stub)` from Phase 1 is retired the moment ERC-20 registers, because keeping a "stub" entry alongside a real template is confusing once Phase 2 ships. Concretely: `src/cli.ts` registers ERC-20 *instead of* calling `registerStubTemplates()` — drop the import.
- **Default output filename** — Derive from contract name via a Solidity-identifier slug. `My Token` → `MyToken.sol`; `LongName` → `LongName.sol`. Lives in the template (per D-04). If `--out` is given, it wins.
- **Newbie-mode content for ERC-20 wizard** — Planner picks the actual `explain` / `reference` / `nextStep` copy. Required content (non-negotiable per Phase 1 newbie-mode contract): centralization warning when Mintable+Ownable is selected (the "single key can mint unlimited tokens" callout from ROADMAP.md DEPLOY-06); reference to the EIP-20 spec; pointer to OpenZeppelin's ERC20 docs; post-generation `nextStep` directing the user toward `smartc list-templates` and the (future) compile-verify gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Project framing, out-of-scope list, key decisions table (Solidity+Solana ecosystems, single-file output, generate-not-deploy)
- `.planning/REQUIREMENTS.md` §ERC-20 — ERC20-01..ERC20-05 (the locked requirements for this phase)
- `.planning/ROADMAP.md` §Phase 2 — Goal and success criteria (especially SC-4: "matches OpenZeppelin Wizard output conventions")

### Phase 1 handoff
- `.planning/phases/01-cli-foundation/01-CONTEXT.md` — Locked Phase 1 decisions still in force (three-part error block, output channel contract, newbie-mode tone)
- `.planning/phases/01-cli-foundation/01-04-SUMMARY.md` "Notes for Phase 2" — Specific carry-over guidance (createCommandStub replacement, registry registration order, confirmOverwrite wiring, formatVersionLine auto-detect)
- `.planning/phases/01-cli-foundation/01-02-SUMMARY.md` — Output channel contract (`result`/`warn`/`error` always; `explain`/`reference`/`nextStep` gated on newbie AND silenced under `--json`)
- `.planning/phases/01-cli-foundation/01-03-SUMMARY.md` — Registry contract (locked five-field shape, `register()` throws on duplicate, insertion-order iteration)

### External (read at planning time)
- `@openzeppelin/wizard` README (npm: https://www.npmjs.com/package/@openzeppelin/wizard) — Confirm current `erc20.print(opts)` signature and option vocabulary (`premint`, `mintable`, `burnable`, `pausable`, `access`, `info`). Researcher must verify against the version pinned at install time.
- OpenZeppelin Wizard live UI (https://wizard.openzeppelin.com) — Reference output to spot-check that `erc20.print` output matches the website (it should — same engine). Useful for sanity-checking the bare-default and all-flags-on snapshot fixtures.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/commands/create.ts` — `createCommandStub()` factory. Phase 2 replaces only the `.action()` body; `--template <id>` and `--out <path>` option surface is locked from Phase 1.
- `src/lib/prompt.ts` — `confirmOverwrite(path, { force })`. Phase 2's `create` action calls this immediately before `fs.writeFile` to satisfy ROADMAP SC-4 (overwrite prompt + `--force`). Throws `CliError(E_FILE_EXISTS)` on refusal; respects `--force`.
- `src/lib/output.ts` — `makeOutput({ newbie, json, color })` returns the six-channel `Output`. ERC-20 wizard uses `output.explain` for question rationale, `output.reference` for OZ/EIP doc links, `output.nextStep` for post-generation guidance, `output.warn` for centralization callouts (which must fire even in non-newbie mode — see Phase 1 CONTEXT decision on critical warnings).
- `src/lib/errors.ts` — `CliError` + `renderError`. Any user-facing failure must use `CliError` with the three-part WHAT/WHY/FIX block. Stable codes to introduce in Phase 2: probably `E_INVALID_INPUT` (failed validator), `E_WIZARD_CANCEL` (user Ctrl+C'd the wizard). Codes once shipped never rename.
- `src/lib/version.ts` — `formatVersionLine()`. Will auto-pick up @openzeppelin/contracts version when Phase 3 installs it. Phase 2 may optionally surface the @openzeppelin/wizard version too — planner's call.
- `src/registry/types.ts` + `src/registry/index.ts` — Five-field locked `Template` shape, `register/list/get/clear`. Phase 2 *adds* `runWizard` and `generate` as optional fields on `Template<TOpts>`; the registry's `register()` already throws on duplicate id so the canary-retirement is enforced by structure (you can't double-register `foundation-smoke` and `erc20` at the same id).
- `src/cli.ts` — Boots the registry via `registerStubTemplates()` then `buildProgram()`. Phase 2 swaps the stub call for `registerErc20Template()` (or whatever the template factory is named). One-line change.

### Established Patterns
- **`vi.mock('@clack/prompts', ...)` then top-level `await import(SUT)`** — Phase 1's locked Vitest 4 ESM mock pattern. Use this verbatim in `tests/templates/erc20/wizard.spec.ts` to test `runWizard()` without a real TTY.
- **Subcommand factories return `Command`** — Composition over global state. Apply to template plugins: `registerErc20Template(registry)` registers, doesn't mutate module state.
- **E2E spec spawns `dist/cli.js` with `NO_COLOR=1`** — Phase 2 adds an e2e case that exercises the wizard via piped stdin (or via `--template erc20` + flags-from-CLI if we decide to support flag-driven non-interactive runs; that's a planner question).

### Integration Points
- **`src/cli.ts` boot sequence** — Replace `registerStubTemplates()` with `registerErc20Template()`. ERC-20 template registers itself with the registry's locked five-field shape; the two new functional fields (`runWizard`, `generate`) flow through transparently.
- **`src/commands/create.ts` `.action()` body** — Replaces the `E_NOT_IMPLEMENTED` throw. New flow: validate `--template` against registry; if missing, prompt via wizard picker; call `template.runWizard(io)`; derive output path (`--out` override or template-suggested filename); call `confirmOverwrite` unless `--force`; call `template.generate(opts)`; `fs.writeFile` the source; `output.nextStep` the user.
- **`tests/cli.spec.ts` SC-4 placeholder** — Currently `it.skip`. Phase 2 unskips and fills in: spawn `smartc create --template erc20 --out tmp/X.sol`, pipe answers via stdin, assert file exists; second run with same `--out` should prompt; with `--force` should overwrite.

</code_context>

<specifics>
## Specific Ideas

- **"Honesty" framing** — Same instinct as Phase 1's "single canary entry is intentional honesty." Phase 2's equivalent: the generated `.sol` file is *honest about what it is* — a source file that follows OZ conventions but hasn't been compile-verified yet. The `nextStep` after generation should not claim "ready to deploy"; it should point at the (Phase 3) compile gate and at the (Phase 5) DEPLOY.md as future capabilities.
- **`@openzeppelin/wizard` is a black box** — D-09's snapshot strategy treats it as such. We don't try to predict its output formatting; we lock what it produces and detect change. If OZ ships a behavior change we want, we regenerate the snapshots in a dedicated commit and the diff is the audit trail.
- **Phase 2 ↔ Phase 3 seam is explicit** — The two-step plugin contract (D-03) exists so Phase 3 can insert compile-verify between `runWizard` and `generate`-then-write *without modifying the plugin shape*. Researcher should sketch the Phase 3 dispatcher delta and confirm the seam holds before locking Phase 2's plugin shape.
- **`info` field on @openzeppelin/wizard** — The wizard supports a `securityContact` / `license` `info` block. Default `license: "MIT"` matches typical OZ Wizard output; whether SmartC surfaces these as wizard prompts in Phase 2 or hides them is planner's call.

</specifics>

<deferred>
## Deferred Ideas

- **Flag-driven non-interactive ERC-20 generation** — e.g., `smartc create --template erc20 --name MyToken --symbol MTK --supply 1000000 --mintable --access roles`. Useful for CI/scripting, but not required by ROADMAP SC for Phase 2. Capture for a future "CLI ergonomics" iteration (possibly Phase 9 or v2).
- **SmartC-attribution header in generated files** — A `// Generated by SmartC vX.Y.Z` comment block above SPDX. Deferred because (a) it diverges from OZ Wizard byte-for-byte equality, (b) Phase 5 DEPLOY.md is a more honest attribution surface. Planner may revisit.
- **Pre-deploy safety checklist surfacing during wizard** — Currently a Phase 5 DEPLOY.md concern (DEPLOY-08). Could be partially surfaced during Phase 2 wizard for newbie mode, but risks scope creep — defer to Phase 5.
- **Versioned snapshot fixture naming** — If @openzeppelin/wizard ships a major bump, the canonical snapshot may be regenerated. Whether to keep historical snapshots as test fixtures (proving backward compatibility of the test harness, not the output) is a future quality-of-life question, not a Phase 2 deliverable.

</deferred>

---

*Phase: 02-erc-20-canary-template*
*Context gathered: 2026-05-18*
