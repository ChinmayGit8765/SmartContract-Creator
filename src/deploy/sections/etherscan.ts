// Verify on Etherscan (DEPLOY-07). Two shapes — Foundry (cast abi-encode +
// forge verify-contract) and Hardhat (npx hardhat verify). The compiler version
// must be the FULL solc string `v0.8.35+commit.47b9dedd` (Etherscan matches the
// commit hash); a short `0.8.35` fails verification (pitfall 3). Driven from
// solc.version() at runtime so it stays in sync if solc is bumped.

import { createRequire } from "node:module";
import type { DeployMeta } from "../types.js";

const require = createRequire(import.meta.url);

/** `0.8.35+commit.47b9dedd.Emscripten.clang` → `v0.8.35+commit.47b9dedd`. */
function fullSolcVersion(): string {
  try {
    const solc = require("solc") as { version: () => string };
    const raw = solc.version(); // e.g. 0.8.35+commit.47b9dedd.Emscripten.clang
    const m = raw.match(/^(\d+\.\d+\.\d+\+commit\.[0-9a-f]+)/);
    if (m) return `v${m[1]}`;
    return `v${raw}`;
  } catch {
    return "v0.8.35+commit.47b9dedd";
  }
}

export function etherscan(meta: DeployMeta): string {
  const id = `src/${meta.contractName}.sol:${meta.contractName}`;
  const ver = fullSolcVersion();
  const hasArgs = meta.constructorArgs.length > 0;
  const typeList = meta.constructorArgs.map((a) => a.type).join(",");
  const valList = meta.constructorArgs.map((a) => a.exampleValue).join(" ");

  const forgeCtorLine = hasArgs
    ? `  --constructor-args $(cast abi-encode "constructor(${typeList})" ${valList}) \\`
    : null;
  const hardhatArgs = hasArgs
    ? " " + meta.constructorArgs.map((a) => `"${a.exampleValue}"`).join(" ")
    : "";

  return [
    "## Verify on Etherscan",
    "",
    "```bash",
    "# Verify on Etherscan (Foundry). Needs an Etherscan API key.",
    `forge verify-contract <DEPLOYED_ADDRESS> ${id} \\`,
    forgeCtorLine,
    `  --compiler-version ${ver} \\`,
    "  --etherscan-api-key <KEY> \\",
    "  --chain <CHAIN>",
    "```",
    "",
    "```bash",
    "# Verify on Etherscan (Hardhat). Needs @nomicfoundation/hardhat-verify configured.",
    `npx hardhat verify --network <NETWORK_NAME> <DEPLOYED_ADDRESS>${hardhatArgs}`,
    "```",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
