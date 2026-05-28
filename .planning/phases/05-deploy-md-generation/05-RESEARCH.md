# Phase 5: DEPLOY.md Generation - Research

**Researched:** 2026-05-29
**Domain:** EVM contract deployment tooling (Hardhat, Foundry, Remix, Etherscan) + deterministic Markdown generation from a normalized contract descriptor
**Confidence:** HIGH (constructor signatures empirically generated from the installed OZ wizard; toolchain syntax verified against current official docs)

## Summary

Phase 5 adds a `DEPLOY.md` deployment guide alongside every generated `.sol`. The architecture is fully prescribed by CONTEXT.md (D-01..D-14): an additive optional `deployMeta?(opts): DeployMeta` method on the `Template<TOpts>` interface (mirroring how Phase 2 added `runWizard?`/`generate?`), a normalized chain-agnostic `DeployMeta` descriptor, and composable per-section `(meta) => string` renderers assembled into the final Markdown. The deploy-doc write slots into `src/commands/create.ts` after compile-verify, gated on `tpl.deployMeta` being present, and respects the existing overwrite gate for both files.

The single highest-risk technical detail is **constructor-argument ordering**, which changes drastically with the access-control mode. I generated every constructor signature empirically from the installed `@openzeppelin/wizard@0.10.8` (the same package `generate.ts` calls), so the deploy commands can interpolate the exact `--constructor-args` the user's options produce. The Foundry and Etherscan snippet shapes were verified against current official Foundry docs (`forge create` now requires `--broadcast` to actually deploy; `forge verify-contract` takes ABI-encoded constructor args via `cast abi-encode`). The Remix "deep-link import of a local file" is **not feasible** — the honest path is "open remix.ethereum.org, create the file, paste."

On D-03 (refactor vs duplicate centralization warnings): **recommend a hybrid — extract a shared `centralizationWarnings(meta)` in `src/deploy/warnings.ts` as the single source of computation, but have the wizards CALL it rather than re-deriving warnings inline.** The wizard warnings are currently plain inline `io.output.warn("...")` string literals coupled only to the boolean flags — they are NOT deeply entangled with the wizard's control flow, so extraction is low-risk and yields one source of truth (the structural guarantee CONTEXT calls "not copy-paste-and-hope"). A test enforces byte-equality regardless.

**Primary recommendation:** Build `src/deploy/` with `types.ts` (DeployMeta, CentralizationWarning), `warnings.ts` (shared computation), `sections/*.ts` (one renderer per D-04 section, keyed by `meta.chain`), and `index.ts` (`generateDeployDoc(meta) => { filename, content }`). Each template adds a `deployMeta(opts)` binding. Wizards call the shared warning function. Constructor args are derived from a per-template + per-access-mode mapping locked against the committed fixtures.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Normalize opts → DeployMeta | Template (per-template `deployMeta()`) | — | Each template knows its own Opts shape; D-01 keeps the deploy generator opts-agnostic |
| Compute centralization warnings | `src/deploy/warnings.ts` (shared) | Wizard (consumer) | D-03 single source of truth; wizard + DEPLOY.md draw from the same rules |
| Render Markdown sections | `src/deploy/sections/*.ts` (pure `(meta)=>string`) | — | D-04 deterministic composable renderers; chain-keyed for the Phase 7 seam |
| Assemble + name the doc | `src/deploy/index.ts` (`generateDeployDoc`) | — | One assembly point; returns `{ filename, content }` like `generate()` |
| Filename derivation (.DEPLOY.md path) | `src/templates/*/filename.ts` (reuse) | `src/commands/create.ts` | Derive `.sol` path first, then swap suffix; D-07 |
| Overwrite gate (both files) | `src/lib/prompt.ts` (extend) | `src/commands/create.ts` | D-08; check both up front, prompt listing both |
| Dispatcher wiring | `src/commands/create.ts` | — | D-09/D-10; write DEPLOY.md only after .sol compile-verifies |
| Provenance versions | `src/lib/version.ts` (reuse `safeReadVersion`) | header section | D-11; smartc/solc/@oz versions in the doc header |

## Standard Stack

**No new runtime dependencies.** Phase 5 is pure TypeScript string-building over already-installed packages. The "stack" the DEPLOY.md *documents* (Hardhat, Foundry, Remix, Etherscan) is not installed by smartc — those are tools the *user* runs. smartc only emits copy-pasteable commands.

