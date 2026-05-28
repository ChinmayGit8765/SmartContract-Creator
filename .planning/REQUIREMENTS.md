# Requirements: SmartContract Creator

**Defined:** 2026-05-15
**Core Value:** Generate a working, compile-verified smart contract file from a wizard — no boilerplate, no remembering EIPs, no scaffolding a full project.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### CLI Foundation

- [ ] **CLI-01**: User can install the CLI globally via `npm install -g smartc`
- [x] **CLI-02**: User can run `smartc --help` to see all commands and flags
- [x] **CLI-03**: User can run `smartc create` to launch the interactive wizard
- [x] **CLI-04**: User can run `smartc list-templates` to see available templates with descriptions
- [x] **CLI-05**: User can run `smartc create --template <id>` to skip template selection
- [x] **CLI-06**: User can pass `--newbie` for explanatory output or `--experienced` (default) for terse output
- [x] **CLI-07**: User is prompted before overwriting an existing file; `--force` flag skips the prompt
- [x] **CLI-08**: User sees actionable error messages (next-step guidance) when any command fails

### Doctor / Environment

- [ ] **DOCTOR-01**: User can run `smartc doctor` to see status of Node, solc (bundled), anchor, cargo-build-sbf, and ollama
- [ ] **DOCTOR-02**: Doctor reports each tool with: found (yes/no), version, status (OK / missing / outdated)
- [ ] **DOCTOR-03**: Doctor exits 0 if all minimum requirements met, 1 otherwise

### ERC-20 (Solidity)

- [ ] **ERC20-01**: User can generate an ERC-20 contract with configurable name, symbol, and initial supply
- [ ] **ERC20-02**: User can opt in to Mintable (post-deploy minting by an authorized account)
- [ ] **ERC20-03**: User can opt in to Burnable (holders can burn their own tokens)
- [ ] **ERC20-04**: User can opt in to Pausable (authorized account can pause transfers)
- [ ] **ERC20-05**: When Mintable or Pausable is selected, user picks access control style: Ownable (single owner) or AccessControl (multi-role)

### ERC-721 (Solidity NFT)

- [x] **ERC721-01**: User can generate an ERC-721 contract with configurable name, symbol, and base URI
- [x] **ERC721-02**: User can opt in to Mintable, Enumerable, and Burnable
- [x] **ERC721-03**: User can opt in to EIP-2981 royalties with configurable recipient address and basis points (e.g., 250 = 2.5%)
- [x] **ERC721-04**: User can opt in to Pausable
- [x] **ERC721-05**: When Mintable or Pausable is selected, user picks access control style: Ownable or AccessControl

### ERC-1155 (Solidity multi-token)

- [x] **ERC1155-01**: User can generate an ERC-1155 contract with a configurable URI template
- [x] **ERC1155-02**: User can opt in to Mintable and Burnable
- [x] **ERC1155-03**: User can opt in to Supply tracking (total supply per token id)
- [x] **ERC1155-04**: User can opt in to Pausable
- [x] **ERC1155-05**: When Mintable or Pausable is selected, user picks access control style: Ownable or AccessControl

### SPL Token (Solana / Rust + Anchor)

- [ ] **SPL-01**: User can generate a Solana SPL token program with configurable name, symbol, decimals, and initial supply
- [ ] **SPL-02**: User is explicitly prompted to choose mint authority — null (revoked immediately, immutable supply) or single key (mutable supply)
- [ ] **SPL-03**: User is explicitly prompted to choose freeze authority — null (no freeze ever) or single key (freezable)
- [ ] **SPL-04**: User can opt in to Metaplex metadata generation so wallets can display token name/symbol/image
- [ ] **SPL-05**: When Anchor is missing, the SPL output is still written and the user sees a clear warning that compile-verify was skipped

### Compile-Verify

- [x] **COMP-01**: Solidity contracts are compiled in-process via the `solc` npm package against a pinned `@openzeppelin/contracts` version
- [ ] **COMP-02**: Solana contracts are compiled by shelling out to `anchor build` when Anchor is present on the user's machine
- [x] **COMP-03**: When compile fails, the generated file is NOT written to disk; the user sees the compile diagnostics
- [x] **COMP-04**: Compile warnings are surfaced to the user but do not block writing the file
- [x] **COMP-05**: The Solidity import callback resolves `@openzeppelin/contracts/...` imports from the tool's bundled dependencies (no user install required)

