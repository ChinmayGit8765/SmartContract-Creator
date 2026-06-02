---
phase: 07-spl-token-solana-anchor
plan: 01
subsystem: templates/spl + compiler/solana + deploy/solana
tags: [spl, solana, anchor, compile-verify, graceful-degradation, deploy]

requires:
  - phase: 03-compile-verify-safety-net
    provides: compileVerify seam (solana branch was a NOT_IMPLEMENTED stub)
  - phase: 05-deploy-md-generation
    provides: chain-keyed deploy section registry + DeployMeta(chain:"solana") seam
  - phase: 06-doctor-and-environment-probe
    provides: runVersion (reused to detect anchor)
provides:
  - SPL token template (id "spl", chain "solana") — wizard/generate/deployMeta
  - Anchor lib.rs generator (option-driven; mint/freeze authority, Metaplex, revoke-after-mint)
  - compileVerifySolana — anchor-build adapter with graceful degradation (SPL-05) + scratch-workspace build (COMP-02)
  - solana DEPLOY.md sections (DEPLOY-05): spl-token CLI + Anchor, devnet + mainnet-beta
affects: [08, 09]

tech-stack:
  added: []
  patterns:
    - "compileVerify returns CompileResult { warnings, skipped, skipReason? } — skipped path lets the dispatcher write + warn instead of failing"
    - "Solana side effects (anchor detection, build runner) injected for unit-testability without the toolchain"
    - "SPL source assembled from option-driven parts (no wizard library exists for Solana — sanctioned string assembly)"

key-files:
  created:
    - src/templates/spl/{validators,opts,naming,generate,deployMeta,wizard,index}.ts
    - src/templates/spl/README.md
    - src/compiler/solana.ts
    - src/deploy/sections/solana/{header,helpers,params,safety-checklist,spl-token-cli,anchor,solscan}.ts
    - tests/templates/spl/{validators,generate,wizard}.spec.ts
    - tests/compiler/solana.spec.ts
    - tests/deploy/solana-sections.spec.ts
    - tests/commands/create.spl.spec.ts
  modified:
    - src/compiler/index.ts (route solana → compileVerifySolana; return CompileResult)
    - src/compiler/types.ts (CompileResult)
    - src/deploy/types.ts (spl DeployFlags)
    - src/deploy/warnings.ts (spl authority warnings)
    - src/deploy/constructorArgs.ts (splConstructorArgs)
    - src/deploy/index.ts (deployDocPath swaps .rs too)
    - src/deploy/sections/index.ts (solana branch)
    - src/commands/create.ts (skipped handling; EVM-only solc nextStep)
    - src/cli.ts (registerSplTemplate)
    - tests/compiler/compile.spec.ts (solana now skips, not throws)
    - tests/commands/create.spec.ts (compileVerify signature regex allows the new 3rd arg)

key-decisions:
  - "compileVerify gained a CompileResult return + optional 3rd opts arg (programName, injectable solanaDeps) — additive; Phase 3 destructuring callers unaffected"
  - "Only Node + bundled solc are 'required' tooling; anchor absent is a SKIP not a failure (SPL-05) — matches the doctor required/optional split"
  - "deployDocPath extended to swap a trailing .sol OR .rs for .DEPLOY.md (additive; .sol behavior unchanged)"
  - "SPL 'constructorArgs' repurposed as the editable source constants (symbol/decimals/supply) so the Solana deploy doc can echo the baked-in params"
  - "Authority prompts have NO default — the user must explicitly choose null vs deployer (SPL-02/03), null listed first"

patterns-established:
  - "Chain plugin = same plugin shape as EVM (wizard/generate/deployMeta) but generate assembles source directly and compile-verify can skip"
  - "Per-chain deploy section folder (sections/solana/) registered via the chain-keyed sectionsFor"

requirements-completed: [SPL-01, SPL-02, SPL-03, SPL-04, SPL-05, COMP-02, DEPLOY-05]

duration: 95min
completed: 2026-05-31
---

# Phase 7 Plan 01: SPL Token (Solana / Anchor) Summary

**The 4th template: `smartc create --template spl` walks an explicit-authority wizard, scaffolds an Anchor program (`<snake>.rs`), compile-verifies via `anchor build` when the toolchain is present and gracefully skips-with-warning when it's absent, and writes a Solana DEPLOY.md with spl-token CLI + Anchor commands for devnet and mainnet-beta.**

## Performance
- **Duration:** ~95 min
- **Tasks:** 1 wave (plugin + compiler adapter + deploy sections + wiring + tests)
- **Files:** ~20 created, ~11 modified

## Accomplishments
- SPL plugin with explicit mint/freeze authority prompts (no default — SPL-02/03), Metaplex opt-in (SPL-04), and an option-driven Anchor `lib.rs` generator (mint, optional metadata CPI, revoke-after-mint for fixed supply).
- `compileVerifySolana`: filled the Phase 3 solana seam — returns `skipped:true` when anchor is absent (SPL-05, the primary path here) or runs `anchor build` in a version-coherent scratch workspace and throws `E_COMPILE_FAILED` on failure (COMP-02).
- `compileVerify` now returns a chain-agnostic `CompileResult`; the dispatcher writes the file + warns on skip and only shows the solc footer for EVM.
- Solana DEPLOY.md sections plug into the Phase 5 chain-keyed registry (DEPLOY-05): both deploy paths, both clusters, authority-tailored commands.
- 46 new tests; full suite green (351 passed, 1 skipped); tsc clean.

## Deviations from Plan
None functionally. Honest scope note carried in the template README + DEPLOY.md: with no Anchor toolchain in this environment, the generated Rust is a best-effort scaffold — compile-verified only on machines that have Anchor (graceful degradation is by design).

## Issues Encountered
- One pre-existing test asserted `compileVerify(source, tpl.chain)` with an exact-arity regex; updated to allow the additive 3rd options arg (intent preserved).

## User Setup Required
To get compile-verification (not just generation) for SPL: install the Anchor toolchain (`smartc doctor` reports it). Without it, generation still works and warns.

## Next Phase Readiness
- Phase 8 (AI add-feature) can reuse the skip/`CompileResult` pattern and the `runVersion` probe for the ollama check.
- Phase 9 (Distribution) should note in CI that the SPL anchor-build path is exercised only where Anchor is installed.

---
*Phase: 07-spl-token-solana-anchor*
*Completed: 2026-05-31*
