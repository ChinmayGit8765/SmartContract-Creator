// Phase 4 — ERC-721 NFT template plugin barrel.
//
// 1:1 clone of src/templates/erc20/index.ts (CONTEXT D-01). Per the registry
// boundary contract: the registry-returned `Template` is opaque — `runWizard` /
// `generate` are NOT re-exported from this barrel; the dispatcher only depends on
// the registry-returned shape.
//
// `Erc721Template extends Template<Erc721Opts>` narrows both optional fields to
// required at the concrete binding site below.

import { register, get } from "../../registry/index.js";
import type { Template } from "../../registry/types.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import type { Erc721Opts } from "./opts.js";

/** Registers the ERC-721 NFT template. Idempotent — safe to call multiple times.
 *  Phase 4's first new EVM contract type; proves the additive-only plugin model.
 */
export function registerErc721Template(): void {
  if (get("erc721")) return;
  const tpl: Template<Erc721Opts> = {
    id: "erc721",
    name: "ERC-721 NFT",
    chain: "evm",
    status: "alpha",
    description:
      "Non-fungible token (ERC-721) on EVM chains. Opt-in Mintable/Enumerable/Burnable/Pausable + EIP-2981 royalty.",
    runWizard,
    generate,
  };
  // Cast at the registry boundary: TS function-parameter contravariance forbids
  // assigning Template<Erc721Opts> to Template<unknown>, but the registry stores
  // templates opaquely — the dispatcher always re-pairs the registry-returned
  // template with its own runWizard's return value before calling generate, so the
  // variance is sound at runtime.
  register(tpl as unknown as Template);
}
