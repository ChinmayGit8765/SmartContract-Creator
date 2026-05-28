// Phase 5 — ERC-721 opts → DeployMeta mapping (D-01/D-02). Reads opts.royalty.enabled
// into the normalized `royalty` flag; royalty adds NO constructor arg.

import { erc721ConstructorArgs } from "../../deploy/constructorArgs.js";
import { centralizationWarnings } from "../../deploy/warnings.js";
import type { AccessMode, DeployFlags, DeployMeta } from "../../deploy/types.js";
import type { Erc721Opts } from "./opts.js";

export function deployMetaErc721(opts: Erc721Opts): DeployMeta {
  const access: AccessMode = opts.access === false ? "none" : opts.access;
  const flags: DeployFlags = {
    mintable: opts.mintable,
    burnable: opts.burnable,
    pausable: opts.pausable,
    access,
    enumerable: opts.enumerable,
    royalty: opts.royalty.enabled,
  };
  return {
    contractName: opts.name,
    chain: "evm",
    standard: "erc721",
    constructorArgs: erc721ConstructorArgs(flags),
    flags,
    warnings: centralizationWarnings({ standard: "erc721", flags }),
  };
}
