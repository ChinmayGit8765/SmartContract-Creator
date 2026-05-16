# Roadmap: SmartContract Creator

## Overview

SmartContract Creator ships a TypeScript/Node CLI that scaffolds compile-verified smart contracts (ERC-20, ERC-721, ERC-1155, SPL) from a wizard, with deployment docs and optional local-AI customization. The journey lays a CLI shell, proves the architecture on the simplest template (ERC-20), locks in the compile-verify safety net before fanning out to more templates, then layers cross-cutting concerns (DEPLOY.md, doctor), tackles the Solana toolchain in isolation, gates the high-risk AI flow on the existing safety net, and finally hardens cross-platform distribution for public release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: CLI Foundation** - Installable CLI shell with command surface, wizard runner, and verbosity modes
- [ ] **Phase 2: ERC-20 Canary Template** - First template end-to-end via programmatic builder, proving the plugin architecture
- [ ] **Phase 3: Compile-Verify Safety Net** - In-process Solidity compile gate; nothing un-compilable reaches disk
- [ ] **Phase 4: ERC-721 + ERC-1155 Templates** - Full Solidity template coverage validating additive-only plugin model
- [ ] **Phase 5: DEPLOY.md Generation** - Deployment docs with per-option centralization warnings for every Solidity template
- [ ] **Phase 6: Doctor & Environment Probe** - Toolchain detection command, prerequisite to graceful SPL degradation
- [ ] **Phase 7: SPL Token (Solana / Anchor)** - Rust/Anchor template with shell-out compile adapter and authority footgun prompts
- [ ] **Phase 8: AI add-feature (Ollama)** - Local-LLM patch flow with sandbox-compile-then-write rollback safety
- [ ] **Phase 9: Cross-Platform Distribution** - Public GitHub repo, npm-installable globally, CI verified on Windows/macOS/Linux

## Phase Details

### Phase 1: CLI Foundation
**Goal**: User can install the CLI and discover its surface — commands, flags, help, and verbosity modes are all wired even if no template ships yet.
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08
**Success Criteria** (what must be TRUE):
  1. User can run `smartc --help` and see every command and flag with descriptions
  2. User can run `smartc list-templates` and see registered templates with descriptions (registry is wired even if templates are stubs)
  3. User sees terse output by default and explanatory output when passing `--newbie`
  4. User is prompted before overwriting an existing file at the chosen output path, and `--force` skips the prompt
  5. When a command fails, the user sees an actionable error message with a next-step suggestion
**Plans**: 4 plans in 3 waves

Plans:
- [ ] 01-01-PLAN.md — Scaffold TypeScript ESM project (package.json, tsconfig, tsup, vitest, stub entry)
- [ ] 01-02-PLAN.md — Build load-bearing libs (errors, output, env, color, prompt, version) with unit tests
- [ ] 01-03-PLAN.md — Build template registry (types, register/list/get, stub canary) with unit tests
- [ ] 01-04-PLAN.md — Wire commander program + commands + e2e tests (after spike-validating commander 14 patterns)

### Phase 2: ERC-20 Canary Template
**Goal**: User can run `smartc create --template erc20` and walk through the wizard to produce a working `.sol` file on disk, proving the entire plugin + builder pipeline on the simplest template.
**Depends on**: Phase 1
**Requirements**: ERC20-01, ERC20-02, ERC20-03, ERC20-04, ERC20-05
**Success Criteria** (what must be TRUE):
  1. User can generate an ERC-20 with their own name, symbol, and initial supply
  2. User can opt in to Mintable, Burnable, and Pausable independently
  3. When Mintable or Pausable is selected, user is asked to choose Ownable or AccessControl
  4. The generated `.sol` file matches OpenZeppelin Wizard output conventions (no syntax-corrupting template hacks)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Compile-Verify Safety Net
**Goal**: User never receives a file that doesn't compile — the Solidity compile gate runs in-process before any source touches disk, against pinned OpenZeppelin and `solc` versions.
**Depends on**: Phase 2
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria** (what must be TRUE):
  1. User runs `smartc create` for ERC-20 and the generated file is compile-verified before being written
  2. When compile fails, user sees the compiler diagnostics and no file is left on disk
  3. When compile warns (but does not error), user sees the warnings and the file is still written
  4. User does not need to install OpenZeppelin contracts locally — imports resolve from the tool's bundled dependencies
  5. The pinned `solc` and `@openzeppelin/contracts` versions are visible somewhere user-facing (banner, `--version`, or doctor)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: ERC-721 + ERC-1155 Templates
