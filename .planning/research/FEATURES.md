# Feature Research

**Domain:** Smart contract scaffolding / wizard-driven contract generator CLI
**Researched:** 2026-05-14
**Confidence:** HIGH for EVM wizard options (verified against OpenZeppelin wizard source on GitHub); MEDIUM for SPL/Anchor template conventions (verified against Solana/Anchor official docs but no equivalent single-file "wizard"); MEDIUM for DEPLOY.md conventions (synthesized from multiple credible sources, no canonical template).

---

## 0. Tools Studied

| Tool | What it generates | Single-file? | Wizard-driven? | Relevance |
|------|------------------|--------------|----------------|-----------|
| **OpenZeppelin Contracts Wizard** (`wizard.openzeppelin.com`) | One Solidity file per token, copy-paste output | YES | YES (web UI) | Direct competitor and gold standard for option set |
| **thirdweb CLI** (`npx thirdweb create contract`) | Full Hardhat or Foundry project with base contracts | NO (full project) | Partial (template flags) | Competing onboarding flow, but project-scaffolds not single-file |
| **Hardhat init** (`npx hardhat init`) | Empty project + sample Lock.sol | NO | Minimal (JS/TS/Viem prompt only) | Sets baseline expectation for "init" UX |
| **Foundry init** (`forge init`) | Empty project + Counter.sol | NO | NO | Same — project scaffolder, no contract wizard |
| **create-eth / Scaffold-ETH 2** | Full dApp (contracts + Next.js frontend + hooks) | NO | YES (extensions) | Different scope, but informs DX expectations |
| **Anchor init** (`anchor init`) | Solana program workspace (Rust + tests + IDL) | NO | NO | Baseline for Solana side, no wizard equivalent for SPL |
| **`spl-token create-token` CLI** | No source — creates a mint on-chain directly | N/A | NO | Important contrast: many Solana devs never write SPL code at all |
| **OpenZeppelin Stylus / Stellar / Cairo wizards** | Single Rust/Cairo file | YES | YES | Confirms OZ's single-file-output model is the standard wizard shape |

**Key takeaway from the survey:** the EVM ecosystem already has a definitive winner for single-file token wizardry (OpenZeppelin). Our differentiation must come from (a) CLI/local-first workflow, (b) cross-chain coverage including Solana/SPL where no equivalent wizard exists, and (c) the optional AI-assisted `add-feature` flow. Matching OZ on Solidity option set is table stakes; beating it on Solidity option set is unlikely to be valuable.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete / users file an issue and leave.

#### Tool-level table stakes (chassis)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive wizard prompts (name, symbol, etc.) | Every comparable tool has this; non-wizard means just write Solidity yourself | LOW | Use a battle-tested prompt lib (inquirer/prompts/clack); avoid hand-rolling |
| Non-interactive flag mode (`--name X --symbol Y --mintable`) | CI use, scripting, reproducibility; OZ wizard's URL params do this | LOW | Every prompt must have a matching flag |
| Compile-verifies generated output before exit | If the tool emits broken code, trust is dead immediately | MEDIUM | Solidity: shell out to `solc` or `hardhat`. Anchor: shell out to `anchor build` / `cargo build-sbf`. Bundle or detect toolchain. |
| SPDX license header + Solidity pragma | Etherscan/Sourcify verification fails without SPDX; OZ wizard always emits these | LOW | Default to `SPDX-License-Identifier: MIT`, `pragma solidity ^0.8.20` (or latest stable) |
| Pinned, current OpenZeppelin version in imports | Drift = compile failure on user's machine; security audits assume specific versions | LOW | Pin to a known-good `@openzeppelin/contracts@x.y.z` per release |
| Deterministic output (same inputs → byte-identical file) | Reproducibility, diffability, AI patch correctness | LOW | No timestamps, random ordering, or env-dependent strings in output |
| Helpful errors when toolchain missing | "solc not found" with install hint, not a stack trace | LOW | Pre-flight check before invoking compile |
| `--dry-run` / preview to stdout | Users want to see before writing | LOW | Standard CLI hygiene |
| Overwrite protection (prompt or `--force`) | Don't silently clobber files | LOW | Check `existsSync` before write |
| README or banner pointing to `DEPLOY.md` after generation | Users miss files in subdirectories | LOW | Print "Next steps:" with file paths on success |
| Help text per template / per option | `--help` must actually explain options, not just list them | LOW | Each option needs a one-liner doc string |