### Already-installed deps this phase touches
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@openzeppelin/wizard` | 0.10.8 [VERIFIED: package.json + runtime probe] | Source of truth for constructor signatures (read indirectly via fixtures, not at runtime) | Same package `generate.ts` already calls |
| `@openzeppelin/contracts` | 5.6.1 [VERIFIED: runtime `safeReadVersion`] | Provenance header version | Pinned, surfaced in `--version` already |
| `solc` | 0.8.35 [VERIFIED: `solc.version()` = `0.8.35+commit.47b9dedd.Emscripten.clang`] | Compiler-version string for Etherscan verify + provenance | Pinned, compile-verify uses it |
| `@clack/prompts` | ^0.11.0 [VERIFIED: package.json] | `confirm` for the (extended) overwrite gate | Already the prompt lib |

### Toolchains the DEPLOY.md documents (NOT installed by smartc)
| Tool | Doc'd command shape | Verified against |
|------|--------------------|------------------|
| Foundry `forge` | `forge create <path>:<Name> --rpc-url --private-key --constructor-args ... --broadcast` | getfoundry.sh/forge/reference/forge-create [CITED] |
| Foundry `forge verify-contract` | `forge verify-contract <addr> <path>:<Name> --constructor-args $(cast abi-encode ...) --compiler-version v0.8.35+commit.47b9dedd --etherscan-api-key --chain` | getfoundry.sh/forge/reference/forge-verify-contract [CITED] |
| Hardhat (classic) | `scripts/deploy.js` + `npx hardhat run scripts/deploy.js --network <net>` | hardhat.org/docs [CITED] |
| Hardhat verify | `npx hardhat verify --network <net> <addr> <ctor-args...>` | hardhat-verify plugin [CITED] |
| Remix | open remix.ethereum.org, create file, paste (NO local deep-link) | remix-ide.readthedocs.io/locations [CITED] |

**Installation:** None. `git`-tracked source changes only.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** new packages. All dependencies it reads (`@openzeppelin/wizard`, `@openzeppelin/contracts`, `solc`, `@clack/prompts`) are already in `package.json` and were verified at runtime in prior phases. No `npm install` step is part of Phase 5.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add optional `deployMeta?(opts: TOpts): DeployMeta` to `Template<TOpts>` (additive, like `runWizard?`/`generate?`). Each EVM template implements it.
- **D-02:** `DeployMeta` is the normalized contract: `{ contractName, chain, standard, constructorArgs[], flags{}, warnings[] }`. The `warnings` array is the SINGLE SOURCE for DEPLOY-06, computed once in `deployMeta()`.
- **D-03:** Centralization warnings computed in one place and reused. Refactor wizard warning logic into shared `centralizationWarnings(meta)` in `src/deploy/warnings.ts`. Fall back to duplication only if the refactor proves invasive.
- **D-04:** Markdown from composable section-renderers, NOT one blob. Sections in order: (1) Header, (2) Centralization Warnings, (3) Pre-Deploy Safety Checklist, (4) Remix, (5) Hardhat, (6) Foundry, (7) Etherscan verify, (8) Constructor args reference. Each is a pure `(meta) => string` in `src/deploy/sections/`.
- **D-05:** Commands are copy-pasteable, parameterized with real contract name + constructor args. Unknowable values marked `<YOUR_RPC_URL>` etc.
- **D-06:** Safety checklist partly static, partly option-derived (Mintable/Pausable/Royalty add conditional items).
- **D-07:** DEPLOY.md named `<ContractName>.DEPLOY.md` alongside the `.sol`, in the same directory. With `--out path/to/Custom.sol` → `path/to/Custom.DEPLOY.md`.
- **D-08:** Overwrite gate covers the DEPLOY.md too. Check both paths up front; prompt once listing both (unless `--force`).
- **D-09:** Deploy-doc write slots into `create.ts` after compile-verify. Flow: `runWizard → generate → compileVerify → [resolve both out paths] → [overwrite gate for both] → writeFile(.sol) → if(tpl.deployMeta) writeFile(DEPLOY.md) → result + nextStep`. Gated on `tpl.deployMeta` present.
- **D-10:** DEPLOY.md written ONLY after the `.sol` compile-verifies (no artifacts on compile failure).
- **D-11:** DEPLOY.md header records provenance via `safeReadVersion`: "Generated by smartc <ver> · solc <ver> · @openzeppelin/contracts <ver> · <date>". This is the attribution home Phase 2 deferred (NOT in the .sol).
- **D-12:** Golden-snapshot DEPLOY.md per template per option-combination under `tests/fixtures/deploy/`. Representative spread, not exhaustive. Plus per-section unit tests.
- **D-13:** Centralization-warning matrix test in `tests/deploy/warnings.spec.ts` asserting the exact warning set per flag combination.
- **D-14:** E2E test extends `tests/commands/create.compile.spec.ts` — assert BOTH `<Name>.sol` AND `<Name>.DEPLOY.md` exist on disk, and DEPLOY.md contains Hardhat/Foundry/Remix headers + the expected warning.

### Claude's Discretion (resolved below with recommendations)

- **Exact `DeployMeta` field names** — finalized in §DeployMeta Design. Keep `flags` keys aligned to Opts names (`mintable`, `burnable`, `pausable`, `access`).
- **Hardhat vs Ignition** — **RECOMMEND classic `scripts/deploy.js` + `npx hardhat run`** (lowest barrier, universal). Document Ignition as a v2 pointer.
- **Foundry style** — **RECOMMEND `forge create` one-liner** with a note pointing at `forge script` for production.
- **Remix** — **RECOMMEND "open remix.ethereum.org, create the file, paste"** (local deep-link import is NOT feasible — see Open Q5). Optionally note the `?code=<base64>` param as an advanced alternative.
- **Section copy / `--newbie`** — **RECOMMEND the DEPLOY.md content is identical regardless of `--newbie`** (the doc is self-contained and explanatory by design; `--newbie` only affects CLI `output.explain` lines).
- **D-03 refactor vs duplicate** — **RECOMMEND hybrid refactor** (shared computation, wizards call it). See §Centralization-Warning Matrix.

### Deferred Ideas (OUT OF SCOPE)

- SPL/Solana deploy sections (DEPLOY-05) — Phase 7 plugs into the chain-keyed registry built here.
- Hardhat Ignition module variant — v2.
- `forge script` production deploy script — v2 (note as a pointer only).
- Automated Etherscan verification from the CLI (broadcasting / calling the API) — explicitly out of scope (TOOL-V2-01); the tool NEVER broadcasts.
- Gas estimation / bytecode size in the DEPLOY.md — future polish.
- Per-chain RPC presets (Polygon/Arbitrum/BSC) — out of scope; note EVM-generic.
- Multisig setup walkthrough — checklist mentions it; actual walkthrough is v2.
- `--no-deploy-doc` flag — defer; Phase 5 always generates the doc for EVM templates.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-01 | DEPLOY.md generated alongside every contract, named to match | §Filenaming (D-07): reuse `contractNameToFilename`, swap `.sol`→`.DEPLOY.md`; dispatcher wiring §Dispatcher Integration |
| DEPLOY-02 | Hardhat deploy commands | §Hardhat Snippet — classic `scripts/deploy.js` + `npx hardhat run` |
| DEPLOY-03 | Foundry (`forge`) deploy commands | §Foundry Snippet — `forge create ... --broadcast` with exact ctor args |
| DEPLOY-04 | "Open in Remix" one-liner | §Remix Path — open + paste instructions (deep-link not feasible) |
| DEPLOY-06 | Auto-disclose centralization warnings from option combo | §Centralization-Warning Matrix + shared `centralizationWarnings()` |
| DEPLOY-07 | Etherscan verification snippets | §Etherscan Verify Snippet — `forge verify-contract` + `npx hardhat verify` |
| DEPLOY-08 | Pre-deploy safety checklist | §Pre-Deploy Safety Checklist — static + option-derived items |

**NOT in this phase:** DEPLOY-05 (SPL deploy commands) is Phase 7. Build the chain-keyed section registry so Phase 7 adds `chain:"solana"` renderers without touching EVM ones — but do NOT implement SPL sections here.

## DeployMeta Design

### Proposed types (`src/deploy/types.ts`)

```typescript
export type DeployChain = "evm" | "solana";
export type DeployStandard = "erc20" | "erc721" | "erc1155" | "spl";
export type AccessMode = "ownable" | "roles" | "none";

/** One constructor parameter, in declaration order, with an example value the
 *  user can copy-paste. Order MUST match the generated .sol constructor exactly. */
export interface ConstructorArg {
  readonly name: string;        // e.g. "recipient", "defaultAdmin", "initialOwner"
  readonly type: string;        // ABI type for cast abi-encode: "address", "uint256", "string"
  readonly exampleValue: string; // a placeholder like "<YOUR_WALLET_ADDRESS>" — never a real secret
}

/** Normalized flag set. Keys align 1:1 with Opts field names (CONTEXT Discretion).
 *  Optional keys are template-specific; the warning + section renderers read them
 *  defensively (absent === false / not applicable). */
export interface DeployFlags {
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  readonly access: AccessMode;        // normalized from `false | "ownable" | "roles"`
  // template-specific (present only on the relevant standard):
  readonly enumerable?: boolean;      // erc721
  readonly royalty?: boolean;         // erc721 (derived from royalty.enabled)
  readonly supply?: boolean;          // erc1155
  readonly updatableUri?: boolean;    // erc1155 (always true — owner-controlled setURI)
  readonly premintNonZero?: boolean;  // erc20 (premint !== "0" — drives `recipient` ctor arg)
}

export type WarningSeverity = "critical" | "info";

export interface CentralizationWarning {
  readonly id: string;       // stable key for tests, e.g. "mintable-ownable"
  readonly severity: WarningSeverity;
  readonly title: string;    // short heading
  readonly body: string;     // the locked warning prose (BYTE-IDENTICAL to wizard output)
}

