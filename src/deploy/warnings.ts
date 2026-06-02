// Phase 5 — single-source centralization warnings (D-03).
//
// This is the ONE place centralization risk is computed. The wizard emits the
// `critical`-severity subset (preserving its byte-identical visible behavior) and
// the DEPLOY.md renders the full set. Because both draw from this function,
// DEPLOY-06's "auto-disclose based on the option combo" is a STRUCTURAL guarantee,
// not copy-paste-and-hope.
//
// IMPORTANT — per-standard text drift: the three "Mintable + Ownable" bodies are
// NOT identical (erc20 "tokens" / erc721 "NFTs" / erc1155 "quantities of any token
// id"). The bodies below are BYTE-IDENTICAL to the wizard literals in
// src/templates/{erc20,erc721,erc1155}/wizard.ts — tests/deploy/warnings.spec.ts
// and tests/deploy/wizard-parity.spec.ts (05-03) lock this.

import type {
  CentralizationWarning,
  DeployFlags,
  DeployStandard,
} from "./types.js";

/** The mintable+ownable body differs per standard (the noun differs). */
function mintableOwnableBody(standard: DeployStandard): string {
  switch (standard) {
    case "erc721":
      return (
        "Mintable + Ownable: a single key can mint unlimited NFTs. " +
        "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy."
      );
    case "erc1155":
      return (
        "Mintable + Ownable: a single key can mint unlimited quantities of any token id. " +
        "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy."
      );
    default: // erc20 (and spl, which never reaches here with mintable+ownable)
      return (
        "Mintable + Ownable: a single key can mint unlimited tokens. " +
        "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy."
      );
  }
}

/** The pausable+ownable body differs per standard (erc721/erc1155 are NFT/token-id
 *  framed; erc20 is the generic transfers framing). */
function pausableOwnableBody(standard: DeployStandard): string {
  switch (standard) {
    case "erc721":
      return (
        "Pausable + Ownable: a single key can halt all NFT transfers. " +
        "Consider AccessControl (multi-role) or a multisig owner."
      );
    case "erc1155":
      return (
        "Pausable + Ownable: a single key can halt all transfers across every token id. " +
        "Consider AccessControl (multi-role) or a multisig owner."
      );
    default: // erc20
      return (
        "Pausable + Ownable: a single key can halt all transfers. " +
        "Consider AccessControl (multi-role) or a multisig owner."
      );
  }
}

/** Single source of truth for centralization warnings (DEPLOY-06 / D-03).
 *  Returns warnings in a stable order: mintable-ownable, pausable-ownable,
 *  royalty-ownable (erc721), erc1155-uri-owner (erc1155 always), roles-multi-key.
 *  The wizard emits only severity==="critical"; the DEPLOY.md renders all. */
export function centralizationWarnings({
  standard,
  flags,
}: {
  standard: DeployStandard;
  flags: DeployFlags;
}): CentralizationWarning[] {
  const out: CentralizationWarning[] = [];
  const ownable = flags.access === "ownable";

  if (flags.mintable && ownable) {
    out.push({
      id: "mintable-ownable",
      severity: "critical",
      title: "Mintable + Ownable",
      body: mintableOwnableBody(standard),
    });
  }

  if (flags.pausable && ownable) {
    out.push({
      id: "pausable-ownable",
      severity: "critical",
      title: "Pausable + Ownable",
      body: pausableOwnableBody(standard),
    });
  }

  if (standard === "erc721" && flags.royalty && ownable) {
    out.push({
      id: "royalty-ownable",
      severity: "critical",
      title: "EIP-2981 + Ownable",
      body:
        "EIP-2981 + Ownable: the contract owner can change the royalty recipient at any time via _setDefaultRoyalty. " +
        "Marketplaces may distrust royalty signals from single-key-controlled contracts.",
    });
  }

  if (standard === "erc1155") {
    // Always-on: the wizard default updatableUri:true ships an owner-controlled
    // setURI in EVERY erc1155 contract, so this warning fires on every run.
    out.push({
      id: "erc1155-uri-owner",
      severity: "critical",
      title: "Owner-controlled URI",
      body:
        "ERC-1155 default-URI setter is owner-controlled (wizard default `updatableUri:true`). " +
        "The contract owner can change the URI template at any time. Use a multisig owner or freeze ownership before launch if metadata must be immutable.",
    });
  }

  if (standard === "spl") {
    // Solana authority footguns (SPL-02 / SPL-03). The wizard emits the critical
    // subset byte-identical to these bodies (tests/deploy/wizard-parity.spec.ts).
    if (flags.mintAuthorityRetained) {
      out.push({
        id: "spl-mint-authority-retained",
        severity: "critical",
        title: "Mint authority retained",
        body:
          "Mint authority retained: whoever holds the mint authority can mint unlimited new tokens, inflating supply at will. " +
          "Revoke it (choose null) for a fixed, trustless supply, or transfer it to a multisig before launch.",
      });
    }
    if (flags.freezeAuthorityRetained) {
      out.push({
        id: "spl-freeze-authority-retained",
        severity: "critical",
        title: "Freeze authority retained",
        body:
          "Freeze authority retained: the authority holder can freeze any holder's token account, blocking their transfers. " +
          "Choose null if you never need to freeze accounts — it cannot be added back after the mint is created.",
      });
    }
    if (flags.metadata) {
      out.push({
        id: "spl-metadata-update-authority",
        severity: "info",
        title: "Metadata update authority",
        body:
          "Metaplex metadata is created as mutable with the deployer as update authority — name/symbol/URI can be changed later. " +
          "Set the metadata immutable or hand the update authority to a multisig once the token details are final.",
      });
    }
  }

  if (flags.access === "roles" && (flags.mintable || flags.pausable)) {
    // NEW (DEPLOY.md only — info severity, NOT emitted by the wizard).
    out.push({
      id: "roles-multi-key",
      severity: "info",
      title: "AccessControl — multiple privileged roles",
      body:
        "This contract uses AccessControl — multiple addresses hold privileged roles " +
        "(DEFAULT_ADMIN_ROLE / MINTER_ROLE / PAUSER_ROLE). Confirm each is granted to the intended address.",
    });
  }

  return out;
}
