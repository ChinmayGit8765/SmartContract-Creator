// Token parameters baked into the generated program (editable source constants).

import type { DeployMeta } from "../../types.js";
import { argVal } from "./helpers.js";

export function solanaParams(meta: DeployMeta): string {
  const symbol = argVal(meta, "TOKEN_SYMBOL", "MYTKN");
  const decimals = argVal(meta, "TOKEN_DECIMALS", "9");
  const supply = argVal(meta, "INITIAL_SUPPLY", "0");
  const mintAuth = meta.flags.mintAuthorityRetained ? "retained (deployer)" : "revoked (null)";
  const freezeAuth = meta.flags.freezeAuthorityRetained ? "retained (deployer)" : "none (null)";
  const metadata = meta.flags.metadata ? "yes (Metaplex)" : "no";
  return [
    "## Token Parameters",
    "",
    "These are baked into the program as source constants — edit them in the `.rs`",
    "file before building if you need to change them.",
    "",
    "| Parameter | Value |",
    "|-----------|-------|",
    `| Name | ${meta.contractName} |`,
    `| Symbol | ${symbol} |`,
    `| Decimals | ${decimals} |`,
    `| Initial supply | ${supply} (whole tokens) |`,
    `| Mint authority | ${mintAuth} |`,
    `| Freeze authority | ${freezeAuth} |`,
    `| Metadata | ${metadata} |`,
  ].join("\n");
}
