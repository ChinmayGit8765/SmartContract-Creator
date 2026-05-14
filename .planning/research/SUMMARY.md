# Project Research Summary

**Project:** SmartContract Creator
**Domain:** Wizard-driven smart contract scaffolding CLI (TypeScript/Node, single-file output, EVM + Solana)
**Researched:** 2026-05-14
**Confidence:** HIGH

## Executive Summary

SmartContract Creator sits in a well-mapped ecosystem. The Solidity side has a definitive precedent (OpenZeppelin Contracts Wizard) that has solved most of the hard architectural and feature-set questions; the Solana side is genuinely greenfield with no equivalent tool, which is both an opportunity and an unknown. The recommended approach is a layered TypeScript CLI using `commander` + `@clack/prompts` for the shell, `solc` (npm package, bundled WASM) for in-process Solidity compile, and `execa` to shell out to `anchor build` for Solana. Templates are built with a programmatic builder (NOT Handlebars on Solidity — `{` collisions make that miserable), exposed through a uniform `TemplatePlugin` interface from day one so adding a fifth template post-v1 is one folder and one registry line.

The single most important architectural commitment is the **compile-verify gate**: no generated source reaches the user's disk until it has been compiled against pinned dependency versions. This is the safety net that makes the whole tool credible — without it, both the templates and (especially) the optional AI flow are unsafe to ship. Every other pitfall mitigation flows from this invariant. The AI customization (`add-feature --ai` via local Ollama) should be treated as strictly post-v1: hallucination (5–21% of LLM-suggested imports don't exist) and prompt injection are both first-class risks, and they require the safety net to already be solid.

Top risks to design around: (1) template engine choice fighting Solidity syntax, (2) version drift from caret ranges destroying reproducibility, (3) Anchor toolchain heaviness and Windows incompatibility forcing graceful degradation, (4) contract-side footguns (default-rugpullable owner mint, missing reentrancy guards, SPL authority defaults) that are the difference between "scaffolded a token" and "scaffolded a rug-pullable token." The `doctor` command and per-option-combination DEPLOY.md warnings are the user-facing levers that make these risks visible.

## Key Findings

### Recommended Stack

A boring, modern TypeScript stack with one in-process compiler (Solidity) and one shell-out compiler (Solana). All versions verified live against npm on 2026-05-14.

**Core technologies:**
- **`commander@14.0.3`** — CLI parsing. Stable, typed generics, ~18ms startup, 35M+ weekly downloads. Right size for a ~4-command CLI; oclif would be overkill.
- **`@clack/prompts@1.4.0`** — Interactive wizard. ESM-native, TS-first, `group()` API designed for wizard flows. Modern 2026 default; what every major `create-*` template uses. Requires Node 20.12+.
- **`solc@0.8.35`** (npm package, NOT `solc-js`) — In-process Solidity compile via bundled Emscripten WASM. Zero toolchain prerequisite for users. Supports Standard JSON I/O.
- **`@openzeppelin/contracts@5.6.1`** — Solidity template imports. Pin exactly. Min pragma 0.8.24.
- **`execa@9.x`** — Spawn `anchor build` with promise interface and structured stdout/stderr capture.
- **`ollama@0.6.3`** — Official Ollama npm client for the post-v1 `add-feature --ai` command. Detect daemon via `GET /api/version` first; list pulled models via `/api/tags`.

**Explicitly NOT recommended:**
- Handlebars / Mustache / EJS templating over `.sol` files — `{{ }}` vs `{` collisions are a maintenance trap.
- `solc-js` (the GitHub project name) — confusingly different from the `solc` npm package; people search for the wrong one.
- The unmaintained `prompts` (terkelg) and `command-exists` packages.
- Caret/tilde version ranges in package.json — exact pinning only, for reproducibility.

**Phase 1 is fully unblocked** — every Solidity-path dependency bundles or installs from npm. No external toolchain required to ship ERC-20/721/1155.

