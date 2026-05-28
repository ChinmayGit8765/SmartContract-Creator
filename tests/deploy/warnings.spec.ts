import { describe, it, expect } from "vitest";
import { centralizationWarnings } from "../../src/deploy/warnings.js";
import type { DeployFlags } from "../../src/deploy/types.js";

// DEPLOY-06 / D-13 warning matrix + byte-lock.
//
// The expected `*_BODY` literals below are copied BYTE-FOR-BYTE from the
// pre-refactor wizard sources (src/templates/{erc20,erc721,erc1155}/wizard.ts).
// This pins centralizationWarnings()'s bodies so the 05-03 wizard refactor can
// emit the critical subset and remain byte-identical to today's visible output.

const ERC20_MINT_BODY =
  "Mintable + Ownable: a single key can mint unlimited tokens. " +
  "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.";
const ERC721_MINT_BODY =
  "Mintable + Ownable: a single key can mint unlimited NFTs. " +
  "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.";
const ERC1155_MINT_BODY =
  "Mintable + Ownable: a single key can mint unlimited quantities of any token id. " +
  "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.";
const ERC721_ROYALTY_BODY =
  "EIP-2981 + Ownable: the contract owner can change the royalty recipient at any time via _setDefaultRoyalty. " +
  "Marketplaces may distrust royalty signals from single-key-controlled contracts.";
const ERC721_PAUSE_BODY =
  "Pausable + Ownable: a single key can halt all NFT transfers. " +
  "Consider AccessControl (multi-role) or a multisig owner.";
const ERC1155_PAUSE_BODY =
  "Pausable + Ownable: a single key can halt all transfers across every token id. " +
  "Consider AccessControl (multi-role) or a multisig owner.";
const ERC1155_URI_BODY =
  "ERC-1155 default-URI setter is owner-controlled (wizard default `updatableUri:true`). " +
  "The contract owner can change the URI template at any time. Use a multisig owner or freeze ownership before launch if metadata must be immutable.";

const baseFlags = (over: Partial<DeployFlags>): DeployFlags => ({
  mintable: false,
  burnable: false,
  pausable: false,
  access: "none",
  ...over,
});