#### Per-template table stakes — **ERC-20** (Solidity)

Anchored on OpenZeppelin Contracts Wizard's actual option set (verified from `packages/core/solidity/src/erc20.ts`). Categorization reflects what we judge essential for v1 of a "credible" ERC-20 wizard.

| Option | Type | Default | Why table stakes | Complexity |
|--------|------|---------|------------------|------------|
| `name` | string | `"MyToken"` | Constructor arg; can't make a token without it | LOW |
| `symbol` | string | `"MTK"` | Same | LOW |
| `premint` | string (decimal amount) | `"0"` | Users overwhelmingly want a starting supply minted to deployer; biggest single UX miss if absent | LOW |
| `decimals` (override) | integer | 18 | Not in OZ wizard (defaults to 18) but a frequent custom request; we should at least surface as a flag | LOW |
| `mintable` | bool | `false` | Most common "yes I want this" — pulls in OZ AccessControl/Ownable + `mint()` | LOW (one import, one function) |
| `burnable` | bool | `false` | Trivially common; pulls in `ERC20Burnable` | LOW (one mixin) |
| `pausable` | bool | `false` | Common for utility tokens; pulls in `ERC20Pausable` + `Pausable` + role | LOW |
| `permit` (EIP-2612) | bool | `true` in OZ | Gasless approvals are now ecosystem-standard; OZ defaults this ON | LOW (one mixin, requires EIP-712 domain) |
| Access control choice | `false \| 'ownable' \| 'roles' \| 'managed'` | auto-selected based on other options | If user enables mintable/pausable, *something* must gate it. OZ auto-picks Ownable unless user upgrades. | LOW–MED |

#### Per-template table stakes — **ERC-721** (Solidity)

Anchored on `packages/core/solidity/src/erc721.ts`.

| Option | Type | Default | Why table stakes | Complexity |
|--------|------|---------|------------------|------------|
| `name` | string | `"MyToken"` | Constructor arg | LOW |
| `symbol` | string | `"MTK"` | Constructor arg | LOW |
| `baseUri` | string (URI) | `""` | If you don't ask for this, the user has to edit the file themselves — defeats the wizard | LOW |
| `mintable` | bool | `false` | Without this you can't actually mint NFTs after deploy unless `incremental` constructor-mints; users expect a mint function | LOW |
| `incremental` (auto-increment IDs) | bool | `false` | The "single function, no tokenId arg" UX users actually want; OZ exposes this explicitly | LOW |
| `burnable` | bool | `false` | Common | LOW |
| `uriStorage` | bool | `false` | Per-token metadata URIs are common (e.g., reveal mechanics) | LOW |
| `pausable` | bool | `false` | Common | LOW |
| Access control choice | enum (see above) | auto | Same rationale as ERC-20 | LOW–MED |

#### Per-template table stakes — **ERC-1155** (Solidity)

Anchored on `packages/core/solidity/src/erc1155.ts`.

| Option | Type | Default | Why table stakes | Complexity |
|--------|------|---------|------------------|------------|
| `name` | string | `"MyToken"` | Used by OZ for storage namespace and metadata; required | LOW |
| `uri` | string (URI template) | `""` | The whole point of ERC-1155 is multi-token URIs; no URI = broken UX | LOW |
| `mintable` | bool | `false` | Without it, no way to issue tokens after deploy → useless | LOW |
| `burnable` | bool | `false` | Common | LOW |
| `pausable` | bool | `false` | Common | LOW |
| `supply` (totalSupply tracking) | bool | `false` | Indexers, dashboards, and OpenSea expect totalSupply per id; OZ exposes this | LOW |
| `updatableUri` | bool | `true` in OZ | Default ON in OZ because users assume URIs are mutable for reveals | LOW |
| Access control choice | enum | auto | If `mintable`/`pausable`/`updatableUri` chosen → must gate | LOW–MED |

#### Per-template table stakes — **SPL Token (Anchor / Rust)**

There is **no OpenZeppelin equivalent for Solana** as of researched date (verified — OZ supports Solidity, Stylus, Stellar Soroban, Cairo, Polkadot, Uniswap Hooks, but not Solana). The bar here is set by:
1. Anchor's `anchor init` (empty workspace) — no opinion offered
2. The `spl-token` CLI flow (no code, just on-chain `create-token` + `create-account`)
3. Hand-written Anchor SPL examples (Metaplex docs, QuickNode guides, Anchor docs)

