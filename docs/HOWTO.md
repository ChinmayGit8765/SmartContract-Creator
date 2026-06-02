# How to use smartc

A task-oriented guide to every command. For the big picture, start at the
[README](../README.md). To extend the tool, see [FORKING.md](FORKING.md). To call
it from scripts/agents, see [EMBEDDING.md](EMBEDDING.md).

## Contents
- [Install & verify](#install--verify)
- [Generate a contract](#generate-a-contract)
- [Each template, end to end](#each-template-end-to-end)
- [Reading the DEPLOY.md](#reading-the-deploymd)
- [Check your toolchain (doctor)](#check-your-toolchain-doctor)
- [AI add-feature](#ai-add-feature)
- [Flags & exit codes](#flags--exit-codes)
- [Troubleshooting](#troubleshooting)

## Install & verify

```sh
npm install -g smartc      # or: npx smartc <command>
smartc --version
smartc doctor              # what's installed on this machine
```

Node 20+ is required. `solc` and OpenZeppelin are bundled. Solana/AI tooling is
optional.

## Generate a contract

```sh
smartc create --template <erc20|erc721|erc1155|spl> [--out PATH] [--newbie] [--force]
```

What happens:
1. The wizard asks template-specific questions.
2. The source is generated.
3. **It is compile-verified** (Solidity in-process; Solana via `anchor build` if
   present). If it fails to compile, nothing is written.
4. You're prompted before overwriting an existing file (`--force` skips this).
5. `<Name>.sol` (or `.rs`) **and** `<Name>.DEPLOY.md` are written.

`--out` sets the path (default `./<Name>.sol`). The DEPLOY.md is always written
next to it. Add `--newbie` for explanations and EIP/doc links at each step.

## Each template, end to end

### ERC-20 (fungible)
```sh
smartc create --template erc20 --out MyToken.sol
```
Prompts: name → symbol → initial supply → Mintable? → Burnable? → Pausable? →
(if Mintable/Pausable) Ownable vs AccessControl. Mintable+Ownable surfaces a
"single key can mint unlimited tokens" warning.

### ERC-721 (NFT)
```sh
smartc create --template erc721 --out MyNFT.sol
```
Prompts: name → symbol → base URI → Mintable? → Enumerable? → Burnable? →
Pausable? → EIP-2981 royalty? → (if royalty) basis points + recipient → (if
Mintable/Pausable) access style.

### ERC-1155 (multi-token)
```sh
smartc create --template erc1155 --out Game.sol
```
Prompts: name → URI template (e.g. `https://.../{id}.json`) → Mintable? →
Burnable? → Supply tracking? → Pausable? → (if Mintable/Pausable) access style.

### SPL (Solana / Anchor)
```sh
smartc create --template spl --out my_token.rs
```
Prompts: name → symbol → decimals (0-9) → initial supply → **mint authority**
(revoke=null vs keep=deployer) → **freeze authority** (none=null vs keep) →
Metaplex metadata? The two authority prompts have no default — you must choose.

Output is an Anchor program. Drop it into an `anchor init` project at
`programs/<name>/src/lib.rs`, run `anchor keys sync`, then `anchor build`. If you
don't have the Anchor toolchain, smartc still writes the file and warns that
compile-verification was skipped — run `smartc doctor` to see what's missing.

## Reading the DEPLOY.md

Every `create` writes `<Name>.DEPLOY.md` with:
- **Deploy commands** — EVM: Hardhat, Foundry (`forge create --broadcast`), Remix.
  Solana: `spl-token` CLI and Anchor, for **devnet and mainnet-beta**.
- **Centralization warnings** derived from your exact options (e.g. Ownable +
  Mintable, retained SPL mint authority).
- **A pre-deploy safety checklist** and verification snippets (Etherscan / Solscan).

It interpolates only your validated contract name and placeholder tokens like
`<YOUR_WALLET_ADDRESS>` — never a real key or address.

## Check your toolchain (doctor)

```sh
smartc doctor            # human table
smartc doctor --json     # machine-readable; exits 0 if required tools are OK
```
Reports Node, bundled solc (both **required**), and anchor, cargo-build-sbf,
ollama (**optional** — needed for SPL build / AI). Exit code is `0` when the
required tools are present, `1` otherwise — so it's usable as a CI gate.

## AI add-feature

Patch a feature into an existing contract with a local model:
```sh
smartc add-feature --ai --file MyToken.sol "add a per-wallet cap of 100 tokens"
```
Requirements: a running [Ollama](https://ollama.com) daemon and a pulled model
(`ollama pull qwen2.5-coder`). The flow: ask the model for the full updated file
→ show a diff → confirm → **sandbox-compile** → write only if it builds. A
non-compiling suggestion leaves your file untouched.

- `--model <name>` or `SMARTC_OLLAMA_MODEL` overrides the model (default
  `qwen2.5-coder`).
- `SMARTC_OLLAMA_HOST` / `OLLAMA_HOST` overrides the daemon URL (default
  `http://127.0.0.1:11434`).
- `--force` skips the confirmation.

Treat AI output as a suggestion, not an audit.

## Flags & exit codes

Global: `--newbie` (explanations; env `SMARTC_NEWBIE=1`), `--force`, `--no-color`,
`--json`, `-V`/`--version`, `--help`.

| Exit | Meaning |
|------|---------|
| 0 | Success (or `doctor` with required tools present). |
| 1 | Runtime error — compile failure, AI unreachable, `doctor` missing a required tool. |
| 2 | Usage error — bad/missing flag, unknown template, file not found. |
| 130 | Cancelled (Ctrl+C / dismissed a prompt). |

Errors print a three-part block: `Error:` (what + a stable `code:`), `Why:`, `Fix:`.

## Troubleshooting

- **"Missing --template"** — `create` needs `--template <id>`; see `smartc list-templates`.
- **Solidity compile failure** — if you didn't edit generated output, please open
  an issue; the pinned solc + OpenZeppelin should always produce compilable source.
- **SPL written but "compile-verify skipped"** — that's expected without Anchor;
  install it (`smartc doctor`) to get verification, or build manually.
- **"Could not reach the Ollama daemon"** — start it (`ollama serve`), pull a
  model, or set `SMARTC_OLLAMA_HOST`.
