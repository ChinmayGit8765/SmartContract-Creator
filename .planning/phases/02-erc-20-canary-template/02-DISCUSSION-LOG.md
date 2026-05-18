# Phase 2: ERC-20 Canary Template - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 02-erc-20-canary-template
**Areas discussed:** Code-gen strategy & plugin contract

---

## Gray area selection

Four candidate gray areas were presented:

| Area | Description | Selected |
|------|-------------|----------|
| Code-gen strategy & plugin contract | How is the .sol emitted, what shape does the plugin contract take | ✓ |
| Wizard flow & validation | Question order, prompt styles, validators, conditional access-control follow-up | |
| Generated file conventions | SPDX, pragma, OZ import paths, decimals, header style | |
| Canary stub & newbie content | Foundation-smoke fate, ERC-20 explain/reference/nextStep messages | |

**User's choice:** Code-gen strategy & plugin contract only. The other three areas became Claude's discretion (defaults captured in CONTEXT.md).

---

## Code-gen strategy & plugin contract

### Question 1: How should the ERC-20 .sol get emitted?

| Option | Description | Selected |
|--------|-------------|----------|
| Use @openzeppelin/wizard directly | Add @openzeppelin/wizard as dep; call `erc20.print(opts)`. OZ owns generator + contract evolution. | ✓ |
| Typed builder we own | Hand-write a composition system assembling OZ imports/inherits/constructor lines. Full control, more code, must keep up with OZ. | |
| Hybrid: OZ wizard + our wrapper | Call @openzeppelin/wizard for the body, post-process with SmartC header. Plugin contract still ours; OZ is one template's implementation detail. | |

**User's choice:** Use @openzeppelin/wizard directly.
**Notes:** Minimum-code path; literal satisfaction of SC-4 "matches OpenZeppelin Wizard output conventions." OZ maintains contract evolution + pragma/import bumps. Trade-off: tied to OZ's option vocabulary (`premint`, `access`, etc.).

### Question 2: What shape should the Template plugin expose for wizard + generation?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-step: runWizard() then generate() | Template exposes `runWizard(io) → opts`, `generate(opts) → {filename, source}`. Dispatcher orchestrates. Phase 3 splices compile-verify between steps. | ✓ |
| Single run() method | `run(io)` does wizard + generation, returns generated file. Less ceremony, but Phase 3 compile-verify has no clean seam. | |
| Three-part: wizard, generate, validate | Adds explicit `validate(opts)` step. Risk of premature abstraction — @clack validators + Phase 3 compile-verify already cover both ends. | |

**User's choice:** Two-step: runWizard() then generate().
**Notes:** Critical decision for the Phase 2↔Phase 3 seam. Compile-verify can be spliced between wizard and write without modifying the plugin contract.

### Question 3: When should @openzeppelin/wizard and @openzeppelin/contracts get installed?

| Option | Description | Selected |
|--------|-------------|----------|
| Wizard in Phase 2, contracts in Phase 3 | Phase 2 installs only @openzeppelin/wizard. Generated `.sol` references @openzeppelin/contracts/... but the dep isn't installed yet. `--version` stays honest. | ✓ |
| Both in Phase 2 | Install @openzeppelin/wizard AND @openzeppelin/contracts now. Version banner becomes useful one phase sooner. Phase 2 owns the pinned-version decision. | |
| Only wizard, explicit no-compile framing | Same as option 1 but make the framing explicit (Phase 2 = source, Phase 3 = verified source). No code difference. | |

**User's choice:** Wizard in Phase 2, contracts in Phase 3.
**Notes:** Clean phase boundaries. Phase 3 owns the compile dep and the pinned-version choice. Generated files in Phase 2 are technically un-compilable by SmartC's bundled toolchain — acceptable because SC-4 is about output *conventions*, not compilability (Phase 3's job).

### Question 4: How should generate() output be locked against silent @openzeppelin/wizard drift?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: smoke snapshot + flag assertions | Two snapshots (bare-default + all-flags-on canonical) + per-flag `toContain` assertions. ~6 fixtures, axis-by-axis coverage. | ✓ |
| Exhaustive snapshots per combo | Snapshot every meaningful option combination. ~16-32 fixtures per template — unmaintainable across four templates. | |
| Pure assertion-based, no snapshots | Test only that we pass options to wizard correctly via spy. No protection against OZ silently changing output format. | |

**User's choice:** Hybrid: smoke snapshot + flag assertions.
**Notes:** Snapshots detect OZ drift; assertions cover our option-mapping. Sets the testing pattern that ERC-721, ERC-1155, SPL plugins will reuse.

---

## Claude's Discretion

User deferred the following to Claude / downstream agents:

- **Wizard flow & validation** — Sequential single-question prompts in natural reading order; @clack/prompts validator regexes to be picked by planner.
- **Generated file conventions** — Defer to @openzeppelin/wizard's defaults. No SmartC-attribution header in Phase 2 (preserves byte-for-byte equality with wizard.openzeppelin.com).
- **Canary stub fate** — Retire `foundation-smoke` the moment ERC-20 registers. Drop the `registerStubTemplates()` import in `src/cli.ts`.
- **Default output filename** — Derive from contract name via Solidity-identifier slug (`MyToken` → `MyToken.sol`). `--out` overrides.
- **Newbie-mode ERC-20 content** — Planner picks copy. Required (non-negotiable): centralization warning on Mintable+Ownable; EIP-20 reference; OZ docs pointer; post-generation nextStep pointing toward future compile gate and DEPLOY.md.

## Deferred Ideas

- Flag-driven non-interactive ERC-20 generation (`--name`, `--symbol`, `--supply`, `--mintable`, etc.) — future ergonomics iteration.
- SmartC-attribution header in generated files — diverges from OZ Wizard equality; defer; Phase 5 DEPLOY.md is a more honest attribution surface.
- Pre-deploy safety checklist during wizard — defer to Phase 5 DEPLOY.md.
- Versioned snapshot fixture naming — future quality-of-life question.
