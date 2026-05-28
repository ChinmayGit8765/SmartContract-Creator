# Phase 5: DEPLOY.md Generation - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning
**Mode:** Auto-elected (recommended options across all gray areas)

<domain>
## Phase Boundary

Every time `smartc create` writes a contract `.sol` file, it ALSO writes a `DEPLOY.md` alongside it (named to match: `MyToken.sol` → `MyToken.DEPLOY.md` or `DEPLOY.md` depending on naming decision below). The DEPLOY.md is a deployment guide tailored to (a) the template/chain and (b) the user's exact option combination.

For EVM templates (ERC-20, ERC-721, ERC-1155), the DEPLOY.md includes:
- Copy-pasteable Hardhat deploy commands (DEPLOY-02)
- Copy-pasteable Foundry (`forge`) deploy commands (DEPLOY-03)
- An "Open in Remix" one-liner for the simplest path (DEPLOY-04)
- Centralization warnings auto-derived from the option combination (DEPLOY-06) — e.g., Ownable + Mintable → "a single key can mint unlimited tokens"
- Etherscan verification command snippets (DEPLOY-07)
- A pre-deploy safety checklist (DEPLOY-08)

This phase establishes the **deploy-doc generation framework** that Phase 7 plugs SPL/Solana into (DEPLOY-05 — `spl-token` + Anchor commands — is Phase 7's responsibility; this phase builds the framework + all EVM content).

**Out of scope (later phases / v2):**
- SPL/Solana deploy commands (DEPLOY-05) — Phase 7 plugs into the framework built here.
- `smartc doctor` toolchain detection — Phase 6.
- AI add-feature — Phase 8.
- Automated verification/deployment from the CLI (broadcasting txns, calling Etherscan API) — explicitly OUT OF SCOPE per REQUIREMENTS.md (DEPLOY.md gives instructions; the tool never broadcasts).
- Per-chain RPC config, gas estimation, multisig setup automation — v2.

</domain>

<decisions>
## Implementation Decisions

### Deploy-doc plugin architecture (additive to the Phase 2 plugin model)
- **D-01: Add an optional `deployMeta?(opts: TOpts): DeployMeta` method to the `Template<TOpts>` interface.** This mirrors how Phase 2 added `runWizard?`/`generate?` — additive optional fields, no breaking change. Each EVM template implements `deployMeta()` to return a NORMALIZED, chain-agnostic descriptor the deploy generator reads. This keeps the deploy generator from having to know each template's bespoke `Opts` shape.
- **D-02: `DeployMeta` is the normalized contract between templates and the deploy generator.** Shape (researcher/planner finalizes exact fields): `{ contractName: string; chain: "evm" | "solana"; standard: "erc20" | "erc721" | "erc1155" | "spl"; constructorArgs: { name: string; type: string; exampleValue: string }[]; flags: { mintable: boolean; burnable: boolean; pausable: boolean; access: "ownable" | "roles" | "none"; [k: string]: ... }; warnings: CentralizationWarning[] }`. The `warnings` array is the SINGLE SOURCE for DEPLOY-06 — computed once in `deployMeta()`, reused by both the wizard's live warnings AND the DEPLOY.md.
- **D-03: Centralization warnings are computed in one place and reused.** Phase 2 + Phase 4 templates already surface centralization warnings DURING the wizard (e.g. Mintable+Ownable). Phase 5 refactors that warning logic into a shared `centralizationWarnings(meta)` function (in `src/deploy/warnings.ts`) so the wizard and the DEPLOY.md draw from the SAME rules. NOTE: this is the ONE place Phase 5 touches existing template code — and it's a DRY refactor, not a behavior change (the same warnings still fire in the wizard). If the refactor proves invasive, fall back to duplicating the warning text in the deploy module and leave the wizard warnings untouched (planner's judgment after reading the existing wizard warning code).

### DEPLOY.md content structure
- **D-04: Markdown template with deterministic sections.** The DEPLOY.md is assembled from composable section-renderers (one function per section), NOT a single string blob. Sections in order: (1) Header (contract name + standard + smartc/solc/@oz versions), (2) ⚠ Centralization Warnings (DEPLOY-06), (3) Pre-Deploy Safety Checklist (DEPLOY-08), (4) Deploy via Remix (DEPLOY-04 — simplest), (5) Deploy via Hardhat (DEPLOY-02), (6) Deploy via Foundry (DEPLOY-03), (7) Verify on Etherscan (DEPLOY-07), (8) Constructor arguments reference. Each section is a pure `(meta: DeployMeta) => string` function in `src/deploy/sections/`.
- **D-05: Commands are copy-pasteable and parameterized with the real contract name + constructor args.** Hardhat/Foundry/Remix snippets reference the actual `MyToken` contract name and show the constructor args the user's options produced (e.g., an ERC-20 with name/symbol/premint shows those values in the `forge create --constructor-args` line). Placeholders for things the tool can't know (RPC URL, private key, Etherscan API key) are clearly marked `<YOUR_RPC_URL>` etc. with a one-line note.
- **D-06: Safety checklist is partly static, partly option-derived.** Static items (review owner address, test on a testnet first, set up a multisig for privileged roles, audit before mainnet value). Option-derived items appended based on flags (e.g., if Mintable: "Confirm who holds MINTER_ROLE / owner — they can mint unlimited supply"; if Pausable: "Confirm who can pause — they can freeze all transfers"; if Royalty: "Confirm the royalty recipient address and basis points are correct — the owner can change them post-deploy").

