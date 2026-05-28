# Phase 4: ERC-721 + ERC-1155 Templates - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Mode:** Auto-elected (recommended options across all gray areas)

<domain>
## Phase Boundary

Add two new generatable templates — `erc721` (NFT) and `erc1155` (multi-token) — that plug into the Phase 2 plugin contract (`runWizard → generate`) and ride the Phase 3 compile gate without changes to the dispatcher or the gate itself.

The phase validates the additive-only plugin model promised by Phase 2 D-03: a new template should ship by adding files under `src/templates/<id>/`, calling `register<Foo>Template()` from `src/cli.ts` boot, and writing tests — with ZERO modifications to `src/commands/create.ts`, `src/compiler/`, `src/registry/`, or any Phase 1/2/3 library.

Both templates compile-verify via the existing Phase 3 `compileVerify` gate. Output filename derives from the contract name (`MyNFT` → `MyNFT.sol`) per Phase 2 D-04.

**Out of scope (later phases):**
- DEPLOY.md alongside generated files — Phase 5.
- SPL token (Solana) — Phase 7.
- AI add-feature on generated NFT/1155 files — Phase 8.
- Cross-platform install hardening — Phase 9.
- ERC-721 votes / on-chain SVG / merkle-mint — v2 (REQUIREMENTS.md §v2).
- ERC-1155 EIP-2981 royalties / per-id URI overrides — v2.

</domain>

<decisions>
## Implementation Decisions

### Plugin shape (inherited from Phase 2 D-03..D-06)
- **D-01: Mirror the Phase 2 ERC-20 file layout per template.** Each of `src/templates/erc721/` and `src/templates/erc1155/` ships an `index.ts` barrel (`register<Foo>Template()` + `Template<TFooOpts>` instance), `wizard.ts` (@clack/prompts sequence), `generate.ts` (thin wrapper around `@openzeppelin/wizard.erc721.print` / `.erc1155.print`), and `opts.ts` (per-template Opts type). This is the proven Phase 2 shape — the test that the plugin model is additive is "is this layout the same?".
- **D-02: Wizard package version (`@openzeppelin/wizard@0.10.8`) is NOT bumped in Phase 4.** Locked at Phase 2 D-07 pin; no version churn for new templates. Phase 4 just exercises more of the same wizard package surface (`erc721.print` and `erc1155.print` instead of `erc20.print`).
- **D-03: Per-template golden snapshots (hybrid strategy from Phase 2 D-09).** Two committed snapshots per template — `bare-default.sol` (minimum opts, no flags) and `all-flags-on.sol` (maximum opts ON). Plus per-flag assertions. Same naming convention as `tests/fixtures/erc20/`.

### ERC-721 royalty surface (ERC721-03) — KEY DISCOVERY
- **D-04: `@openzeppelin/wizard@0.10.8` does NOT include EIP-2981 royalty support in its `ERC721Options` interface.** The wizard's typed surface (`baseUri`, `enumerable`, `uriStorage`, `burnable`, `pausable`, `mintable`, `incremental`, `votes`, `namespacePrefix`) does not have a `royalty` field. The smartc wizard MUST collect royalty inputs (basis points + recipient address) and inject them via a post-process string transform on the wizard's printed output — adding an `ERC2981` parent + `import "@openzeppelin/contracts/token/common/ERC2981.sol"` + a constructor call `_setDefaultRoyalty(recipient, fee)`. This is the ONE place Phase 4 has to violate Phase 2 D-02 ("no string templating") — but only for the royalty post-process; the rest of the file is byte-for-byte wizard output.
- **D-05: Royalty post-process is a single targeted insertion, not a template body.** The transform inserts (a) the import line above the contract declaration, (b) the `ERC2981` parent in the contract's `is ...` list, (c) the `_setDefaultRoyalty(...)` call at the END of the constructor. Each insertion is a one-line `string.replace()` against a literal regex anchor visible in the wizard's emit (e.g., the `contract <Name>` line, the `constructor(` opener). Documented in `src/templates/erc721/royalty.ts` with the regex anchors as comments. If wizard changes its output shape across versions, the snapshot tests catch it instantly.
- **D-06: Royalty is opt-in only; default OFF.** When opted-OUT, the wizard's output is byte-for-byte unchanged (no royalty.ts code runs). The wizard's all-flags-on snapshot for ERC-721 does NOT include royalty — royalty has its OWN snapshot pair (`all-flags-on-with-royalty.sol`) to keep the wizard-pure path testable and the royalty-injected path testable separately.
- **D-07: Royalty input validation** — basis points must be an integer 0–10000 (10000 = 100%, EIP-2981 spec); recipient must match `/^0x[0-9a-fA-F]{40}$/` (canonical EVM address checksum). Validators live in `src/templates/erc721/wizard.ts` next to the other Solidity-input validators.

