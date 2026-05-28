// Deploy via Foundry (DEPLOY-03). `forge create` one-liner; MUST include
// --broadcast (without it the command is a dry-run that deploys nothing).
// Omit the --constructor-args line entirely for a no-arg constructor.

import type { DeployMeta } from "../types.js";

export function foundry(meta: DeployMeta): string {
  const id = `src/${meta.contractName}.sol:${meta.contractName}`;
  const argLine =
    meta.constructorArgs.length > 0
      ? `  --constructor-args ${meta.constructorArgs
          .map((a) => a.exampleValue)
          .join(" ")} \\`
      : null;
  return [
    "## Deploy via Foundry",
    "",
    "```bash",
    "# Deploy with Foundry (forge create). Requires foundry installed (foundryup).",
    "# Assumes you placed the .sol under src/ in a forge project.",
    "# --broadcast is REQUIRED — without it forge create is a dry-run simulation.",
    `forge create ${id} \\`,
    "  --rpc-url <YOUR_RPC_URL> \\",
    "  --private-key <YOUR_PRIVATE_KEY> \\",
    argLine,
    "  --broadcast",
    "```",
    "",
    "_For production, prefer a versioned `forge script` deploy script — see https://getfoundry.sh/forge/deploying._",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
