// Phase 5 — ERC-1155 opts → DeployMeta mapping (D-01/D-02). updatableUri is NOT
// an opts field — the wizard default is true (an owner-controlled setURI ships in
// every contract), so it is hardcoded here, matching generate.ts.

import { erc1155ConstructorArgs } from "../../deploy/constructorArgs.js";
import { centralizationWarnings } from "../../deploy/warnings.js";
import type { AccessMode, DeployFlags, DeployMeta } from "../../deploy/types.js";
import type { Erc1155Opts } from "./opts.js";

export function deployMetaErc1155(opts: Erc1155Opts): DeployMeta {
  const access: AccessMode = opts.access === false ? "none" : opts.access;
  const flags: DeployFlags = {
    mintable: opts.mintable,
    burnable: opts.burnable,
    pausable: opts.pausable,
    access,
    supply: opts.supply,
    updatableUri: true, // wizard default — always on
  };
  return {
    contractName: opts.name,
    chain: "evm",
    standard: "erc1155",
    constructorArgs: erc1155ConstructorArgs(flags),
    flags,
    warnings: centralizationWarnings({ standard: "erc1155", flags }),
  };
}