export interface DeployMeta {
  readonly contractName: string;       // user's raw name (e.g. "MyToken") — used in commands
  readonly chain: DeployChain;
  readonly standard: DeployStandard;
  readonly constructorArgs: readonly ConstructorArg[];
  readonly flags: DeployFlags;
  readonly warnings: readonly CentralizationWarning[];
}
```

### `access` normalization

The Opts `access` field is `false | "ownable" | "roles"`. Map `false → "none"` when building `DeployMeta.flags.access`. This keeps the deploy module from carrying the `false` sentinel.

### Per-template `deployMeta(opts)` mapping (concrete)

**Note:** The contract-name interpolation in commands uses `opts.name` verbatim (e.g. `MyToken`), but the *filename* uses the derived PascalCase (`contractNameToFilename`). For the `<path>:<contractName>` Foundry/verify identifier and the Solidity `contract X` name, OZ uses the raw `opts.name` (the fixtures show `contract MyToken`). Recommendation: use `opts.name` for the contract identifier in commands and the derived filename base for the file path — they coincide for clean PascalCase names. The planner should confirm whether OZ sanitizes `name` into the contract identifier (it does NOT transform e.g. `MyToken`; for names with spaces OZ would error earlier in compile-verify, so by the time `deployMeta` runs the name is a valid identifier).

#### ERC-20 (`src/templates/erc20/deployMeta.ts`)

```typescript
export function deployMetaErc20(opts: Erc20Opts): DeployMeta {
  const access: AccessMode = opts.access === false ? "none" : opts.access;
  const premintNonZero = opts.premint !== "0" && opts.premint !== "";
  const flags: DeployFlags = {
    mintable: opts.mintable, burnable: opts.burnable, pausable: opts.pausable,
    access, premintNonZero,
  };
  return {
    contractName: opts.name, chain: "evm", standard: "erc20",
    constructorArgs: erc20ConstructorArgs(flags),   // see Constructor-Arg Matrix
    flags,
    warnings: centralizationWarnings({ standard: "erc20", flags }),
  };
}
```

#### ERC-721 (`src/templates/erc721/deployMeta.ts`)

```typescript
export function deployMetaErc721(opts: Erc721Opts): DeployMeta {
  const access: AccessMode = opts.access === false ? "none" : opts.access;
  const flags: DeployFlags = {
    mintable: opts.mintable, burnable: opts.burnable, pausable: opts.pausable,
    access, enumerable: opts.enumerable, royalty: opts.royalty.enabled,
  };
  return {
    contractName: opts.name, chain: "evm", standard: "erc721",
    constructorArgs: erc721ConstructorArgs(flags),
    flags,
    warnings: centralizationWarnings({ standard: "erc721", flags }),
  };
}
```

#### ERC-1155 (`src/templates/erc1155/deployMeta.ts`)

```typescript
export function deployMetaErc1155(opts: Erc1155Opts): DeployMeta {
  const access: AccessMode = opts.access === false ? "none" : opts.access;
  const flags: DeployFlags = {
    mintable: opts.mintable, burnable: opts.burnable, pausable: opts.pausable,
    access, supply: opts.supply, updatableUri: true,   // wizard default — always on
  };
  return {
    contractName: opts.name, chain: "evm", standard: "erc1155",
    constructorArgs: erc1155ConstructorArgs(flags),
    flags,
    warnings: centralizationWarnings({ standard: "erc1155", flags }),
  };
}
```

## Constructor-Arg Matrix (EMPIRICAL — the load-bearing finding)

The constructor signature is fully determined by `(standard, premint>0?, access mode, which roles exist)`. I generated every signature from the installed `@openzeppelin/wizard@0.10.8` — the SAME package `generate.ts` calls — so these are exact, not assumed. [VERIFIED: runtime probe of `erc20.print`/`erc721.print`/`erc1155.print`]

### Rules

- **Ownable** adds a single `address initialOwner` (passed to `Ownable(initialOwner)`). For ERC-20 it appears AFTER `recipient` (if premint>0): `(address recipient, address initialOwner)`.
- **AccessControl (roles)** replaces the owner with a sequence of role-holder addresses, in this order: `defaultAdmin`, then `pauser` (only if pausable), then `minter` (only if mintable). ERC-1155 with a URI setter also grants `URI_SETTER_ROLE` but does NOT add a ctor arg for it (the deployer grants it post-deploy; the fixture shows only `defaultAdmin, pauser, minter`).
- **ERC-20 `recipient`** appears as the FIRST arg ONLY when `premint > 0` (the `_mint(recipient, ...)` line). When `premint === "0"` AND no flags AND `access:none`, the constructor is **`constructor()` — ZERO args**.
- **ERC-721 with `access:none`** and no premint has a **no-arg `constructor()`** (just `ERC721(name, symbol)`).
- **ERC-1155** ALWAYS has an owner-ish arg in the no-flags case because the wizard's default `updatableUri:true` injects a setURI requiring `Ownable(initialOwner)` even when `access:false` — the bare fixture shows `constructor(address initialOwner)`. With `access:roles` it becomes `(defaultAdmin, pauser, minter)`.

### Verified signatures

| Standard | premint | access | Flags | Constructor signature | Source |
|----------|---------|--------|-------|----------------------|--------|
| ERC-20 | 0 | none | none | `constructor()` | runtime probe |
| ERC-20 | >0 | none | none | `constructor(address recipient)` | fixture `erc20/bare-default.sol` |
| ERC-20 | >0 | ownable | mintable (+/- pausable/burnable) | `constructor(address recipient, address initialOwner)` | runtime probe |
| ERC-20 | >0 | roles | mintable only | `constructor(address recipient, address defaultAdmin, address minter)` | runtime probe |
| ERC-20 | >0 | roles | mintable+burnable+pausable | `constructor(address recipient, address defaultAdmin, address pauser, address minter)` | fixture `erc20/all-flags-on.sol` |
| ERC-721 | — | none | none | `constructor()` | fixture `erc721/bare-default.sol` |
| ERC-721 | — | ownable | mintable (+/- others) | `constructor(address initialOwner)` | runtime probe |
| ERC-721 | — | roles | mintable+enum+burn+pause (+/- royalty) | `constructor(address defaultAdmin, address pauser, address minter)` | fixtures `erc721/all-flags-on*.sol` |
| ERC-1155 | — | none(→Ownable) | none | `constructor(address initialOwner)` | fixture `erc1155/bare-default.sol` |
| ERC-1155 | — | ownable | any | `constructor(address initialOwner)` | runtime probe |
| ERC-1155 | — | roles | mintable only | `constructor(address defaultAdmin, address minter)` | runtime probe |
| ERC-1155 | — | roles | mintable+burn+supply+pause | `constructor(address defaultAdmin, address pauser, address minter)` | fixture `erc1155/all-flags-on.sol` |

### Reference implementation for the arg builders

```typescript
// All addresses use "<YOUR_WALLET_ADDRESS>" as exampleValue (never a real key).
const ADDR = (name: string): ConstructorArg => ({ name, type: "address", exampleValue: "<YOUR_WALLET_ADDRESS>" });

function rolesArgs(flags: DeployFlags): ConstructorArg[] {
  const out = [ADDR("defaultAdmin")];
  if (flags.pausable) out.push(ADDR("pauser"));
  if (flags.mintable) out.push(ADDR("minter"));
  return out;
}

function erc20ConstructorArgs(flags: DeployFlags): ConstructorArg[] {
  const out: ConstructorArg[] = [];
  if (flags.premintNonZero) out.push(ADDR("recipient"));
  if (flags.access === "ownable") out.push(ADDR("initialOwner"));
  else if (flags.access === "roles") out.push(...rolesArgs(flags));
  return out;   // premint=0 + access=none ⇒ [] ⇒ `constructor()`
}

function erc721ConstructorArgs(flags: DeployFlags): ConstructorArg[] {
  if (flags.access === "ownable") return [ADDR("initialOwner")];
  if (flags.access === "roles") return rolesArgs(flags);
  return [];   // access=none ⇒ no-arg ctor
}

function erc1155ConstructorArgs(flags: DeployFlags): ConstructorArg[] {
  // updatableUri default forces Ownable even at access=none.
  if (flags.access === "roles") return rolesArgs(flags);
  return [ADDR("initialOwner")];   // none OR ownable ⇒ initialOwner
}
```

> **The planner MUST lock these builders against the committed fixtures in a unit test** (parse each fixture's `constructor(...)` arg list, assert it equals `ercXXXConstructorArgs(flagsForThatFixture)`). This is the strongest guard against the #1 pitfall.

## Deploy Snippet Templates

All snippets interpolate `meta.contractName` and the ordered `meta.constructorArgs`. Placeholders the tool can't know are `<YOUR_RPC_URL>`, `<YOUR_PRIVATE_KEY>`, `<KEY>`, `<CHAIN>`, `<DEPLOYED_ADDRESS>`, `<YOUR_WALLET_ADDRESS>` with a one-line note.

### Foundry Snippet (DEPLOY-03) [CITED: getfoundry.sh/forge/reference/forge-create]

`forge create` now requires `--broadcast` to actually deploy (without it the command is a dry-run simulation). Constructor args follow `--constructor-args` and precede `--broadcast`. Contract identifier is `<path>:<Name>`.

```bash
# Deploy with Foundry (forge create). Requires foundry installed (foundryup).
# The contract path assumes you placed the .sol under src/ in a forge project.
forge create src/MyToken.sol:MyToken \
  --rpc-url <YOUR_RPC_URL> \
  --private-key <YOUR_PRIVATE_KEY> \
  --constructor-args <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> \
  --broadcast
