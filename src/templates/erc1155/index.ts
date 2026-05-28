// Phase 4 — ERC-1155 multi-token template plugin barrel.
//
// Per CONTEXT D-03/D-04/D-05 (Phase 2 precedent): the registry-returned
// `Template` is the opaque boundary — `runWizard`/`generate` are NOT re-exported
// from this barrel so the dispatcher only depends on the registry-returned shape.
//
// `Erc1155Template extends Template<Erc1155Opts>` narrows both optional
// `runWizard?`/`generate?` fields to required at the concrete binding site below.
//
// Boot wiring (calling registerErc1155Template() from src/cli.ts) lands in plan
// 04-04 (CONTEXT D-12). This plan only ships the registration function.

import { register, get } from "../../registry/index.js";
import type { Template } from "../../registry/types.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import type { Erc1155Opts } from "./opts.js";

/** Registers the ERC-1155 multi-token template. Idempotent — safe to call multiple times.
 *  Per CONTEXT D-08: no royalty in Phase 4 (deferred to v2).
 */
export function registerErc1155Template(): void {
  if (get("erc1155")) return;
  const tpl: Template<Erc1155Opts> = {
    id: "erc1155",
    name: "ERC-1155 Multi-Token",
    chain: "evm",
    status: "alpha",
    description:
      "Multi-token (ERC-1155) on EVM chains. Opt-in Mintable/Burnable/Supply/Pausable.",
    runWizard,
    generate,
  };
  // Cast at the registry boundary: TS function-parameter contravariance forbids
  // assigning Template<Erc1155Opts> to Template<unknown>, but the registry stores
  // templates opaquely (D-05) — the dispatcher always re-pairs the registry-returned
  // template with its own runWizard's return value before calling generate, so the
  // variance is sound at runtime.
  register(tpl as unknown as Template);
}
