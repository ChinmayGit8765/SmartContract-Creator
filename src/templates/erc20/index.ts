// Phase 2 — ERC-20 template plugin barrel.
//
// Per UI-SPEC UI-09: the five-field literal is normative and byte-locked.
// Per CONTEXT D-03/D-04/D-05: the registry-returned `Template` is the opaque
// boundary — `runWizard`/`generate` are NOT re-exported from this barrel so
// the dispatcher only depends on the registry-returned shape.
//
// Plan 02-01 widened `Template<TOpts>` with optional `runWizard?`/`generate?`;
// `Erc20Template extends Template<Erc20Opts>` narrows both to required at the
// concrete binding site below.

import { register, get } from "../../registry/index.js";
import type { Template } from "../../registry/types.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import type { Erc20Opts } from "./opts.js";

/** Registers the ERC-20 canary template. Idempotent — safe to call multiple times.
 *  Phase 2 retires the foundation-smoke stub; this is the first real template
 *  plugin and the model for ERC-721/ERC-1155/SPL.
 */
export function registerErc20Template(): void {
  if (get("erc20")) return;
  const tpl: Template<Erc20Opts> = {
    id: "erc20",
    name: "ERC-20 Token",
    chain: "evm",
    status: "alpha",
    description: "Fungible token (ERC-20) on EVM chains. Opt-in Mintable/Burnable/Pausable.",
    runWizard,
    generate,
  };
  // Cast at the registry boundary: TS function-parameter contravariance forbids
  // assigning Template<Erc20Opts> to Template<unknown>, but the registry stores
  // templates opaquely (D-05) — the dispatcher always re-pairs the registry-returned
  // template with its own runWizard's return value before calling generate, so the
  // variance is sound at runtime.
  register(tpl as unknown as Template);
}