Because our output is **one file** but Anchor programs typically span a workspace (`Cargo.toml`, `Anchor.toml`, `lib.rs`, IDL, tests), we have a constraint mismatch. See "Architectural decision required" below.

| Option | Type | Default | Why table stakes | Complexity |
|--------|------|---------|------------------|------------|
| `name` | string | `"MyToken"` | Metaplex metadata name | LOW |
| `symbol` | string | `"MTK"` | Metaplex metadata symbol | LOW |
| `decimals` | integer (0–9) | 9 | Required by `initialize_mint`; 9 is Solana convention for fungibles | LOW |
| `initial_supply` (premint to deployer) | string | `"0"` | Equivalent to EVM `premint`; without this, user has to do a second mint step | LOW |
| `metadata_uri` | string | `""` | Without Metaplex metadata, wallets show "Unknown Token" — broken UX | MEDIUM (requires Metaplex Token Metadata CPI) |
| `mint_authority_keep` | bool | `true` | Without it, the program can never mint again — user must understand this tradeoff | LOW (just whether to call `set_authority(None)` after init) |
| `freeze_authority` | enum: `none \| keep` | `none` | Freeze authority is a known centralization concern; default OFF, document the choice | LOW |

**Architectural decision required** (flag for roadmap, not for FEATURES.md scope): "one file" for SPL means either:
- (a) emit just `lib.rs` and expect user to drop into an existing Anchor workspace — works for experienced Solana devs but breaks the newbie promise
- (b) emit `lib.rs` + adjacent `Anchor.toml` + `Cargo.toml` stubs and call it "one logical contract" even though it's 3 files — pragmatic
- (c) restrict v1 SPL output to be a **client-side script** (TypeScript using `@solana/spl-token`) that creates the mint, rather than an on-chain Anchor program — matches what 90%+ of real SPL tokens do (no custom program at all)

Recommendation for roadmap: **(c)** is most honest to how SPL tokens actually work in production. Custom Anchor programs are for tokens with custom mint/burn/transfer logic, not vanilla fungibles. If the goal is "newbie can ship a token", a TypeScript mint-creation script is closer to reality than a Rust program. This deserves a dedicated decision in the roadmap.

---

### Differentiators (Competitive Advantage)

Features not strictly expected, but where we can beat OpenZeppelin Wizard's web UI and existing CLIs.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Local-first CLI** (no copy-paste from web) | OZ wizard is web-only; copy-paste loses context, no shell history, no diff against last run | LOW | Core premise of project — get this right |
| **Generated `DEPLOY.md` per contract** | OZ wizard prints code only; deploy guidance is "go figure it out". This is the single biggest gap in OZ's UX. | MEDIUM | See DEPLOY.md content checklist below — this is where we provide outsized value |
| **`add-feature --ai` (Ollama-backed custom logic patches)** | OZ wizard is fixed-option; if you want anything custom, you write Solidity. We let users describe a feature in English and patch the file. | HIGH | Risk: AI-generated Solidity is dangerous. MUST compile-verify the patched output and MUST flag clearly that AI output is unaudited. See PITFALLS doc. |
| **Compile-verify gate before file is written** | OZ wizard outputs broken code occasionally (see forum: "ERC20 with Burnable+Permit+Votes+UUPS not deployable"). We can refuse to write if compile fails. | MEDIUM | Differentiator vs OZ; matches user expectation set by `tsc`-style tools |
| **Cross-chain coverage including Solana/SPL** | OZ doesn't have Solana. Anchor doesn't have a wizard. We're the only single tool covering both. | HIGH | Real moat if executed; risk is we do both badly. Start with one chain solid, then expand. |
| **Embedded centralization-risk warnings** in DEPLOY.md and as wizard inline notes | "You picked `ownable` + `mintable` — single key can mint infinitely. Mitigations: multisig owner, timelock, renounce after premint." Most wizards leave this to audit-time. | LOW | Static text per option combination; high value-per-effort |
| **Testnet-first deploy recipe** in DEPLOY.md (Sepolia / Devnet) | Newbies skip testnet because no one tells them how; pros want a copy-pasteable command sequence | LOW | Hardcoded for one canonical testnet per chain |
| **Etherscan/Solscan verification recipe** in DEPLOY.md | Hardhat-verify exists but config is finicky; we generate the exact command with the right constructor-args encoding | MEDIUM | Requires we know constructor args from wizard answers |
| **Reproducible runs via config file** (`smartycontract.config.json` or `--from-config`) | OZ wizard has no "save & resume"; URL params kinda do this but lose AI patch state | LOW | Persist wizard answers as JSON next to output |
| **Plain-language explainers next to each option** | "What does `permit` do?" — embedded one-liner in prompt + link to docs. Better than OZ tooltip. | LOW | Static strings; minimal effort |

