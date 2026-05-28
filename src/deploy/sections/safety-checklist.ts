// Pre-Deploy Safety Checklist (DEPLOY-08). Static items always present; option-
// derived items appended per meta.flags (05-RESEARCH lines 386-410).

import type { DeployMeta } from "../types.js";

const STATIC_ITEMS = [
  "- [ ] Review the owner / admin address — whoever holds it controls privileged functions.",
  "- [ ] Deploy to a public testnet (e.g. Sepolia) and exercise every function before mainnet.",
  "- [ ] For any privileged role, set up a multisig (e.g. Safe) instead of a single EOA key.",
  "- [ ] Have the contract audited before it holds real value.",
  "- [ ] Double-check the constructor arguments below — they are baked in at deploy time and cannot be changed without redeploying.",
  "- [ ] Never paste a private key that controls real funds into a shell or script you didn't write.",
];

export function safetyChecklist(meta: DeployMeta): string {
  const lines: string[] = ["## Pre-Deploy Safety Checklist", "", ...STATIC_ITEMS];
  const f = meta.flags;
  if (f.mintable) {
    lines.push(
      "- [ ] Confirm who holds mint authority (MINTER_ROLE / owner) — they can mint unlimited supply.",
    );
  }
  if (f.pausable) {
    lines.push("- [ ] Confirm who can pause — they can freeze all transfers.");
  }
  if (meta.standard === "erc721" && f.royalty) {
    lines.push(
      "- [ ] Confirm the royalty recipient address and basis points are correct — the owner can change them post-deploy via _setDefaultRoyalty.",
    );
  }
  if (meta.standard === "erc1155" && f.updatableUri) {
    lines.push(
      "- [ ] Confirm who can change the token URI — by default the owner can rewrite metadata at any time. Freeze ownership or use a multisig if metadata must be immutable.",
    );
  }
  if (f.access === "ownable") {
    lines.push(
      "- [ ] This contract uses Ownable — a SINGLE key controls all privileged functions. Consider AccessControl or transferring ownership to a multisig.",
    );
  } else if (f.access === "roles") {
    lines.push(
      "- [ ] This contract uses AccessControl — confirm each role (DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE) is granted to the intended address.",
    );
  }
  return lines.join("\n");
}
