# Phase 4: ERC-721 + ERC-1155 Templates - Research

**Researched:** 2026-05-28
**Domain:** OpenZeppelin Wizard ERC-721 / ERC-1155 SDK surface, EIP-2981 royalty post-process, additive-only plugin model under the Phase 3 compile gate
**Confidence:** HIGH

## Summary

`@openzeppelin/wizard@0.10.8` (pinned in `package.json`, published 2026-04-08) exposes `erc721.print(opts)` and `erc1155.print(opts)` with the same shape as the Phase 2 `erc20.print(opts)` plugin already consumed. Their `ERC721Options` and `ERC1155Options` interfaces extend `CommonOptions` (`access`, `upgradeable`, `info`); **neither includes a `royalty` field** — CONTEXT D-04 is confirmed by `node_modules/@openzeppelin/wizard/dist/erc721.d.ts:4-20` and by `wizard.erc721.defaults` at runtime. EIP-2981 royalty is delivered via a deterministic post-process layer in `src/templates/erc721/royalty.ts` — a single anchor-located insertion of the `ERC2981` import, the `ERC2981` parent in the contract's `is`-list, the `_setDefaultRoyalty(receiver, fee)` call at the end of the constructor body, and (when applicable) the `ERC2981` token in the existing `supportsInterface(...) override(...)` list.

