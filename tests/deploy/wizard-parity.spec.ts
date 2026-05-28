import { describe, it, expect } from "vitest";
import { centralizationWarnings } from "../../src/deploy/warnings.js";
import type { DeployFlags, DeployStandard } from "../../src/deploy/types.js";

// D-03 drift lock. The wizards now source their warnings from
// centralizationWarnings() and emit only the `critical` subset. This test pins
// that subset byte-for-byte to the pre-refactor wizard literals — so the refactor
// cannot silently change the visible wizard output (or the DEPLOY.md disclosures).
//
// The expected literals below are copied BYTE-FOR-BYTE from the pre-refactor
// src/templates/{erc20,erc721,erc1155}/wizard.ts warn blocks.

const EXPECTED = {
  erc20Mint:
    "Mintable + Ownable: a single key can mint unlimited tokens. " +
    "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  erc721Mint:
    "Mintable + Ownable: a single key can mint unlimited NFTs. " +
    "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  erc721Royalty:
    "EIP-2981 + Ownable: the contract owner can change the royalty recipient at any time via _setDefaultRoyalty. " +
    "Marketplaces may distrust royalty signals from single-key-controlled contracts.",
  erc721Pause:
    "Pausable + Ownable: a single key can halt all NFT transfers. " +
    "Consider AccessControl (multi-role) or a multisig owner.",
  erc1155Mint:
    "Mintable + Ownable: a single key can mint unlimited quantities of any token id. " +
    "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  erc1155Pause:
    "Pausable + Ownable: a single key can halt all transfers across every token id. " +
    "Consider AccessControl (multi-role) or a multisig owner.",
  erc1155Uri:
    "ERC-1155 default-URI setter is owner-controlled (wizard default `updatableUri:true`). " +
    "The contract owner can change the URI template at any time. Use a multisig owner or freeze ownership before launch if metadata must be immutable.",
};

/** Reproduces the wizard's emit: the critical-severity bodies, in order. */
function wizardCriticalBodies(standard: DeployStandard, flags: DeployFlags): string[] {
  return centralizationWarnings({ standard, flags })
    .filter((w) => w.severity === "critical")
    .map((w) => w.body);
}

const base = (over: Partial<DeployFlags>): DeployFlags => ({
  mintable: false,
  burnable: false,
  pausable: false,
  access: "none",
  ...over,
});

describe("wizard parity — critical warnings byte-identical to pre-refactor literals (D-03)", () => {
  it("erc20 mintable+ownable", () => {
    expect(wizardCriticalBodies("erc20", base({ mintable: true, access: "ownable" }))).toEqual([
      EXPECTED.erc20Mint,
    ]);
  });

  it("erc721 mintable+royalty+pausable + ownable (order: mint, pause, royalty)", () => {
    expect(
      wizardCriticalBodies(
        "erc721",
        base({ mintable: true, pausable: true, royalty: true, access: "ownable" }),
      ),
    ).toEqual([EXPECTED.erc721Mint, EXPECTED.erc721Pause, EXPECTED.erc721Royalty]);
  });

  it("erc1155 mintable+pausable + ownable (order: mint, pause, always-on uri)", () => {
    expect(
      wizardCriticalBodies("erc1155", base({ mintable: true, pausable: true, access: "ownable" })),
    ).toEqual([EXPECTED.erc1155Mint, EXPECTED.erc1155Pause, EXPECTED.erc1155Uri]);
  });

  it("erc1155 always emits the URI warning even with no flags", () => {
    expect(wizardCriticalBodies("erc1155", base({}))).toEqual([EXPECTED.erc1155Uri]);
  });

  it("roles combos emit NO critical wizard warning (roles-multi-key is info)", () => {
    expect(wizardCriticalBodies("erc20", base({ mintable: true, access: "roles" }))).toEqual([]);
    expect(
      wizardCriticalBodies("erc721", base({ mintable: true, pausable: true, access: "roles" })),
    ).toEqual([]);
    // erc1155 still emits its always-on uri warning under roles, but NOT a mint/pause critical.
    expect(
      wizardCriticalBodies("erc1155", base({ mintable: true, pausable: true, access: "roles" })),
    ).toEqual([EXPECTED.erc1155Uri]);
  });

  it("no flags / access none → erc20 & erc721 emit nothing", () => {
    expect(wizardCriticalBodies("erc20", base({}))).toEqual([]);
    expect(wizardCriticalBodies("erc721", base({}))).toEqual([]);
  });
});
