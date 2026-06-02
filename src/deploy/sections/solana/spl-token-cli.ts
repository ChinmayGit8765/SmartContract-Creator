// Deploy via the spl-token CLI (DEPLOY-05) — the quickest path to a token that
// does NOT require deploying the Anchor program. Covers devnet + mainnet-beta.
// Authority lines are tailored to the user's mint/freeze choices.

import type { DeployMeta } from "../../types.js";
import { argVal } from "./helpers.js";

export function solanaSplTokenCli(meta: DeployMeta): string {
  const decimals = argVal(meta, "TOKEN_DECIMALS", "9");
  const supply = argVal(meta, "INITIAL_SUPPLY", "0");
  const freezeFlag = meta.flags.freezeAuthorityRetained ? " --enable-freeze" : "";

  const lines = [
    "## Deploy via spl-token CLI (fastest path)",
    "",
    "Creates the mint directly through the on-chain SPL Token program — no Anchor",
    "deploy required. Requires the Solana CLI + spl-token (`smartc doctor`).",
    "",
    "```bash",
    "# 1. Pick a cluster (devnet first; swap the URL for mainnet-beta when ready):",
    "solana config set --url https://api.devnet.solana.com",
    "#   mainnet:  solana config set --url https://api.mainnet-beta.solana.com",
    "",
    "# 2. Fund the deployer wallet (devnet only):",
    "solana airdrop 2",
    "",
    `# 3. Create the mint with ${decimals} decimals:`,
    `spl-token create-token --decimals ${decimals}${freezeFlag}`,
    "#   -> note the printed <MINT_ADDRESS>",
    "",
    "# 4. Create your associated token account for the mint:",
    "spl-token create-account <MINT_ADDRESS>",
    "",
    `# 5. Mint the initial supply (${supply} whole tokens):`,
    `spl-token mint <MINT_ADDRESS> ${supply}`,
  ];

  if (!meta.flags.mintAuthorityRetained) {
    lines.push(
      "",
      "# 6. Revoke the mint authority -> fixed, immutable supply (your choice):",
      "spl-token authorize <MINT_ADDRESS> mint --disable",
    );
  }
  if (!meta.flags.freezeAuthorityRetained) {
    lines.push(
      "",
      "# Freeze authority was set to null at creation (no --enable-freeze) — accounts can never be frozen.",
    );
  }
  if (meta.flags.metadata) {
    lines.push(
      "",
      "# Metadata: attach Metaplex Token Metadata so wallets show name/symbol/image.",
      "# Use `metaboss` or the Anchor program path below — the spl-token CLI alone does not write metadata.",
    );
  }
  lines.push("```");
  return lines.join("\n");
}