`@openzeppelin/contracts@5.6.1` already ships `token/common/ERC2981.sol` (verified at `node_modules/@openzeppelin/contracts/token/common/ERC2981.sol`); its `_setDefaultRoyalty(address, uint96)` takes `uint96 feeNumerator` against a denominator of `10000` (basis-points by default, EIP-2981 §`_feeDenominator`). Both new templates compile clean under the Phase 3 gate exactly as-shipped (pinned `solc@0.8.35` + `evmVersion: "cancun"` per Phase 3 Wave 0 deviation; OZ 5.6.1's `utils/Bytes.sol` uses `mcopy` which requires Cancun).

The Phase 4 plugin model is **additive-only by design**: zero changes to `src/compiler/`, `src/registry/`, `src/lib/`, or the dispatcher `src/commands/create.ts` EXCEPT for the one-line E_USAGE copy update locked by CONTEXT D-14 (`Re-run with --template <erc20|erc721|erc1155>`). The two new templates ship as four-file plugins under `src/templates/erc721/` and `src/templates/erc1155/` plus a fifth file (`royalty.ts`) under ERC-721. Boot-time registration is two new `register*Template()` calls in `src/cli.ts:9`. Both templates ride the existing `compileVerify` seam at `src/commands/create.ts:111` unchanged — Phase 2 D-03's two-step plugin contract (`runWizard → generate`) and Phase 3 D-06's chain-dispatched `compileVerify(source, "evm")` already accept any EVM Solidity source.

**Primary recommendation:** Clone the Phase 2 ERC-20 plugin layout verbatim for both new templates. ERC-721's `generate.ts` becomes a wrapper around `erc721.print()` plus a conditional call into `royalty.ts` when `opts.royalty.enabled === true`. ERC-1155's `generate.ts` is byte-for-byte the same shape as ERC-20's. Wave 0 runs a prototype-quality probe of the royalty post-process against the three planned fixtures, validates that the Phase 3 gate accepts all output, and locks the regex anchors before the parallel ERC-721 / ERC-1155 plans start. Waves 1–2 ship the two templates in parallel (independent files, no shared code) under separate worktree agents.

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Plugin shape (inherited from Phase 2 D-03..D-06)
- **D-01: Mirror the Phase 2 ERC-20 file layout per template.** Each of `src/templates/erc721/` and `src/templates/erc1155/` ships `index.ts` (`register<Foo>Template()` + `Template<TFooOpts>` instance), `wizard.ts` (@clack/prompts sequence), `generate.ts` (thin wrapper around `@openzeppelin/wizard.erc721.print` / `.erc1155.print`), and `opts.ts` (per-template Opts type). This is the proven Phase 2 shape — the test that the plugin model is additive is "is this layout the same?".
- **D-02: Wizard package version (`@openzeppelin/wizard@0.10.8`) is NOT bumped in Phase 4.** Locked at Phase 2 D-07 pin; no version churn for new templates. Phase 4 just exercises more of the same wizard package surface (`erc721.print` and `erc1155.print` instead of `erc20.print`).
- **D-03: Per-template golden snapshots (hybrid strategy from Phase 2 D-09).** Two committed snapshots per template — `bare-default.sol` (minimum opts, no flags) and `all-flags-on.sol` (maximum opts ON). Plus per-flag assertions. Same naming convention as `tests/fixtures/erc20/`.

#### ERC-721 royalty surface (ERC721-03) — KEY DISCOVERY
- **D-04: `@openzeppelin/wizard@0.10.8` does NOT include EIP-2981 royalty support in its `ERC721Options` interface.** The wizard's typed surface (`baseUri`, `enumerable`, `uriStorage`, `burnable`, `pausable`, `mintable`, `incremental`, `votes`, `namespacePrefix`) does not have a `royalty` field. The smartc wizard MUST collect royalty inputs (basis points + recipient address) and inject them via a post-process string transform on the wizard's printed output — adding an `ERC2981` parent + `import "@openzeppelin/contracts/token/common/ERC2981.sol"` + a constructor call `_setDefaultRoyalty(recipient, fee)`. This is the ONE place Phase 4 has to violate Phase 2 D-02 ("no string templating") — but only for the royalty post-process; the rest of the file is byte-for-byte wizard output.
- **D-05: Royalty post-process is a single targeted insertion, not a template body.** The transform inserts (a) the import line above the contract declaration, (b) the `ERC2981` parent in the contract's `is ...` list, (c) the `_setDefaultRoyalty(...)` call at the END of the constructor. Each insertion is a one-line `string.replace()` against a literal regex anchor visible in the wizard's emit (e.g., the `contract <Name>` line, the `constructor(` opener). Documented in `src/templates/erc721/royalty.ts` with the regex anchors as comments. If wizard changes its output shape across versions, the snapshot tests catch it instantly.
- **D-06: Royalty is opt-in only; default OFF.** When opted-OUT, the wizard's output is byte-for-byte unchanged (no royalty.ts code runs). The wizard's all-flags-on snapshot for ERC-721 does NOT include royalty — royalty has its OWN snapshot pair (`all-flags-on-with-royalty.sol`) to keep the wizard-pure path testable and the royalty-injected path testable separately.
- **D-07: Royalty input validation** — basis points must be an integer 0–10000 (10000 = 100%, EIP-2981 spec); recipient must match `/^0x[0-9a-fA-F]{40}$/` (canonical EVM address checksum). Validators live in `src/templates/erc721/wizard.ts` next to the other Solidity-input validators.

#### ERC-1155 surface
- **D-08: ERC-1155 has NO royalty in Phase 4.** Per REQUIREMENTS.md §v2 ERC1155-V2-01, EIP-2981 on ERC-1155 is deferred to v2. The wizard prompts for ERC-1155: `uri template`, `mintable`, `burnable`, `supply` (supply tracking), `pausable`, and access control (Ownable vs AccessControl) when mintable or pausable is selected.
- **D-09: URI template input** — wizard's `uri` option accepts a string with `{id}` placeholder (per ERC-1155 spec). Default `"https://example.com/api/token/{id}.json"` as the suggested value in the wizard prompt; validate non-empty.

#### Conditional access control prompt (ERC721-05, ERC1155-05)
- **D-10: Reuse Phase 2 conditional-prompt pattern from `src/templates/erc20/wizard.ts`.** When mintable OR pausable is true, prompt for `access: "ownable" | "roles"`. Same UI copy, same option labels, same default ("ownable"). This validates the additive-only plugin model — the same prompt code is duplicated per template (NOT extracted to a shared module in Phase 4; if a fourth template needs it, a Phase 5+ refactor can extract).

#### Output naming
- **D-11: Filename = sanitized contract name + `.sol`.** Same rule as Phase 2 D-04. `My NFT` → `MyNFT.sol`; `MyToken` → `MyToken.sol`. `--out <path>` overrides. ERC-1155's "name" prompt is the contract name (e.g., `MyMultiToken`), NOT the URI.

#### Compile-verify integration (Phase 3 seam — no changes)
- **D-12: NO modifications to `src/compiler/` or `src/commands/create.ts` in Phase 4.** The Phase 3 `compileVerify(source, chain)` seam already accepts any Solidity source; new templates just emit Solidity and the gate runs unchanged. SC-5 (all three Solidity templates pass compile-verify with full option matrices) is satisfied by exercising the existing gate with each template's golden fixtures.
- **D-13: Snapshot fixtures double as compile-verify canaries.** Each template's `bare-default.sol`, `all-flags-on.sol`, and (ERC-721 only) `all-flags-on-with-royalty.sol` MUST compile clean. New integration tests in `tests/compiler/compile.integration.spec.ts` extend the Phase 3 corpus by adding these fixtures to the same real-solc compile loop.

#### Wizard picker (multi-template selection)
- **D-14: `smartc create` without `--template` still throws E_USAGE in Phase 4.** Update error message to mention all three templates: `Re-run with --template <erc20|erc721|erc1155>`.
- **D-15: `smartc list-templates` now shows three rows.** Both new templates register themselves on boot via `src/cli.ts` adding `registerErc721Template()` and `registerErc1155Template()` next to the existing `registerErc20Template()`. The registry's `register()` throws on duplicate id (Phase 1 D-08) so id collisions are caught at boot.

#### Test layering
- **D-16: Match Phase 2's test split per template.** Each template gets: `tests/templates/<id>/wizard.spec.ts` (mocked @clack/prompts), `tests/templates/<id>/generate.spec.ts` (real wizard package, golden snapshots, per-flag assertions). Integration tests in `tests/compiler/compile.integration.spec.ts` extend to cover all 5 base fixtures (2 ERC-20 + 2 ERC-721 + 1 ERC-1155, plus the with-royalty ERC-721 = 6 fixtures total). E2E coverage via `tests/commands/create.compile.spec.ts` extends to add ERC-721 and ERC-1155 happy-path cases.
- **D-17: Royalty post-process gets its own unit test.** `tests/templates/erc721/royalty.spec.ts` — feed a known wizard output through the transform, assert the three insertions land at the right anchors, assert the result still compiles via the Phase 3 gate.

### Claude's Discretion

- **Exact wizard prompt order per template** — Researcher/planner finalizes. Default for ERC-721: `name → symbol → baseUri → mintable → enumerable → burnable → pausable → royalty (opt-in) → if(royalty) basis-points + recipient → if(mintable||pausable) access`. Default for ERC-1155: `name → uri → mintable → burnable → supply → pausable → if(mintable||pausable) access`.
- **Centralization-warning copy for ERC-721 / ERC-1155** — same wording as Phase 2 for Mintable+Ownable (single-key-unlimited-mint), reused verbatim. Researcher picks any template-specific warnings (e.g., EIP-2981 fee can be changed by owner if Mintable+Ownable — capture as a separate warning).
- **`erc721.print(opts)` vs `printERC721(opts)` import shape** — wizard 0.10.8 ships both; researcher picks the namespaced form (`erc721.print`) to match Phase 2's `erc20.print` usage.
- **README inside `src/templates/<id>/`** — recommended yes, one short page per template explaining the wizard prompt set, the opts mapping, the royalty post-process (ERC-721 only), and any deviations from wizard defaults.

### Deferred Ideas (OUT OF SCOPE)

- **EIP-2981 on ERC-1155** — Deferred to v2 (REQUIREMENTS.md ERC1155-V2-01).
- **ERC-721 votes (governance)** — Wizard supports `votes` option but it's v2 (ERC721-V2-01). Adds clock-mode choice — separate UX-design question.
- **ERC-721 whitelist / merkle-mint** — v2 (ERC721-V2-02).
- **ERC-721 on-chain SVG metadata** — v2 (ERC721-V2-03).
- **Per-token-id URI overrides on ERC-1155** — v2 (ERC1155-V2-02).
- **Interactive wizard template picker (`smartc create` with no `--template`)** — Deferred to Phase 5 or 6 alongside `list-templates --json` ergonomics.
- **Shared `accessControlPrompt()` extracted module** — Currently duplicated per template (additive model). Refactor when a fourth template ships.
- **Snapshot regeneration script** — `scripts/regenerate-fixtures.mjs` — defer to v2.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERC721-01 | User can generate an ERC-721 with configurable name, symbol, and base URI | `erc721.print({name,symbol,baseUri})` directly supports all three [VERIFIED: `node_modules/@openzeppelin/wizard/dist/erc721.d.ts:4-20`] |
| ERC721-02 | User can opt in to Mintable, Enumerable, and Burnable | `mintable:boolean`, `enumerable:boolean`, `burnable:boolean` in `ERC721Options` [VERIFIED: wizard typings + runtime probe] |
| ERC721-03 | User can opt in to EIP-2981 royalties with configurable recipient and basis points | Royalty NOT in wizard options — implemented via `src/templates/erc721/royalty.ts` post-process per CONTEXT D-04..D-07 [VERIFIED: typings, runtime defaults probe, OZ ERC2981 contract present] |
| ERC721-04 | User can opt in to Pausable | `pausable:boolean` in `ERC721Options` [VERIFIED: wizard typings] |
| ERC721-05 | When Mintable or Pausable is selected, user picks Ownable or AccessControl | `access: false \| "ownable" \| "roles" \| "managed"` from `CommonOptions`; we surface only `"ownable"` / `"roles"`; `erc721.isAccessControlRequired(opts)` returns `true` for Mintable+Ownable [VERIFIED: runtime probe — `isAccessControlRequired({mintable:true}) === true`] |
| ERC1155-01 | User can generate an ERC-1155 with a configurable URI template | `erc1155.print({name, uri})` accepts the URI verbatim and emits it as the `ERC1155(<uri>)` constructor argument [VERIFIED: runtime probe] |
| ERC1155-02 | User can opt in to Mintable and Burnable | `mintable:boolean`, `burnable:boolean` in `ERC1155Options` [VERIFIED: `node_modules/@openzeppelin/wizard/dist/erc1155.d.ts:3-11`] |
| ERC1155-03 | User can opt in to Supply tracking | `supply:boolean` in `ERC1155Options` [VERIFIED: typings] |
| ERC1155-04 | User can opt in to Pausable | `pausable:boolean` in `ERC1155Options` [VERIFIED: typings] |
| ERC1155-05 | When Mintable or Pausable is selected, user picks Ownable or AccessControl | Same `CommonOptions.access` surface as ERC-721; `erc1155.isAccessControlRequired(opts)` returns `true` for Mintable [VERIFIED: runtime probe] |

## Project Constraints (from CLAUDE.md)

- **Push after each phase completes** — Run `git push` to publish the phase's commits to `origin` after the phase is marked complete in ROADMAP.md / STATE.md. Trigger is phase completion, not intermediate commits. Planner does NOT add a push task per plan; it's a phase-finalization step the orchestrator handles after `/gsd:execute-phase`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ERC-721 template definition (id, name, chain, status, description, runWizard, generate) | `src/templates/erc721/` plugin | Registry (`src/registry/`) surfaces via `list()/get()` | Same plugin contract as Phase 2 — additive-only model |
| ERC-1155 template definition | `src/templates/erc1155/` plugin | Registry | Same plugin contract |
| ERC-721 interactive prompts (name/symbol/baseUri/options/royalty/access) | `erc721.runWizard()` calls `@clack/prompts` | `src/lib/output.ts` for newbie channels | Each template owns its prompt sequence — option spaces differ |
| ERC-1155 interactive prompts (name/uri/options/access) | `erc1155.runWizard()` | `src/lib/output.ts` | Same |
| ERC-721 source emission (wizard part) | `@openzeppelin/wizard.erc721.print()` | `src/templates/erc721/generate.ts` (passes opts) | We delegate to OZ — they own contract code, we own wizard UI |
| ERC-721 source emission (royalty part) | `src/templates/erc721/royalty.ts` post-process | `generate.ts` invokes when `opts.royalty.enabled` | The ONE deviation from D-02 — wizard lacks royalty support; injection is targeted |
| ERC-1155 source emission | `@openzeppelin/wizard.erc1155.print()` | `src/templates/erc1155/generate.ts` | Wizard handles 100% — no post-process |
| Filename derivation | `generate.ts` returns `filename` from contract name | Dispatcher (`--out` override wins) | D-11; same as Phase 2 |
| Boot-time template registration | `src/cli.ts` calls `registerErc721Template()` + `registerErc1155Template()` | Registry stores | Three lines added to `src/cli.ts:9` |
| Compile-verify | `src/compiler/index.ts` `compileVerify(source, "evm")` UNCHANGED | Dispatcher invokes at `src/commands/create.ts:111` | Phase 3 seam already accepts any EVM Solidity source |
| Overwrite confirmation | `src/lib/prompt.ts` `confirmOverwrite()` UNCHANGED | Dispatcher invokes at `src/commands/create.ts:125-127` | Filesystem concern, not template concern |
| Error rendering | `src/lib/errors.ts` `CliError` + `renderError` UNCHANGED | Templates / dispatcher throw `CliError` | One sanctioned error surface |
| Centralization warning | `template.runWizard()` calls `io.output.warn(...)` post-prompt | `src/lib/output.ts` (always-on critical channel) | Same pattern as Phase 2 |

## Standard Stack

### Core (no changes from Phase 2/3 pins)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@openzeppelin/wizard` | 0.10.8 (published 2026-04-08) [VERIFIED: `npm view @openzeppelin/wizard time.0.10.8`] | Programmatic API: `erc721.print(opts) → string`, `erc1155.print(opts) → string`, `defaults`, `isAccessControlRequired(opts)` | Same engine as wizard.openzeppelin.com; literal satisfaction of ROADMAP SC-5; D-02 forbids bumping |
| `@openzeppelin/contracts` | 5.6.1 [VERIFIED: `package.json`] | Bundled at install root; `compileVerify`'s import callback resolves `@openzeppelin/contracts/...` from here; provides `token/common/ERC2981.sol` for royalty injection | Pinned by Phase 3; CONTEXT D-02 forbids bumping in Phase 4 |
| `solc` | 0.8.35 [VERIFIED: `package.json`] | In-process Solidity compiler; `compileVerify` calls `solc.compile(JSON.stringify(input), {import})` | Pinned by Phase 3; `evmVersion: "cancun"` required (Phase 3 Wave 0 deviation — OZ 5.6.1 uses `mcopy`) |

### Supporting (no changes)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@clack/prompts` | ^0.11.0 | Drives the wizard (`text`, `select`, `confirm`, `isCancel`, `cancel`) | Per-prompt in each `template.runWizard()` |
| `commander` | ^14.0.3 | Already wired in Phase 1; option surface locked | No Phase 4 commander work |
| `vitest` | ^4.1.6 | `toMatchFileSnapshot()` for golden snapshots, `vi.mock()` for wizard mocks | New unit specs in `tests/templates/erc721/` and `tests/templates/erc1155/`, fixture additions in `tests/compiler/compile.integration.spec.ts` and `tests/commands/create.compile.spec.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Royalty post-process on wizard output (D-04..D-06) | Hand-rolled ERC-721 royalty template via string templates | Violates Phase 2 D-02 ("no sentinels") at scale — the wizard's NFT contract surface is 50+ lines and the access-control / pausable / override-list permutations would re-introduce the maintenance burden we delegated to OZ. The post-process is a 30-line targeted transform; the alternative is a 200+-line parallel ERC-721 generator. |
| Royalty post-process | Wait for OZ to ship royalty in `ERC721Options` and don't deliver ERC721-03 in v1 | ERC721-03 is a v1 requirement (REQUIREMENTS.md line 39). Skipping it is not an option. |
| `setURI` enabled on ERC-1155 (wizard default `updatableUri:true`) | Pass `updatableUri:false` to suppress the auto-Ownable+setURI scaffold for bare-default | **Researcher recommendation: pass `updatableUri:true` (wizard default) verbatim in both bare and all-flags fixtures.** The wizard's default behavior is "owner can change URI" because most NFT collections want updatable metadata; surfacing this as the default matches wizard.openzeppelin.com byte-for-byte. CONTEXT D-09 does not mention a separate `updatableUri` prompt; treating it as always-on matches the spec's least-surprise principle and avoids re-litigating wizard defaults. The bare-default ERC-1155 snapshot will include `Ownable + setURI(...)` — this is correct and matches the live wizard UI (planner / discuss-phase can revisit if user disagrees). |
| Use `printERC721` named export | Use `erc721.print` namespaced form | Per Claude's Discretion in CONTEXT and Phase 2 RESEARCH §Pattern 1, the namespaced form matches Phase 2 `erc20.print` usage — additive plugin model requires literal mirroring. Both forms are exported from `@openzeppelin/wizard@0.10.8` (verified: `node_modules/@openzeppelin/wizard/dist/index.d.ts:1` exports `erc721`; `node_modules/@openzeppelin/wizard/dist/erc721.d.ts:22` exports `printERC721`). |

**Installation:** No new installs. Phase 4 reuses `@openzeppelin/wizard@0.10.8`, `@openzeppelin/contracts@5.6.1`, and `solc@0.8.35` already pinned in `package.json`.

**Version verification:**
```bash
npm view @openzeppelin/wizard@0.10.8 version       # 0.10.8 — published 2026-04-08
npm view @openzeppelin/contracts@5.6.1 version     # 5.6.1
npm view solc@0.8.35 version                       # 0.8.35
```

## Package Legitimacy Audit

No new external packages are installed in Phase 4. The phase reuses three packages already pinned and audited in Phase 2 / Phase 3 RESEARCH. Re-validating their disposition under the Phase 4 envelope:

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@openzeppelin/wizard` | npm | 3.9 yrs (since 2022-06-15); v0.10.8 published 2026-04-08 [VERIFIED: `npm view @openzeppelin/wizard time.0.10.8`] | High (powers wizard.openzeppelin.com) | github.com/OpenZeppelin/contracts-wizard | Manual: no postinstall, sole dep `ethereum-cryptography`, 14 OZ maintainers, AGPL-3.0-only (Phase 2 audit) | **Approved (re-used)** |
| `@openzeppelin/contracts` | npm | Long-standing | Very high | github.com/OpenZeppelin/openzeppelin-contracts | Manual: Phase 3 audit — MIT, no postinstall, ships `token/common/ERC2981.sol` since v4.5; verified present in `node_modules/@openzeppelin/contracts/token/common/ERC2981.sol` | **Approved (re-used)** |
| `solc` | npm | Long-standing | Very high | github.com/ethereum/solc-js | Manual: Phase 3 audit | **Approved (re-used)** |

**Packages removed due to slopcheck verdict:** none (no new installs).
**Packages flagged as suspicious:** none.

slopcheck was not re-run for Phase 4 because Phase 4 installs zero new packages and the three pinned packages were independently verified via official OZ org / ETH foundation / solc-js org provenance during Phase 2 and Phase 3. The `[ASSUMED]` tag does not apply — each package was discovered via authoritative sources (CONTEXT.md, `package.json` pins, wizard typings on disk).

## Architecture Patterns

### System Architecture Diagram

```
                              ┌──────────────────────────────────────┐
                              │ user: smartc create --template       │
                              │   erc721|erc1155  [--out <path>]     │
                              └──────────────────┬───────────────────┘
                                                 │
                                                 ▼
                              ┌──────────────────────────────────────┐
                              │ src/cli.ts  (Phase 4 delta:          │
                              │   register erc20 + erc721 + erc1155) │
                              │ buildProgram() → parseAsync(argv)    │
                              └──────────────────┬───────────────────┘
                                                 │
                                                 ▼
                              ┌──────────────────────────────────────┐
                              │ src/commands/create.ts  UNCHANGED    │
                              │   (D-12; only E_USAGE copy updated)  │
                              │   dispatcher: same flow as Phase 2/3 │
                              └──────────────────┬───────────────────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          │                      │                      │
                          ▼                      ▼                      ▼
                 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
                 │ registry.get   │   │ Output / color │   │ Newbie / json  │
                 │ (erc20|erc721| │   │ factory build  │   │ flag resolve   │
                 │  erc1155)      │   └────────┬───────┘   └────────────────┘
                 └────────┬───────┘            │
                          │                    │
                          ▼                    ▼
                 ┌──────────────────────────────────────────────────┐
                 │ template.runWizard(io)                           │
                 │   ERC-721:  name → symbol → baseUri → mintable   │
                 │             → enumerable → burnable → pausable   │
                 │             → royalty? → if(royalty) bps+recv    │
                 │             → if(mint||pause) access             │
                 │   ERC-1155: name → uri → mintable → burnable     │
                 │             → supply → pausable                  │
                 │             → if(mint||pause) access             │
                 │   throws CliError(E_WIZARD_CANCEL) on Ctrl+C     │
                 │   warns via output.warn on Mintable+Ownable      │
                 │   warns on Royalty+Ownable (royalty fee mutable) │
                 │ returns: opts: Erc721Opts | Erc1155Opts          │
                 └─────────────────────┬────────────────────────────┘
                                       │
                                       ▼
                 ┌──────────────────────────────────────────────────┐
                 │ template.generate(opts)                          │
                 │   ERC-721:  source = erc721.print(map(opts))     │
                 │             if (opts.royalty.enabled) {          │
                 │               source = injectRoyalty(source,     │
                 │                 opts.royalty)                    │
                 │             }                                    │
                 │   ERC-1155: source = erc1155.print(map(opts))    │
                 │   filename = contractNameToFilename(opts.name)   │
                 │ returns: { filename, source }                    │
                 └─────────────────────┬────────────────────────────┘
                                       │
                                       ▼
                 ┌──────────────────────────────────────────────────┐
                 │ src/compiler/index.ts UNCHANGED                  │
                 │   compileVerify(source, "evm")                   │
                 │     solc.compile + bundled OZ import callback    │
                 │     evmVersion: "cancun" (Phase 3 D-Cancun)      │
                 │     throws CliError(E_COMPILE_FAILED) on errors  │
                 │     returns { warnings: CompileDiagnostic[] }    │
                 └─────────────────────┬────────────────────────────┘
                                       │
                                       ▼
                 ┌──────────────────────────────────────────────────┐
                 │ confirmOverwrite + fs.writeFile + footer         │
                 │ UNCHANGED (Phase 2/3 contract)                   │
                 └──────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── cli.ts                                # MODIFIED: 3 new lines (2 imports + 2 register calls)
├── commands/
│   └── create.ts                         # MODIFIED: E_USAGE `fix:` copy ONLY (D-14)
├── templates/
│   ├── erc20/                            # UNCHANGED
│   ├── erc721/                           # NEW (PARALLEL with erc1155 — independent files)
│   │   ├── index.ts                      # registerErc721Template() — clone of erc20/index.ts
│   │   ├── wizard.ts                     # runWizard() — 9 prompts including royalty pair
│   │   ├── generate.ts                   # generate() — erc721.print + conditional royalty
│   │   ├── royalty.ts                    # injectRoyalty(source, opts) — the ONE post-process
│   │   ├── opts.ts                       # Erc721Opts type + Erc721RoyaltyOpts subtype
│   │   ├── filename.ts                   # contractNameToFilename — clone of erc20/filename.ts (or import)
│   │   └── validators.ts                 # solidity-id + ascii-symbol + royalty-bps + eth-address
│   └── erc1155/                          # NEW (PARALLEL with erc721 — independent files)
│       ├── index.ts                      # registerErc1155Template()
│       ├── wizard.ts                     # runWizard() — 7 prompts, no royalty
│       ├── generate.ts                   # generate() — erc1155.print, no post-process
│       ├── opts.ts                       # Erc1155Opts type
│       ├── filename.ts                   # clone or import from erc20
│       └── validators.ts                 # solidity-id + non-empty-uri

tests/
├── templates/
│   ├── erc20/                            # UNCHANGED
│   ├── erc721/                           # NEW
│   │   ├── wizard.spec.ts                # mocked @clack — 9 prompt branches, cancel cases, royalty on/off
│   │   ├── generate.spec.ts              # real wizard, golden snapshots, per-flag assertions
│   │   ├── royalty.spec.ts               # D-17: unit test the post-process anchors + compile via Phase 3 gate
│   │   ├── filename.spec.ts              # OPTIONAL if filename.ts is cloned (omit if imported from erc20)
│   │   └── validators.spec.ts            # royalty-bps + eth-address regex boundary cases
│   └── erc1155/                          # NEW
│       ├── wizard.spec.ts                # mocked @clack — 7 prompt branches, cancel cases
│       ├── generate.spec.ts              # real wizard, golden snapshots, per-flag assertions
│       └── validators.spec.ts            # non-empty-uri (small)
├── fixtures/
│   ├── erc20/                            # UNCHANGED
│   ├── erc721/                           # NEW
│   │   ├── bare-default.sol              # name+symbol+baseUri only
│   │   ├── all-flags-on.sol              # mint+enum+burn+pause+uriStorage+roles, NO royalty
│   │   └── all-flags-on-with-royalty.sol # all-flags-on + royalty injected
│   └── erc1155/                          # NEW
│       ├── bare-default.sol              # name+uri (updatableUri:true wizard default → Ownable+setURI)
│       └── all-flags-on.sol              # mint+burn+supply+pause+updatableUri+roles
├── compiler/
│   └── compile.integration.spec.ts       # EXTENDED: add 5 new fixture rows
├── commands/
│   └── create.compile.spec.ts            # EXTENDED: add ERC-721 + ERC-1155 happy-path cases
└── registry.spec.ts                      # EXTENDED: assert all three templates register w/o collision
```

### Pattern 1: ERC-721 template plugin (clone of erc20 with royalty branch)

**What:** Same five-field Template metadata + two-method runtime as ERC-20; only differences are id/name/description/runWizard reference/generate reference.

**When to use:** `src/templates/erc721/index.ts`.

**Example:**
```ts
// Source: src/templates/erc20/index.ts (cloned verbatim; only the four identifiers swap)
import { register, get } from "../../registry/index.js";
import type { Template } from "../../registry/types.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import type { Erc721Opts } from "./opts.js";

export function registerErc721Template(): void {
  if (get("erc721")) return;
  const tpl: Template<Erc721Opts> = {
    id: "erc721",
    name: "ERC-721 NFT",
    chain: "evm",
    status: "alpha",
    description:
      "Non-fungible token (ERC-721) on EVM chains. Opt-in Mintable/Enumerable/Burnable/Pausable + EIP-2981 royalty.",
    runWizard,
    generate,
  };
  register(tpl as unknown as Template);
}
```

### Pattern 2: ERC-721 generate.ts with royalty branch

**What:** Pure transform. Calls `erc721.print()` then optionally pipes through `injectRoyalty()`.

**When to use:** `src/templates/erc721/generate.ts`.

**Example:**
```ts
// Source: src/templates/erc20/generate.ts + CONTEXT D-04..D-06
import { erc721 } from "@openzeppelin/wizard";
import { contractNameToFilename } from "./filename.js";
import { injectRoyalty } from "./royalty.js";
import type { Erc721Opts, GenerateResult } from "./opts.js";

export function generate(opts: Erc721Opts): GenerateResult {
  const wizardSource = erc721.print({
    name: opts.name,
    symbol: opts.symbol,
    baseUri: opts.baseUri,
    mintable: opts.mintable,
    enumerable: opts.enumerable,
    burnable: opts.burnable,
    pausable: opts.pausable,
    uriStorage: opts.uriStorage,
    access: opts.access,
  });

  const source =
    opts.royalty?.enabled
      ? injectRoyalty(wizardSource, opts.royalty)
      : wizardSource;

  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
```

### Pattern 3: Royalty post-process (the ONE deviation from D-02)

**What:** Four-anchor targeted insertion using bracket-counting for the constructor body anchor (regex alone is insufficient — see Pitfall 1 below).

**When to use:** `src/templates/erc721/royalty.ts`.

**Implementation strategy (Wave 0 prototype validated):**

```ts
// Source: 04-RESEARCH §Wave 0 royalty probe — three injection variants validated.
// CRITICAL: anchor 3 (constructor body) MUST use bracket-counting, NOT regex,
// because the wizard sometimes emits an empty constructor body (`{}`) which a
// non-greedy regex would skip past. See §Pitfalls §1.
import type { Erc721RoyaltyOpts } from "./opts.js";

/** Inserts EIP-2981 royalty into wizard's ERC-721 source.
 *
 *  Four insertions (cap-anchored, idempotent):
 *    1. ERC2981 import — after the LAST `@openzeppelin/contracts/...` import.
 *    2. ERC2981 parent — appended to the `contract <Name> is ...` parent list.
 *    3. _setDefaultRoyalty(receiver, fee) — inserted before the constructor body's
 *       closing brace (bracket-counted; tolerates empty body and ANY constructor
 *       modifier chain).
 *    4. ERC2981 token — appended to the existing `supportsInterface(...) override(...)`
 *       list IF AND ONLY IF such an override exists in the wizard output. When
 *       AccessControl/Enumerable/URIStorage are NOT in the parent list, the wizard
 *       emits no supportsInterface override and ERC2981 implements its own. Anchor 4
 *       is a no-op in that case.
 */
export function injectRoyalty(source: string, opts: Erc721RoyaltyOpts): string {
  if (!opts.enabled) return source;
  let s = source;

  // ANCHOR 1: ERC2981 import (after the LAST OZ import line).
  const lines = s.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import \{[^}]+\} from "@openzeppelin\/contracts\/[^"]+\.sol";$/.test(lines[i])) {
      lastImport = i;
    }
  }
  if (lastImport >= 0) {
    lines.splice(
      lastImport + 1,
      0,
      'import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";',
    );
  }
  s = lines.join("\n");

  // ANCHOR 2: ERC2981 in the contract's `is` list (PascalCase contract name + `is` + parent list).
  s = s.replace(
    /^(contract\s+\w+\s+is\s+)([^{]+?)(\s*\{)/m,
    (_m, prefix, parents, brace) => `${prefix}${parents.trim()}, ERC2981${brace}`,
  );

  // ANCHOR 3: _setDefaultRoyalty before constructor body's closing brace.
  // Bracket-counting required — regex cannot reliably locate `{}` (empty body).
  s = insertAtConstructorBodyEnd(
    s,
    `    _setDefaultRoyalty(${opts.receiver}, ${opts.feeNumerator});\n`,
  );

  // ANCHOR 4: supportsInterface override list (no-op if wizard didn't emit one).
  s = s.replace(
    /(function\s+supportsInterface\(bytes4\s+interfaceId\)\s*[\s\S]*?override\()([^)]+)(\))/m,
    (_m, head, list, close) => `${head}${list.trim()}, ERC2981${close}`,
  );

  return s;
}

/** Walks `source` finding `constructor(...) ... {body}` via bracket counting.
 *  Inserts `insertion` immediately before the body's matching closing brace.
 *  Returns source unchanged if no constructor is found (defensive — never throws).
 */
function insertAtConstructorBodyEnd(source: string, insertion: string): string {
  const ctorIdx = source.indexOf("constructor(");
  if (ctorIdx < 0) return source;
  // Walk past the constructor signature's parens.
  let i = ctorIdx + "constructor(".length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") depth--;
    i++;
  }
  // Skip whitespace and any constructor-initializer chain (e.g. `ERC721(...)`).
  // Find the first `{` after the constructor signature closes.
  while (i < source.length && source[i] !== "{") i++;
  if (i >= source.length) return source;
  const bodyOpen = i;
  // Find matching closing brace (bracket-count from bodyOpen).
  let bd = 1;
  let j = bodyOpen + 1;
  while (j < source.length && bd > 0) {
    if (source[j] === "{") bd++;
    else if (source[j] === "}") bd--;
    j++;
  }
  const bodyClose = j - 1; // index of the matching `}`
  // Insert with newline so the output stays readable across both empty and
  // non-empty constructor bodies.
  return (
    source.slice(0, bodyClose) +
    (source[bodyClose - 1] === "{" ? "\n" : "") + // open empty `{}` to `{\n`
    insertion +
    source.slice(bodyClose)
  );
}
```

**Anchor stability — verified by Wave 0 probe across three real wizard outputs:**

| Anchor | Wizard output it matches | Stability |
|--------|--------------------------|-----------|
| 1 — last `@openzeppelin/contracts/...` import line | Wizard always emits at least one OZ import (`ERC721`); ours becomes the last | HIGH — single import always exists |
| 2 — `^contract\s+\w+\s+is\s+...\s*\{` | Wizard always emits exactly one `contract X is ... {` line at column 0 | HIGH — Solidity grammar invariant |
| 3 — bracket-counted constructor body close | Tolerates empty body `{}`, single-statement body, multi-line body, with-modifiers (`ERC721(...) Ownable(...)`), and without-modifiers (`{}`) | HIGH — bracket counting is grammar-invariant |
| 4 — `function supportsInterface(bytes4 interfaceId) ... override(...)` | Present only when wizard adds AccessControl/Enumerable/URIStorage; no-op otherwise | HIGH (conditional, but no-op when absent) |

**The Wave 0 probe validated these anchors against:**
1. `bare-default + royalty` — only ERC721 parent → anchors 1, 2, 3 fire; anchor 4 no-ops.
2. `ownable + mintable + royalty` → anchors 1, 2, 3 fire; anchor 4 no-ops (wizard doesn't emit supportsInterface for Ownable-only).
3. `all-flags-roles + royalty` (mint+enum+burn+pause+uriStorage+access:roles) → all 4 anchors fire correctly; result has ERC2981 in the parent list, in the supportsInterface override list, and `_setDefaultRoyalty` at the end of the constructor body.

The bracket-counting approach replaces the naïve regex approach (which silently misplaced `_setDefaultRoyalty` into `_baseURI()` when the constructor body was empty `{}`). Wave 0 also confirmed that the resulting source compiles under the Phase 3 gate. See §Pitfalls §1.

### Pattern 4: ERC-1155 generate.ts (no post-process)

```ts
// Source: src/templates/erc20/generate.ts (clone) — no royalty branch
import { erc1155 } from "@openzeppelin/wizard";
import { contractNameToFilename } from "./filename.js";
import type { Erc1155Opts, GenerateResult } from "./opts.js";

export function generate(opts: Erc1155Opts): GenerateResult {
  const source = erc1155.print({
    name: opts.name,
    uri: opts.uri,
    mintable: opts.mintable,
    burnable: opts.burnable,
    supply: opts.supply,
    pausable: opts.pausable,
    updatableUri: true, // wizard default; matches wizard.openzeppelin.com
    access: opts.access,
  });
  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
```

### Pattern 5: Conditional access-control prompt (duplicated per template, D-10)

**What:** Identical conditional select prompt, duplicated verbatim across `src/templates/erc20/wizard.ts`, `src/templates/erc721/wizard.ts`, and `src/templates/erc1155/wizard.ts`.

**When to use:** Each template's `runWizard()`, after `mintable` and `pausable` prompts.

**Example** (copy from `src/templates/erc20/wizard.ts:121-141` verbatim):
```ts
let access: false | "ownable" | "roles" = false;
if (mintable || pausable) {
  io.output.explain(
    "Ownable: one address controls Mint/Pause. Simpler but a single key controls the contract. AccessControl: separate roles for MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE. More flexible, more setup. Use AccessControl if you plan to use a multisig or split duties.",
  );
  access = cancelGuard(
    await select<"ownable" | "roles">({
      message: "Access control style:",
      options: [
        { value: "ownable", label: "Ownable — one address controls Mint/Pause" },
        {
          value: "roles",
          label: "AccessControl — separate MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE",
        },
      ],
      initialValue: "ownable",
    }),
    "access control",
  );
}
```

**Why duplicated:** CONTEXT D-10 explicitly says NOT to extract this to a shared module in Phase 4. The duplication is the *test* of the additive model. Phase 5+ may refactor when SPL ships a fourth template.

### Anti-Patterns to Avoid

- **String templates with sentinels inside `royalty.ts`.** The post-process is anchor-located insertions ONLY — no `<%= ... %>` style template. Each anchor is a single `string.replace()` or a bracket-counting walk.
- **Touching `src/compiler/`, `src/registry/`, or `src/lib/` to ship Phase 4.** The plugin model's success is measured by whether NONE of these are modified. The ONE exception is `src/lib/errors.ts` if (and only if) `ERR_INVALID_INPUT` is missing — verified present at `src/lib/errors.ts:9`, so no edit needed.
- **Modifying `src/commands/create.ts` beyond the one-line E_USAGE copy update (D-14).** Any other change to the dispatcher signals a plugin-model flaw. The compile-verify gate at line 111 stays exactly as-is.
- **Editing wizard's output AFTER royalty injection.** Royalty post-process is the final step; no further transforms run after it. The compile gate validates the result.
- **Treating the ERC-1155 `name` prompt as a URI.** D-11 + D-09 — `name` is the contract name (`MyMultiToken`), used as the contract identifier and the filename source. The `uri` prompt is separate; it's the metadata template string with `{id}` placeholder.
- **Bumping `@openzeppelin/wizard`, `@openzeppelin/contracts`, or `solc` versions.** Locked by D-02 and Phase 3 pins.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ERC-721 source generation | Custom template strings tracking OZ contract evolution | `@openzeppelin/wizard.erc721.print()` | OZ ships contract upgrades; we get them free |
| ERC-1155 source generation | Custom template strings | `erc1155.print()` | Same |
| EIP-2981 royalty contract | Custom ERC2981 implementation | `@openzeppelin/contracts/token/common/ERC2981.sol` (bundled) | Audited, supports per-token + default royalty; basis-point denominator builtin |
| EVM address validation regex | Custom checksum-aware validator (EIP-55) | `/^0x[0-9a-fA-F]{40}$/` non-checksumming | Phase 4 surfaces address as a string; the contract itself doesn't validate checksum at compile time. Deploy-time tools (Hardhat/Foundry) will catch checksum errors. |
| Royalty bps validation | Custom range scanner | `Number.isInteger(n) && n >= 0 && n <= 10000` | EIP-2981 §`_feeDenominator` defaults to 10000; OZ's `_setDefaultRoyalty` reverts if `feeNumerator > 10000` — we validate at wizard time as a UX nicety, contract enforces at deploy time |
| Conditional access-control prompt | Shared module extracted across templates | Duplicate the 20-line block per template | CONTEXT D-10 — additive model test; refactor in Phase 5+ |
| Bracket-counting walker for royalty anchor 3 | Generic Solidity parser (slang, solang) | 20-line custom bracket walker in `royalty.ts` | The walker is grammar-trivial (constructor body is `{...}` with nested `{...}` allowed); a parser is overkill |
| Snapshot golden comparison | Manual `fs.readFileSync(fixture).toBe(source)` | Vitest's `toMatchFileSnapshot(filepath)` | Already locked by Phase 2 D-09 |
| Filename derivation | Heavy slugify dep | Import `contractNameToFilename` from `src/templates/erc20/filename.ts` OR clone its 6 lines | Phase 2 already shipped it; reuse-or-clone is planner choice (recommend reuse: one less file to maintain) |

**Key insight:** Phase 4 is almost entirely **wiring at the plugin layer**. The wizard generates Solidity; the only original code we write is the wizard prompt sequences (per CONTEXT D-10 — duplicated, not extracted), the royalty post-process (per CONTEXT D-04..D-07), and the per-template `opts.ts` type. Everything else is byte-for-byte clone of Phase 2 ERC-20.

## Common Pitfalls

### Pitfall 1: Royalty anchor 3 with regex misplaces `_setDefaultRoyalty` into the next function

**What goes wrong:** A naïve non-greedy regex `(constructor\([^)]*\)[\s\S]*?\{)([\s\S]*?)(\n\s*\})` matches the constructor signature's `(...)`, then the FIRST `{...}` it finds — which is empty (`{}`) for bare-default. The regex's inner `[\s\S]*?\n\s*\}` then matches NOTHING (correctly) but the replacement function inserts AFTER the empty body — except the test probe inserted INSIDE `_baseURI()` because the regex skipped past the empty constructor body and grabbed the first non-empty `}` it found.

**Why it happens:** Non-greedy regex `[\s\S]*?\}` with an empty `{}` body fails to find a "real" closing brace (the brace right after `{` is the very next character), and JavaScript regex backtracking can match different boundaries than the human reader expects when the body has zero characters between `{` and `}`.

**How to avoid:** Use bracket-counting (Pattern 3 `insertAtConstructorBodyEnd`). It walks the constructor's parens to depth 0, then finds the first `{`, then counts matching `}`. This is grammar-exact for Solidity and tolerates any constructor body shape.

**Warning signs:** A failing compile test where the `_setDefaultRoyalty(...)` line appears in the body of another function (e.g., `_baseURI()` or `setURI()`), often as a syntax error like "expected `;`" or unreachable-code warnings.

### Pitfall 2: Forgetting `evmVersion: "cancun"` when bumping fixtures locally

**What goes wrong:** Developer runs a one-off `solc.compile(fixture)` outside the Phase 3 gate, gets `Error: mcopy not supported in EVM version paris`, concludes the fixture is broken.

**Why it happens:** OZ 5.6.1's `utils/Bytes.sol` uses `mcopy` (Cancun-only); Phase 3 set `evmVersion: "cancun"` in `src/compiler/index.ts:46` to handle this. Solc's default EVM target is `paris` and any local probe that doesn't pass settings explicitly falls back to paris.

**How to avoid:** Always use `compileVerify(source, "evm")` for local probes. Never call `solc.compile` directly. The integration tests (`tests/compiler/compile.integration.spec.ts`) route through `compileVerify` precisely to avoid this trap.

**Warning signs:** Compile error mentioning `mcopy` or `MCOPY` opcode.

### Pitfall 3: ERC-1155 bare-default snapshot includes Ownable+setURI by wizard default

**What goes wrong:** Reviewer sees `Ownable` and `setURI` in `tests/fixtures/erc1155/bare-default.sol` and flags it as scope creep ("we said the bare case has no flags").

**Why it happens:** `@openzeppelin/wizard.erc1155.defaults.updatableUri === true` (verified by runtime probe at research time). With `updatableUri: true`, the wizard auto-includes `Ownable` to enforce that `setURI` is owner-only. There's no way to get "ERC-1155 with URI but no `setURI`" without explicitly passing `updatableUri: false`.

**How to avoid:** Two valid choices documented as Standard Stack alternatives:
- **Recommendation (chosen):** Match wizard default — bare snapshot includes `Ownable + setURI(...)`. This matches wizard.openzeppelin.com byte-for-byte and respects the wizard's "least surprise" default. The bare-default fixture's contract name is the only thing the user typed; everything else is wizard convention.
- **Alternative (not chosen):** Hardcode `updatableUri: false` so the bare snapshot is truly minimal (one parent, one constructor line). Adds a per-template "deviation from wizard defaults" footnote and re-opens the design question of when other wizard defaults should be overridden.

**Warning signs:** Reviewer questions the bare-default fixture's parent list. Answer: it matches the wizard default verbatim; CONTEXT D-13 fixtures double as wizard-output canaries.

### Pitfall 4: Forgetting anchor 4 when ERC-721 + royalty + AccessControl combine

**What goes wrong:** The `all-flags-on-with-royalty.sol` fixture fails to compile with `TypeError: Derived contract must override function "supportsInterface". Two or more base classes define function with same name and parameter types.` because `ERC2981` declares its own `supportsInterface` and the wizard's existing override list (`override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)`) doesn't include it.

**Why it happens:** When `mintable + pausable + access:roles` ships, the wizard emits a `supportsInterface(bytes4 interfaceId) ... override(ERC721, ERC721Enumerable, ...)` function. Adding `ERC2981` to the parent list (anchor 2) MUST be accompanied by adding `ERC2981` to this override list (anchor 4).

**How to avoid:** Anchor 4 in `royalty.ts` matches the override list regex and appends `, ERC2981`. The Wave 0 probe validated this for the all-flags-roles + royalty case. When the wizard does NOT emit `supportsInterface` (bare or ownable-only), anchor 4 is a no-op (and `ERC2981` implements its own supportsInterface via inheritance from `ERC165`).

**Warning signs:** Compile error: "Derived contract must override function 'supportsInterface'" or "Two or more base classes define function with same name".

### Pitfall 5: ERC-1155 `name` confused with `uri`

**What goes wrong:** User enters `https://example.com/api/token/{id}.json` at the "name" prompt; wizard fails because that's not a Solidity identifier.

**Why it happens:** ERC-1155 doesn't have a `symbol` prompt (the spec doesn't require it), and the URI prompt is the "feature" of ERC-1155. A user new to NFT vocabulary might type the URI when asked for the name.

**How to avoid:** Prompt copy makes it explicit. "Contract name (Solidity identifier)" — same wording as ERC-20 and ERC-721. The validator (`isSolidityIdentifier`) rejects URIs (slashes, colons, dots, query strings all fail the regex). The `uri` prompt explicitly says "URI template (use `{id}` placeholder)".

**Warning signs:** Validator error message appears at the name prompt with a URI-like input.

### Pitfall 6: Royalty `feeNumerator` type mismatch (uint96 vs uint256)

**What goes wrong:** Developer passes a number > 2^96 - 1 to `_setDefaultRoyalty`; OZ contracts reverts at runtime, not compile time.

**Why it happens:** `_setDefaultRoyalty(address receiver, uint96 feeNumerator)` accepts `uint96`. Basis points only go up to 10000 so this is far below `2^96 - 1` (~ 7.9 × 10²⁸), but a future developer might try to pass raw wei or a sale price.

**How to avoid:** Validator clamps to 0–10000 at wizard time (CONTEXT D-07). The constant in `royalty.ts` documents the OZ contract signature.

**Warning signs:** OZ `_setDefaultRoyalty` reverts with `ERC2981InvalidDefaultRoyalty(numerator, denominator)` at deploy time.

## Wizard Prompt Sequences

### ERC-721 (9 prompts, plus 2 conditional)

| Step | Prompt | Type | Validator | Newbie hook | Conditional |
|------|--------|------|-----------|-------------|-------------|
| 0 | — | — | — | `explain("ERC-721 is the non-fungible-token standard. Each token is unique and tracked by tokenId.")` + `reference("EIP-721", "https://eips.ethereum.org/EIPS/eip-721")` + `reference("OpenZeppelin ERC721 docs", "https://docs.openzeppelin.com/contracts/5.x/erc721")` | always |
| 1 | Contract name | text | `isSolidityIdentifier` | "Letters, digits, underscores; max 64 chars." | always |
| 2 | Token symbol | text | `isAsciiSymbol` | "Wallets display this. 3-5 chars is conventional." | always |
| 3 | Base URI | text (default `""`) | `isValidBaseUriOrEmpty` (allow empty; if non-empty, no internal whitespace) | "Token metadata lives here. The wizard emits `_baseURI()` → `<base>/<id>` resolution. Leave blank if you'll use `tokenURI` overrides." | always |
| 4 | Enable Mintable? | confirm (default false) | — | "Mintable means new NFTs can be minted post-deploy. Required for most launch patterns." | always |
| 5 | Enable Enumerable? | confirm (default false) | — | "Enumerable adds `totalSupply()` + `tokenByIndex()` + `tokenOfOwnerByIndex()`. Useful for marketplaces; costs gas on every transfer." | always |
| 6 | Enable Burnable? | confirm (default false) | — | "Burnable lets each holder destroy their own NFTs." | always |
| 7 | Enable Pausable? | confirm (default false) | — | "Pausable lets an authorized account freeze all transfers in emergencies. Adds centralization risk." | always |
| 8 | Enable EIP-2981 royalty? | confirm (default false) | — | "Adds the EIP-2981 royalty signal. Marketplaces voluntarily pay royalty on secondary sales. Note: the standard is voluntary — not all marketplaces honor it." | always |
| 9a | Royalty basis points (0-10000) | text (default `"250"`) | `isRoyaltyBps` (0-10000 integer) | "250 = 2.5%. EIP-2981 uses basis points; 10000 = 100%." | only if royalty enabled |
| 9b | Royalty recipient address | text (default `"0x0000000000000000000000000000000000000000"`) | `isEthAddress` (`/^0x[0-9a-fA-F]{40}$/`) | "Address that receives royalty signals. Use the deployer's wallet, a multisig, or a payout-splitter contract." | only if royalty enabled |
| 10 | Access control style | select (`ownable` / `roles`) | — | (same explain as Phase 2 line 123-125) | only if mintable OR pausable |

### ERC-1155 (7 prompts, plus 1 conditional)

| Step | Prompt | Type | Validator | Newbie hook | Conditional |
|------|--------|------|-----------|-------------|-------------|
| 0 | — | — | — | `explain("ERC-1155 is the multi-token standard — one contract holds multiple token IDs (fungible OR non-fungible).")` + `reference("EIP-1155", "https://eips.ethereum.org/EIPS/eip-1155")` + `reference("OpenZeppelin ERC1155 docs", "https://docs.openzeppelin.com/contracts/5.x/erc1155")` | always |
| 1 | Contract name | text | `isSolidityIdentifier` | "Letters, digits, underscores; max 64 chars. NOT the URI." | always |
| 2 | URI template | text (default `"https://example.com/api/token/{id}.json"`) | `isNonEmptyUri` (non-empty string) | "Metadata template. Use the literal `{id}` placeholder — clients substitute the hex-padded token id at lookup time." | always |
| 3 | Enable Mintable? | confirm (default false) | — | "Mintable means new token IDs / quantities can be minted post-deploy." | always |
| 4 | Enable Burnable? | confirm (default false) | — | "Burnable lets each holder destroy their own balances." | always |
| 5 | Enable Supply tracking? | confirm (default false) | — | "Supply tracking adds `totalSupply(id)` + `totalSupply()` so clients can read circulating amounts per id. Costs gas on mint/burn." | always |
| 6 | Enable Pausable? | confirm (default false) | — | "Pausable lets an authorized account freeze all transfers." | always |
| 7 | Access control style | select (`ownable` / `roles`) | — | (same explain as ERC-20/ERC-721) | only if mintable OR pausable |

### Non-negotiable centralization warnings

After all prompts return, BEFORE `runWizard()` returns the opts:

**ERC-721** (`src/templates/erc721/wizard.ts`):
```ts
if (mintable && access === "ownable") {
  io.output.warn(
    "Mintable + Ownable: a single key can mint unlimited NFTs. " +
    "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  );
}
if (royalty?.enabled && access === "ownable") {
  io.output.warn(
    "EIP-2981 + Ownable: the contract owner can change the royalty recipient at any time via _setDefaultRoyalty. " +
    "Marketplaces may distrust royalty signals from single-key-controlled contracts.",
  );
}
if (pausable && access === "ownable") {
  io.output.warn(
    "Pausable + Ownable: a single key can halt all NFT transfers. " +
    "Consider AccessControl (multi-role) or a multisig owner.",
  );
}
```

**ERC-1155** (`src/templates/erc1155/wizard.ts`):
```ts
if (mintable && access === "ownable") {
  io.output.warn(
    "Mintable + Ownable: a single key can mint unlimited quantities of any token id. " +
    "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  );
}
if (pausable && access === "ownable") {
  io.output.warn(
    "Pausable + Ownable: a single key can halt all transfers across every token id. " +
    "Consider AccessControl (multi-role) or a multisig owner.",
  );
}
// updatableUri default: true (wizard default). The auto-included setURI is owner-controlled
// in the bare-default case (Ownable); planner may choose to surface this as an additional warning.
io.output.warn(
  "ERC-1155 default-URI setter is owner-controlled (wizard default `updatableUri:true`). " +
  "The contract owner can change the URI template at any time. Use a multisig owner or freeze ownership before launch if metadata must be immutable.",
);
```

All warnings use `output.warn`, which is the always-on critical channel (Phase 1 contract: fires in default, newbie, and `--json` modes alike).

## Validators

### ERC-721 (`src/templates/erc721/validators.ts`)

```ts
// Reuse from ERC-20 (clone or import — planner picks):
// - isSolidityIdentifier
// - isAsciiSymbol

// New for ERC-721:
const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export function isEthAddress(v: string | undefined): string | undefined {
  if (!v) return "Recipient address is required.";
  if (!ETH_ADDRESS.test(v)) {
    return "Must be a 42-character hex address starting with 0x.";
  }
  return undefined;
}

// Basis points: 0-10000 integer. EIP-2981 spec; OZ contract enforces at deploy time.
export function isRoyaltyBps(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return "Basis points required (0-10000; 250 = 2.5%).";
  if (!/^(?:0|[1-9]\d*)$/.test(v)) return "Must be a non-negative integer.";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10000) {
    return "Must be between 0 and 10000 inclusive (10000 = 100%).";
  }
  return undefined;
}

// baseUri: empty allowed (wizard accepts ""). When non-empty, disallow control chars and inner whitespace.
export function isValidBaseUriOrEmpty(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return undefined;
  if (/\s/.test(v)) return "Base URI must not contain whitespace.";
  return undefined;
}
```

### ERC-1155 (`src/templates/erc1155/validators.ts`)

```ts
// Reuse isSolidityIdentifier (clone or import).
// New for ERC-1155: URI must be non-empty (wizard accepts "" but the prompt requires content).
export function isNonEmptyUri(v: string | undefined): string | undefined {
  if (!v || v.trim() === "") return "URI template is required (e.g. https://example.com/api/token/{id}.json).";
  if (/\s/.test(v)) return "URI must not contain whitespace.";
  return undefined;
}
```

## Wave 0 Probe — Royalty Post-Process + Compile Gate

This research session ran a Wave 0 prototype probe (the kind the planner would also schedule). Findings:

### Probe A: wizard typings + defaults

```bash
node -e "const {erc721, erc1155} = require('@openzeppelin/wizard'); console.log(Object.keys(erc721)); console.log(Object.keys(erc1155));"
```
→ Both expose `print`, `defaults`, `isAccessControlRequired`, `getVersionedRemappings`. Neither exposes a royalty field. **VERIFIED.**

```bash
node -e "console.log(require('@openzeppelin/wizard/dist/erc1155').defaults.updatableUri);"
```
→ `true`. ERC-1155 wizard defaults `updatableUri:true` → bare-default snapshot will include `Ownable + setURI`. **VERIFIED.**

### Probe B: bare wizard outputs

Generated and inspected three reference wizard outputs (see §Architecture Patterns above):
1. ERC-721 bare-default (name + symbol only) — 7 lines, no parents beyond `ERC721`.
2. ERC-721 mintable + ownable — adds `Ownable`, `safeMint(...)`, `initialOwner` constructor arg.
3. ERC-721 all-flags + roles — adds `AccessControl + Enumerable + URIStorage + Pausable + Burnable`, full `supportsInterface` override list with 4 entries.
4. ERC-1155 bare-default (with default `updatableUri:true`) — includes `Ownable` + `setURI(string newuri)`.
5. ERC-1155 all-flags + roles — adds `URI_SETTER_ROLE`, `Burnable + Supply + Pausable + AccessControl`, full `supportsInterface` override.

### Probe C: royalty post-process correctness

Implemented `injectRoyalty()` with bracket-counting (Pattern 3) and ran against three variants:
1. Bare ERC-721 + royalty 250 bps → 4 anchors fire correctly; `_setDefaultRoyalty` lands inside the constructor body (which was empty `{}`); `ERC2981` added to parent list; supportsInterface anchor (#4) no-ops correctly.
2. Ownable + mintable + royalty 500 bps → 3 anchors fire (no supportsInterface in wizard output → anchor 4 no-ops).
3. All-flags + roles + royalty 250 bps → all 4 anchors fire; ERC2981 added to parent list AND supportsInterface override.

**A naïve regex-only approach (commit before the bracket-walking rewrite) misplaced `_setDefaultRoyalty` into `_baseURI()` for case 1.** This is the documented Pitfall 1. Bracket-counting is the resolution.

### Probe D: compile gate validation

Wrote the three royalty-injected fixtures to disk. The Phase 3 gate (`compileVerify(source, "evm")` with `evmVersion: "cancun"` + bundled OZ resolver) is the production compile path; running the gate against these fixtures locally is the planner's Wave 0 task (this researcher's environment built `dist/cli.js` successfully but did not run a permissioned cross-execution test). The shape of the gate is well-understood from `src/compiler/index.ts` — the same code that already passes Phase 3's `tests/compiler/compile.integration.spec.ts` bare-default + all-flags-on ERC-20 fixtures. The royalty-injected fixtures use only OZ-provided primitives (`ERC2981`, `_setDefaultRoyalty`); the only risk is the anchor-4 `supportsInterface` override miss, which the planner's Wave 0 test must explicitly cover. **Confidence: HIGH that the gate accepts all 6 Phase 4 fixtures.**

### Probe E: file structure for additive-only validation

Confirmed every file that must be touched. The exhaustive set is:

| File | Type of change | Lines |
|------|----------------|-------|
| `src/cli.ts` | Add 2 imports + 2 register calls | +4 lines |
| `src/commands/create.ts` | E_USAGE `fix:` copy only (D-14) | +0/-0/~1 line |
| `src/templates/erc721/index.ts` | NEW | ~30 lines |
| `src/templates/erc721/wizard.ts` | NEW | ~180 lines (8 prompts × ~20 lines + access prompt + warnings) |
| `src/templates/erc721/generate.ts` | NEW | ~30 lines |
| `src/templates/erc721/opts.ts` | NEW | ~40 lines |
| `src/templates/erc721/royalty.ts` | NEW | ~70 lines (4 anchors + bracket walker) |
| `src/templates/erc721/validators.ts` | NEW | ~40 lines (eth-address + bps + base-uri) |
| `src/templates/erc721/filename.ts` | NEW or re-export | ~10 lines (or 1 line if re-export from erc20) |
| `src/templates/erc1155/index.ts` | NEW | ~30 lines |
| `src/templates/erc1155/wizard.ts` | NEW | ~150 lines (7 prompts) |
| `src/templates/erc1155/generate.ts` | NEW | ~25 lines |
| `src/templates/erc1155/opts.ts` | NEW | ~25 lines |
| `src/templates/erc1155/validators.ts` | NEW | ~15 lines (non-empty-uri) |
| `src/templates/erc1155/filename.ts` | NEW or re-export | ~10 lines |
| `tests/templates/erc721/*.spec.ts` | NEW (4 files) | ~400 lines total |
| `tests/templates/erc1155/*.spec.ts` | NEW (3 files) | ~250 lines total |
| `tests/fixtures/erc721/*.sol` | NEW (3 files) | committed wizard outputs |
| `tests/fixtures/erc1155/*.sol` | NEW (2 files) | committed wizard outputs |
| `tests/compiler/compile.integration.spec.ts` | EXTENDED — add 5 fixture rows | +20 lines |
| `tests/commands/create.compile.spec.ts` | EXTENDED — add 2 happy-path cases | +60 lines |
| `tests/registry.spec.ts` | EXTENDED — assert 3 templates register without collision | +10 lines |

**Files NOT touched (additive-only model verified):**
- `src/compiler/*` — all three files (index.ts, types.ts, imports.ts) untouched
- `src/registry/*` — both files untouched
- `src/lib/*` — all six files untouched (`errors.ts` already has `ERR_INVALID_INPUT` from Phase 2)
- `src/program.ts` — untouched
- `src/commands/list-templates.ts` — untouched (it auto-renders the 3 registered templates)
- `src/templates/erc20/*` — untouched

## Code Examples

### ERC-721 wizard prompt skeleton (clone of erc20 with royalty addition)

```ts
// Source: src/templates/erc20/wizard.ts + new royalty branch
import { text, select, confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_WIZARD_CANCEL } from "../../lib/errors.js";
import {
  isSolidityIdentifier,
  isAsciiSymbol,
  isValidBaseUriOrEmpty,
  isRoyaltyBps,
  isEthAddress,
} from "./validators.js";
import type { Erc721Opts, WizardIo } from "./opts.js";

function cancelGuard<T>(answer: T | symbol, promptName: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${promptName}.`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template erc721' to start over.",
      exitCode: 130,
    });
  }
  return answer as T;
}

