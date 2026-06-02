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
import { solanaHeader } from "./solana/header.js";
import { solanaParams } from "./solana/params.js";
import { solanaSafetyChecklist } from "./solana/safety-checklist.js";
import { solanaSplTokenCli } from "./solana/spl-token-cli.js";
import { solanaAnchor } from "./solana/anchor.js";
import { solanaSolscan } from "./solana/solscan.js";
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
  if (chain === "solana") {
    // Solana section set (DEPLOY-05): header, warnings, safety, params, then the
    // two deploy paths (spl-token CLI + Anchor) covering devnet + mainnet-beta,
    // then Solscan. warningsSection is reused (it renders meta.warnings generically).
    return [
      (m) => solanaHeader(m, now),
      warningsSection,
      solanaSafetyChecklist,
      solanaParams,
      solanaSplTokenCli,
      solanaAnchor,
      solanaSolscan,
    ];
  }
  throw new Error(`No deploy sections registered for chain '${chain}'`);
}