---

### Anti-Features (Commonly Requested, Often Problematic — Do NOT ship in v1)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Upgradeability (UUPS / Transparent proxy)** in v1 | OZ wizard has it (`upgradeable: 'uups' \| 'transparent'`); users assume parity. | Proxy patterns are subtle: storage layout rules, initializer ordering, admin-key risk. Generating wrong = catastrophic (broken upgrade bricks contract). The compile-verify gate doesn't catch storage-layout bugs. Requires us to ship deploy script + proxy admin guidance, which doubles DEPLOY.md scope. | Defer to v1.x. Document clearly in the wizard ("Upgradeability not yet supported — see DEPLOY.md for migration patterns"). When we add it, ship UUPS only (simpler than transparent) and require deploy-script generation. |
| **In-tool audit / "scan for vulnerabilities"** | Trust signal; users want green checkmark before deploy | We are not auditors. Slither/Mythril integration is hours-long to run and produces false positives. Claiming "audited" when running a linter is dangerous. | Link to `slither` install + run command in DEPLOY.md. Be explicit that audit means human review, not tool output. |
| **Custom token economics beyond OZ extensions** (taxes on transfer, reflection, dividend distribution, anti-bot, max-wallet-limit) | "Meme coin" demand is real and loud | These are virtually all rugpull/scam features. Even legitimate uses (e.g., reflection) have a long history of bugs. Generating these gives our tool a reputation for shitcoins. | Document as out-of-scope. If `add-feature --ai` is asked to add them, flag the request with a strong warning before AI runs. |
| **ERC-4626 (tokenized vault)**, **ERC-2981 (royalties)** in v1 | Standard-ish extensions OZ supports | Each one expands per-template option matrix and DEPLOY.md content significantly. Better to nail 4 templates × core options than 4 templates × every extension. | Defer to v1.x. Users who need these are not newbies. |
| **Full project scaffold (Hardhat/Foundry workspace)** | thirdweb, scaffold-eth, create-eth all do this | Conflicts with stated v1 scope of "one file out". Choosing scaffolder territory means competing with 3 established tools head-on. | Stay focused: one file, plus a DEPLOY.md that *references* how to use it in an existing project. |
| **Web UI** | OZ has one and it's the SOTA | We're a CLI by design; the local-first angle is the differentiation. Web UI doubles surface area. | Stay CLI. Maybe a `--share` flag that prints a shareable config blob; resist a full web UI in v1. |
| **Frontend / dApp generation** | scaffold-eth does this; users love it | Massive scope expansion (React, wagmi, RainbowKit, wallet config). Different product. | Out of scope, document clearly. Link to scaffold-eth as recommended next step. |
| **AI-generated entire contracts from scratch** (vs. AI patching wizard output) | "Just describe what you want" demand | Whole-contract AI gen produces hallucinated imports, wrong inheritance order, missing access control, and (because Ollama runs unaudited models locally) the user has no signal whether the output is sane. The wizard-base + AI-patch model gives a known-good starting point. | `add-feature --ai` is patches *only*, not full generation. Refuse if there's no existing wizard output to patch. |
| **Custom audit / "we'll review your contract"** | Premium feature requests | Liability. We are not auditors. | Link to audit firms (OpenZeppelin, Trail of Bits, Spearbit, Cantina, code4rena). Free, no liability. |
| **Token-2022 extensions** (transfer fees, non-transferable, interest-bearing) on Solana in v1 | Solana ecosystem hype | Token-2022 extensions have complex interaction rules (e.g., NonTransferable conflicts with TransferFee per Solana docs). Hard to enumerate combinations safely. | v1: classic SPL Token program only. v1.x: pick one extension (likely transfer fee), add it with explicit warnings. |
| **Direct deploy from the wizard** (`smartycontract deploy`) | Convenience; thirdweb deploy does this | Requires holding RPC keys, signer keys, gas estimation, error handling per chain. Each one is its own product. DEPLOY.md gives users the *commands* to run, not the deploy itself. | Print copy-pasteable commands in DEPLOY.md; do not execute them. |
| **OZ-Defender / multisig setup integration** | Reasonable next step after deploy | Per-vendor integration, account creation requires accounts, breaks "local-first" claim | Document the pattern in DEPLOY.md ("Recommended: transfer ownership to Safe multisig — see [link]") without integrating |

