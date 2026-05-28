// Deploy via Remix (DEPLOY-04). A local-file deep-link import is NOT feasible
// (Remix #url= loads only remote URLs; local files need the remixd daemon). The
// honest simplest path is "open remix.ethereum.org, create the file, paste."

import type { DeployMeta } from "../types.js";

export function remix(meta: DeployMeta): string {
  const argList = meta.constructorArgs.map((a) => a.name).join(", ");
  const step5 = argList
    ? `5. In the **Deploy & Run** tab, choose your environment (Injected Provider — MetaMask), enter the constructor arguments (${argList}), and click **Deploy**`
    : "5. In the **Deploy & Run** tab, choose your environment (Injected Provider — MetaMask) and click **Deploy** (this contract has no constructor arguments)";
  return [
    "## Deploy via Remix (simplest, no install)",
    "",
    "1. Open https://remix.ethereum.org",
    `2. In the File Explorer, create a new file named \`${meta.contractName}.sol\``,
    `3. Paste the contents of your generated \`${meta.contractName}.sol\` into it`,
    `4. In the **Solidity Compiler** tab, select compiler 0.8.35 and click "Compile ${meta.contractName}.sol"`,
    step5,
    "",
    "_Power users can pre-load the source via `https://remix.ethereum.org/?code=<base64-of-source>`, but the copy-paste path above is the simplest._",
  ].join("\n");
}
