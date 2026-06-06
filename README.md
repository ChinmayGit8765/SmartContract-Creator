# smartc

[![npm version](https://img.shields.io/npm/v/smartc.svg)](https://www.npmjs.com/package/smartc)
[![license: MIT](https://img.shields.io/npm/l/smartc.svg)](LICENSE)
[![node](https://img.shields.io/node/v/smartc.svg)](https://nodejs.org)

**Generate working, compile-verified smart contracts from a wizard — no boilerplate, no remembering EIPs, no scaffolding a whole project just to write one contract.**

`smartc` is a single-binary CLI that walks you through a few questions and writes one contract file plus a matching `DEPLOY.md` (copy-pasteable deploy + verify commands and option-specific safety warnings). Every Solidity contract is **compiled in-process before it touches disk** — if it doesn't compile, nothing is written.

- **4 templates:** ERC-20, ERC-721 (NFT), ERC-1155 (multi-token) on EVM chains, and SPL tokens on Solana (Anchor).
- **Compile-verified:** Solidity is checked against pinned `solc` + `@openzeppelin/contracts`; Solana is built via `anchor build` when the toolchain is present.
- **DEPLOY.md for every contract:** Hardhat / Foundry / Remix (EVM) or `spl-token` CLI / Anchor (Solana), plus a centralization-warning section derived from *your* option choices.
- **Optional local AI:** `add-feature` patches custom logic into an existing contract via a local Ollama model — with a diff preview, confirmation, and a sandbox-compile that rolls back anything that won't build. No cloud, no API keys.
- **Newbie or expert:** `--newbie` adds explanations and EIP/doc links; the default is terse.

> Status: feature-complete for v1 (all 4 templates, compile-verify, DEPLOY.md, doctor, AI add-feature). EVM templates are fully compile-verified; the Solana template is compile-verified when the Anchor toolchain is installed and otherwise written with a clear "verification skipped" warning.

---

## Install

Requires **Node.js 20+**.

```sh
# Global (once published to npm):
npm install -g smartc
smartc --help

# Or run without installing:
npx smartc create --template erc20
```

From source (for development or forking — see [docs/FORKING.md](docs/FORKING.md)):

```sh
git clone https://github.com/ChinmayGit8765/SmartContract-Creator.git
cd SmartContract-Creator
npm install
npm run build
npm link        # puts `smartc` on your PATH
```

No need to install `solc` or OpenZeppelin — they're bundled. Solana (`anchor`) and AI (`ollama`) are optional; run `smartc doctor` to see what you have.

## Quickstart

```sh
smartc create --template erc20 --out MyToken.sol
# walks the wizard, compile-verifies, writes MyToken.sol + MyToken.DEPLOY.md
```

Prefer explanations? Add `--newbie`. Automating? Add `--force` to skip prompts.

## Commands

| Command | What it does |
|---------|--------------|
| `smartc create --template <id>` | Run the wizard for a template and write `<Name>.<ext>` + `<Name>.DEPLOY.md`. |
| `smartc list-templates [--json]` | List available templates. |
| `smartc doctor [--json]` | Probe the toolchain (Node, bundled solc, anchor, cargo-build-sbf, ollama). Exit 0 when required tools are present. |
| `smartc add-feature --ai --file <path> "<description>"` | Patch a feature into an existing contract via local Ollama. |

Global flags: `--newbie` (explanations), `--force` (skip prompts), `--no-color`, `--json` (machine output where supported), `-V`/`--version`.

## Templates & examples

All four are driven by the same wizard. EVM output matches OpenZeppelin Wizard conventions byte-for-byte.

**ERC-20** — `smartc create --template erc20` · name, symbol, supply, opt-in Mintable/Burnable/Pausable, Ownable vs AccessControl.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MyToken is ERC20, ERC20Permit {
    constructor(address recipient) ERC20("MyToken", "MTK") ERC20Permit("MyToken") {
        _mint(recipient, 1000000 * 10 ** decimals());
    }
}
```

**ERC-721** — `smartc create --template erc721` · name, symbol, base URI, opt-in Mintable/Enumerable/Burnable/Pausable, EIP-2981 royalties.

**ERC-1155** — `smartc create --template erc1155` · URI template, opt-in Mintable/Burnable/Supply-tracking/Pausable.

**SPL (Solana / Anchor)** — `smartc create --template spl` · name, symbol, decimals, supply, **explicit** mint-authority and freeze-authority choices, opt-in Metaplex metadata. Output is an Anchor program (`<name>.rs`); the DEPLOY.md covers both the `spl-token` CLI and Anchor deploy paths for devnet and mainnet-beta.

Each `create` also writes a `DEPLOY.md` next to the contract. For an Ownable + Mintable ERC-20, that file includes, for example:

> **Mintable + Ownable (CRITICAL):** a single key can mint unlimited tokens. Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.

## AI add-feature (optional, local)

```sh
smartc add-feature --ai --file MyToken.sol "add a per-wallet mint cap of 100 tokens"
```

Connects to a **local** [Ollama](https://ollama.com) daemon (no cloud, no keys), shows you a diff, asks you to confirm, then **sandbox-compiles** the result and only writes it if it builds. Default model `qwen2.5-coder` (override with `--model` or `SMARTC_OLLAMA_MODEL`). If Ollama isn't running, it tells you and points at `smartc doctor`.

> AI output is a suggestion, not an audit — always review and test before deploying value.

## Safety

`smartc` generates and compiles; it never broadcasts a transaction. The generated `DEPLOY.md` includes a pre-deploy checklist and surfaces centralization risks specific to your options. **Have contracts audited before they hold real value.**

## Documentation

- **[docs/HOWTO.md](docs/HOWTO.md)** — step-by-step walkthroughs for every command and template.
- **[docs/FORKING.md](docs/FORKING.md)** — fork it, understand the layout, and add your own template (the plugin model is additive — no core changes).
- **[docs/EMBEDDING.md](docs/EMBEDDING.md)** — call `smartc` from scripts, other tools, LLMs, and MCP agents (stable `--json` contracts + exit codes).
- **[AGENTS.md](AGENTS.md)** / **[llms.txt](llms.txt)** — machine-readable capability + invocation summary for AI agents.

## Contributing & forking

PRs and forks welcome. The architecture is deliberately **additive**: a new template is a self-contained folder under `src/templates/<id>/` registered in one line — adding one touches no existing template. See [docs/FORKING.md](docs/FORKING.md).

```sh
npm test          # full suite (unit + integration + e2e)
npm run typecheck
npm run build
```

## License

[MIT](LICENSE) © 2026 Chinmay Purohit.

Built with [OpenZeppelin Wizard](https://wizard.openzeppelin.com), [solc](https://soliditylang.org), [Anchor](https://www.anchor-lang.com), and [Ollama](https://ollama.com).
