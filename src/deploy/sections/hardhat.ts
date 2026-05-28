// Deploy via Hardhat (DEPLOY-02). Classic scripts/deploy.js + `npx hardhat run`
// (lowest barrier; Ignition is newer and not universal — noted as a v2 pointer).

import type { DeployMeta } from "../types.js";

export function hardhat(meta: DeployMeta): string {
  const name = meta.contractName;
  let deployCall: string;
  if (meta.constructorArgs.length === 0) {
    deployCall = `  const contract = await ${name}.deploy();`;
  } else {
    const argLines = meta.constructorArgs
      .map((a, i) => {
        const comma = i < meta.constructorArgs.length - 1 ? "," : "";
        return `    "${a.exampleValue}"${comma} // ${a.name}`;
      })
      .join("\n");
    deployCall = `  const contract = await ${name}.deploy(\n${argLines}\n  );`;
  }
  return [
    "## Deploy via Hardhat",
    "",
    "```javascript",
    "// scripts/deploy.js — classic Hardhat deploy script.",
    'const hre = require("hardhat");',
    "",
    "async function main() {",
    `  const ${name} = await hre.ethers.getContractFactory("${name}");`,
    deployCall,
    "  await contract.waitForDeployment();",
    '  console.log("Deployed to:", await contract.getAddress());',
    "}",
    "",
    "main().catch((e) => { console.error(e); process.exitCode = 1; });",
    "```",
    "",
    "```bash",
    "npx hardhat run scripts/deploy.js --network <NETWORK_NAME>",
    "```",
    "",
    "_Hardhat Ignition is the newer declarative alternative — see https://hardhat.org/ignition (v2)._",
  ].join("\n");
}