```

- The `--constructor-args` list is rendered from `meta.constructorArgs` in order. For a no-arg constructor (e.g. ERC-20 premint=0), **omit the `--constructor-args` line entirely**.
- Note in the doc: "For production, prefer a versioned `forge script` deploy script — see https://getfoundry.sh/forge/deploying" (D-deferred pointer).

### Hardhat Snippet (DEPLOY-02) [CITED: hardhat.org/docs]

**RECOMMEND classic script** (lowest barrier; Ignition is newer and not universal). Render a `scripts/deploy.js` with the contract name + an `ethers` deploy call passing the ordered args, then the run command.

```javascript
// scripts/deploy.js — classic Hardhat deploy script.
const hre = require("hardhat");

async function main() {
  const MyToken = await hre.ethers.getContractFactory("MyToken");
  // Constructor args in order: recipient, defaultAdmin, pauser, minter
  const contract = await MyToken.deploy(
    "<YOUR_WALLET_ADDRESS>", // recipient
    "<YOUR_WALLET_ADDRESS>", // defaultAdmin
    "<YOUR_WALLET_ADDRESS>", // pauser
    "<YOUR_WALLET_ADDRESS>"  // minter
  );
  await contract.waitForDeployment();
  console.log("Deployed to:", await contract.getAddress());
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
```

```bash
npx hardhat run scripts/deploy.js --network <NETWORK_NAME>
```

- For a no-arg constructor, `MyToken.deploy()` with no args.
- Note: "Hardhat Ignition is the newer declarative alternative — see https://hardhat.org/ignition (v2)."

### Remix Path (DEPLOY-04) [CITED: remix-ide.readthedocs.io/locations]

**Local-file deep-link import is NOT feasible.** Remix's `#url=` parameter loads a remote URL (GitHub/raw), and `?gist=` loads a gist — neither can reach a file on the user's disk (that requires `remixd`, a local daemon, which is overkill for "the simplest path"). There IS a `?code=<base64>` parameter that loads inline source, but base64-encoding the whole contract into a URL is fragile and not "simplest." The honest, simplest path:

```text
## Deploy via Remix (simplest, no install)

1. Open https://remix.ethereum.org
2. In the File Explorer, create a new file named `MyToken.sol`
3. Paste the contents of your generated `MyToken.sol` into it
4. In the Solidity Compiler tab, select compiler 0.8.35 and click "Compile MyToken.sol"
5. In the Deploy & Run tab, choose your environment (Injected Provider — MetaMask),
   enter the constructor arguments (recipient, defaultAdmin, pauser, minter), and click Deploy
```

- The constructor-args list shown in step 5 is rendered from `meta.constructorArgs`.
- OPTIONAL advanced note: "Power users can pre-load the source via `https://remix.ethereum.org/?code=<base64-of-source>` but the copy-paste path above is the simplest."

### Etherscan Verify Snippet (DEPLOY-07) [CITED: getfoundry.sh/forge/reference/forge-verify-contract]

Two shapes — Foundry and Hardhat. The compiler version is the FULL solc string `v0.8.35+commit.47b9dedd` (Etherscan requires the commit hash). [VERIFIED: `solc.version()` runtime probe]

Foundry — constructor args must be ABI-encoded via `cast abi-encode`:

```bash
# Verify on Etherscan (Foundry). Needs an Etherscan API key.
forge verify-contract <DEPLOYED_ADDRESS> src/MyToken.sol:MyToken \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS>) \
  --compiler-version v0.8.35+commit.47b9dedd \
  --etherscan-api-key <KEY> \
  --chain <CHAIN>
```

- The `constructor(...)` type list is `meta.constructorArgs.map(a => a.type).join(",")`.
- For a no-arg constructor, **omit the `--constructor-args` line**.

Hardhat — pass raw constructor args (the plugin ABI-encodes internally):

```bash
# Verify on Etherscan (Hardhat). Needs @nomicfoundation/hardhat-verify configured.
npx hardhat verify --network <NETWORK_NAME> <DEPLOYED_ADDRESS> \
  "<YOUR_WALLET_ADDRESS>" "<YOUR_WALLET_ADDRESS>" "<YOUR_WALLET_ADDRESS>" "<YOUR_WALLET_ADDRESS>"
```

### Pre-Deploy Safety Checklist (DEPLOY-08)

**Static items (always present):**

```markdown
## Pre-Deploy Safety Checklist

- [ ] Review the owner / admin address — whoever holds it controls privileged functions.
- [ ] Deploy to a public testnet (e.g. Sepolia) and exercise every function before mainnet.
- [ ] For any privileged role, set up a multisig (e.g. Safe) instead of a single EOA key.
- [ ] Have the contract audited before it holds real value.
- [ ] Double-check the constructor arguments below — they are baked in at deploy time and cannot be changed without redeploying.
- [ ] Never paste a private key that controls real funds into a shell or script you didn't write.
```

**Option-derived items (appended based on `meta.flags`):**

| Condition | Appended checklist item |
|-----------|------------------------|
| `mintable` | `- [ ] Confirm who holds mint authority (MINTER_ROLE / owner) — they can mint unlimited supply.` |
| `pausable` | `- [ ] Confirm who can pause — they can freeze all transfers.` |
| `royalty` (erc721) | `- [ ] Confirm the royalty recipient address and basis points are correct — the owner can change them post-deploy via _setDefaultRoyalty.` |
| `updatableUri` (erc1155, always) | `- [ ] Confirm who can change the token URI — by default the owner can rewrite metadata at any time. Freeze ownership or use a multisig if metadata must be immutable.` |
| `access === "ownable"` | `- [ ] This contract uses Ownable — a SINGLE key controls all privileged functions. Consider AccessControl or transferring ownership to a multisig.` |
| `access === "roles"` | `- [ ] This contract uses AccessControl — confirm each role (DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE) is granted to the intended address.` |

## Centralization-Warning Matrix

### Existing wizard warnings (read from source)

The current warnings are **inline `io.output.warn("literal string")` calls** at the end of each wizard's `runWizard`, gated only on the boolean flags + `access === "ownable"`. They are NOT entangled with the wizard's prompt flow — each is a self-contained conditional emitting a string. This is what makes the D-03 refactor low-risk.

| Template | Condition | Exact current warning text (BYTE-LOCKED) | Source |
|----------|-----------|-------------------------------------------|--------|
| erc20 | `mintable && access==="ownable"` | `Mintable + Ownable: a single key can mint unlimited tokens. Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.` | `erc20/wizard.ts:145-150` |
| erc721 | `mintable && access==="ownable"` | `Mintable + Ownable: a single key can mint unlimited NFTs. Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.` | `erc721/wizard.ts:219-224` |
| erc721 | `royalty.enabled && access==="ownable"` | `EIP-2981 + Ownable: the contract owner can change the royalty recipient at any time via _setDefaultRoyalty. Marketplaces may distrust royalty signals from single-key-controlled contracts.` | `erc721/wizard.ts:225-230` |
| erc721 | `pausable && access==="ownable"` | `Pausable + Ownable: a single key can halt all NFT transfers. Consider AccessControl (multi-role) or a multisig owner.` | `erc721/wizard.ts:231-236` |
| erc1155 | `mintable && access==="ownable"` | `Mintable + Ownable: a single key can mint unlimited quantities of any token id. Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.` | `erc1155/wizard.ts:148-153` |
| erc1155 | `pausable && access==="ownable"` | `Pausable + Ownable: a single key can halt all transfers across every token id. Consider AccessControl (multi-role) or a multisig owner.` | `erc1155/wizard.ts:154-159` |
| erc1155 | ALWAYS (updatableUri default) | `ERC-1155 default-URI setter is owner-controlled (wizard default updatableUri:true). The contract owner can change the URI template at any time. Use a multisig owner or freeze ownership before launch if metadata must be immutable.` | `erc1155/wizard.ts:162-165` |

**Important observations:**
1. All current warnings fire ONLY when `access === "ownable"` (except the erc1155 always-on URI warning). The `roles` case currently has NO wizard warning. For the DEPLOY.md, the planner should decide whether to ADD a "roles" framing warning (CONTEXT D-13 mentions "roles → multiple addresses hold privileged roles" framing). **RECOMMEND adding a roles-mode info warning** to the shared module for the DEPLOY.md, and optionally surfacing it in the wizard too — but flag this as a *behavior addition* to the wizard, so the planner must decide whether to keep wizard parity or let the DEPLOY.md carry extra `info`-severity warnings the wizard doesn't. **Safest: the shared function returns the full set; the wizard emits only the `critical`-severity ones to preserve current wizard behavior byte-for-byte, while the DEPLOY.md renders all of them.** This keeps the wizard's current output unchanged AND gives one source of truth.

### REFACTOR-vs-DUPLICATE recommendation: **HYBRID REFACTOR**

**Recommendation: extract `centralizationWarnings(meta)` into `src/deploy/warnings.ts` as the single computation, and have each wizard CALL it** (emitting the `critical` subset via `output.warn`). Rationale:

- The warnings are plain string literals gated on booleans — extraction touches only the ~7 `output.warn(...)` blocks, not the prompt flow. Blast radius is small (well within CONTEXT's "more than the warning-emitting lines" fallback threshold).
- One source of truth makes DEPLOY-06's guarantee structural, exactly as CONTEXT §Specifics demands.
- The wizard keeps byte-identical *visible* behavior by emitting only `severity === "critical"` warnings (which are precisely today's set). The DEPLOY.md renders the full set (including any new `info` roles framing).
- A test asserts the DEPLOY.md warning bodies are byte-identical to the wizard's emitted strings (CONTEXT §Specifics: "the warning TEXT must be identical").

**Fallback (if the planner finds the refactor invasive after reading the wizard code):** duplicate the exact strings in `warnings.ts`, leave wizards untouched, and add a test that asserts the duplicated strings equal the wizard literals (import both, `expect(deployWarning.body).toBe(wizardLiteral)`). Given the actual structure observed, the hybrid refactor is clearly viable — duplication is the safety net, not the plan.

### Warning matrix for the DEPLOY.md (what `centralizationWarnings(meta)` returns)

| Standard | Flags | Warning IDs returned |
|----------|-------|---------------------|
| any | `mintable && access==="ownable"` | `mintable-ownable` (critical) |
| any | `pausable && access==="ownable"` | `pausable-ownable` (critical) |
| erc721 | `royalty && access==="ownable"` | `royalty-ownable` (critical) |
| erc1155 | always | `erc1155-uri-owner` (critical) |
| any | `access==="roles"` (mintable\|\|pausable) | `roles-multi-key` (info) — NEW, DEPLOY.md only unless planner opts into wizard parity |
| any | no flags / access==="none" | `[]` (no centralization risk to disclose) |

## Architecture Patterns

### System Architecture Diagram

```
                          smartc create --template <id>
                                      |
                                      v
                          [ runWizard(io) -> opts ]
                                      |
                                      v
                       [ generate(opts) -> {filename, source} ]   (existing)
                                      |
                                      v
                       [ compileVerify(source, chain) ]           (existing, D-10 gate)
                              compile FAILS? -> throw, write NOTHING
                                      | (compiles)
                                      v
                resolve .sol outPath  +  derive .DEPLOY.md path (swap suffix)
                                      |
                                      v
              [ overwrite gate: if EITHER exists -> confirm (lists both) ]  (D-08)
                                      |
                                      v
                       writeFile(outPath, source)                  (existing)
                                      |
                          tpl.deployMeta present?  --- no --> done (no DEPLOY.md)
                                      | yes (D-09)
                                      v
                  meta = tpl.deployMeta(opts)        (per-template normalize)
                                      |
                                      v
        generateDeployDoc(meta):                                   (NEW src/deploy/index.ts)
            warnings = centralizationWarnings(meta)  <-- shared, also used by wizard (D-03)
            content  = sectionsFor(meta.chain).map(render => render(meta)).join("\n")
            return { filename: `${base}.DEPLOY.md`, content }
                                      |
                                      v
                       writeFile(deployPath, content)
                                      |
                                      v
                       output.result + nextStep (mention DEPLOY.md)
```

### Recommended Project Structure (NEW `src/deploy/`)

```
src/deploy/
├── index.ts            # generateDeployDoc(meta): { filename, content }
├── types.ts            # DeployMeta, ConstructorArg, DeployFlags, CentralizationWarning
├── warnings.ts         # centralizationWarnings(meta): CentralizationWarning[]  (D-03 shared)
├── ctorArgs.ts         # erc20/erc721/erc1155 ConstructorArg builders (the matrix)
├── sections/
│   ├── index.ts        # sectionsFor(chain): Array<(meta)=>string>  (chain-keyed registry — Phase 7 seam)
│   ├── header.ts       # provenance header (D-11)
│   ├── warnings.ts     # centralization warnings section (D-06)
│   ├── checklist.ts    # pre-deploy safety checklist (D-08)
│   ├── remix.ts        # DEPLOY-04
│   ├── hardhat.ts      # DEPLOY-02
│   ├── foundry.ts      # DEPLOY-03
│   ├── etherscan.ts    # DEPLOY-07
│   └── constructorArgs.ts  # constructor args reference table (D-04 section 8)
└── README.md           # module contract notes

src/templates/erc20/deployMeta.ts      # deployMetaErc20(opts) — new file per template
src/templates/erc721/deployMeta.ts
src/templates/erc1155/deployMeta.ts
```

### Pattern 1: Chain-keyed section registry (the Phase 7 seam)
**What:** `sectionsFor(chain)` returns an ordered array of `(meta) => string` renderers. EVM and Solana have different section sets.
**When to use:** Assembling the doc body. Phase 7 adds a `"solana"` branch returning SPL/Anchor/Solscan renderers without touching EVM ones.
**Example:**
```typescript
// src/deploy/sections/index.ts
import { header } from "./header.js";
import { warningsSection } from "./warnings.js";
import { checklist } from "./checklist.js";
import { remix } from "./remix.js";
import { hardhat } from "./hardhat.js";
import { foundry } from "./foundry.js";
import { etherscan } from "./etherscan.js";
import { constructorArgsSection } from "./constructorArgs.js";

type Section = (meta: DeployMeta) => string;
const EVM_SECTIONS: Section[] = [
  header, warningsSection, checklist, remix, hardhat, foundry, etherscan, constructorArgsSection,
];
export function sectionsFor(chain: DeployChain): Section[] {
  if (chain === "evm") return EVM_SECTIONS;
  // Phase 7: if (chain === "solana") return SOLANA_SECTIONS;
  throw new Error(`No deploy sections registered for chain '${chain}'`);
}
```

### Pattern 2: Pure section renderer
```typescript
// src/deploy/sections/foundry.ts
export function foundry(meta: DeployMeta): string {
  const id = `src/${meta.contractName}.sol:${meta.contractName}`;
  const argLine = meta.constructorArgs.length
    ? `  --constructor-args ${meta.constructorArgs.map(a => a.exampleValue).join(" ")} \\\n`
    : "";
  return [
    "## Deploy via Foundry",
    "```bash",
    `forge create ${id} \\`,
    "  --rpc-url <YOUR_RPC_URL> \\",
    "  --private-key <YOUR_PRIVATE_KEY> \\",
    argLine ? argLine.trimEnd() : null,
    "  --broadcast",
    "```",
  ].filter(Boolean).join("\n");
}
```

### Anti-Patterns to Avoid
- **One giant template string with `${}` interpolation for the whole doc** — violates D-04 (composable renderers). Each section is its own pure function so they're independently testable.
- **Re-deriving warnings in the deploy module separately from the wizard** — violates D-03 single-source. Use the shared function.
- **Hard-coding the constructor arg COUNT instead of deriving from the matrix** — the #1 footgun. Always build args from `meta.flags` via the verified builders.
- **Putting the smartc attribution header in the `.sol`** — CONTEXT §Specifics: the `.sol` stays byte-for-byte OZ output; attribution lives in the DEPLOY.md (D-11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constructor signature derivation | A parser that reads the generated `.sol` and extracts ctor args at runtime | The verified `ctorArgs.ts` builders, locked to fixtures by test | Parsing Solidity is fragile; the flag→args mapping is deterministic and proven |
| Reading dep versions for provenance | New version-reading code | `safeReadVersion("solc")` / `safeReadVersion("@openzeppelin/contracts")` (Phase 1) | Already handles `exports`-map edge cases; tested |
| Filename derivation | New PascalCase logic for `.DEPLOY.md` | `contractNameToFilename` then swap `.sol`→`.DEPLOY.md` | Single source; already tested |
| Overwrite prompt | A new confirm dialog | Extend `confirmOverwrite` (see Open Q9) | Consistent UX + `--force` + `E_FILE_EXISTS` handling |
| ABI-encoding constructor args for the user | Encoding it ourselves | Emit `cast abi-encode "constructor(...)" ...` in the verify snippet | The user runs `cast`; the tool never encodes/broadcasts (out of scope) |

**Key insight:** Phase 5 is a *documentation generator*, not a deployment tool. Everything that would require executing or encoding (broadcasting, ABI-encoding, key handling) is deliberately delegated to the copy-pasteable commands the user runs. smartc's job is to emit the *correct* commands.

## Common Pitfalls

### Pitfall 1: Constructor-arg ordering across Ownable/AccessControl variants
**What goes wrong:** The deploy command passes the wrong number or order of args, so `forge create` / `hardhat run` reverts or deploys with swapped addresses.
**Why it happens:** The constructor signature is NOT fixed per template — it changes with `(premint>0?, access mode, which flags)`. Ownable adds `initialOwner`; roles adds `defaultAdmin` + conditionally `pauser` + conditionally `minter`. ERC-20 prepends `recipient` only when premint>0. ERC-20 premint=0 + no flags has a ZERO-arg constructor.
**How to avoid:** Use the verified `ctorArgs.ts` builders (above). Lock them to the committed fixtures with a test that parses each fixture's `constructor(...)` arg list and asserts equality.
**Warning signs:** A DEPLOY.md `--constructor-args` count that differs from the `.sol` constructor; a roles contract showing an `initialOwner` arg (it should show `defaultAdmin`).

### Pitfall 2: ERC-1155 always has an owner arg even with no flags
**What goes wrong:** Treating ERC-1155 like ERC-20/721 (no-arg ctor when no flags) produces a deploy command missing `initialOwner`.
**Why it happens:** The wizard's default `updatableUri:true` injects an owner-controlled `setURI`, forcing `Ownable(initialOwner)` even at `access:false`. Verified: `erc1155/bare-default.sol` is `constructor(address initialOwner)`.
**How to avoid:** `erc1155ConstructorArgs` returns `[initialOwner]` for both `none` and `ownable`.

### Pitfall 3: Stale / short solc version in the Etherscan verify snippet
**What goes wrong:** `--compiler-version 0.8.35` (short) fails Etherscan verification — it wants the full `v0.8.35+commit.47b9dedd`.
**Why it happens:** Etherscan matches the exact compiler build, including the commit hash.
**How to avoid:** Read the full string from `solc.version()` (`0.8.35+commit.47b9dedd.Emscripten.clang`) and render `v0.8.35+commit.47b9dedd`. Strip the `.Emscripten.clang` suffix; keep the `+commit.<hash>`. Drive it off the runtime probe, not a hardcoded literal, so it stays in sync if solc is bumped.

### Pitfall 4: `forge create` dry-run silently does nothing
**What goes wrong:** A user copies the command, it "succeeds," but no contract is deployed.
**Why it happens:** Current `forge create` is a dry-run WITHOUT `--broadcast`.
**How to avoid:** Always include `--broadcast` in the rendered command (and a one-line note explaining it).

### Pitfall 5: Assuming a Remix local-file deep-link exists
**What goes wrong:** Generating a `https://remix.ethereum.org/#url=file://...` link that doesn't work.
**Why it happens:** Remix `#url=` only loads remote HTTP(S) URLs; local files require the `remixd` daemon.
**How to avoid:** Use the "open + paste" instructions. Optionally mention `?code=<base64>` as advanced.

### Pitfall 6: Warning text drift between wizard and DEPLOY.md
**What goes wrong:** DEPLOY-06's "structural guarantee" silently breaks when someone edits the wizard string but not the doc string (or vice versa).
**How to avoid:** The hybrid refactor (shared `centralizationWarnings`) makes drift impossible. If duplicating, add a test asserting `expect(deployWarning.body).toBe(wizardLiteral)`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.6 [VERIFIED: package.json devDependencies] |
| Config file | (vitest auto-config; tests under `tests/**/*.spec.ts`) |
| Quick run command | `npx vitest run tests/deploy` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | `<Name>.DEPLOY.md` written alongside `<Name>.sol` | e2e | `npx vitest run tests/commands/create.compile.spec.ts` | extend existing |
| DEPLOY-02 | Hardhat section present + correct ctor args | unit | `npx vitest run tests/deploy/sections.spec.ts` | ❌ Wave 0 |
| DEPLOY-03 | Foundry `forge create ... --broadcast` + correct ctor args | unit | `npx vitest run tests/deploy/sections.spec.ts` | ❌ Wave 0 |
| DEPLOY-04 | Remix open+paste instructions present | unit | `npx vitest run tests/deploy/sections.spec.ts` | ❌ Wave 0 |
| DEPLOY-06 | Warning set matches flag combo; byte-identical to wizard | unit | `npx vitest run tests/deploy/warnings.spec.ts` | ❌ Wave 0 (D-13) |
| DEPLOY-07 | Etherscan verify (forge + hardhat) w/ full solc version | unit | `npx vitest run tests/deploy/sections.spec.ts` | ❌ Wave 0 |
| DEPLOY-08 | Static + option-derived checklist items | unit | `npx vitest run tests/deploy/sections.spec.ts` | ❌ Wave 0 |
| (ctor matrix) | builders match committed fixtures | unit | `npx vitest run tests/deploy/ctorArgs.spec.ts` | ❌ Wave 0 |
| (golden) | full DEPLOY.md matches committed snapshot | snapshot | `npx vitest run tests/deploy/golden.spec.ts` | ❌ Wave 0 (D-12) |

### Golden-snapshot fixtures (D-12)
Committed under `tests/fixtures/deploy/`, representative spread (NOT exhaustive):
- `erc20-bare.DEPLOY.md` — premint>0, no flags, no access → `constructor(address recipient)`
- `erc20-all-flags.DEPLOY.md` — mintable+burnable+pausable+roles → 4-arg ctor
- `erc721-all-flags-with-royalty.DEPLOY.md` — all flags + royalty + roles
- `erc1155-all-flags.DEPLOY.md` — all flags + roles

Each golden test reads the corresponding committed `.sol` fixture's opts, runs the full `generateDeployDoc(deployMeta(opts))`, and `toMatchFileSnapshot` / `toBe` against the committed `.DEPLOY.md`.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/deploy`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/deploy/ctorArgs.spec.ts` — locks the constructor-arg builders against committed `.sol` fixtures (highest-priority guard)
- [ ] `tests/deploy/warnings.spec.ts` — DEPLOY-06 / D-13 warning matrix + wizard byte-equality
- [ ] `tests/deploy/sections.spec.ts` — per-section content assertions (DEPLOY-02/03/04/07/08)
- [ ] `tests/deploy/golden.spec.ts` — D-12 golden snapshots
- [ ] `tests/fixtures/deploy/*.DEPLOY.md` — 4 committed golden files
- [ ] extend `tests/commands/create.compile.spec.ts` — D-14 dual-file existence + content (add mocks for an all-flags run to exercise warnings)
- [ ] Framework install: none — vitest already present

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` (treat as enabled). Phase 5 writes a Markdown doc; the security surface is what the doc *advises* and the secrets it must NEVER embed.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in a static doc generator |
| V5 Input Validation | yes | Contract name + opts already validated by the wizard (Phase 2/4 validators); `deployMeta` reads only validated opts. No new untrusted input. |
| V6 Cryptography | yes (by omission) | The tool NEVER handles private keys. Snippets use `<YOUR_PRIVATE_KEY>` placeholders ONLY. Never render a real key or seed. |
| V7 Error Handling | yes | Overwrite gate uses existing `CliError(E_FILE_EXISTS)`; no secrets in error messages |
| V12 Files & Resources | yes | Path resolution reuses Phase 1 `path.resolve` + overwrite gate; never writes outside the user-chosen dir |

### Known Threat Patterns for a deploy-doc generator

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Embedding a real private key in the rendered command | Information Disclosure | Hard rule: example values are placeholders (`<YOUR_PRIVATE_KEY>`, `<YOUR_WALLET_ADDRESS>`). A test greps the golden fixtures for `0x`-prefixed 64-hex strings and fails if any appear. |
| Wrong constructor args → user deploys a contract with attacker-controllable admin | Tampering / Elevation | The ctor-args matrix is fixture-locked; warnings explicitly tell the user to verify the admin address before deploy (checklist DEPLOY-08). |
| Doc advises an unsafe path (single-key mint) without disclosure | Repudiation / trust | DEPLOY-06 centralization warnings auto-fire for the user's exact combo; this is the core safety feature, not an afterthought. |
| Path traversal via `--out` | Tampering | Reuse existing path resolution + overwrite gate; do not introduce new path joins beyond suffix-swap on the already-resolved `.sol` path. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `forge create` deploys by default | `forge create` is a dry-run unless `--broadcast` | Foundry 2024+ | MUST include `--broadcast` in the snippet |
| Hardhat classic `scripts/deploy.js` only | Hardhat Ignition is the *recommended* declarative system (but classic scripts fully supported) | Hardhat 2.22+/Hardhat 3 | Use classic for v1 (lowest barrier); note Ignition as v2 |
| Etherscan accepts short solc version | Etherscan matches full `v<ver>+commit.<hash>` | longstanding | Render the full compiler string |
| Remix `remixd` for local files | Still requires the daemon; no URL deep-link for local files | longstanding | Use open+paste instructions |

**Deprecated/outdated:**
- `forge create` without `--broadcast` as a deploy command — now a no-op simulation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OZ wizard uses `opts.name` verbatim as the Solidity `contract X` identifier (no transform) | DeployMeta Design | If OZ sanitizes names, the `<path>:<Name>` identifier in commands could mismatch. LOW — fixtures confirm `contract MyToken` from `name:"MyToken"`; planner should confirm for non-trivial names (but compile-verify would have already rejected invalid identifiers). |
| A2 | Adding a roles-mode `info` warning to the DEPLOY.md (not currently in the wizard) is acceptable scope | Centralization-Warning Matrix | If the planner wants strict wizard parity, the roles warning should be wizard-emitted too or omitted. Resolved by emitting only `critical` to wizard, full set to doc. |
| A3 | Hardhat `npx hardhat verify` syntax (via `@nomicfoundation/hardhat-verify`) is the current plugin shape | Etherscan Verify Snippet | MEDIUM — verified via training + cross-checked with Hardhat docs search; planner can confirm against hardhat.org/hardhat-runner/plugins at planning time. The Foundry verify path is the primary; hardhat verify is secondary. |
| A4 | The user places the `.sol` under `src/` in a forge/hardhat project | Foundry/Hardhat Snippets | LOW — the doc notes this assumption explicitly; the path is a documented convention, not a tool guarantee. |

## Open Questions

1. **Q2 DeployMeta field names** — RESOLVED: see §DeployMeta Design. `flags` keys mirror Opts (`mintable`/`burnable`/`pausable`/`access`) + template-specific (`enumerable`/`royalty`/`supply`/`updatableUri`/`premintNonZero`). `access` normalized `false→"none"`.
2. **Q3 Hardhat vs Ignition** — RESOLVED: classic `scripts/deploy.js` + `npx hardhat run`. Ignition noted as v2 pointer. [CITED: hardhat.org]
3. **Q4 Foundry constructor-args ordering** — RESOLVED: empirically verified against installed wizard + committed fixtures. See §Constructor-Arg Matrix. Wave 0 prototype confirmed coherence for erc20 all-flags (4 args: recipient,defaultAdmin,pauser,minter). [VERIFIED: runtime probe]
4. **Q5 Remix local-file deep-link** — RESOLVED: NOT feasible. `#url=` is remote-only; local files need `remixd`. Use open+paste. [CITED: remix-ide.readthedocs.io/locations]
5. **Q6 Etherscan verify shape** — RESOLVED: `forge verify-contract <addr> <path>:<Name> --constructor-args $(cast abi-encode "constructor(types)" vals) --compiler-version v0.8.35+commit.47b9dedd --etherscan-api-key --chain`; plus `npx hardhat verify`. Full solc version string required. [CITED + VERIFIED]
6. **Q8 Filenaming** — RESOLVED: see §Filenaming below. Reuse `contractNameToFilename`, swap suffix.
7. **Q9 Overwrite gate for two files** — RESOLVED: see §Overwrite Gate below.
8. **D-03 refactor vs duplicate** — RESOLVED: hybrid refactor (shared computation, wizard emits critical subset). See §Centralization-Warning Matrix.

### Filenaming (D-07) — resolved
`contractNameToFilename(name)` returns `<PascalCase>.sol`. Derive the deploy path by swapping the suffix on the RESOLVED `.sol` path (handles `--out`):
```typescript
// after: const outPath = globalOpts.out ?? path.resolve(process.cwd(), filename);
const deployPath = outPath.replace(/\.sol$/i, ".DEPLOY.md");
// Edge: if outPath has no .sol suffix (custom --out without .sol), append: outPath + ".DEPLOY.md"
const deployPath = /\.sol$/i.test(outPath) ? outPath.replace(/\.sol$/i, ".DEPLOY.md") : `${outPath}.DEPLOY.md`;
```
This yields `MyToken.sol → MyToken.DEPLOY.md` and `path/to/Custom.sol → path/to/Custom.DEPLOY.md` (D-07). Recommend a small pure helper `deployDocPath(solPath): string` in `src/deploy/index.ts` so it's unit-testable.

### Overwrite Gate (D-08) — resolved
Current `confirmOverwrite(path, {force})` handles one path. Cleanest extension: add an overload/variant that checks BOTH paths up front and prompts ONCE listing both. Recommended new signature:
```typescript
// src/lib/prompt.ts — additive, keeps single-path version working.
export async function confirmOverwriteMany(
  paths: string[],
  opts: ConfirmOverwriteOpts = {},
): Promise<boolean> {
  if (opts.force) return true;
  const existing = paths.filter((p) => existsSync(p));
  if (existing.length === 0) return true;
  const list = existing.map((p) => `  - ${p}`).join("\n");
  const answer = await confirm({
    message: `These files already exist and will be overwritten:\n${list}\nOverwrite?`,
    initialValue: false,
  });
  if (isCancel(answer) || answer === false) {
    throw new CliError({
      code: ERR_FILE_EXISTS,
      what: `Refused to overwrite ${existing.length} existing file(s).`,
      why: "One or more output paths already exist and you chose not to overwrite.",
      fix: "Re-run with a different --out path, or pass --force to overwrite without prompting.",
    });
  }
  return true;
}
```
Then in `create.ts` step 5: `await confirmOverwriteMany([outPath, deployPath], { force: globalOpts.force })` (move the gate to BEFORE the `.sol` write so it covers both — D-08). Keep `confirmOverwrite` for any single-path callers. Import `existsSync` in `prompt.ts` (currently imported in `create.ts`).

### Dispatcher Integration (D-09/D-10) — resolved
Insert after the compile-verify block (`create.ts` ~line 119) and BEFORE the current single-path overwrite gate:
```typescript
// 4. Resolve BOTH output paths.
const outPath = globalOpts.out ?? path.resolve(process.cwd(), filename);
const deployPath = tpl.deployMeta ? deployDocPath(outPath) : null;

// 5. Overwrite gate — both files up front (D-08).
const targets = deployPath ? [outPath, deployPath] : [outPath];
await confirmOverwriteMany(targets, { force: globalOpts.force });

// 6. Write .sol (only reached after compile-verify — D-10).
await writeFile(outPath, source, "utf8");

// 7. Write DEPLOY.md if the template provides deployMeta (D-09).
if (tpl.deployMeta && deployPath) {
  const meta = tpl.deployMeta(opts);
  const { content } = generateDeployDoc(meta);
  await writeFile(deployPath, content, "utf8");
  output.result(`Wrote ${deployPath}`);
}
```
Note the current code only calls `confirmOverwrite` when `existsSync(outPath)` — `confirmOverwriteMany` internally filters existing, so the `existsSync` pre-check is no longer needed (the function no-ops when nothing exists). Add a `nextStep` mentioning the DEPLOY.md ("Read MyToken.DEPLOY.md for copy-pasteable deploy + verify commands.").

### Provenance header (D-11) — resolved
```typescript
// src/deploy/sections/header.ts
import { safeReadVersion } from "../../lib/version.js";
export function header(meta: DeployMeta): string {
  const smartc = /* readOwnVersion is private; expose or duplicate the read */ "0.1.0";
  const solc = safeReadVersion("solc") ?? "unknown";
  const oz = safeReadVersion("@openzeppelin/contracts") ?? "unknown";
  const date = new Date().toISOString().slice(0, 10);
  return `# Deploy: ${meta.contractName}\n\n` +
    `> Generated by smartc ${smartc} · solc ${solc} · @openzeppelin/contracts ${oz} · ${date}\n`;
}
```
**Note:** `readOwnVersion()` in `version.ts` is NOT exported (only `safeReadVersion` and `formatVersionLine`). The planner should export `readOwnVersion()` (additive) so the header can read smartc's own version, OR pass the version into `generateDeployDoc`. Recommend exporting `readOwnVersion`. **Caveat for golden snapshots:** the `<date>` makes the doc non-deterministic. Recommend injecting a `now: Date` (default `new Date()`) into `generateDeployDoc` so tests can freeze it, OR exclude the date line from snapshot comparison (normalize it). Flag for the planner: deterministic-snapshot requires a fixed date.

## Wave 0 Prototype Confirmation

Ran a Wave-0 probe (`c:\tmp\wave0-deploy-probe.mjs`) building a `DeployMeta` for the erc20 all-flags fixture (roles, 4-arg constructor) and rendering the Foundry + Etherscan sections. Output:

```
## Deploy via Foundry
forge create src/MyToken.sol:MyToken \
  --rpc-url <YOUR_RPC_URL> --private-key <YOUR_PRIVATE_KEY> \
  --constructor-args <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> <YOUR_WALLET_ADDRESS> \
  --broadcast