### DEPLOY.md Generation

- [ ] **DEPLOY-01**: A DEPLOY.md is generated alongside every contract, named to match the contract file
- [ ] **DEPLOY-02**: DEPLOY.md for EVM templates includes step-by-step Hardhat deploy commands
- [ ] **DEPLOY-03**: DEPLOY.md for EVM templates includes step-by-step Foundry (`forge`) deploy commands
- [ ] **DEPLOY-04**: DEPLOY.md for EVM templates includes an "Open in Remix" one-liner for the absolute simplest deploy path
- [ ] **DEPLOY-05**: DEPLOY.md for SPL includes `spl-token` CLI + Anchor deploy commands for Solana devnet and mainnet-beta
- [ ] **DEPLOY-06**: DEPLOY.md auto-discloses centralization warnings based on the user's option combination (e.g., Ownable + Mintable produces a "single key can mint unlimited tokens" warning)
- [ ] **DEPLOY-07**: DEPLOY.md includes copy-pasteable Etherscan/Solscan verification command snippets
- [ ] **DEPLOY-08**: DEPLOY.md includes a pre-deploy safety checklist (review owner address, set up multisig, test on testnet, etc.)

### AI Customization (add-feature)

- [ ] **AI-01**: User can run `smartc add-feature --ai --file X.sol "<description>"` to patch custom logic into an existing generated file
- [ ] **AI-02**: The AI provider connects to a local Ollama daemon via HTTP
- [ ] **AI-03**: AI output is sandbox-compiled before being written to disk; the file is rolled back to its prior state on compile failure
- [ ] **AI-04**: User sees a diff preview and must confirm before changes are applied
- [ ] **AI-05**: When Ollama is unreachable, the tool fails gracefully with a clear message pointing to `smartc doctor` and Ollama install docs
- [ ] **AI-06**: User can specify the Ollama model via `--model <name>` (with a documented default)

### Distribution

- [ ] **DIST-01**: Package is installable via `npm install -g smartc` and works on Windows, macOS, and Linux (verified in CI matrix)
- [ ] **DIST-02**: Public GitHub repo includes README with install instructions, quickstart, and license
- [ ] **DIST-03**: README includes example generated outputs (snippets or links) for each of the 4 templates

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### ERC-20 extensions

- **ERC20-V2-01**: Capped supply option
- **ERC20-V2-02**: Permit (EIP-2612) gasless approvals
- **ERC20-V2-03**: Votes (ERC20Votes for governance)
- **ERC20-V2-04**: Flashmint (EIP-3156)

### ERC-721 extensions

- **ERC721-V2-01**: Votes (ERC721Votes)
- **ERC721-V2-02**: Whitelist / Merkle-tree mint
- **ERC721-V2-03**: On-chain SVG metadata option

### ERC-1155 extensions

- **ERC1155-V2-01**: EIP-2981 royalties
- **ERC1155-V2-02**: Per-token-id URI overrides

### SPL extensions

- **SPL-V2-01**: Multisig authority (mint or freeze)
- **SPL-V2-02**: Token-2022 extensions (transfer fees, interest-bearing, non-transferable, etc.)
- **SPL-V2-03**: Pure TypeScript mint-creation script as an output mode (alternative to Anchor program)

### Tooling