### ERC-1155 surface
- **D-08: ERC-1155 has NO royalty in Phase 4.** Per REQUIREMENTS.md §v2 ERC1155-V2-01, EIP-2981 on ERC-1155 is deferred to v2. The wizard prompts for ERC-1155: `uri template`, `mintable`, `burnable`, `supply` (supply tracking), `pausable`, and access control (Ownable vs AccessControl) when mintable or pausable is selected.
- **D-09: URI template input** — wizard's `uri` option accepts a string with `{id}` placeholder (per ERC-1155 spec). Default `"https://example.com/api/token/{id}.json"` as the suggested value in the wizard prompt; validate non-empty.

### Conditional access control prompt (ERC721-05, ERC1155-05)
- **D-10: Reuse Phase 2 conditional-prompt pattern from `src/templates/erc20/wizard.ts`.** When mintable OR pausable is true, prompt for `access: "ownable" | "roles"`. Same UI copy, same option labels, same default ("ownable"). This validates the additive-only plugin model — the same prompt code is duplicated per template (NOT extracted to a shared module in Phase 4; if a fourth template needs it, a Phase 5+ refactor can extract).

### Output naming
- **D-11: Filename = sanitized contract name + `.sol`.** Same rule as Phase 2 D-04. `My NFT` → `MyNFT.sol`; `MyToken` → `MyToken.sol`. `--out <path>` overrides. ERC-1155's "name" prompt is the contract name (e.g., `MyMultiToken`), NOT the URI.

### Compile-verify integration (Phase 3 seam — no changes)
- **D-12: NO modifications to `src/compiler/` or `src/commands/create.ts` in Phase 4.** The Phase 3 `compileVerify(source, chain)` seam already accepts any Solidity source; new templates just emit Solidity and the gate runs unchanged. SC-5 (all three Solidity templates pass compile-verify with full option matrices) is satisfied by exercising the existing gate with each template's golden fixtures.
- **D-13: Snapshot fixtures double as compile-verify canaries.** Each template's `bare-default.sol`, `all-flags-on.sol`, and (ERC-721 only) `all-flags-on-with-royalty.sol` MUST compile clean. New integration tests in `tests/compiler/compile.integration.spec.ts` extend the Phase 3 corpus by adding these fixtures to the same real-solc compile loop.

### Wizard picker (multi-template selection)
- **D-14: `smartc create` without `--template` still throws E_USAGE in Phase 4.** Phase 2 left an `E_USAGE` ("Missing --template flag") because only one template shipped; Phase 4 has three templates and an interactive picker WOULD be nice — but adding it is a separate UX surface that pulls Phase 2's required-flag-or-picker design decision out of "Deferred". Decision: keep the required-flag behavior in Phase 4; revisit in Phase 5/6 alongside `smartc list-templates --json` ergonomics. UPDATE THE ERROR MESSAGE FIX to mention all three templates: `Re-run with --template <erc20|erc721|erc1155>`.
- **D-15: `smartc list-templates` now shows three rows.** Both new templates register themselves on boot via `src/cli.ts` adding `registerErc721Template()` and `registerErc1155Template()` next to the existing `registerErc20Template()`. The registry's `register()` throws on duplicate id (Phase 1 D-08) so id collisions are caught at boot.

