// Phase 7 — SPL token (Solana / Anchor) template plugin barrel.
// Mirrors the EVM plugins: the registry-returned Template is the opaque boundary;
// runWizard/generate/deployMeta are bound here but not re-exported.

import { register, get } from "../../registry/index.js";
import type { Template } from "../../registry/types.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import { deployMetaSpl } from "./deployMeta.js";
import type { SplOpts } from "./opts.js";

/** Registers the SPL token template. Idempotent. */
export function registerSplTemplate(): void {
  if (get("spl")) return;
  const tpl: Template<SplOpts> = {
    id: "spl",
    name: "SPL Token",
    chain: "solana",
    status: "alpha",
    description:
      "Fungible token (SPL) on Solana via Anchor. Explicit mint/freeze authority; opt-in Metaplex metadata.",
    runWizard,
    generate,
    deployMeta: deployMetaSpl,
  };
  register(tpl as unknown as Template);
}
