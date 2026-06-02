# Deploy-doc generation

Turns a normalized, chain-agnostic `DeployMeta` descriptor into a per-template,
per-option `DEPLOY.md` deployment guide. Every `create` run for a template that
exposes `deployMeta(opts)` writes a `<Name>.DEPLOY.md` alongside the `.sol`
file, after compile-verify (Phase 5).

## Public surface

| Export | File | Purpose |
|--------|------|---------|
| `generateDeployDoc(meta, { now? })` | `index.ts` | Assembles the full DEPLOY.md; returns `{ filename, content }`. `now` is injectable for deterministic snapshots. |
| `deployDocPath(solPath)` | `index.ts` | Pure suffix-swap: `Foo.sol` → `Foo.DEPLOY.md`. No new path join (reuses the resolved `.sol` path). |
| `centralizationWarnings({ standard, flags })` | `warnings.ts` | **Single source** of centralization warnings (D-03). Both the wizard and the DEPLOY.md read from here. |
| `erc20ConstructorArgs` / `erc721ConstructorArgs` / `erc1155ConstructorArgs` | `constructorArgs.ts` | Fixture-locked constructor-argument builders — the #1 footgun guard (wrong ctor args = failed deploy). |
| `sectionsFor(chain, now?)` | `sections/index.ts` | Chain-keyed registry of section renderers. Returns the ordered `(meta)=>string` list for a chain; throws for unregistered chains. |

Per-template mappings live in `src/templates/{erc20,erc721,erc1155}/deployMeta.ts`
(opts → `DeployMeta`), bound onto each `Template` literal via the optional
`deployMeta?` field.

## Sections (EVM, D-04 order)

`header → warnings → safety-checklist → remix → hardhat → foundry → etherscan →
constructor-args`. Each is an independently-testable pure `(meta) => string`
function under `sections/`. The assembler joins them with blank lines; golden
fixtures under `tests/fixtures/deploy/*.DEPLOY.md` snapshot-lock the output.

## Locked design decisions

- **`DeployMeta` is the chain-agnostic contract (D-02).** It carries
  `{ contractName, chain, standard, flags, constructorArgs, warnings }` — no
  EVM- or Solana-specific shape leaks into the assembler.
- **Warnings are single-source (D-03).** `centralizationWarnings()` is the only
  place warning bodies are defined. The wizard emits the `severity:"critical"`
  subset live; the DEPLOY.md renders all of them. `wizard-parity.spec.ts` locks
  the wizard's visible output byte-identical to the pre-refactor literals.
- **The section registry is chain-keyed — this is the Phase 7 seam.** Adding
  Solana support means registering `chain:"solana"` renderers in
  `sections/index.ts`; the EVM renderers are untouched.
- **Constructor-arg builders are fixture-locked.** Their output is snapshot-tested
  so a refactor cannot silently emit wrong deploy args.
- **The header date is injectable.** `generateDeployDoc(meta, { now })` threads a
  freezable `Date` into the header so golden snapshots are deterministic; the
  full `solc` version is read from `solc.version()` at runtime, not hardcoded.
- **No raw user input reaches the doc.** Only the compile-verified contract name
  and fixed placeholder tokens (`<YOUR_WALLET_ADDRESS>`, etc.) are interpolated —
  no user-supplied addresses or RPC URLs (T-05-04).

## What Phase 7 plugs in

`DEPLOY-05` (SPL): a `chain:"solana"` entry in the section registry rendering
`spl-token` CLI + Anchor deploy commands for devnet and mainnet-beta. Because
the registry is chain-keyed and `DeployMeta` is chain-agnostic, the SPL template
adds its `deployMeta(opts)` returning `chain:"solana"` and registers solana
section renderers — no change to the EVM path.