See `.planning/research/STACK.md` for the full version table, alternatives considered, and detection strategies.

### Expected Features

OpenZeppelin Contracts Wizard sets the table-stakes bar for Solidity templates. There is no equivalent for Solana, which means our SPL template is greenfield — biggest unknown, biggest opportunity.

**Must have (table stakes):**
- **Per-template wizard prompts** matching OZ Wizard conventions:
  - **ERC-20:** name, symbol, premint/supply, mintable, burnable, pausable, access control (Ownable / Roles)
  - **ERC-721:** name, symbol, base URI, mintable, enumerable, pausable, burnable, votes, access control
  - **ERC-1155:** URI, mintable, burnable, supply tracking, pausable, access control
  - **SPL:** name, symbol, decimals, mint authority, freeze authority (or null), initial supply, metadata
- **Single-file output** at the user-specified path — no full project scaffolding
- **Compile-verify** before write: contract must compile against pinned OZ/solc versions, or the tool errors out
- **DEPLOY.md generation** alongside the contract with deployment commands and safety warnings
- **`doctor` command** that reports node/solc/anchor/ollama presence and versions
- **Two verbosity modes** (newbie / experienced) toggled by one flag, not two separate UIs
- **Graceful degradation** when Anchor is missing: still emit `lib.rs` + DEPLOY.md, skip compile-verify with a clear message

**Should have (competitive differentiators):**
- **Per-option-combination centralization warnings** inline in DEPLOY.md (e.g., Ownable + Mintable → "single key can mint infinite tokens"). No competitor ships these inline; high-value low-cost win.
- **OpenZeppelin-versions-pinned** approach with a visible "tested against OZ 5.6.1" banner. Builds trust.
- **`list-templates` command** for discoverability.
- **Solana TS-script alternative** to Anchor `lib.rs` (since real-world SPL token creation often uses a TS mint-creation script, not an Anchor program). Decision flagged below.

**Defer (post-v1):**
- **`add-feature --ai` via Ollama** — high risk, isolated subcommand, ship after v1
- **Upgrade proxies** (transparent / UUPS) — subtle storage-layout traps; compile-verify can't catch them
- **Foundry-flavored project scaffolds** — out of scope; we generate one file
- **Etherscan verification automation** — DEPLOY.md instructs but tool doesn't perform
- **Telemetry** — none in v1 (community trust)