---

## DEPLOY.md Content Checklist

This is where we differentiate. **Every generated contract** must ship with a `DEPLOY.md` next to it. Sections marked `[NON-NEGOTIABLE]` cannot be omitted in any output.

### Required sections (in this order)

1. **`# Deploying [ContractName]`** — title with contract name from wizard input.

2. **`## What This Contract Is`** `[NON-NEGOTIABLE]`
   - One-paragraph plain-language summary of what was generated (e.g., "An ERC-20 fungible token named X with symbol Y, supporting mint by owner and burn by holder.")
   - List of *enabled* features with one-line each (e.g., "Mintable: the owner address can create new tokens at any time.")
   - This section is generated from wizard answers; not a static template.

3. **`## ⚠️ Security Warnings — Read Before Deploying`** `[NON-NEGOTIABLE]`
   Sub-bullets generated conditionally based on options:
   - **If `access: 'ownable'` and (`mintable` or `pausable`):** "Centralization risk — the owner address can [mint unlimited tokens / pause all transfers]. If the owner's private key is lost or compromised, [consequences]. Mitigations: (a) transfer ownership to a multisig (Safe / Gnosis), (b) transfer ownership to a timelock with delay, (c) call `renounceOwnership()` after premint to make supply fixed."
   - **If `mintable: true`:** "Unlimited supply — there is no maximum cap. If you want a hard cap, see ERC20Capped in OpenZeppelin docs."
   - **If `pausable: true`:** "The pauser role can freeze all transfers, including yours. Users of this token must trust the pauser."
   - **If Solana + `mint_authority` retained:** "Mint authority is retained by the payer wallet — this wallet can mint infinite supply. To make supply fixed, call `set_authority(MintTokens, null)` after the initial mint. See Solana cookbook link."
   - **If Solana + `freeze_authority` retained:** "Freeze authority can lock any token account. Most production tokens revoke this."
   - **Generic, always present:** "This contract has not been audited. Wizard-generated code uses audited OpenZeppelin components, but the specific combination has not been reviewed for your use case. Do not deploy to mainnet with significant value at stake without a professional audit."
   - **If `add-feature --ai` was used:** "AI-generated code in this contract has been compile-verified but NOT audited. AI may introduce subtle bugs (reentrancy, integer overflow, incorrect access control). Treat with extra scrutiny."
   - **Reentrancy note (Solidity):** "Solidity contracts following the OpenZeppelin pattern follow checks-effects-interactions; if you added external calls via `add-feature`, review for reentrancy."

4. **`## Prerequisites`** `[NON-NEGOTIABLE]`
   - Required tools (node version, foundry/hardhat, anchor CLI, solana CLI)
   - Wallet setup (private key in env file with `.gitignore` reminder)
   - Funded testnet account (link to faucet for Sepolia / Devnet)

5. **`## Step 1: Compile`**
   - Exact command(s) for at least one toolchain (Hardhat for Solidity, Anchor for Rust)
   - Expected output (what success looks like)

6. **`## Step 2: Deploy to Testnet`** `[NON-NEGOTIABLE — at least one testnet]`
   - **EVM:** Sepolia is the canonical testnet as of researched date. Foundry + cast example, Hardhat Ignition example, or hand-rolled ethers script — pick one canonical path.
   - **Solana:** Devnet. `solana-test-validator` for fully local, devnet for shared.
   - Include the **constructor args** (or initial-mint args) inline, derived from wizard answers. Don't make users figure out their own input encoding.
   - Sample output including the deployed address placeholder.

7. **`## Step 3: Verify on Block Explorer`**
   - EVM: `hardhat verify --network sepolia <ADDRESS> <constructor-args>` with args pre-filled
   - Solana: `solana program show <PROGRAM_ID>` + Solscan link
   - Mention SPDX-License-Identifier requirement (we always emit it, but note why)

8. **`## Step 4: Post-Deploy Sanity Checks`**
   - Call `name()`, `symbol()`, `totalSupply()` (or Solana mint-info) to confirm
   - For ownable: `owner()` returns expected address
   - For premint: deployer balance matches premint amount

