# SmartContract Creator

## What This Is

A TypeScript/Node.js CLI tool that scaffolds smart contract files from a wizard. Users pick a template (ERC-20, ERC-721, ERC-1155 for Solidity on Ethereum, or SPL token for Rust/Anchor on Solana), answer template-specific questions, and get a single contract file plus a DEPLOY.md with deployment steps and safety warnings. Targets both newbies who want guardrails and experienced devs who want to skip boilerplate.

## Core Value

Generate a working, compile-verified smart contract file from a wizard — no boilerplate, no remembering EIPs, no scaffolding a full project just to write one contract.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Installable CLI tool (TypeScript/Node, distributable via npm or GitHub)
- [ ] Interactive wizard that walks the user through template selection and configuration
- [ ] ERC-20 (Solidity) template with wizard prompts (name, symbol, supply, mintable, burnable)
- [ ] ERC-721 (Solidity) NFT template with wizard prompts
- [ ] ERC-1155 (Solidity) multi-token template with wizard prompts
- [ ] Solana SPL token (Rust/Anchor) template with wizard prompts
- [ ] Compile-verify step that runs the appropriate compiler on the generated file and surfaces errors
- [ ] DEPLOY.md generation alongside the contract — deployment steps, network notes, safety warnings
- [ ] Configurable verbosity — newbie mode (explanations, guardrails) vs experienced mode (terse, fast)
- [ ] Optional AI customization via local Ollama — separate `add-feature` command that patches custom logic into an existing generated file
- [ ] Public GitHub repo with working README, install instructions, and usage examples

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- VS Code extension — deferred; CLI first ships faster and the same core can be wrapped later
- Full project scaffolding (Hardhat / Foundry / Anchor project structure) — only the contract file is generated; users add it to their own project
- Automated deployment to testnet/mainnet — DEPLOY.md gives instructions but the tool itself does not broadcast transactions (safety + scope)
- Hosted AI / paid API keys — local Ollama only, keeps it self-contained and free for users
- Other chains (Polygon, BSC, Avalanche) — EVM bytecode works on all of them, but no chain-specific templates in v1
- Arbitrum Stylus (Rust on EVM L2) — interesting but adds toolchain complexity for v1
- AI-driven contract generation as the primary flow — wizard handles the standard cases; AI is opt-in for custom additions only

## Context

- Solo / personal portfolio project — "misc github project" framing, no monetization plans
- TypeScript/Node chosen because the web3 tooling ecosystem (ethers.js, solc-js, hardhat) is JS-native; cleanest path for a CLI that needs to compile Solidity
- Local Ollama chosen for AI to avoid API key management, cost, and runtime dependencies on external services
- User has a "beginning.py" starter file in the repo — convention; safe to delete or ignore during build
- Two ecosystems means two compiler toolchains: `solc` for Solidity, `rustc` + Anchor for Solana — tool needs to detect these on user's machine and surface a clear error if missing
- Audience straddles newbies and experienced devs — verbosity flag is the lever, not two separate UIs

## Constraints

- **Tech stack**: TypeScript/Node.js for the CLI itself — best web3 ecosystem support and easiest to distribute via npm
- **AI**: Local Ollama only — no cloud API keys, no monetization, must work offline once Ollama is set up
- **Distribution**: GitHub repo + npm-installable — open source, no auth, no paid tier
- **Compile dependencies**: Solidity compile requires `solc` (or solc-js bundled); Solana compile requires Rust + Anchor on user's machine — tool must detect and report missing dependencies clearly
- **Scope discipline**: 4 templates, single-file output, no deployment — keep v1 small enough to ship as a public repo with a clean README

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CLI first, VS Code extension later | Faster to build, no IDE-specific quirks, same core can be wrapped into an extension later | — Pending |
| TypeScript/Node over Python/Rust/Go | Best web3 library support (ethers, solc-js, hardhat ecosystem); standard for blockchain CLI tooling | — Pending |
| Local Ollama for AI, not hosted API | Self-contained, no API key management, no usage costs, fits "misc github project" framing | — Pending |
| Pure wizard primary, AI opt-in | Wizard handles the standard cases deterministically; AI invoked only via explicit `add-feature` for custom logic | — Pending |
| Output is a single contract file, not a full project scaffold | Keeps v1 minimal; users plug it into their own Hardhat/Foundry/Anchor setup | — Pending |
| Generate-and-compile, not generate-and-deploy | Verifying the file compiles is safety net; broadcasting transactions is a bigger surface area for v1 | — Pending |
| Solidity (Ethereum) + Rust (Solana), not Solidity + Rust-on-EVM | User originally said "Rust for Ethereum" but Rust doesn't run on Ethereum mainnet; clarified to two separate ecosystems | — Pending |

---
*Last updated: 2026-05-14 after initialization*
