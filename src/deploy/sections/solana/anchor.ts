// Deploy via Anchor (DEPLOY-05) — builds and deploys the generated program to
// devnet + mainnet-beta. This path is needed when you want the on-chain program
// (e.g. for the Metaplex metadata CPI it performs at initialize time).

import type { DeployMeta } from "../../types.js";

export function solanaAnchor(meta: DeployMeta): string {
  return [
    "## Deploy via Anchor (the generated program)",
    "",
    "Deploys the generated Anchor program, then calls its `initialize` instruction",
    "to create the mint and mint the initial supply" +
      (meta.flags.metadata ? " (and write Metaplex metadata)" : "") +
      ". Requires the Anchor toolchain (`smartc doctor`).",
    "",
    "```bash",
    "# 1. Scaffold a project and drop in the generated program:",
    "anchor init my-token && cd my-token",
    `#   replace programs/my-token/src/lib.rs with the generated ${meta.contractName} source`,
    "",
    "# 2. Sync the program id (updates declare_id! + Anchor.toml):",
    "anchor keys sync",
    "",
    "# 3. Build:",
    "anchor build",
    "",
    "# 4. Deploy to devnet (then re-run against mainnet-beta when ready):",
    "anchor deploy --provider.cluster devnet",
    "#   mainnet:  anchor deploy --provider.cluster mainnet",
    "",
    "# 5. Call initialize (via your tests/ or a client script) to create the mint",
    "#    and mint the initial supply to your wallet's associated token account.",
    "```",
    "",
    "_The generated program revokes the mint authority inside `initialize` when you",
    "chose a fixed supply — no extra step needed on this path._",
  ].join("\n");
}
