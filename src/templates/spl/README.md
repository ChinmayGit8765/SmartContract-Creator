# SPL Token template (Solana / Anchor)

Fungible token (SPL) on Solana, scaffolded as an Anchor program. Registered via
`registerSplTemplate()` (id `spl`, chain `solana`, status `alpha`). Unlike the EVM
templates (which delegate verbatim to `@openzeppelin/wizard`), Solana has no
equivalent generator, so `generate.ts` assembles the program `lib.rs` from
option-driven parts.

## Wizard prompts

Order: `name → symbol → decimals → supply → mint authority → freeze authority →
metadata`.

| # | Prompt | Type | Validator / notes |
|---|--------|------|-------------------|
| 1 | Token name | text | `isTokenName` (1-32, Metaplex limit) |
| 2 | Token symbol | text | `isSplSymbol` (1-10 ASCII) |
| 3 | Decimals (0-9) | text | `isDecimals` (9 = Solana convention) |
| 4 | Initial supply | text | `isWholeSupply` (whole tokens) |
| 5 | Mint authority | select | **explicit, no default** (SPL-02): revoke (null) / keep (deployer) |
| 6 | Freeze authority | select | **explicit, no default** (SPL-03): none (null) / keep (deployer) |
| 7 | Metaplex metadata? | confirm | SPL-04 — wallets show name/symbol/image |

The two authority prompts have **no default** — the user must actively choose
(null is the safer option, listed first). Post-prompt, the wizard emits the
critical centralization warnings (mint/freeze authority retained) sourced from
the single-source `centralizationWarnings({ standard: "spl" })`.

## Output

`generate()` returns `{ filename: "<snake>.rs", source }` — an Anchor program
whose `initialize` instruction creates the mint with the chosen decimals + freeze
authority, mints the initial supply to the deployer's associated token account,
optionally writes Metaplex metadata, and optionally revokes the mint authority
(fixed supply). `declare_id!` uses Anchor's placeholder — `anchor keys sync`
replaces it. Place the file at `programs/<name>/src/lib.rs` in an `anchor init`
project.

## Compile-verify (COMP-02 / SPL-05)

`src/compiler/solana.ts` handles the Solana branch of `compileVerify`:

- **anchor present** → scaffolds a scratch Anchor workspace (Cargo.toml deps
  matched to the generated code: anchor-lang/anchor-spl 0.30.x, +`metadata`
  feature when metadata is on), runs `anchor build`, and throws
  `E_COMPILE_FAILED` on a build failure — nothing un-buildable reaches `--out`.
- **anchor absent** → returns `{ skipped: true }`; the dispatcher writes the file
  anyway and warns the user, pointing them at `smartc doctor` and the Anchor
  install docs. This graceful-degradation path is the well-tested primary path
  (the Anchor toolchain is heavy and frequently absent).

Both side effects (anchor detection + the build runner) are injectable, so the
orchestration is unit-tested without the real toolchain.

## DEPLOY.md (DEPLOY-05)

`deployMeta()` returns a `chain:"solana"` DeployMeta; the chain-keyed section
registry (`src/deploy/sections/index.ts`) renders the Solana set: header,
warnings, safety checklist, token parameters, **two deploy paths** (`spl-token`
CLI and Anchor — each covering devnet + mainnet-beta), and a Solscan view
section. The spl-token commands are tailored to the authority choices
(`authorize ... --disable` only when revoking; `--enable-freeze` only when
keeping freeze authority).

## A note on verification

When the Anchor toolchain is absent, the generated Rust is a best-effort
starting point, not compile-verified — the DEPLOY.md and the program header tell
the user to run `anchor build`. Install Anchor (and re-run, or build manually) to
get the same compile-verified guarantee the EVM templates have.