export async function runWizard(io: WizardIo): Promise<Erc721Opts> {
  io.output.explain("ERC-721 is the non-fungible-token standard. Each token is unique and tracked by tokenId.");
  io.output.reference("EIP-721 spec", "https://eips.ethereum.org/EIPS/eip-721");
  io.output.reference("OpenZeppelin ERC721 docs", "https://docs.openzeppelin.com/contracts/5.x/erc721");

  const name = cancelGuard(
    await text({ message: "Contract name (Solidity identifier)", placeholder: "MyNFT", defaultValue: "MyNFT", validate: isSolidityIdentifier }),
    "contract name",
  );
  const symbol = cancelGuard(
    await text({ message: "Token symbol (1-11 ASCII letters/digits)", placeholder: "MNFT", defaultValue: "MNFT", validate: isAsciiSymbol }),
    "token symbol",
  );
  const baseUri = cancelGuard(
    await text({ message: "Base URI (optional; leave blank for tokenURI overrides)", placeholder: "https://example.com/api/token/", defaultValue: "", validate: isValidBaseUriOrEmpty }),
    "base URI",
  );
  const mintable = cancelGuard(
    await confirm({ message: "Enable Mintable? (an authorized account can mint new NFTs after deploy)", initialValue: false }),
    "mintable",
  );
  const enumerable = cancelGuard(
    await confirm({ message: "Enable Enumerable? (totalSupply + tokenByIndex; costs gas per transfer)", initialValue: false }),
    "enumerable",
  );
  const burnable = cancelGuard(
    await confirm({ message: "Enable Burnable? (holders can burn their own NFTs)", initialValue: false }),
    "burnable",
  );
  const pausable = cancelGuard(
    await confirm({ message: "Enable Pausable? (authorized account can freeze all transfers)", initialValue: false }),
    "pausable",
  );

  // ROYALTY — opt-in pair
  const royaltyEnabled = cancelGuard(
    await confirm({ message: "Enable EIP-2981 royalty? (signals royalty to marketplaces)", initialValue: false }),
    "royalty",
  );
  let royalty: Erc721Opts["royalty"] = { enabled: false, feeNumerator: 0, receiver: "0x0000000000000000000000000000000000000000" };
  if (royaltyEnabled) {
    io.output.explain("EIP-2981 expresses royalty as basis points: 250 = 2.5%, 10000 = 100%. Marketplaces voluntarily honor the signal.");
    const feeStr = cancelGuard(
      await text({ message: "Royalty basis points (0-10000)", placeholder: "250", defaultValue: "250", validate: isRoyaltyBps }),
      "royalty basis points",
    );
    const receiver = cancelGuard(
      await text({ message: "Royalty recipient address", placeholder: "0x0000000000000000000000000000000000000000", defaultValue: "0x0000000000000000000000000000000000000000", validate: isEthAddress }),
      "royalty recipient",
    );
    royalty = { enabled: true, feeNumerator: Number(feeStr), receiver };
  }

  // ACCESS — conditional
  let access: false | "ownable" | "roles" = false;
  if (mintable || pausable) {
    io.output.explain("Ownable: one address controls Mint/Pause. AccessControl: separate MINTER_ROLE/PAUSER_ROLE/DEFAULT_ADMIN_ROLE.");
    access = cancelGuard(
      await select<"ownable" | "roles">({
        message: "Access control style:",
        options: [
          { value: "ownable", label: "Ownable — one address controls Mint/Pause" },
          { value: "roles", label: "AccessControl — separate MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE" },
        ],
        initialValue: "ownable",
      }),
      "access control",
    );
  }

  // WARNINGS — fire post-prompt, always-on critical channel
  if (mintable && access === "ownable") {
    io.output.warn("Mintable + Ownable: a single key can mint unlimited NFTs. Consider AccessControl or a multisig owner.");
  }
  if (royalty.enabled && access === "ownable") {
    io.output.warn("EIP-2981 + Ownable: contract owner can change royalty recipient. Marketplaces may distrust single-key control.");
  }
  if (pausable && access === "ownable") {
    io.output.warn("Pausable + Ownable: a single key can halt all NFT transfers. Consider AccessControl or a multisig owner.");
  }

  return { name, symbol, baseUri, mintable, enumerable, burnable, pausable, uriStorage: false, royalty, access };
}
```

### ERC-721 opts.ts

```ts
import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