### Filenaming
- **D-07: DEPLOY.md is named `<ContractName>.DEPLOY.md` alongside the `.sol`.** For `MyToken.sol`, the deploy doc is `MyToken.DEPLOY.md` in the SAME directory. Rationale: DEPLOY-01 says "named to match the contract file"; prefixing with the contract name (rather than a bare `DEPLOY.md`) avoids collisions when a user generates multiple contracts into the same directory. If `--out path/to/Custom.sol` is given, the deploy doc is `path/to/Custom.DEPLOY.md`.
- **D-08: Overwrite gate applies to the DEPLOY.md too.** The existing `confirmOverwrite` (Phase 1) gates the `.sol`; Phase 5 also gates the DEPLOY.md path. If EITHER target exists, prompt (unless `--force`). To keep it simple: check both paths up-front, prompt once listing both files that would be overwritten. Planner finalizes the exact prompt UX.

### Dispatcher integration
- **D-09: Deploy-doc generation slots into `src/commands/create.ts` AFTER compile-verify, alongside the `.sol` write.** New flow: `runWizard → generate → compileVerify → [resolve both out paths] → [overwrite gate for both] → writeFile(.sol) → if(tpl.deployMeta) writeFile(DEPLOY.md) → result + nextStep`. The deploy-doc write is gated on `tpl.deployMeta` being present — a template without it (e.g., a future template that opts out) just doesn't get a DEPLOY.md, no error.
- **D-10: DEPLOY.md is written ONLY after the `.sol` compile-verifies.** Same safety principle as Phase 3: no artifacts on disk for a contract that doesn't compile. The deploy doc describes a verified contract; if compile fails, neither file is written.

### Versioning + provenance
- **D-11: DEPLOY.md header records provenance.** "Generated by smartc <ver> · solc <ver> · @openzeppelin/contracts <ver> · <date>". Uses the existing `safeReadVersion` helper (Phase 1). This is the honest-attribution surface Phase 2 deferred (Phase 2 D-deferred "SmartC-attribution header in generated files" — the DEPLOY.md is where it belongs, NOT in the .sol).

### Testing
- **D-12: Golden-snapshot the DEPLOY.md per template per option-combination, mirroring the .sol fixture strategy.** Committed fixtures under `tests/fixtures/deploy/`: `erc20-bare.DEPLOY.md`, `erc20-all-flags.DEPLOY.md`, `erc721-all-flags-with-royalty.DEPLOY.md`, `erc1155-all-flags.DEPLOY.md` (a representative spread, NOT exhaustive — same discipline as Phase 2 D-10). Plus per-section unit tests asserting specific content (e.g., "Mintable+Ownable produces the unlimited-mint warning string").
- **D-13: Centralization-warning matrix test.** A focused unit test in `tests/deploy/warnings.spec.ts` that drives `centralizationWarnings()` across the flag combinations and asserts the exact warning set per combination — this is the DEPLOY-06 lock. Especially: Ownable+Mintable → unlimited-mint warning; Ownable+Pausable → freeze-all-transfers warning; roles → "multiple addresses hold privileged roles" framing.
- **D-14: E2E test extends `tests/commands/create.compile.spec.ts`** — after a create run, assert BOTH `<Name>.sol` AND `<Name>.DEPLOY.md` exist on disk, and the DEPLOY.md contains the Hardhat/Foundry/Remix headers + the expected centralization warning for the chosen options.