## Verify on Etherscan
forge verify-contract <DEPLOYED_ADDRESS> src/MyToken.sol:MyToken \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" <4 addrs>) \
  --compiler-version v0.8.35+commit.47b9dedd --etherscan-api-key <KEY> --chain <CHAIN>
```

**Coherence: PASS.** The 4 constructor args (recipient, defaultAdmin, pauser, minter) exactly match the committed `erc20/all-flags-on.sol` constructor `(address recipient, address defaultAdmin, address pauser, address minter)`. The Etherscan `constructor(address,address,address,address)` type list matches the arg count. The compiler-version is the full solc string. This confirms the DeployMeta → section-renderer → command pipeline produces coherent, fixture-accurate output. The probe also confirmed the no-arg edge case: ERC-20 premint=0 + no flags → `constructor()` (renderers must omit `--constructor-args` entirely).

## Environment Availability

> The tools the DEPLOY.md *documents* (forge, hardhat, remix, cast) are NOT smartc dependencies — the user installs them. smartc only emits commands. The ONLY runtime dependencies Phase 5 reads are already installed (verified below).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | ✓ | v22.18.0 | — |
| `@openzeppelin/wizard` | ctor-arg verification (research-time only) | ✓ | 0.10.8 | — |
| `@openzeppelin/contracts` | provenance header | ✓ | 5.6.1 | "unknown" string |
| `solc` | compiler-version string | ✓ | 0.8.35+commit.47b9dedd | "unknown" string |
| `vitest` | tests | ✓ | ^4.1.6 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `safeReadVersion` returns `null` → render "unknown" (matches existing `create.ts` behavior).

## Sources

### Primary (HIGH confidence)
- Runtime probe of installed `@openzeppelin/wizard@0.10.8` (`erc20.print`/`erc721.print`/`erc1155.print`) — constructor signatures for every access/flag combo
- Runtime probe of installed `solc@0.8.35` — `solc.version()` = `0.8.35+commit.47b9dedd.Emscripten.clang`
- Committed fixtures `tests/fixtures/{erc20,erc721,erc1155}/*.sol` — constructor signatures cross-check
- Source files: `src/commands/create.ts`, `src/registry/types.ts`, `src/lib/{version,prompt}.ts`, `src/templates/*/{wizard,opts,generate,filename}.ts`
- getfoundry.sh/forge/reference/forge-create — `forge create` syntax + `--broadcast` requirement
- getfoundry.sh/forge/reference/forge-verify-contract — verify syntax + ABI-encoded ctor args

### Secondary (MEDIUM confidence)
- hardhat.org/docs + hardhat.org/ignition — Ignition is "recommended" but classic scripts fully supported (drives the classic-script default)
- remix-ide.readthedocs.io/locations — Remix URL params (`#url=` remote-only; `?gist=`, `?code=` exist; no local-file deep-link)

### Tertiary (LOW confidence)
- `npx hardhat verify` exact flag shape (`@nomicfoundation/hardhat-verify`) — from training, planner to confirm at planning time (A3)

## Metadata

**Confidence breakdown:**
- Constructor-arg matrix: HIGH — empirically generated from the installed wizard + cross-checked against committed fixtures
- Foundry/Etherscan syntax: HIGH — verified against current official Foundry docs
- Hardhat classic-script choice: HIGH — verified recommendation + lowest-barrier rationale
- Remix path: HIGH — confirmed local deep-link infeasible
- Centralization-warning refactor recommendation: HIGH — based on reading the actual wizard warning code (plain inline strings, low coupling)
- DeployMeta design: HIGH — derived directly from CONTEXT D-02 + the verified Opts shapes
- Hardhat verify exact flags: MEDIUM — cross-checked, but confirm plugin at planning time

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (30 days — stable domain; toolchain syntax changes slowly. Re-verify `forge create`/`verify-contract` flags if Foundry has a major release.)