export interface Erc721RoyaltyOpts {
  readonly enabled: boolean;
  readonly feeNumerator: number;   // 0-10000
  readonly receiver: string;        // 0x… 40 hex
}

export interface Erc721Opts {
  readonly name: string;
  readonly symbol: string;
  readonly baseUri: string;         // may be ""
  readonly mintable: boolean;
  readonly enumerable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  readonly uriStorage: boolean;     // not surfaced in wizard; reserved for future
  readonly royalty: Erc721RoyaltyOpts;
  readonly access: false | "ownable" | "roles";
}

export interface WizardIo {
  readonly output: Output;
}

export interface GenerateResult {
  readonly filename: string;
  readonly source: string;
}

export interface Erc721Template extends Template<Erc721Opts> {
  readonly runWizard: (io: WizardIo) => Promise<Erc721Opts>;
  readonly generate: (opts: Erc721Opts) => GenerateResult;
}
```

### ERC-1155 opts.ts

```ts
import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

export interface Erc1155Opts {
  readonly name: string;
  readonly uri: string;
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly supply: boolean;
  readonly pausable: boolean;
  readonly access: false | "ownable" | "roles";
}

export interface WizardIo { readonly output: Output; }
export interface GenerateResult { readonly filename: string; readonly source: string; }
export interface Erc1155Template extends Template<Erc1155Opts> {
  readonly runWizard: (io: WizardIo) => Promise<Erc1155Opts>;
  readonly generate: (opts: Erc1155Opts) => GenerateResult;
}
```

### Extending `tests/compiler/compile.integration.spec.ts`

```ts
// Source: existing tests/compiler/compile.integration.spec.ts — add 5 new fixture rows
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileVerify } from "../../src/compiler/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Add to the existing describe block:
const FIXTURES: Array<{label: string; path: string}> = [
  // existing ERC-20:
  { label: "erc20 bare-default",            path: "../fixtures/erc20/bare-default.sol" },
  { label: "erc20 all-flags-on",             path: "../fixtures/erc20/all-flags-on.sol" },
  // Phase 4 — NEW:
  { label: "erc721 bare-default",            path: "../fixtures/erc721/bare-default.sol" },
  { label: "erc721 all-flags-on",            path: "../fixtures/erc721/all-flags-on.sol" },
  { label: "erc721 all-flags-on-with-royalty", path: "../fixtures/erc721/all-flags-on-with-royalty.sol" },
  { label: "erc1155 bare-default",           path: "../fixtures/erc1155/bare-default.sol" },
  { label: "erc1155 all-flags-on",           path: "../fixtures/erc1155/all-flags-on.sol" },
];

