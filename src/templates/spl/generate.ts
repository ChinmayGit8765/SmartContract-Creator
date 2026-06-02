// Phase 7 — SPL token (Solana / Anchor) source generator.
//
// Unlike the EVM templates (which delegate verbatim to @openzeppelin/wizard),
// Solana has no equivalent generator library, so this assembles an Anchor
// program `lib.rs` from option-driven parts. The pieces are kept small and
// composed so each option toggles a self-contained block.
//
// Target toolchain (matched by the scratch Cargo.toml in src/compiler/solana.ts
// so the anchor-build compile-verify path stays version-coherent):
//   anchor-lang 0.30.x, anchor-spl 0.30.x, mpl-token-metadata via anchor_spl::metadata.
//
// The generated program: initializes a new SPL Mint with the chosen decimals and
// freeze authority, mints the initial supply to the deployer's associated token
// account, optionally writes Metaplex Token Metadata, and optionally revokes the
// mint authority (immutable supply). declare_id! uses Anchor's well-known
// placeholder — run `anchor keys sync` after `anchor init` to set the real id.

import { toSnakeProgramName, splFilename } from "./naming.js";
import type { SplOpts, GenerateResult } from "./opts.js";

/** Anchor's default `anchor init` program id placeholder. */
const PLACEHOLDER_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";

function escapeRustStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function generate(opts: SplOpts): GenerateResult {
  const programName = toSnakeProgramName(opts.name);
  const revoke = opts.mintAuthority === "revoke";
  const freeze = opts.freezeAuthority === "deployer";
  const meta = opts.metadata;

  const useStmts = [
    "use anchor_lang::prelude::*;",
    "use anchor_spl::associated_token::AssociatedToken;",
    `use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount${
      revoke ? ", set_authority, SetAuthority" : ""
    }};`,
  ];
  if (revoke) {
    useStmts.push("use anchor_spl::token::spl_token::instruction::AuthorityType;");
  }
  if (meta) {
    useStmts.push(
      "use anchor_spl::metadata::{",
      "    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,",
      "    CreateMetadataAccountsV3, Metadata,",
      "};",
    );
  }

  const consts = [
    `const TOKEN_NAME: &str = "${escapeRustStr(opts.name)}";`,
    `const TOKEN_SYMBOL: &str = "${escapeRustStr(opts.symbol)}";`,
    `const TOKEN_DECIMALS: u8 = ${opts.decimals};`,
    `// Initial supply in WHOLE tokens; scaled by 10^decimals at mint time.`,
    `const INITIAL_SUPPLY: u64 = ${opts.supply};`,
  ];
  if (meta) {
    consts.push(
      `// Off-chain JSON metadata (name/image/description). Replace before mainnet.`,
      `const TOKEN_URI: &str = "https://example.com/${programName}.json";`,
    );
  }

  // Instruction body blocks.
  const body: string[] = [
    "        let amount = INITIAL_SUPPLY",
    "            .checked_mul(10u64.pow(TOKEN_DECIMALS as u32))",
    '            .expect("supply overflow");',
    "        if amount > 0 {",
    "            let cpi_accounts = MintTo {",
    "                mint: ctx.accounts.mint.to_account_info(),",
    "                to: ctx.accounts.token_account.to_account_info(),",
    "                authority: ctx.accounts.payer.to_account_info(),",
    "            };",
    "            let cpi_ctx = CpiContext::new(",
    "                ctx.accounts.token_program.to_account_info(),",
    "                cpi_accounts,",
    "            );",
    "            mint_to(cpi_ctx, amount)?;",
    "        }",
  ];

  if (meta) {
    body.push(
      "",
      "        // Metaplex Token Metadata so wallets display name / symbol / image.",
      "        let data = DataV2 {",
      "            name: TOKEN_NAME.to_string(),",
      "            symbol: TOKEN_SYMBOL.to_string(),",
      "            uri: TOKEN_URI.to_string(),",
      "            seller_fee_basis_points: 0,",
      "            creators: None,",
      "            collection: None,",
      "            uses: None,",
      "        };",
      "        create_metadata_accounts_v3(",
      "            CpiContext::new(",
      "                ctx.accounts.token_metadata_program.to_account_info(),",
      "                CreateMetadataAccountsV3 {",
      "                    metadata: ctx.accounts.metadata.to_account_info(),",
      "                    mint: ctx.accounts.mint.to_account_info(),",
      "                    mint_authority: ctx.accounts.payer.to_account_info(),",
      "                    update_authority: ctx.accounts.payer.to_account_info(),",
      "                    payer: ctx.accounts.payer.to_account_info(),",
      "                    system_program: ctx.accounts.system_program.to_account_info(),",
      "                    rent: ctx.accounts.rent.to_account_info(),",
      "                },",
      "            ),",
      "            data,",
      "            true,  // is_mutable",
      "            true,  // update_authority_is_signer",
      "            None,  // collection_details",
      "        )?;",
    );
  }

  if (revoke) {
    body.push(
      "",
      "        // Revoke the mint authority -> fixed, immutable supply (SPL-02).",
      "        let cpi_accounts = SetAuthority {",
      "            current_authority: ctx.accounts.payer.to_account_info(),",
      "            account_or_mint: ctx.accounts.mint.to_account_info(),",
      "        };",
      "        set_authority(",
      "            CpiContext::new(",
      "                ctx.accounts.token_program.to_account_info(),",
      "                cpi_accounts,",
      "            ),",
      "            AuthorityType::MintTokens,",
      "            None,",
      "        )?;",
    );
  }
  body.push("", "        Ok(())");

  // Accounts struct.
  const mintConstraints = [
    "        init,",
    "        payer = payer,",
    "        mint::decimals = TOKEN_DECIMALS,",
    "        mint::authority = payer.key(),",
  ];
  if (freeze) {
    mintConstraints.push("        mint::freeze_authority = payer.key(),");
  }

  const accounts: string[] = [
    "#[derive(Accounts)]",
    "pub struct Initialize<'info> {",
    "    #[account(",
    ...mintConstraints,
    "    )]",
    "    pub mint: Account<'info, Mint>,",
    "    #[account(",
    "        init,",
    "        payer = payer,",
    "        associated_token::mint = mint,",
    "        associated_token::authority = payer,",
    "    )]",
    "    pub token_account: Account<'info, TokenAccount>,",
  ];
  if (meta) {
    accounts.push(
      "    /// CHECK: PDA validated by the Metaplex Token Metadata program during CPI.",
      "    #[account(mut)]",
      "    pub metadata: UncheckedAccount<'info>,",
    );
  }
  accounts.push(
    "    #[account(mut)]",
    "    pub payer: Signer<'info>,",
    "    pub token_program: Program<'info, Token>,",
    "    pub associated_token_program: Program<'info, AssociatedToken>,",
  );
  if (meta) {
    accounts.push("    pub token_metadata_program: Program<'info, Metadata>,");
  }
  accounts.push(
    "    pub system_program: Program<'info, System>,",
    "    pub rent: Sysvar<'info, Rent>,",
    "}",
  );

  const source = [
    "// Generated by smartc — Solana SPL token (Anchor program).",
    "// Place this at programs/" + programName + "/src/lib.rs inside an `anchor init` project,",
    "// then run `anchor keys sync` to replace the placeholder program id below.",
    "",
    ...useStmts,
    "",
    `declare_id!("${PLACEHOLDER_PROGRAM_ID}");`,
    "",
    ...consts,
    "",
    `#[program]`,
    `pub mod ${programName} {`,
    "    use super::*;",
    "",
    "    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {",
    ...body,
    "    }",
    "}",
    "",
    ...accounts,
    "",
  ].join("\n");

  return { filename: splFilename(opts.name), source };
}