- **TOOL-V2-01**: Etherscan/Solscan verification automation from the CLI (not just docs)
- **TOOL-V2-02**: Community template plugin model via npm packages (e.g., `smartc-template-*` auto-discovery)
- **TOOL-V2-03**: VS Code extension wrapping the same core

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full project scaffolding (Hardhat/Foundry/Anchor structure) | Out of spec — tool outputs a single contract file; DEPLOY.md tells users which tools to set up |
| Automated testnet/mainnet deployment from the CLI | Larger safety surface (key handling, RPC failures, broadcast errors); DEPLOY.md provides instructions instead |
| Hosted AI / paid API keys (OpenAI, Anthropic, etc.) | Personal/portfolio project; no monetization; local Ollama keeps it self-contained |
| Upgrade proxies (transparent or UUPS) in v1 | Storage-layout traps that compile-verify cannot catch; subtle bugs; defer to a dedicated future investigation |
| Custom audits, formal verification, or symbolic execution | Out of scope for a scaffolding tool — DEPLOY.md warns users to audit before deploying value |
| Cloud telemetry | Open-source crypto-tool community treats telemetry as a trust risk; no telemetry in any version |
| Mobile app or web UI | CLI first; VS Code extension is a v2 wrapper if it happens |
| Fee-on-transfer tokens, rebasing tokens | Known compatibility footguns with DEX pools; deliberately not offered |
| Other EVM chains as first-class targets (Polygon, BSC, Arbitrum) | The contracts work on any EVM chain by default; DEPLOY.md can note which chains, but no per-chain template variants |
| Arbitrum Stylus (Rust on EVM L2) | Adds a third toolchain; out of scope for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 9 | Pending |
| CLI-02 | Phase 1 | Complete |
| CLI-03 | Phase 1 | Complete |
| CLI-04 | Phase 1 | Complete |
| CLI-05 | Phase 1 | Complete |
| CLI-06 | Phase 1 | Complete |
| CLI-07 | Phase 1 | Complete |
| CLI-08 | Phase 1 | Complete |
| DOCTOR-01 | Phase 6 | Pending |
| DOCTOR-02 | Phase 6 | Pending |
| DOCTOR-03 | Phase 6 | Pending |
| ERC20-01 | Phase 2 | Pending |
| ERC20-02 | Phase 2 | Pending |
| ERC20-03 | Phase 2 | Pending |
| ERC20-04 | Phase 2 | Pending |
| ERC20-05 | Phase 2 | Pending |
| ERC721-01 | Phase 4 | Complete |
| ERC721-02 | Phase 4 | Complete |
| ERC721-03 | Phase 4 | Complete |
| ERC721-04 | Phase 4 | Complete |
| ERC721-05 | Phase 4 | Complete |
| ERC1155-01 | Phase 4 | Complete |
| ERC1155-02 | Phase 4 | Complete |
| ERC1155-03 | Phase 4 | Complete |
| ERC1155-04 | Phase 4 | Complete |
| ERC1155-05 | Phase 4 | Complete |
| SPL-01 | Phase 7 | Pending |
| SPL-02 | Phase 7 | Pending |
| SPL-03 | Phase 7 | Pending |
| SPL-04 | Phase 7 | Pending |
| SPL-05 | Phase 7 | Pending |
| COMP-01 | Phase 3 | Complete |
| COMP-02 | Phase 7 | Pending |
| COMP-03 | Phase 3 | Complete |
| COMP-04 | Phase 3 | Complete |
| COMP-05 | Phase 3 | Complete |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |
| DEPLOY-03 | Phase 5 | Pending |
| DEPLOY-04 | Phase 5 | Pending |
| DEPLOY-05 | Phase 7 | Pending |
| DEPLOY-06 | Phase 5 | Pending |
| DEPLOY-07 | Phase 5 | Pending |
| DEPLOY-08 | Phase 5 | Pending |
| AI-01 | Phase 8 | Pending |
| AI-02 | Phase 8 | Pending |
| AI-03 | Phase 8 | Pending |
| AI-04 | Phase 8 | Pending |
| AI-05 | Phase 8 | Pending |
| AI-06 | Phase 8 | Pending |
| DIST-01 | Phase 9 | Pending |
| DIST-02 | Phase 9 | Pending |
| DIST-03 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

**Cross-phase notes:**
- `CLI-01` (npm install -g) is mapped to Phase 9 (Distribution) since cross-platform install verification is the bulk of the work; Phase 1 builds the `bin` entry so the local-link install works during development.
- `COMP-02` (anchor build shell-out) is mapped to Phase 7 (SPL), where the Anchor adapter lives, alongside `SPL-05` graceful-degradation. Phase 3 ships the SEAM SHAPE (`compileVerify(source, "solana")` throws `E_NOT_IMPLEMENTED` with a Phase 7 pointer) so the dispatcher contract is already chain-agnostic.
- `DEPLOY-05` (SPL deploy commands) is mapped to Phase 7 because the SPL DEPLOY.md generator only makes sense once the SPL template exists. Phase 5 (DEPLOY.md Generation) establishes the deploy-doc framework that Phase 7 plugs into.

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-28 — Phase 4 complete: ERC721-01..05 + ERC1155-01..05 marked Complete (all 10 Phase 4 requirements; additive-only plugin model validated — only src/cli.ts +4 lines + create.ts E_USAGE copy changed as source)*
