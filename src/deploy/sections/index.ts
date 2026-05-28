// Chain-keyed section registry — the Phase 7 seam. EVM and Solana have different
// section sets. Phase 7 adds a `"solana"` branch returning SPL/Anchor/Solscan
// renderers WITHOUT touching the EVM ones (05-RESEARCH §Pattern 1).
//
// The header renderer takes an optional `now` Date for deterministic golden
// snapshots; every other renderer is a pure `(meta) => string`. sectionsFor()
// accepts the `now` and binds it into the header wrapper so the registry's
// Section type stays uniform (the assembler passes the frozen date through).

import { header } from "./header.js";
import { warningsSection } from "./warnings.js";
import { safetyChecklist } from "./safety-checklist.js";
import { remix } from "./remix.js";
import { hardhat } from "./hardhat.js";
import { foundry } from "./foundry.js";
import { etherscan } from "./etherscan.js";
import { constructorArgsSection } from "./constructor-args.js";
import type { DeployChain, DeployMeta } from "../types.js";

export type Section = (meta: DeployMeta) => string;

/** Returns the ordered EVM section renderers (D-04 order):
 *  header, warnings, safety-checklist, remix, hardhat, foundry, etherscan,
 *  constructor-args. The header is bound to the supplied `now` date. */
export function sectionsFor(chain: DeployChain, now?: Date): Section[] {
  if (chain === "evm") {
    return [
      (m) => header(m, now),
      warningsSection,
      safetyChecklist,
      remix,
      hardhat,
      foundry,
      etherscan,
      constructorArgsSection,
    ];
  }
  // Phase 7: if (chain === "solana") return SOLANA_SECTIONS;
  throw new Error(`No deploy sections registered for chain '${chain}'`);
}