9. **`## Mainnet Deployment`** `[NON-NEGOTIABLE]`
   - Bold warning: "Do not proceed to mainnet without an audit if real funds are involved."
   - Same commands with network changed
   - Reminder: testnet success ≠ mainnet safety (different gas, MEV exposure, fork risk)
   - Recommended actions before mainnet:
     - Run static analysis (Slither, Mythril) — give the install + run command
     - Get an audit (link to OZ Defender, Trail of Bits, etc.)
     - Transfer ownership to a multisig (link to Safe)

10. **`## Common Pitfalls`**
    - Forgot to fund deployer wallet → tx fails silently
    - Wrong network in config → deployed to wrong chain
    - Constructor args mismatch in verification → verification fails
    - Solana: insufficient SOL for rent → mint init fails

11. **`## What Was NOT Included`** `[NON-NEGOTIABLE]`
    - Explicitly list features the user might assume but were *not* generated:
      - "Upgradeability: not supported in v1. This contract is immutable once deployed."
      - "Audit: not performed. This is wizard-generated code only."
      - "Frontend: not generated. See [scaffold-eth] for a dApp UI template."
      - "Multisig setup: not configured. See [Safe docs] to transfer ownership."

12. **`## References`**
    - Link to wizard config that produced this (the saved JSON, if present)
    - Link to OpenZeppelin Contracts docs for each extension used
    - Link to the chain's official deploy docs

---

## Feature Dependencies

```
[name + symbol] ──required for──> [all token templates]

[mintable] ──requires──> [access control: ownable | roles | managed]
                              └──requires──> [some EOA or multisig as authority]

[pausable] ──requires──> [access control]
[updatableUri (ERC1155)] ──requires──> [access control]

[votes (ERC20)] ──requires──> [permit] (OZ auto-adds)
[votes (ERC721)] ──standalone, but conflicts with─> [enumerable in some OZ versions]

[premint > 0] ──requires──> [a deployer/recipient address — defaults to msg.sender in constructor]

[Solana: metadata_uri non-empty] ──requires──> [Metaplex Token Metadata CPI in lib.rs]
[Solana: initial_supply > 0] ──requires──> [mint_authority retained at least through deploy tx]

[add-feature --ai] ──requires──> [an existing wizard-generated file to patch]
                  ──requires──> [Ollama installed and running locally]
                  ──requires──> [compile-verify pass before write]
```

### Dependency Notes

- **`mintable` and access control are inseparable:** if user picks `mintable: true` without picking access, we must auto-pick `ownable` and tell them. OZ wizard does this.
- **`permit` is auto-enabled when `votes` is enabled** (ERC-20): votes require EIP-712 nonces which permit provides. Match OZ default to avoid surprise.
- **`upgradeable` (when we add it post-v1) requires initializer pattern, NOT constructor:** all constructor args become initializer args. This rewrites a lot of the template. Flag for v1.x phase.
- **Solana `metadata_uri` requires Metaplex CPI:** non-trivial dependency. Without it, the token is "Unknown Token" in wallets. If we omit Metaplex support, document loudly.

---

## MVP Definition

### Launch With (v1) — locked scope

- [ ] **Wizard chassis:** interactive prompts + non-interactive flags + `--dry-run` + overwrite protection + help text
- [ ] **Compile-verify gate** before write (Solidity via `solc` or bundled hardhat, Solana via `anchor build` or `cargo build-sbf`)
- [ ] **ERC-20 template** with: name, symbol, premint, decimals override, mintable, burnable, pausable, permit, access control (ownable/roles)
- [ ] **ERC-721 template** with: name, symbol, baseUri, mintable, incremental IDs, burnable, uriStorage, pausable, access control
- [ ] **ERC-1155 template** with: name, uri, mintable, burnable, pausable, supply tracking, updatable URI, access control
- [ ] **SPL Token template** with: name, symbol, decimals, initial_supply, metadata_uri, mint_authority retention choice, freeze_authority choice — **format decision pending** (Anchor program vs TypeScript script — see SPL section above)
- [ ] **DEPLOY.md generator** with all `[NON-NEGOTIABLE]` sections above, conditional warnings based on wizard answers
- [ ] **Deterministic output** + pinned OZ version + SPDX + pragma
- [ ] **Repro config file** (`.smartycontract.json` written next to output)

### Add After Validation (v1.x)