### Test layering
- **D-16: Match Phase 2's test split per template.** Each template gets: `tests/templates/<id>/wizard.spec.ts` (mocked @clack/prompts), `tests/templates/<id>/generate.spec.ts` (real wizard package, golden snapshots, per-flag assertions). The integration tests in `tests/compiler/compile.integration.spec.ts` extend to cover **7 total fixtures = 2 existing ERC-20 (bare-default + all-flags-on) + 5 NEW Phase-4 fixtures (2 ERC-721 [bare-default, all-flags-on] + 1 ERC-721-with-royalty + 2 ERC-1155 [bare-default, all-flags-on])**. E2E coverage via `tests/commands/create.compile.spec.ts` extends to add ERC-721 and ERC-1155 happy-path cases.
- **D-17: Royalty post-process gets its own unit test.** `tests/templates/erc721/royalty.spec.ts` — feed a known wizard output through the transform, assert the three insertions land at the right anchors, assert the result still compiles via the Phase 3 gate.

### Claude's Discretion
- **Exact wizard prompt order per template** — Researcher/planner finalizes. Default for ERC-721: `name → symbol → baseUri → mintable → enumerable → burnable → pausable → royalty (opt-in) → if(royalty) basis-points + recipient → if(mintable||pausable) access`. Default for ERC-1155: `name → uri → mintable → burnable → supply → pausable → if(mintable||pausable) access`.
- **Centralization-warning copy for ERC-721 / ERC-1155** — same wording as Phase 2 for Mintable+Ownable (single-key-unlimited-mint), reused verbatim. Researcher picks any template-specific warnings (e.g., EIP-2981 fee can be changed by owner if Mintable+Ownable — capture as a separate warning).
- **`erc721.print(opts)` vs `printERC721(opts)` import shape** — wizard 0.10.8 ships both; researcher picks the namespaced form (`erc721.print`) to match Phase 2's `erc20.print` usage.
- **README inside `src/templates/<id>/`** — recommended yes, one short page per template explaining the wizard prompt set, the opts mapping, the royalty post-process (ERC-721 only), and any deviations from wizard defaults. Sets expectations for Phase 7 (SPL plug-in) and Phase 8 (AI add-feature).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Project framing; ERC-721 and ERC-1155 in Active requirements.
- `.planning/REQUIREMENTS.md` §ERC-721 (ERC721-01..05) + §ERC-1155 (ERC1155-01..05) — the locked requirements.
- `.planning/REQUIREMENTS.md` §v2 (ERC721-V2-01..03, ERC1155-V2-01..02) — explicitly out-of-scope features for this phase.
- `.planning/ROADMAP.md` §Phase 4 — Goal + SC-1..SC-5 (especially SC-2 for EIP-2981 and SC-5 for "all three Solidity templates pass compile-verify").

### Phase 1–3 handoffs
- `.planning/phases/02-erc-20-canary-template/02-CONTEXT.md` — Locked plugin contract (D-03..D-06); golden-snapshot strategy (D-09); per-flag assertion pattern (D-09); centralization warning copy.
- `.planning/phases/02-erc-20-canary-template/02-VERIFICATION.md` — confirms plugin shape works end-to-end.
- `.planning/phases/03-compile-verify-safety-net/03-CONTEXT.md` — D-06 seam shape `compileVerify(source, chain)`; D-13 three-layer test strategy.
- `.planning/phases/03-compile-verify-safety-net/03-VERIFICATION.md` — confirms compile gate runs unchanged for any EVM source.
- `src/templates/erc20/index.ts` + `wizard.ts` + `generate.ts` + `opts.ts` — the literal layout to clone per new template.
- `src/lib/output.ts` — Output channels (warn, explain, reference, nextStep) — reused identically per Phase 1 contract.

