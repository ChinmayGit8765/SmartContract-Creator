// Phase 7 — SPL opts → DeployMeta mapping. Pure transform. chain:"solana",
// standard:"spl". Authorities map to the SPL-specific flags the warnings + Solana
// section renderers read; the "constructor args" are the editable source constants.

import { splConstructorArgs } from "../../deploy/constructorArgs.js";
import { centralizationWarnings } from "../../deploy/warnings.js";
import type { DeployFlags, DeployMeta } from "../../deploy/types.js";
import type { SplOpts } from "./opts.js";

export function deployMetaSpl(opts: SplOpts): DeployMeta {
  const flags: DeployFlags = {
    // EVM-shaped keys are not applicable to SPL — normalize to false/none.
    mintable: opts.mintAuthority === "deployer",
    burnable: false,
    pausable: false,
    access: "none",
    // SPL-specific footgun flags:
    mintAuthorityRetained: opts.mintAuthority === "deployer",
    freezeAuthorityRetained: opts.freezeAuthority === "deployer",
    metadata: opts.metadata,
  };
  return {
    contractName: opts.name,
    chain: "solana",
    standard: "spl",
    constructorArgs: splConstructorArgs({
      symbol: opts.symbol,
      decimals: opts.decimals,
      supply: opts.supply,
    }),
    flags,
    warnings: centralizationWarnings({ standard: "spl", flags }),
  };
}