- [ ] `add-feature --ai` via Ollama — defer if v1 ships without; this is the highest-risk feature and easiest to get wrong
- [ ] **Upgradeability** (UUPS first, transparent later) — adds initializer mode, deploy-script generation
- [ ] **ERC-20 Votes** + **ERC-20 Flash mint** — OZ has them; we skip for v1 to reduce option-matrix size
- [ ] **ERC-721 Enumerable** + **ERC-721 Votes**
- [ ] **Slither integration** as opt-in `--check`
- [ ] **Token-2022 extensions** (transfer fee first) for Solana
- [ ] **Metaplex metadata** auto-CPI for SPL (if not in v1)

### Future Consideration (v2+)

- [ ] ERC-4626 vault template
- [ ] ERC-2981 royalty extension
- [ ] EIP-7702 / smart account templates
- [ ] Stylus / Cairo / Move targets (OZ already has wizards for these)
- [ ] OZ Defender / Safe multisig integration recipes
- [ ] Foundry-format output (`forge create` instead of Hardhat)
- [ ] Wizard-shareable URL or config-blob (`--share`)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Wizard chassis + prompts + flags | HIGH | LOW | P1 |
| Compile-verify gate | HIGH | MEDIUM | P1 |
| ERC-20 template (core options) | HIGH | LOW | P1 |
| ERC-721 template (core options) | HIGH | LOW | P1 |
| ERC-1155 template (core options) | HIGH | LOW | P1 |
| SPL token template | HIGH | MEDIUM | P1 |
| DEPLOY.md generator with warnings | HIGH | MEDIUM | P1 |
| Deterministic output / SPDX / pinning | MEDIUM | LOW | P1 |
| Repro config file | MEDIUM | LOW | P1 |
| Per-option centralization warnings | HIGH | LOW | P1 |
| `add-feature --ai` via Ollama | MEDIUM | HIGH | P2 |
| Upgradeability (UUPS) | MEDIUM | HIGH | P2 |
| ERC-20 Votes / Flash mint | LOW | LOW | P2 |
| ERC-721 Enumerable / Votes | LOW | LOW | P2 |
| Slither `--check` integration | MEDIUM | MEDIUM | P2 |
| Token-2022 extensions | MEDIUM | HIGH | P2 |
| Metaplex metadata auto-CPI | HIGH | HIGH | P1 *if* we go Anchor route for SPL; P2 if TS-script route |
| ERC-4626 / ERC-2981 | LOW | MEDIUM | P3 |
| Direct deploy from CLI | LOW | HIGH | P3 (anti-feature for v1) |
| Web UI | LOW | HIGH | P3 (anti-feature) |
| Frontend gen | LOW | VERY HIGH | P3 (out of scope) |

**Priority key:**
- P1: Must have for launch (v1)
- P2: Should have, v1.x
- P3: Nice to have / future / explicit anti-feature

---

## Competitor Feature Analysis