**Goal**: User can scaffold NFT (ERC-721) and multi-token (ERC-1155) contracts through the same wizard, with both compile-verified — validating the plugin model is additive without core changes.
**Depends on**: Phase 3
**Requirements**: ERC721-01, ERC721-02, ERC721-03, ERC721-04, ERC721-05, ERC1155-01, ERC1155-02, ERC1155-03, ERC1155-04, ERC1155-05
**Success Criteria** (what must be TRUE):
  1. User can generate an ERC-721 with configurable name, symbol, and base URI, plus opt-in Mintable, Enumerable, Burnable, and Pausable
  2. User can opt in to EIP-2981 royalties on ERC-721 with a configurable recipient and basis-points value
  3. User can generate an ERC-1155 with a configurable URI template and opt-in Mintable, Burnable, Supply tracking, and Pausable
  4. When Mintable or Pausable is selected on either template, the wizard asks for Ownable vs AccessControl
  5. All three Solidity templates (ERC-20, ERC-721, ERC-1155) pass compile-verify with their full option matrices
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: DEPLOY.md Generation
**Goal**: User receives a deployment guide alongside every generated contract, with deploy commands for multiple toolchains, verification snippets, and centralization warnings derived from their option choices.
**Depends on**: Phase 4
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07, DEPLOY-08
**Success Criteria** (what must be TRUE):
  1. Every generated contract is accompanied by a DEPLOY.md named to match the contract file
  2. EVM DEPLOY.md includes copy-pasteable Hardhat, Foundry (`forge`), and Remix one-liner deploy commands
  3. DEPLOY.md auto-surfaces centralization warnings specific to the user's option combination (e.g., Ownable + Mintable produces the unlimited-mint warning)
  4. DEPLOY.md includes Etherscan/Solscan verification command snippets and a pre-deploy safety checklist
  5. SPL DEPLOY.md (populated in Phase 7) includes `spl-token` CLI + Anchor deploy commands for Solana devnet and mainnet-beta
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Doctor & Environment Probe
**Goal**: User can run `smartc doctor` to see exactly which toolchains are installed and at what versions, before hitting any phase that depends on them.
**Depends on**: Phase 5
**Requirements**: DOCTOR-01, DOCTOR-02, DOCTOR-03
**Success Criteria** (what must be TRUE):
  1. User runs `smartc doctor` and sees a clear report for Node, solc (bundled), anchor, cargo-build-sbf, and ollama
  2. Each tool is reported with found yes/no, version, and status (OK / missing / outdated)
  3. `smartc doctor` exits with code 0 when minimum requirements are met and code 1 otherwise, so it's scriptable in CI
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: SPL Token (Solana / Anchor)
**Goal**: User can scaffold a Solana SPL token program with explicit authority choices, and the tool degrades gracefully when the Anchor toolchain is absent.
**Depends on**: Phase 6
**Requirements**: SPL-01, SPL-02, SPL-03, SPL-04, SPL-05
**Success Criteria** (what must be TRUE):
  1. User can generate an SPL token with configurable name, symbol, decimals, and initial supply
  2. User is explicitly asked to choose mint authority (null vs single key) and freeze authority (null vs single key) — no implicit defaults
  3. User can opt in to Metaplex metadata so wallets display name/symbol/image
  4. When Anchor is installed, the SPL output is compile-verified via `anchor build` before being written
  5. When Anchor is missing, the SPL output is still written and the user sees a clear warning that compile-verify was skipped, with a pointer to `smartc doctor`
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: AI add-feature (Ollama)
**Goal**: User can patch custom logic into an existing generated contract via a local Ollama model, with the safety net rolling back any change that doesn't compile.
**Depends on**: Phase 7
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06
**Success Criteria** (what must be TRUE):
  1. User can run `smartc add-feature --ai --file X.sol "<description>"` and have the local Ollama daemon produce a patched file
  2. User sees a diff preview and must explicitly confirm before any change is applied
  3. AI-produced output is sandbox-compiled before being written; on compile failure the file is rolled back to its prior state with a clear message
  4. When Ollama is unreachable, the command fails gracefully with a message pointing to `smartc doctor` and the Ollama install docs
  5. User can override the Ollama model with `--model <name>` and there is a documented default
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: Cross-Platform Distribution
**Goal**: User on Windows, macOS, or Linux can run `npm install -g smartc` and have a working CLI, with a public GitHub repo backing it.
**Depends on**: Phase 8
**Requirements**: DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. User on any of Windows, macOS, or Linux can install the package via `npm install -g smartc` and run `smartc --help` successfully
  2. CI runs the install on all three OSes for every release-candidate build, and a green CI is required before publish
  3. The public GitHub repo's README includes install instructions, a quickstart, a license, and example generated outputs for each of the four templates
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CLI Foundation | 0/TBD | Not started | - |
| 2. ERC-20 Canary Template | 0/TBD | Not started | - |
| 3. Compile-Verify Safety Net | 0/TBD | Not started | - |
| 4. ERC-721 + ERC-1155 Templates | 0/TBD | Not started | - |
| 5. DEPLOY.md Generation | 0/TBD | Not started | - |
| 6. Doctor & Environment Probe | 0/TBD | Not started | - |
| 7. SPL Token (Solana / Anchor) | 0/TBD | Not started | - |
| 8. AI add-feature (Ollama) | 0/TBD | Not started | - |
| 9. Cross-Platform Distribution | 0/TBD | Not started | - |

---
*Roadmap created: 2026-05-15*
*Depth: standard (9 phases, 53 v1 requirements mapped)*
*Coverage: 53/53 v1 requirements*