### Claude's Discretion
- **Exact `DeployMeta` field names** — researcher/planner finalizes. Keep `flags` keys aligned with the existing Opts field names (`mintable`, `burnable`, `pausable`, `access`) so the mapping from `opts` → `DeployMeta` is mechanical.
- **Hardhat vs Hardhat-Ignition** — Hardhat shipped Ignition as the recommended deploy system. Researcher picks: a classic `scripts/deploy.js` + `npx hardhat run` snippet (simplest, most widely understood) vs an Ignition module. Default: classic script (lowest barrier; Ignition is newer and not universal). Document the choice.
- **Foundry snippet style** — `forge create` one-liner (simplest) vs a `forge script` Solidity deploy script. Default: `forge create --rpc-url <> --private-key <> --constructor-args <...>` one-liner for the simplest path, with a note pointing at `forge script` for production.
- **Remix one-liner** — the "Open in Remix" deep-link uses a GitHub-gist or raw-URL import. Since the contract file is LOCAL (not on GitHub yet), the Remix path is likely "copy this file into a new Remix file" instructions + a link to remix.ethereum.org. Researcher confirms whether a deep-link import from a local file is feasible; if not, the simplest honest path is "open remix.ethereum.org, create MyToken.sol, paste the contents". Document.
- **Section copy + tone** — newbie vs terse. The DEPLOY.md is a written artifact, NOT CLI output, so it's verbose by nature; but the `--newbie` flag could add extra explanatory prose. Default: the DEPLOY.md content is the SAME regardless of `--newbie` (the doc is self-contained and explanatory by design); newbie mode only affects the CLI `output.explain` lines, not the written doc. Planner confirms.
- **Whether to refactor wizard warnings into the shared module (D-03) or duplicate** — planner reads the existing Phase 2/4 wizard warning code and decides. Preference: refactor to shared `centralizationWarnings()` so there's one source of truth; fall back to duplication if the refactor would force changes to more than the warning-emitting lines.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — generate-and-compile-not-deploy principle; DEPLOY.md gives instructions, tool never broadcasts.
- `.planning/REQUIREMENTS.md` §DEPLOY.md Generation — DEPLOY-01..08 (DEPLOY-05 is Phase 7 — SPL; build the framework so Phase 7 plugs in).
- `.planning/ROADMAP.md` §Phase 5 — Goal + SC-1..SC (especially the Ownable+Mintable unlimited-mint warning example).

### Phase 1–4 handoffs
- `.planning/phases/02-erc-20-canary-template/02-CONTEXT.md` — plugin contract (runWizard/generate added as optional fields — the model Phase 5 follows for `deployMeta`); centralization warning copy; D-deferred attribution-header note (DEPLOY.md is the home for attribution).
- `.planning/phases/04-erc-721-and-erc-1155-templates/04-CONTEXT.md` — D-10 conditional access prompt; the per-template warning surfaces (Mintable+Ownable, Royalty+Ownable, Pausable+Ownable); the Opts field names for each template (`mintable`, `burnable`, `pausable`, `access`, `royalty`, `supply`).
- `.planning/phases/03-compile-verify-safety-net/03-CONTEXT.md` — D-10 "no artifacts on disk if compile fails" principle (Phase 5 D-10 mirrors it for DEPLOY.md).
- `src/commands/create.ts` — the dispatcher; the deploy-doc write slots in after compile-verify (lines ~119-130) and alongside the `.sol` write.
- `src/templates/{erc20,erc721,erc1155}/wizard.ts` — the existing centralization-warning emission to refactor/reuse (D-03).
- `src/templates/{erc20,erc721,erc1155}/opts.ts` — the Opts shapes the `deployMeta()` mapping reads.
- `src/registry/types.ts` — the `Template<TOpts>` interface to extend with the optional `deployMeta?`.
- `src/lib/version.ts` — `safeReadVersion` for the DEPLOY.md provenance header.
- `src/lib/prompt.ts` — `confirmOverwrite` to extend for the DEPLOY.md path.