| Feature | OpenZeppelin Wizard | thirdweb CLI | Anchor init | Our Approach |
|---------|---------------------|--------------|-------------|--------------|
| Output format | Single Solidity file (in-browser) | Hardhat or Foundry project | Anchor workspace | Single file per contract (with sibling DEPLOY.md + config json) |
| Interface | Web UI | CLI (some flags) | CLI (no prompts) | CLI wizard + flags + config |
| ERC-20 options | All standard + flashmint + crossChain + votes | Pre-built contracts library, less granular | N/A | Match OZ core set; defer flashmint/cross-chain |
| ERC-721 options | All standard + enumerable + votes | Pre-built drops/marketplace | N/A | Match OZ core set; defer enumerable/votes to v1.x |
| ERC-1155 options | Standard set | Pre-built editions | N/A | Match OZ core set |
| Solana / SPL | Not supported | Not supported | Workspace only, no token wizard | **Our differentiator** — TS-script or Anchor program, with explicit centralization warnings |
| Deploy guidance | None (just code) | Built-in `thirdweb deploy` | Sample script in workspace | **DEPLOY.md** — biggest single differentiator |
| AI assistance | None | None | None | `add-feature --ai` (post-v1) — second major differentiator |
| Centralization warnings | None inline | None inline | None | Inline + DEPLOY.md — opinionated stance |
| Compile verification | Implicit (browser doesn't run solc) | Yes via Hardhat/Foundry | Yes via `anchor build` | Yes — refuse to write if compile fails |
| Verification recipe | None | Built into thirdweb dashboard | None | Generated `hardhat verify` or Solscan steps |
| Upgradeability | UUPS + Transparent | Modular Contracts framework | N/A | **Defer to v1.x** — anti-feature in v1 |
| Reproducibility | URL params | Config files | Anchor.toml | `.smartycontract.json` repro file |

---

## Sources

Verified against (HIGH confidence):
- [OpenZeppelin Contracts Wizard ERC-20 source](https://github.com/OpenZeppelin/contracts-wizard/blob/master/packages/core/solidity/src/erc20.ts) — option set authoritative
- [OpenZeppelin Contracts Wizard ERC-721 source](https://github.com/OpenZeppelin/contracts-wizard/blob/master/packages/core/solidity/src/erc721.ts)
- [OpenZeppelin Contracts Wizard ERC-1155 source](https://github.com/OpenZeppelin/contracts-wizard/blob/master/packages/core/solidity/src/erc1155.ts)
- [OpenZeppelin Wizard access-control enum source](https://github.com/OpenZeppelin/contracts-wizard/blob/master/packages/core/solidity/src/set-access-control.ts) — confirms `[false, 'ownable', 'roles', 'managed']`
- [OpenZeppelin Wizard upgradeability enum source](https://github.com/OpenZeppelin/contracts-wizard/blob/master/packages/core/solidity/src/set-upgradeable.ts) — confirms `[false, 'transparent', 'uups']`
- [OpenZeppelin Contracts Wizard hosted UI](https://wizard.openzeppelin.com/)
- [OpenZeppelin Contracts Wizard docs page](https://docs.openzeppelin.com/wizard)
- [OpenZeppelin Contracts Wizard GitHub repo](https://github.com/OpenZeppelin/contracts-wizard)
- [thirdweb CLI create docs](https://portal.thirdweb.com/cli/create)
- [Hardhat 3 Getting Started](https://hardhat.org/docs/getting-started)
- [Hardhat v2 project setup docs](https://v2.hardhat.org/hardhat-runner/docs/guides/project-setup)
- [Scaffold-ETH 2 docs](https://docs.scaffoldeth.io/)
- [create-eth repo](https://github.com/scaffold-eth/create-eth)
- [Anchor SPL Token Basics](https://www.anchor-lang.com/docs/tokens/basics)
- [Solana Token Extensions (Token-2022) docs](https://solana.com/docs/tokens/extensions)
- [Metaplex Create Token with Anchor guide](https://developers.metaplex.com/tokens/anchor/create-token)
- [Hardhat smart contract verification docs](https://hardhat.org/docs/learn-more/smart-contract-verification)
- [Etherscan Verify Contract](https://etherscan.io/verifyContract)

Verified against (MEDIUM confidence — community/blog sources cross-referenced with official docs):
- [QuickNode: Create and Mint SPL Tokens Using Anchor](https://www.quicknode.com/guides/solana-development/anchor/create-tokens)
- [QuickNode: Token-2022 with Anchor](https://www.quicknode.com/guides/solana-development/anchor/token-2022)
- [CertiK: What is Centralization Risk](https://www.certik.com/resources/blog/What-is-centralization-risk)
- [Ethereum.org Smart Contract Security](https://ethereum.org/developers/docs/smart-contracts/security/)
- [RareSkills: Token 2022 Specification](https://rareskills.io/post/token-2022)
- [Helius: What is Token-2022](https://www.helius.dev/blog/what-is-token-2022)
- [Definition and Detection of Centralization Defects in Smart Contracts (arxiv 2411.10169)](https://arxiv.org/abs/2411.10169)
- [Bitbond Smart Contract Verification Guide 2025](https://www.bitbond.com/resources/smart-contract-verification-comprehensive-guide/)

LOW confidence / single-source items flagged in body text where used. The DEPLOY.md section structure is a synthesis — no single canonical template exists in the ecosystem, so the checklist is opinionated rather than copied from a source.

### Gaps / open questions for follow-up research

1. **SPL output format decision (Anchor program vs TS mint-creation script)** is unresolved and is the single biggest unknown. Roadmap should include a dedicated decision phase or spike before SPL implementation starts.
2. **`add-feature --ai` safety story** needs its own deep dive (compile-verify is necessary but insufficient; consider Slither, manual review prompts, refusal patterns).
3. **Solidity compiler bundling vs detection** — do we ship `solc-js`, shell out to system `solc`, require Hardhat? Affects install UX significantly. Out of scope for FEATURES but flag for STACK.md.
4. **Anchor toolchain availability on Windows** — Anchor's install story is rough on Windows; if our user base is partly Windows newbies, the TS-script route for SPL becomes more attractive.

---
*Feature research for: smart contract scaffolding/generator CLI*
*Researched: 2026-05-14*