**Anti-features (deliberately won't build):**
- Full Hardhat/Foundry/Anchor project scaffolding
- Automated testnet/mainnet deployment from the CLI
- Hosted AI / paid API keys
- Cloud telemetry
- Custom audits or formal verification

See `.planning/research/FEATURES.md` for the full per-template option lists and DEPLOY.md content checklist.

### Architecture Approach

Layered architecture: thin CLI shell → use-case flows → domain services → adapters → infrastructure. Templates are plugins behind a uniform `TemplatePlugin` interface from day one. Both compilers (Solidity in-process, Anchor shell-out) sit behind a common `CompilerAdapter` strategy. AI is dynamic-imported only by the `add-feature` flow so its absence cannot break `smartc create`.

**Major components:**
1. **CLI Shell** (`bin/smartc.ts` + `commands/`) — Commander wiring; dispatch only
2. **Flows** (`flows/`) — Use-case orchestration (`create-flow`, `feature-flow`, `doctor-flow`); takes deps as arguments
3. **Wizard Runner** (`wizard/`) — `@clack` wrapper that runs a prompt schema and returns typed answers
4. **Template Registry + Plugins** (`templates/`) — One folder per template (`erc20/`, `erc721/`, `erc1155/`, `spl/`); each exports prompts, `build()`, deploy-doc generator, required env
5. **Programmatic Builders** (`builders/solidity/`, `builders/rust/`) — `SourceFile` structures + `print()` emission; never Handlebars
6. **Compiler Adapters** (`compile/`) — `solidity.ts` (in-proc) and `anchor.ts` (execa) behind one interface
7. **AI Provider** (`ai/`) — Ollama HTTP client, lazy-imported, isolated from core flows
8. **Env Probe** (`env/`) — Detect installed tools; powers `doctor` command

**Build order:** CLI shell → plugin interface + wizard → SoliditySourceFile + print → ERC-20 (canary) → file writer + create flow (no compile) → Solidity compiler adapter → ERC-721 + ERC-1155 → DEPLOY.md generator → doctor command → Rust builder + SPL template + Anchor adapter → AI provider + add-feature command → polish. Steps 1–5 are a hard sequential chain; 6–12 can largely happen in any order.

See `.planning/research/ARCHITECTURE.md` for the full component diagram, plugin interface, and patterns.

### Critical Pitfalls

1. **Template engine collision with Solidity `{ }`** — Handlebars/Mustache fight Solidity syntax on every block. **Avoid by** using a programmatic builder for the contract source (OZ Wizard's proven approach); template literals only for tiny leaf snippets.
2. **Version drift via caret/tilde ranges** — Caret on `@openzeppelin/contracts` or `solc` will silently move under you and break golden-file diffs. **Avoid by** exact pinning in package.json, golden-file diff CI from day one, single source-of-truth versions module.
3. **AI hallucination + prompt injection in `add-feature`** — 5–21% of LLM-suggested imports don't exist; OWASP LLM01:2025 lists prompt injection as #1 risk. **Avoid by** sandbox-compile-then-write (re-run compiler on AI output before touching disk); rollback on compile fail; structured plan-then-execute prompt; treat user feature-description text as untrusted.
4. **Contract-side rugpull defaults** — Owner + Mintable + no cap = unlimited mint by one key. ~1 in 4 NFT contracts in academic datasets exhibit owner-control backdoor patterns. **Avoid by** fixed-supply defaults; explicit prompts for opt-in to mintable; centralization warnings auto-disclosed in DEPLOY.md per-option-combination; reentrancy guards by default on ERC-721/1155 mint/transfer paths.
5. **SPL authority footguns** — Default `mint_authority` and `freeze_authority` decisions lock users out or permanently expose them. **Avoid by** explicit wizard prompts (null vs single-key vs multisig), no implicit defaults; embed authority risk warnings in DEPLOY.md.
6. **Anchor toolchain heaviness + Windows incompatibility** — Anchor isn't installed by default and is non-uniform across OSes. Tool must fail gracefully when missing, not halfway through. **Avoid by** doctor command before SPL phase (or shipping doctor+SPL together); skip compile-verify on Solana when toolchain absent, emit lib.rs + warning anyway; explicit Windows-CI test matrix.
7. **CLI distribution: shebang, ESM/CJS, Windows paths** — bin script issues are the silent killer of "I tried it and it didn't work." **Avoid by** test the `npm install -g` install on Windows + macOS + Linux in CI from Phase 1; ship as ESM with `"bin"` shebang correctly set.

See `.planning/research/PITFALLS.md` for the full 15-pitfall catalog, "looks done but isn't" checklist, and real-world incident citations.

## Implications for Roadmap

The safety net (Phases 1–3) must land before more templates (5+) and absolutely before AI (Phase 9). Without compile-verify, the whole pipeline is unsafe.

### Phase 1: CLI Foundation + Plugin Interface
**Rationale:** Need invocation, output logger, and the `TemplatePlugin` contract before any template work. Defining the interface up front is free and saves rewrites.
**Delivers:** `smartc --help` works; `TemplatePlugin` interface; `@clack` wizard runner skeleton; output module with newbie/experienced verbosity; empty registry.
**Uses:** `commander`, `@clack/prompts`, TypeScript ESM, `tsup` or `tsc` build.
**Addresses:** Foundation for every feature; verbosity (table stakes); discoverability.
**Avoids:** Two-codepath verbosity drift (Pitfall #2 in PITFALLS.md); plugin interface refactors later.

### Phase 2: ERC-20 Template + Programmatic Builder
**Rationale:** ERC-20 is the simplest template and proves the entire pipeline end-to-end before fanning out. The programmatic builder is the riskiest architectural piece — get it right on the simplest case first.
**Delivers:** `SoliditySourceFile` builder + `print()`; ERC-20 prompt schema; `templates/erc20/` plugin; `smartc create` produces a working `.sol` file; file writer with overwrite guard.
**Implements:** Architecture components 4 (Template Plugin), 5 (Programmatic Builder), 7 (Flows minus compile).
**Avoids:** Template engine collision pitfall by using builders from day one.

### Phase 3: Compile-Verify (Solidity) — The Safety Net
**Rationale:** This is the architectural spine. Every later phase depends on the compile gate being solid. Must come before more templates.
**Delivers:** `CompilerAdapter` interface; `compile/solidity.ts` using in-process `solc`; pinned dependencies via exact versions; import callback resolving `@openzeppelin/contracts` from node_modules; ERC-20 output gated on successful compile; clear error reporting on failure.
**Uses:** `solc@0.8.35`, `@openzeppelin/contracts@5.6.1`.
**Avoids:** Version drift (caret ranges), generation of uncompilable contracts, future AI safety failures.

### Phase 4: ERC-721 + ERC-1155 Templates
**Rationale:** Validates the plugin model by adding two more Solidity templates with no core code changes. If this isn't additive-only, the architecture is wrong and we want to know now.
**Delivers:** Two new template folders, both behind same `TemplatePlugin` interface; compile-verify reused; full Solidity coverage of v1 templates.
**Addresses:** Table-stakes feature set for the Solidity side; NFT (ERC-721) and multi-token (ERC-1155) demand.
**Avoids:** Architectural drift by surfacing core-code changes if any are needed.

### Phase 5: DEPLOY.md Generator + Centralization Warnings
**Rationale:** DEPLOY.md is the highest-value competitive differentiator and is cross-cutting (consumes wizard answers from every template). Doing it here lets it benefit all three Solidity templates immediately.
**Delivers:** `deployDoc(answers, compileResult)` per template; per-option-combination warning rules (Ownable + Mintable, etc.); deploy commands for at least Hardhat + Foundry on Sepolia + mainnet; verification command snippets; safety checklist section.
**Addresses:** Highest-value differentiator from FEATURES.md.
**Avoids:** Rugpullable defaults (Pitfall #4) by inline disclosure.

### Phase 6: Doctor Command + Env Probe
**Rationale:** Standalone; useful before the SPL phase (so users can diagnose Anchor missing); good "ship something useful in isolation" milestone.
**Delivers:** `env/probe.ts`; `smartc doctor` reports node, solc (bundled, always OK), anchor, cargo-build-sbf, ollama daemon health.
**Uses:** `execa`, `hasbin`/`which`.
**Avoids:** Anchor failure mid-flow (Pitfall #6); enables Phase 7 graceful degradation.

### Phase 7: SPL Template + Anchor Adapter
**Rationale:** Solana is its own beast — new builder (`RustSourceFile`), new compiler adapter (`anchor build` via execa), and the open question of how Anchor handles single-file output. Doing it after EVM is fully working means EVM users aren't gated on Solana risk.
**Delivers:** `RustSourceFile` builder; `templates/spl/` plugin with mint/freeze authority prompts; `compile/anchor.ts` adapter (likely generates scratch workspace under the hood); graceful degradation when Anchor not installed; DEPLOY.md for Solana devnet + mainnet-beta.
**Open question to resolve:** Anchor `lib.rs` output vs TypeScript mint-creation script. Recommendation: prototype both at the start of this phase; pick the one that round-trips through compile-verify reliably on at least Linux + macOS.
**Avoids:** SPL authority footguns (Pitfall #5); Anchor toolchain crashes mid-flow.

### Phase 8: CLI Distribution + Cross-Platform CI
**Rationale:** Ship-readiness. Going public on GitHub without `npm install -g` working on Windows is the silent killer. Done late enough that all behavior is stable, early enough that fixing install issues isn't a last-minute panic.
**Delivers:** `package.json` `"bin"` entry + shebang; ESM build with `tsup`; CI matrix (Windows / macOS / Linux × Node 20 / 22); README install + quickstart; license; example outputs in repo.
**Avoids:** Distribution pitfall (Pitfall #7); the "I tried it and it didn't work" silent failure.

### Phase 9: AI add-feature (POST-v1, may slip)
**Rationale:** High risk, isolated, optional. Should not block v1 ship. Dynamic-imported so its absence cannot affect core flows.
**Delivers:** `ai/provider.ts` interface; `ai/ollama.ts` HTTP impl; `commands/add-feature.ts`; sandbox-compile-then-write enforcement; rollback on compile fail; structured plan-then-execute prompt template; prompt injection red-team test suite; default Ollama model recommendation.
**Open question:** Default model recommendation (`qwen2.5-coder:7b` vs `llama3.1:8b` vs current 2026 SOTA local coder) — decide at start of phase based on patch-quality testing.
**Avoids:** AI hallucination & prompt injection (Pitfall #3) via compile gate.

### Phase Ordering Rationale

- **Compile-verify (Phase 3) gates everything else** — it's the safety net. Building ERC-20 before it (Phase 2) is acceptable because Phase 2 produces a file we can throw away; the compile gate is added before more templates fan out.
- **ERC-20 first as canary** — simplest, highest demand, proves architecture without committing to 3 templates' worth of work.
- **DEPLOY.md after all 3 Solidity templates** — single phase covers all three; avoids bolting it onto each template phase.
- **Doctor before SPL** — Solana is the first phase that requires external toolchain detection. Building doctor first means SPL can lean on it for graceful degradation.
- **Distribution before AI** — Ship v1 with the four templates and DEPLOY.md working everywhere. AI is post-v1 polish.
- **AI strictly last** — Hallucination + injection + heavy lazy-load make this the riskiest phase; do it when the safety net is rock-solid.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Compile-verify):** Confirm `solc` npm package can resolve `@openzeppelin/contracts` imports via the import-callback API without local installs; prototype before locking the import-resolution strategy.
- **Phase 7 (SPL):** Open question on Anchor `lib.rs` vs TS mint-script output format. Prototype both at phase start. Real Windows testing for Anchor invocation — flagged MEDIUM confidence in STACK.md.
- **Phase 9 (AI):** Default Ollama model recommendation — defer to phase-start benchmarking; SOTA local coding models shift faster than research cycles.

Phases with standard patterns (skip phase-level research):
- **Phase 1 (CLI Foundation):** Commander + @clack are well-documented; no surprises.
- **Phase 2 (ERC-20 template):** OZ Wizard source is the reference; pattern is established.
- **Phase 4 (ERC-721 + ERC-1155):** Once the plugin model is proven in Phase 2, these are additive.
- **Phase 5 (DEPLOY.md generator):** Markdown generation; no exotic tech.
- **Phase 6 (Doctor):** `execa` + `which` pattern is boring.
- **Phase 8 (Distribution):** Standard `npm install -g` + bin shebang; cross-platform CI matrix is standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every version verified live on npm 2026-05-14. Library choices backed by 2026 ecosystem surveys + download stats. |
| Features | HIGH for EVM (OZ Wizard verified source), MEDIUM for SPL (no canonical equivalent) and DEPLOY.md (no canonical template) |
| Architecture | HIGH for patterns (OZ Wizard precedent confirms builder-over-template), MEDIUM for specific library coupling (could swap clack for inquirer with minimal damage). Anchor single-file compile mechanism is LOW confidence — needs prototype. |
| Pitfalls | HIGH for risk taxonomy (OWASP, EIPs, academic NFT-backdoor study, multiple cited incidents). MEDIUM for specific mitigations like "plan-then-execute" AI prompting (credible but evolving). |

**Overall confidence:** HIGH for the EVM/Solidity path (Phases 1–6, 8); MEDIUM for the Solana path (Phase 7) pending Anchor compile prototype; MEDIUM for AI integration (Phase 9) pending model benchmarking.

### Gaps to Address

- **Anchor single-file compile** — Anchor wants a workspace. Solana adapter will likely generate a tiny throwaway workspace under the hood. Validate at start of Phase 7. If infeasible on Windows specifically, skip compile-verify on Solana there and document.
- **`solc` import callback for OZ contracts** — Confirm callback resolves `@openzeppelin/contracts/...` from `node_modules` or bundled copies without requiring user install. Validate at start of Phase 3.
- **Default local-LLM model for `add-feature`** — Pick based on patch-quality testing at start of Phase 9, not from training data.
- **SPL output format** — Anchor `lib.rs` vs TS mint-creation script. Real-world SPL token creation often uses TS scripts; Anchor program is the "smart contract" framing but heavier toolchain. Decide at Phase 7 start.

## Sources

### Primary (HIGH confidence)
- [OpenZeppelin/contracts-wizard](https://github.com/OpenZeppelin/contracts-wizard) — Verified per-token-type modules (`erc20.ts`, `erc721.ts`, `erc1155.ts`), `print.ts`, modular feature setters. Defines the builder-over-template approach and per-template option lists.
- npm registry verification (live, 2026-05-14): `commander`, `@clack/prompts`, `solc`, `@openzeppelin/contracts`, `ollama`, `execa`.
- [OpenZeppelin Contracts 5.x Docs](https://docs.openzeppelin.com/contracts/5.x/) — Authoritative on Solidity contract patterns + min pragma.
- [Solidity Standard JSON I/O](https://docs.soliditylang.org/en/latest/using-the-compiler.html) — Compile API contract.
- [Anchor GitHub Releases](https://github.com/solana-foundation/anchor/releases) — Anchor 1.0.2 (April-May 2026); removed hard Solana CLI dep.
- [OWASP LLM Top 10 2025](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — Prompt injection as #1 risk.
- [EIPs: 20, 721, 1155, 2981, 2612] — Standard references for contract surface area.

### Secondary (MEDIUM confidence)
- [PkgPulse — Ink vs Clack vs Enquirer 2026](https://www.pkgpulse.com/guides/ink-vs-clack-vs-enquirer-interactive-cli-nodejs-2026) — DX/ecosystem comparison.
- [Anchor SPL Token Basics](https://www.anchor-lang.com/docs/tokens/basics) and [Metaplex Create Token with Anchor](https://developers.metaplex.com/tokens/anchor/create-token) — SPL conventions; no canonical wizard exists.
- [CertiK: What is Centralization Risk](https://www.certik.com/resources/blog/What-is-centralization-risk) — Centralization warning content.
- [Centralization Defects in Smart Contracts (arxiv:2411.10169)](https://arxiv.org/abs/2411.10169) — NFT owner-control backdoor stats.
- Academic AI hallucination studies: arXiv 2506.08837, 2512.05239 — hallucinated import rates.

### Tertiary (LOW confidence — needs validation)
- Exact behavior of `anchor build` against a single-file scratch workspace — needs Phase 7 prototype.
- Windows compatibility of `anchor build` — flagged MEDIUM in STACK.md, validate with real Windows CI.
- Best-in-class local coding LLM for the `add-feature` flow — Ollama-side; pick at Phase 9 start.

---
*Research completed: 2026-05-14*
*Ready for roadmap: yes*
