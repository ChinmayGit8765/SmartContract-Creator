// View / verify on Solscan (the Solana analog of DEPLOY-07's Etherscan section).

import type { DeployMeta } from "../../types.js";

export function solanaSolscan(_meta: DeployMeta): string {
  return [
    "## View on Solscan",
    "",
    "```bash",
    "# Inspect the mint after creation (devnet):",
    "#   https://solscan.io/token/<MINT_ADDRESS>?cluster=devnet",
    "# Mainnet (drop the ?cluster query):",
    "#   https://solscan.io/token/<MINT_ADDRESS>",
    "",
    "# Confirm authorities + supply from the CLI:",
    "spl-token display <MINT_ADDRESS>",
    "```",
    "",
    "_Solana programs/tokens don't need source verification the way Etherscan does;",
    "wallets read token identity from the Metaplex metadata account instead._",
  ].join("\n");
}