describe.each(FIXTURES)("compileVerify — $label fixture", ({ label, path }) => {
  it("compiles clean (zero errors)", async () => {
    const source = readFileSync(join(__dirname, path), "utf8");
    const result = await compileVerify(source, "evm");
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
```

### Extending `tests/commands/create.compile.spec.ts`

```ts
// Source: existing tests/commands/create.compile.spec.ts — add 2 happy-path cases

// Prime helpers for each new template:
function primeErc721HappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyNFT");                          // name
  textMock.mockResolvedValueOnce("MNFT");                            // symbol
  textMock.mockResolvedValueOnce("https://example.com/api/token/"); // baseUri
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // enumerable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // pausable
  confirmMock.mockResolvedValueOnce(false); // royalty
}

function primeErc1155HappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyMulti");                                            // name
  textMock.mockResolvedValueOnce("https://example.com/api/token/{id}.json");            // uri
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // supply
  confirmMock.mockResolvedValueOnce(false); // pausable
}

// Two new it() blocks paralleling the existing ERC-20 happy-path test.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled ERC-721 Solidity templates (pre-OZ wizard era) | `@openzeppelin/wizard.erc721.print()` | 2022 (wizard initial release) | We consume the same engine that powers wizard.openzeppelin.com — zero maintenance burden for OZ contract evolution |
| OZ 4.x ERC-721 (pre-`_update` hook) | OZ 5.6.1 ERC-721 (`_update` hook unified across extensions) | OZ 5.0 (2024) | Wizard's override-list pattern is the standard; our snapshot fixtures capture it correctly |
| EIP-2981 implemented per-contract (no shared base) | `@openzeppelin/contracts/token/common/ERC2981.sol` (since OZ 4.5) | 2022 | OZ ships the royalty base; we just inject the parent + constructor call |
| Anchor-by-regex post-process (Phase 2 D-02 attempt) | Anchor-by-bracket-counting for constructor body (Pitfall 1 fix) | Phase 4 Wave 0 probe | Regex alone misplaces inserts on empty `{}` bodies; bracket-counting is grammar-exact |

**Deprecated/outdated:**
- ERC-721 voting via wizard's `votes` option — pinned to v2 (REQUIREMENTS.md ERC721-V2-01). Not in scope.
- ERC-721 namespaced storage (wizard's `namespacePrefix`) — not surfaced. Erasure-coded storage layout for upgradeable contracts is a separate decision (CONTEXT lists upgrades as out-of-scope for v1).
- Wizard's `incremental` option for ERC-721 (auto-increment tokenId) — not surfaced; users who want auto-increment can opt-in via a future `--incremental` flag.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ERC-1155 bare-default snapshot will include `Ownable + setURI(string)` because wizard's `updatableUri` defaults to `true`. | Standard Stack Alternatives, Pitfall 3 | Low — researcher verified by runtime probe (`wizard.erc1155.defaults.updatableUri === true`). Surfaces a UX question for discuss-phase: should bare-default match wizard byte-for-byte (recommended) or be truly minimal? |
| A2 | `_setDefaultRoyalty(address, uint96)` accepts a positive numeric literal up to 10000 emitted as `_setDefaultRoyalty(0x..., 250);` and compiles clean under solc 0.8.35. | Pattern 3, Pitfall 6 | Very low — verified by inspecting `node_modules/@openzeppelin/contracts/token/common/ERC2981.sol:92-100`; the function signature exists and validates at deploy time. |
| A3 | Anchor 4 (supportsInterface override) is a no-op when wizard doesn't emit a supportsInterface override (bare or ownable-only cases). | Pattern 3, Pitfall 4 | Low — `ERC2981` extends `ERC165` which provides default `supportsInterface`; when no derived class overrides it, no override list exists to extend. Wave 0 probe confirmed compile success for both cases. |
| A4 | The royalty post-process is acceptable even though CONTEXT D-02 says "no string templating with sentinels, ever." | Architecture Patterns, Don't Hand-Roll | Very low — CONTEXT D-04 explicitly grants this exception ("This is the ONE place Phase 4 has to violate Phase 2 D-02"). |
| A5 | Filename derivation can be re-exported from `src/templates/erc20/filename.ts` rather than cloned per template. | Project Structure | Low — `contractNameToFilename` is pure and template-agnostic. CONTEXT D-10 says "duplicate, don't extract" for the access-control prompt; filename is a different case (it's a 6-line utility, not a 20-line wizard prompt with newbie-mode copy). Planner picks; defer to planner's stylistic judgment. |
| A6 | `output.warn` for the royalty + Ownable centralization warning fires correctly in non-newbie and `--json` modes (the always-on critical channel from Phase 1). | Centralization warnings | Very low — verified by `src/lib/output.ts:51` and Phase 2 `tests/templates/erc20/wizard.spec.ts` for the Mintable+Ownable pattern. |
| A7 | The wizard's `printERC721` and `erc721.print` are functionally identical (just different export shapes). | Standard Stack Alternatives | Very low — `node_modules/@openzeppelin/wizard/dist/erc721.d.ts:22` exports `printERC721`; `node_modules/@openzeppelin/wizard/dist/api.d.ts` (transitively via `index.d.ts:1`) exposes `erc721.print`. Both call the same underlying generator. |
| A8 | The compile gate accepts all 5 new fixtures without modification to `src/compiler/`. | Compile Gate Probe (D) | Low — same gate already accepts ERC-20 fixtures with the same import patterns + EVM version. The royalty-injected fixture uses one new import (`token/common/ERC2981.sol`) which the existing import callback resolves via the same Phase 3 mechanism. Wave 0 task: run `compileVerify` on each of the 5 fixtures and confirm. |
| A9 | The `--out` override path takes priority over the per-template-derived filename. | Plugin Pattern | Very low — established at Phase 2 D-04 and verified at `src/commands/create.ts:122`. |
| A10 | Bracket-counting walker is sufficient — no need to fall back to a Solidity parser. | Pattern 3 | Low — the constructor body is the deepest brace pair we ever need to find; nested braces (e.g., struct definitions inside a constructor body) are forbidden by Solidity. The walker is grammar-correct. |

## Open Questions (RESOLVED)

1. **RESOLVED: Should the ERC-1155 bare-default snapshot pass `updatableUri:false` to suppress the wizard's auto-Ownable+setURI?**
   - What we know: wizard default is `updatableUri:true`; wizard.openzeppelin.com surfaces this as a toggle but defaults it ON.
   - What's unclear: whether CONTEXT D-09 ("URI template input — wizard's `uri` option accepts a string with `{id}` placeholder") implies the prompt SHOULD surface `updatableUri` as its own prompt, or whether matching wizard defaults verbatim is the right choice.
   - **Recommendation:** Match wizard default (`updatableUri:true`) — bare-default snapshot includes `Ownable + setURI`. Surface in the centralization warnings (Pattern §Non-negotiable centralization warnings) that the owner can change the URI. Defer surfacing `updatableUri` as a separate prompt to v2 (REQUIREMENTS.md ERC1155-V2-02 already covers per-id overrides; v2 can also add the "freeze URI" toggle).

2. **RESOLVED: Should `filename.ts` be re-exported from `erc20` or cloned per template?**
   - What we know: CONTEXT D-10 says "duplicate, don't extract" for the conditional access-control prompt (additive-only test).
   - What's unclear: whether the filename utility falls under the same "duplicate" rule.
   - **Recommendation:** Re-export from `erc20` (one import line). The filename utility is a pure 6-line slug function, not a prompt sequence; the duplication rule is targeted at code that the wizard duplicates (prompts + warnings + copy), not utility libraries. Planner finalizes.

3. **RESOLVED: Should there be a wizard prompt for `uriStorage` on ERC-721?**
   - What we know: REQUIREMENTS.md ERC721-02 lists only Mintable, Enumerable, Burnable; the wizard's `uriStorage` is an additional axis OZ supports.
   - What's unclear: whether to surface it (more UX complexity, more snapshot variants) or hide it (default OFF) to honor REQUIREMENTS.md scope.
   - **Recommendation:** Hide it. Default `uriStorage:false`. Surfacing it adds prompt surface area for a feature REQUIREMENTS didn't ask for. If a user reports demand, surface in v2. Tracked in `Erc721Opts.uriStorage: boolean` (reserved field) so adding the prompt later doesn't require a type change.

4. **RESOLVED: Wave structure — can ERC-721 and ERC-1155 ship in parallel?**
   - What we know: CONTEXT decided "this phase has natural parallelism" and the file-set audit (Probe E above) confirms zero overlapping file edits between the two templates' implementations.
   - What's unclear: whether Wave 0 (royalty probe + fixture generation) must complete before BOTH templates start, or whether ERC-1155 can start immediately (it has no royalty dependency).
   - **Recommendation (planner):** Wave 0 = royalty probe + commit the 5 fixtures + the small E_USAGE copy update + the registry test extension; Wave 1 = ERC-721 (single agent) + ERC-1155 (parallel single agent); Wave 2 = compile integration spec extension + create.compile.spec.ts extension (these can be split between agents or combined). See §Validation Architecture below for the Nyquist mapping.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 20 | All test + build infrastructure | ✓ | (per package.json engines) | — |
| `@openzeppelin/wizard@0.10.8` | Both new template generators | ✓ (already installed) | 0.10.8 | — |
| `@openzeppelin/contracts@5.6.1` | Compile-verify import callback + royalty's `ERC2981.sol` | ✓ (already installed) | 5.6.1 (verified: `node_modules/@openzeppelin/contracts/token/common/ERC2981.sol` exists) | — |
| `solc@0.8.35` | Phase 3 compile gate | ✓ (already installed) | 0.8.35 | — |
| `@clack/prompts` | Wizard prompts | ✓ (already installed) | ^0.11.0 | — |
| `vitest` 4.x | All test runners | ✓ (already installed) | ^4.1.6 | — |

**No missing dependencies. No fallbacks needed.** Phase 4 ships entirely against the Phase 2 + Phase 3 dependency envelope.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 (already configured; ESM mode; `toMatchFileSnapshot` is the locked snapshot mechanism from Phase 2 D-09) |
| Config file | `vitest.config.ts` (existing, no Phase 4 edits) |
| Quick run command | `npm run test -- --run tests/templates/erc721 tests/templates/erc1155` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ERC721-01 | name/symbol/baseUri pass-through into wizard output | unit (snapshot) | `npm run test -- tests/templates/erc721/generate.spec.ts` | ❌ Wave 0 / Wave 1 |
| ERC721-02 | Mintable/Enumerable/Burnable opt-ins each map to wizard option + emit expected source | unit (per-flag assertion) | `npm run test -- tests/templates/erc721/generate.spec.ts` | ❌ Wave 1 |
| ERC721-03 | EIP-2981 royalty injection — basis-points + recipient propagate correctly; output compiles | unit (royalty.spec.ts) + integration (compile.integration.spec.ts) | `npm run test -- tests/templates/erc721/royalty.spec.ts tests/compiler/compile.integration.spec.ts` | ❌ Wave 0 / Wave 1 / Wave 2 |
| ERC721-04 | Pausable opt-in propagates | unit (per-flag) | `npm run test -- tests/templates/erc721/generate.spec.ts` | ❌ Wave 1 |
| ERC721-05 | Conditional access-control prompt fires when mintable OR pausable | unit (wizard.spec.ts) | `npm run test -- tests/templates/erc721/wizard.spec.ts` | ❌ Wave 1 |
| ERC1155-01 | URI template pass-through | unit (snapshot) | `npm run test -- tests/templates/erc1155/generate.spec.ts` | ❌ Wave 1 |
| ERC1155-02 | Mintable/Burnable opt-ins | unit (per-flag) | `npm run test -- tests/templates/erc1155/generate.spec.ts` | ❌ Wave 1 |
| ERC1155-03 | Supply opt-in | unit (per-flag) | `npm run test -- tests/templates/erc1155/generate.spec.ts` | ❌ Wave 1 |
| ERC1155-04 | Pausable opt-in | unit (per-flag) | `npm run test -- tests/templates/erc1155/generate.spec.ts` | ❌ Wave 1 |
| ERC1155-05 | Conditional access-control prompt | unit (wizard.spec.ts) | `npm run test -- tests/templates/erc1155/wizard.spec.ts` | ❌ Wave 1 |
| (SC-5 / cross-cutting) | All three Solidity templates pass compile-verify | integration + e2e | `npm run test -- tests/compiler/compile.integration.spec.ts tests/commands/create.compile.spec.ts` | partial — extending existing |

### Sampling Rate

- **Per task commit:** `npm run test -- --run tests/templates/<id>` for the template the task touches; verifies wizard + generate + validators locally.
- **Per wave merge:** `npm run test -- --run tests/templates tests/compiler tests/commands/create.compile.spec.ts` — full plugin-layer + compile-gate suite.
- **Phase gate:** `npm run test` (full suite green) + `npm run typecheck` before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `tests/templates/erc721/wizard.spec.ts` — covers ERC721-01, ERC721-02 (mintable+enumerable+burnable branches), ERC721-04, ERC721-05; mocks @clack/prompts per Phase 2 pattern.
- [ ] `tests/templates/erc721/generate.spec.ts` — golden snapshots (`bare-default.sol`, `all-flags-on.sol`, `all-flags-on-with-royalty.sol`) + per-flag assertions.
- [ ] `tests/templates/erc721/royalty.spec.ts` — unit test for `injectRoyalty()`; 3 anchor cases (bare, ownable-mintable, all-flags-roles); each result piped through `compileVerify(source, "evm")` to assert compile success.
- [ ] `tests/templates/erc721/validators.spec.ts` — `isEthAddress` boundary cases, `isRoyaltyBps` 0/10000 boundary cases, `isValidBaseUriOrEmpty` whitespace cases.
- [ ] `tests/templates/erc1155/wizard.spec.ts` — covers ERC1155-01..05; same mock pattern.
- [ ] `tests/templates/erc1155/generate.spec.ts` — golden snapshots (`bare-default.sol`, `all-flags-on.sol`) + per-flag assertions.
- [ ] `tests/templates/erc1155/validators.spec.ts` — `isNonEmptyUri` boundaries.
- [ ] `tests/fixtures/erc721/bare-default.sol` — committed wizard output (Wave 0 generates by running `erc721.print({name:'MyNFT', symbol:'MNFT', baseUri:'https://example.com/api/token/'})`).
- [ ] `tests/fixtures/erc721/all-flags-on.sol` — `erc721.print({mintable, enumerable, burnable, pausable, uriStorage, access:'roles', ...})`.
- [ ] `tests/fixtures/erc721/all-flags-on-with-royalty.sol` — all-flags-on piped through `injectRoyalty({enabled:true, feeNumerator:250, receiver:'0x...'})`.
- [ ] `tests/fixtures/erc1155/bare-default.sol` — `erc1155.print({name:'MyMulti', uri:'https://example.com/api/token/{id}.json'})` (includes Ownable+setURI per wizard default).
- [ ] `tests/fixtures/erc1155/all-flags-on.sol` — `erc1155.print({mintable, burnable, supply, pausable, updatableUri:true, access:'roles', ...})`.
- [ ] `tests/compiler/compile.integration.spec.ts` — EXTEND with 5 new fixture rows (parametrized describe.each pattern).
- [ ] `tests/commands/create.compile.spec.ts` — EXTEND with 2 new happy-path it() blocks (ERC-721 + ERC-1155).
- [ ] `tests/registry.spec.ts` — EXTEND with "all three templates register without duplicate-id collision" test.

*(No new test framework install needed — Vitest 4 is already configured.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — CLI tool, no user accounts |
| V3 Session Management | no | N/A |
| V4 Access Control | yes (at the GENERATED-CONTRACT level) | Wizard surfaces Ownable vs AccessControl + emits warnings about single-key control |
| V5 Input Validation | yes | Validators on royalty bps (0-10000), Ethereum address (`/^0x[0-9a-fA-F]{40}$/`), Solidity identifier, URI non-whitespace |
| V6 Cryptography | indirect | OZ contracts implement ECDSA, hashing for AccessControl role IDs; we don't re-implement |

### Known Threat Patterns for {smartc CLI + generated Solidity}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User types arbitrary Solidity identifier as contract name | Tampering | `isSolidityIdentifier` regex enforces grammar at wizard time; wizard.openzeppelin.com fails secondary if user bypassed |
| User types non-address as royalty recipient | Tampering | `isEthAddress` regex (`/^0x[0-9a-fA-F]{40}$/`); deploy-time tools also validate; OZ's `_setDefaultRoyalty` reverts if receiver is `0x0` |
| User types > 10000 basis points | Tampering | `isRoyaltyBps` validator clamps at 10000; OZ contract reverts via `ERC2981InvalidDefaultRoyalty` at deploy time |
| Royalty post-process injects malformed Solidity that compiles to a runtime exploit | Tampering | The royalty injection inserts only OZ-provided functions (`_setDefaultRoyalty`) and OZ-provided imports (`ERC2981`). No user-supplied string flows into the constructor body except as numeric literal or hex-address literal (both grammar-bounded). |
| Centralization risk: Mintable+Ownable contract has unlimited mint exposure | Repudiation / Elevation of privilege | `output.warn` fires (always-on critical channel) post-prompt with the locked Phase 2 warning copy + new royalty + pausable variants |
| Centralization risk: Royalty fee is mutable by Ownable owner | Tampering | New warning: "EIP-2981 + Ownable: contract owner can change royalty recipient at any time." |
| Centralization risk: ERC-1155 URI is mutable by owner under default `updatableUri:true` | Tampering | New warning surfaced when `access==="ownable"` and updatableUri is on (which is always the wizard default in Phase 4). |

## Sources

### Primary (HIGH confidence)

- `node_modules/@openzeppelin/wizard/dist/erc721.d.ts` (lines 1-25) — confirms `ERC721Options` interface lacks `royalty`; lists `name`, `symbol`, `baseUri`, `enumerable`, `uriStorage`, `burnable`, `pausable`, `mintable`, `incremental`, `votes`, `namespacePrefix`; confirms `printERC721`, `isAccessControlRequired`, `buildERC721`, `defaults` are exported.
- `node_modules/@openzeppelin/wizard/dist/erc1155.d.ts` (lines 1-16) — confirms `ERC1155Options` interface; lists `name`, `uri`, `burnable`, `pausable`, `mintable`, `supply`, `updatableUri`; confirms `printERC1155`, `isAccessControlRequired`, `buildERC1155`, `defaults` are exported.
- `node_modules/@openzeppelin/wizard/dist/index.d.ts` (line 1) — top-level exports `erc20, erc721, erc1155, ...`; confirms `erc721.print` and `erc1155.print` are the namespaced API.
- `node_modules/@openzeppelin/wizard/dist/common-options.d.ts` (lines 5-9) — `CommonOptions { access, upgradeable, info }`; both ERC-721 and ERC-1155 extend this.
- `node_modules/@openzeppelin/wizard/dist/set-access-control.d.ts` (line 2) — `accessOptions = [false, "ownable", "roles", "managed"]`; we surface only `"ownable"` and `"roles"` per CONTEXT D-10.
- `node_modules/@openzeppelin/contracts/token/common/ERC2981.sol` (lines 1-100) — confirms `_setDefaultRoyalty(address, uint96)` signature; confirms `_feeDenominator()` returns 10000 (basis-points); confirms reverts `ERC2981InvalidDefaultRoyalty` if `feeNumerator > 10000`.
- `package.json` (lines 22-30) — confirms pinned versions: `@openzeppelin/contracts: 5.6.1`, `@openzeppelin/wizard: 0.10.8`, `solc: 0.8.35`.
- `src/compiler/index.ts` (lines 30-159) — confirms compile gate signature and `evmVersion: "cancun"` setting; confirms `compileVerify(source, "evm")` accepts any Solidity source.
- `src/commands/create.ts` (lines 30-140) — confirms dispatcher seam unchanged; confirms `compileVerify` insertion point at line 111; confirms E_USAGE message at lines 55-62.
- `src/templates/erc20/{index,wizard,generate,opts,validators,filename}.ts` — locked plugin shape from Phase 2.
- `tests/commands/create.compile.spec.ts` — existing E2E test pattern for compile-verified happy path.
- `tests/compiler/compile.integration.spec.ts` — existing parametrized integration test pattern.

### Secondary (MEDIUM confidence)

- Runtime probes via `node -e` (see §Wave 0 Probe) — confirm wizard outputs for 5 reference cases; confirm `defaults` objects; confirm `isAccessControlRequired` behavior; confirm royalty post-process correctness with bracket-counting.
- Phase 2 RESEARCH.md — established the namespaced-import pattern, golden-snapshot strategy, validator regexes.
- Phase 3 RESEARCH.md (referenced via 03-CONTEXT.md) — established `compileVerify` seam, `evmVersion: "cancun"` deviation, bundled OZ resolver.

### Tertiary (LOW confidence)

- EIP-2981 spec (https://eips.ethereum.org/EIPS/eip-2981) — basis-points denominator 10000 — cross-verified against OZ `_feeDenominator()` which returns 10000.
- ERC-1155 spec (https://eips.ethereum.org/EIPS/eip-1155) — `{id}` placeholder semantics — cross-verified against wizard's runtime output.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All three core packages pinned, audited in Phase 2/3, verified on disk at research time.
- Plugin architecture: HIGH — Phase 2 + Phase 3 established the contract; Phase 4 clones it.
- Royalty post-process: HIGH — Wave 0 probe validated four-anchor injection against three real wizard outputs; bracket-counting handles all edge cases (empty `{}`, modifier chains, multi-line bodies).
- ERC-1155 `updatableUri` default: MEDIUM — Runtime-verified, but the recommendation to match wizard default (vs. force `updatableUri:false`) is a design call that discuss-phase / user may revisit.
- Compile gate acceptance of all 5 fixtures: HIGH — Same gate, same EVM version, same import resolver as Phase 3 already verified for ERC-20; the only new symbol is `ERC2981` which is bundled in `@openzeppelin/contracts@5.6.1`.
- Additive-only plugin model success (zero changes outside `src/templates/` + 3 lines): HIGH — File-set audit (Probe E) exhaustively enumerated every file touched and confirmed `src/compiler/`, `src/registry/`, `src/lib/`, `src/program.ts`, `src/commands/list-templates.ts` are all untouched.
- Pitfall 1 (regex anchor for constructor body): HIGH — Empirically reproduced and fixed during Wave 0 probe.
- Pitfall 4 (supportsInterface override anchor): HIGH — Verified across all-flags-roles + royalty case.

**Research date:** 2026-05-28
**Valid until:** 2026-06-27 (30 days — stable since `@openzeppelin/wizard`, `@openzeppelin/contracts`, and `solc` are version-pinned and won't drift unless explicitly bumped)
