// Phase 5 — ERC-20 opts → DeployMeta mapping (D-01/D-02). Pure transform; reads
// the template's own Opts shape and returns the normalized chain-agnostic
// descriptor the deploy generator consumes. Mirrors generate.ts's pure style.

import { erc20ConstructorArgs } from "../../deploy/constructorArgs.js";
import { centralizationWarnings } from "../../deploy/warnings.js";
import type { AccessMode, DeployFlags, DeployMeta } from "../../deploy/types.js";
import type { Erc20Opts } from "./opts.js";

export function deployMetaErc20(opts: Erc20Opts): DeployMeta {
  const access: AccessMode = opts.access === false ? "none" : opts.access;
  const premintNonZero = opts.premint !== "0" && opts.premint !== "";
  const flags: DeployFlags = {
    mintable: opts.mintable,
    burnable: opts.burnable,
    pausable: opts.pausable,
    access,
    premintNonZero,
  };
  return {
    contractName: opts.name,
    chain: "evm",
    standard: "erc20",
    constructorArgs: erc20ConstructorArgs(flags),
    flags,
    warnings: centralizationWarnings({ standard: "erc20", flags }),
  };
}
