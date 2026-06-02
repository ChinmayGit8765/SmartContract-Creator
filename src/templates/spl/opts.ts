// Phase 7 type contracts for the SPL token (Solana / Anchor) template.
// Type-only module. The wizard returns SplOpts; generate() turns it into an
// Anchor program lib.rs; deployMeta() maps it to the chain-agnostic DeployMeta.

import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

/** Mint authority choice (SPL-02): "revoke" = set to null right after minting →
 *  immutable supply; "deployer" = the deployer keeps it → supply can grow. */
export type MintAuthorityChoice = "revoke" | "deployer";

/** Freeze authority choice (SPL-03): "none" = the mint can never freeze accounts;
 *  "deployer" = the deployer can freeze any holder's token account. */
export type FreezeAuthorityChoice = "none" | "deployer";

export interface SplOpts {
  readonly name: string; // display name, e.g. "My Token"
  readonly symbol: string; // e.g. "MYTKN"
  readonly decimals: number; // 0-9
  readonly supply: string; // whole-token count as a string (scaled by decimals at mint)
  readonly mintAuthority: MintAuthorityChoice;
  readonly freezeAuthority: FreezeAuthorityChoice;
  readonly metadata: boolean; // Metaplex Token Metadata (SPL-04)
}

export interface WizardIo {
  readonly output: Output;
}

export interface GenerateResult {
  readonly filename: string;
  readonly source: string;
}

/** Concrete SPL template binding — narrows the optional Template fields to required. */
export interface SplTemplate extends Template<SplOpts> {
  readonly runWizard: (io: WizardIo) => Promise<SplOpts>;
  readonly generate: (opts: SplOpts) => GenerateResult;
}