### External (read at planning time)
- Hardhat deploy docs — https://hardhat.org/docs (confirm classic `hardhat run scripts/deploy.js` vs Ignition recommendation).
- Foundry book — https://book.getfoundry.sh/ (`forge create` constructor-args syntax; `forge verify-contract` for DEPLOY-07).
- Remix docs — https://remix-ide.readthedocs.io/ (how a user opens a local .sol; deep-link import feasibility).
- Etherscan verify docs — https://docs.etherscan.io/ (the `forge verify-contract` + `hardhat verify` snippet shapes).
- EIP-2981 — royalty recipient + bps (for the royalty centralization warning in DEPLOY-06).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/commands/create.ts` — the dispatcher. Phase 5 adds the deploy-doc write after compile-verify + `.sol` write. The overwrite gate (step 5) extends to cover both paths.
- `src/templates/{erc20,erc721,erc1155}/index.ts` — each gets a new `deployMeta` field on its Template instance (additive — like runWizard/generate).
- `src/templates/{erc20,erc721,erc1155}/wizard.ts` — the centralization-warning lines to refactor into the shared `centralizationWarnings()` (D-03) — or leave + duplicate if invasive.
- `src/templates/{erc20,erc721,erc1155}/opts.ts` — read by each template's `deployMeta(opts)` mapping.
- `src/registry/types.ts` — extend `Template<TOpts>` with `deployMeta?(opts: TOpts): DeployMeta`.
- `src/lib/version.ts` — `safeReadVersion` for the provenance header.
- `src/lib/prompt.ts` — `confirmOverwrite` extends to the DEPLOY.md path.
- `tests/commands/create.compile.spec.ts` — extend with deploy-doc existence + content assertions (D-14).
- `tests/fixtures/` — add a `deploy/` subdir for golden DEPLOY.md snapshots.

### Established Patterns
- **Optional-method additive plugin extension** — Phase 2 added `runWizard?`/`generate?`; Phase 5 adds `deployMeta?` the same way.
- **Section-renderer composition** — pure `(meta) => string` functions, one per section, assembled in order. Mirrors the compositional style of the codebase.
- **Golden-snapshot + targeted assertion** — Phase 2 D-09 / Phase 4 D-03. DEPLOY.md fixtures follow the same discipline (representative spread, not exhaustive) + per-section content assertions.
- **No artifacts on compile failure** — Phase 3 D-10. Phase 5 D-10 extends it: DEPLOY.md only written after .sol compile-verifies.

### Integration Points
- **`src/commands/create.ts`** — deploy-doc write slots in after compile-verify; overwrite gate covers both `.sol` and `.DEPLOY.md`.
- **`src/registry/types.ts`** — `deployMeta?` added to Template interface.
- **Each template `index.ts`** — adds `deployMeta` binding.
- **NEW module `src/deploy/`** — `index.ts` (`generateDeployDoc(meta): { filename, content }`), `warnings.ts` (`centralizationWarnings(meta): CentralizationWarning[]`), `types.ts` (`DeployMeta`, `CentralizationWarning`), `sections/*.ts` (one renderer per section), `README.md`.

</code_context>

<specifics>
## Specific Ideas

- **One source of truth for centralization warnings (DEPLOY-06)** — the single most important design choice. The warning that fires in the wizard ("you selected Mintable + Ownable — a single key can mint unlimited tokens") MUST be the same warning that lands in the DEPLOY.md. D-03 makes `centralizationWarnings(meta)` the shared computation. This is what makes DEPLOY-06's "auto-discloses centralization warnings based on the user's option combination" a structural guarantee, not a copy-paste-and-hope.
- **The DEPLOY.md is the honest-attribution home** — Phase 2 deliberately kept the `.sol` byte-for-byte matching OpenZeppelin Wizard output (no smartc header). The DEPLOY.md is where smartc's provenance belongs (D-11): "Generated by smartc <ver>". This keeps the contract pristine and the attribution honest.
- **Phase 5 ↔ Phase 7 seam** — the `DeployMeta.chain` field is the dispatch point. Phase 5 implements the `chain: "evm"` deploy sections (Hardhat/Foundry/Remix/Etherscan). Phase 7's SPL template will set `chain: "solana"` and the deploy generator routes to Solana sections (`spl-token` + Anchor + Solscan) — DEPLOY-05. The section-renderer registry (`sections/`) is keyed by chain so Phase 7 ADDS solana sections without touching EVM ones.
- **Minimal touch to existing templates** — Phase 5's risk is the D-03 refactor. If extracting the wizard warnings into a shared module forces wide changes, the fallback (duplicate the warning strings in `src/deploy/warnings.ts`, leave wizards untouched) keeps the blast radius small. The planner decides after reading the actual warning code. Either way, the warning TEXT must be identical between wizard and DEPLOY.md — a test enforces this if duplicated.

</specifics>

<deferred>
## Deferred Ideas

- **SPL/Solana deploy sections (DEPLOY-05)** — Phase 7. The framework (chain-keyed section registry) is built here; Phase 7 adds the solana renderers.
- **Hardhat Ignition module** — defer; classic deploy script is the simplest path for v1. v2 can add an Ignition variant.
- **`forge script` production deploy script** — defer; `forge create` one-liner covers v1. Note it as a pointer in the doc.
- **Automated Etherscan verification from the CLI** — explicitly out of scope (REQUIREMENTS.md TOOL-V2-01). DEPLOY.md gives the command; the tool never calls the API.
- **Gas estimation / bytecode size in the DEPLOY.md** — nice-to-have, defer to a future polish pass (also flagged in Phase 3 deferred).
- **Per-chain deploy variants (Polygon/Arbitrum/BSC RPC presets)** — out of scope per REQUIREMENTS.md (contracts work on any EVM chain; DEPLOY.md can note this generically). v2.
- **Multisig setup walkthrough** — the checklist mentions "set up a multisig"; an actual walkthrough is v2.
- **`--no-deploy-doc` flag to skip DEPLOY.md** — possible ergonomics flag; defer unless a user asks. Phase 5 always generates the doc for EVM templates.

</deferred>

---

*Phase: 05-deploy-md-generation*
*Context gathered: 2026-05-29*
*Auto-mode: all gray areas resolved with recommended options.*
