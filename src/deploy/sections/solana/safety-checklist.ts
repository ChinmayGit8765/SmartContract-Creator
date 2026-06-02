// Pre-Deploy Safety Checklist for Solana SPL tokens (DEPLOY-08, Solana flavor).
// Authority items are tailored to the user's mint/freeze choices.

import type { DeployMeta } from "../../types.js";

const STATIC_ITEMS = [
  "- [ ] Deploy to devnet first and confirm the mint, supply, and authorities before mainnet-beta.",
  "- [ ] Replace the placeholder `declare_id!` with your real program id via `anchor keys sync`.",
  "- [ ] Keep your deployer keypair secret — never paste a keypair that controls real funds into an untrusted script.",
  "- [ ] Decide who holds the upgrade authority of the deployed program (or set it to null to make the program immutable).",
];

export function solanaSafetyChecklist(meta: DeployMeta): string {
  const lines: string[] = ["## Pre-Deploy Safety Checklist", "", ...STATIC_ITEMS];
  const f = meta.flags;
  if (f.mintAuthorityRetained) {
    lines.push(
      "- [ ] Mint authority is RETAINED — you can mint unlimited supply. Move it to a multisig or revoke it once supply is final.",
    );
  } else {
    lines.push(
      "- [ ] Mint authority will be REVOKED (fixed supply) — double-check the initial supply is exactly what you want; you cannot mint more later.",
    );
  }
  if (f.freezeAuthorityRetained) {
    lines.push(
      "- [ ] Freeze authority is RETAINED — you can freeze any holder. Confirm holders are aware; consider null if you don't need it.",
    );
  }
  if (f.metadata) {
    lines.push(
      "- [ ] Metadata is created mutable with you as update authority — host the off-chain JSON/image and make it immutable (or use a multisig) once final.",
    );
  }
  return lines.join("\n");
}