### External (read at planning time)
- `@openzeppelin/wizard` package source — `node_modules/@openzeppelin/wizard/dist/erc721.d.ts` + `erc1155.d.ts` for the typed option surface; `printERC721` / `printERC1155` signatures.
- OpenZeppelin Wizard live UI (https://wizard.openzeppelin.com) — Reference for the expected output of ERC-721 + ERC-1155 across all flag combinations. Useful for spot-checking the snapshot fixtures.
- EIP-2981 spec (https://eips.ethereum.org/EIPS/eip-2981) — NFT royalty standard; basis points 0–10000 = 0–100%.
- ERC-1155 spec (https://eips.ethereum.org/EIPS/eip-1155) — multi-token; URI template with `{id}` placeholder.

### Existing committed fixtures (referenced for snapshot parity)
- `tests/fixtures/erc20/bare-default.sol` + `tests/fixtures/erc20/all-flags-on.sol` — Phase 2 + 3 templates; new fixtures live alongside under `tests/fixtures/erc721/` and `tests/fixtures/erc1155/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/templates/erc20/index.ts` — Template registration pattern. Clone verbatim for `erc721` and `erc1155`, changing only the id/name/description/runWizard/generate references.
- `src/templates/erc20/wizard.ts` — @clack/prompts sequence pattern. Clone per template, swap the prompt list. The conditional access-control branch (when mintable||pausable) ports directly.
- `src/templates/erc20/generate.ts` — Thin wrapper around `erc20.print(opts)`. Mirror as `erc721.print(opts)` and `erc1155.print(opts)`. The ERC-721 generate.ts adds the royalty post-process layer when `opts.royalty.enabled === true`.
- `src/templates/erc20/opts.ts` — Per-template Opts type. ERC-721 adds `royalty?: { enabled: boolean; fee: number; receiver: string }`; ERC-1155 adds `uri: string` and `supply: boolean`.
- `src/cli.ts` — Boots the registry. Add two import lines + two `register*Template()` calls next to the existing ERC-20 registration.
- `src/commands/create.ts` — NO CHANGES per D-12, except the E_USAGE fix-line copy update per D-14 (`Re-run with --template <erc20|erc721|erc1155>`).
- `src/compiler/` — NO CHANGES per D-12. The compile gate runs unchanged.
- `src/lib/output.ts` — Output factory unchanged; wizard reuses `output.warn` for centralization warnings, `output.explain` / `output.reference` / `output.nextStep` for newbie-mode copy.
- `src/lib/errors.ts` — `CliError` + stable codes reused. Phase 4 introduces ONE new stable code: `ERR_INVALID_INPUT` (already shipped in Phase 2 per D-04 Phase 2 — confirm; if not present, add). Used for royalty-bps + recipient-address validator failures.
- `tests/templates/erc20/wizard.spec.ts` + `generate.spec.ts` — Clone per new template. Mock pattern is locked from Phase 1 (vi.mock @clack/prompts at module top + dynamic SUT import).
- `tests/compiler/compile.integration.spec.ts` — Extend the existing parametrized test to add the four new fixtures (2 ERC-721 + 1 ERC-1155 + 1 ERC-721-with-royalty). Same test shape, more rows.
- `tests/commands/create.compile.spec.ts` — Extend with ERC-721 and ERC-1155 happy-path cases. Same in-process dispatcher pattern, new template ids.

### Established Patterns
- **`vi.mock('@clack/prompts', ...)` + dynamic SUT import** — Locked Vitest 4 ESM pattern.
- **Conditional access prompt** — `if (opts.mintable || opts.pausable) opts.access = await select(...)` — duplicated per template (additive-only model — no shared abstraction yet).
- **Snapshot pair per template** — `bare-default.sol` + `all-flags-on.sol`. ERC-721 adds a third: `all-flags-on-with-royalty.sol`.
- **Stable error codes** — `ERR_USAGE`, `ERR_FILE_EXISTS`, `ERR_WIZARD_CANCEL`, `ERR_COMPILE_FAILED`, `ERR_INVALID_INPUT` (Phase 2). No new codes in Phase 4.

### Integration Points
- **`src/cli.ts` boot sequence** — Add `registerErc721Template()` and `registerErc1155Template()` next to the existing ERC-20 registration. Three lines added.
- **`src/commands/create.ts` E_USAGE copy** — Update the `fix:` line to list all three template ids. One-line change.
- **`tests/registry.spec.ts`** — Existing tests verify Phase 1's foundation-smoke stub registration; extend (or add new spec) to verify all three templates register without throwing on collision.
- **`tests/compiler/compile.integration.spec.ts`** — Add 4 new fixture rows to the parametrized "compiles clean" suite.

</code_context>

<specifics>
## Specific Ideas

- **Royalty as the "additive-only" stress test** — ERC-721's EIP-2981 royalty is the one feature in Phase 4 that the wizard doesn't natively support. The post-process transform (D-04..D-06) is the audit-able workaround: a 30-line targeted transform with regex anchors, its own unit test, its own snapshot pair. If a future @openzeppelin/wizard release adds royalty natively, the transform can be retired in a dedicated commit and the snapshot diff is the audit trail.
- **Snapshot fixture maintenance discipline** — All snapshot files are committed as-emitted by the wizard (LF-encoded). When `@openzeppelin/wizard` bumps, regenerate via a dedicated script (`scripts/regenerate-fixtures.mjs`?) and review the diff as a pull request. Phase 4 does NOT ship the regenerate script (defer to v2); Phase 4 just locks the snapshot strategy.
- **Phase 4 ↔ Phase 5 seam** — DEPLOY.md generation (Phase 5) reads the per-option flag combination to surface centralization warnings. Phase 4's `Opts` types are the input contract for Phase 5's DEPLOY.md generator — keep field names stable (e.g., `mintable: boolean`, `access: "ownable" | "roles"`, `royalty: { ... }`) so Phase 5 can read them directly without renaming.
- **The plugin model's first real test** — Phase 4's success is binary: ZERO changes to `src/compiler/`, `src/commands/create.ts` (except the E_USAGE copy), `src/registry/`, `src/lib/`. If Phase 4 requires modifying any of those files for reasons beyond the one-line E_USAGE-copy update, the plugin model has a flaw to fix.

</specifics>

<deferred>
## Deferred Ideas

- **EIP-2981 on ERC-1155** — Deferred to v2 per REQUIREMENTS.md §v2 (ERC1155-V2-01). Multi-token royalties have more design surface (per-id royalty vs default royalty) and the spec is less universally supported than ERC-721 royalties.
- **ERC-721 votes (governance)** — Wizard supports it via `votes` option but it's a v2 requirement (ERC721-V2-01). Adds clock-mode choice (`'blocknumber' | 'timestamp'`) which is a UX-design question.
- **ERC-721 whitelist / merkle-mint** — v2 (ERC721-V2-02). Substantial additional UX surface (merkle root input, leaf format) and a separate test-vector concern.
- **ERC-721 on-chain SVG metadata** — v2 (ERC721-V2-03). Substantial bytecode-size implications.
- **Per-token-id URI overrides on ERC-1155** — v2 (ERC1155-V2-02).
- **Interactive wizard template picker (`smartc create` with no `--template`)** — Deferred to Phase 5 or Phase 6 (alongside `list-templates --json` ergonomics). Phase 4 ships three required-flag-only templates; the multi-template picker is its own UX surface.
- **Shared `accessControlPrompt()` extracted module** — Currently duplicated per template (additive model). If a fourth template ships in v1.5 or v2, refactor to a shared helper at that point.
- **Snapshot regeneration script** — `scripts/regenerate-fixtures.mjs` — defer to v2.

</deferred>

---

*Phase: 04-erc-721-and-erc-1155-templates*
*Context gathered: 2026-05-28*
*Auto-mode: all gray areas resolved with recommended options.*