describe("centralizationWarnings — DEPLOY-06 matrix", () => {
  it("erc20 mintable+ownable → one critical mintable-ownable (byte-identical)", () => {
    const w = centralizationWarnings({
      standard: "erc20",
      flags: baseFlags({ mintable: true, access: "ownable" }),
    });
    expect(w).toHaveLength(1);
    expect(w[0].id).toBe("mintable-ownable");
    expect(w[0].severity).toBe("critical");
    expect(w[0].body).toBe(ERC20_MINT_BODY);
  });

  it("erc20 no flags / access none → []", () => {
    expect(centralizationWarnings({ standard: "erc20", flags: baseFlags({}) })).toEqual([]);
  });

  it("erc721 mintable+royalty+pausable + ownable → three critical, byte-identical", () => {
    const w = centralizationWarnings({
      standard: "erc721",
      flags: baseFlags({
        mintable: true,
        pausable: true,
        royalty: true,
        access: "ownable",
      }),
    });
    const byId = Object.fromEntries(w.map((x) => [x.id, x]));
    expect(byId["mintable-ownable"].body).toBe(ERC721_MINT_BODY);
    expect(byId["pausable-ownable"].body).toBe(ERC721_PAUSE_BODY);
    expect(byId["royalty-ownable"].body).toBe(ERC721_ROYALTY_BODY);
    expect(w.every((x) => x.severity === "critical")).toBe(true);
  });

  it("erc721 mintable-ownable body says 'unlimited NFTs' (differs from erc20)", () => {
    const w = centralizationWarnings({
      standard: "erc721",
      flags: baseFlags({ mintable: true, access: "ownable" }),
    });
    expect(w[0].body).toContain("unlimited NFTs");
    expect(w[0].body).not.toBe(ERC20_MINT_BODY);
  });

  it("erc1155 always emits erc1155-uri-owner (even no-flags/access none)", () => {
    const bare = centralizationWarnings({ standard: "erc1155", flags: baseFlags({}) });
    expect(bare.map((x) => x.id)).toEqual(["erc1155-uri-owner"]);
    expect(bare[0].body).toBe(ERC1155_URI_BODY);
    expect(bare[0].severity).toBe("critical");
  });

  it("erc1155 mintable+pausable + ownable → mintable/pausable + always-on uri (byte-identical)", () => {
    const w = centralizationWarnings({
      standard: "erc1155",
      flags: baseFlags({ mintable: true, pausable: true, access: "ownable" }),
    });
    const byId = Object.fromEntries(w.map((x) => [x.id, x]));
    expect(byId["mintable-ownable"].body).toBe(ERC1155_MINT_BODY);
    expect(byId["pausable-ownable"].body).toBe(ERC1155_PAUSE_BODY);
    expect(byId["erc1155-uri-owner"].body).toBe(ERC1155_URI_BODY);
  });

  it("erc20/erc721 never emit erc1155-uri-owner", () => {
    const e20 = centralizationWarnings({
      standard: "erc20",
      flags: baseFlags({ mintable: true, access: "ownable" }),
    });
    const e721 = centralizationWarnings({
      standard: "erc721",
      flags: baseFlags({ mintable: true, access: "ownable" }),
    });
    expect(e20.some((x) => x.id === "erc1155-uri-owner")).toBe(false);
    expect(e721.some((x) => x.id === "erc1155-uri-owner")).toBe(false);
  });

  it("roles + (mintable||pausable) → includes info roles-multi-key", () => {
    const w = centralizationWarnings({
      standard: "erc20",
      flags: baseFlags({ mintable: true, access: "roles" }),
    });
    const roles = w.find((x) => x.id === "roles-multi-key");
    expect(roles).toBeDefined();
    expect(roles?.severity).toBe("info");
    // roles never produces the critical mintable-ownable warning.
    expect(w.some((x) => x.id === "mintable-ownable")).toBe(false);
  });

  it("roles with NO mintable/pausable → no roles-multi-key", () => {
    const w = centralizationWarnings({
      standard: "erc20",
      flags: baseFlags({ burnable: true, access: "roles" }),
    });
    expect(w.some((x) => x.id === "roles-multi-key")).toBe(false);
  });

  it("the critical subset is exactly today's wizard literals (byte-equality lock)", () => {
    // erc20 mintable+ownable
    const e20 = centralizationWarnings({
      standard: "erc20",
      flags: baseFlags({ mintable: true, access: "ownable" }),
    })
      .filter((x) => x.severity === "critical")
      .map((x) => x.body);
    expect(e20).toEqual([ERC20_MINT_BODY]);

    // erc721 mintable+royalty+pausable+ownable (order: mint, pause, royalty)
    const e721 = centralizationWarnings({
      standard: "erc721",
      flags: baseFlags({ mintable: true, pausable: true, royalty: true, access: "ownable" }),
    })
      .filter((x) => x.severity === "critical")
      .map((x) => x.body);
    expect(e721).toEqual([ERC721_MINT_BODY, ERC721_PAUSE_BODY, ERC721_ROYALTY_BODY]);

    // erc1155 mintable+pausable+ownable (order: mint, pause, uri-owner)
    const e1155 = centralizationWarnings({
      standard: "erc1155",
      flags: baseFlags({ mintable: true, pausable: true, access: "ownable" }),
    })
      .filter((x) => x.severity === "critical")
      .map((x) => x.body);
    expect(e1155).toEqual([ERC1155_MINT_BODY, ERC1155_PAUSE_BODY, ERC1155_URI_BODY]);
  });

  it("no warning body contains a 0x-prefixed address literal — T-05-01", () => {
    const combos: { standard: "erc20" | "erc721" | "erc1155"; flags: DeployFlags }[] = [
      { standard: "erc20", flags: baseFlags({ mintable: true, pausable: true, access: "ownable" }) },
      { standard: "erc721", flags: baseFlags({ mintable: true, royalty: true, pausable: true, access: "ownable" }) },
      { standard: "erc1155", flags: baseFlags({ mintable: true, pausable: true, access: "roles" }) },
    ];
    for (const c of combos) {
      for (const w of centralizationWarnings(c)) {
        expect(w.body).not.toMatch(/0x[0-9a-fA-F]{40}/);
      }
    }
  });
});
