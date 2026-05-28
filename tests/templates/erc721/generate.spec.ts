import { describe, it, expect } from "vitest";
import { generate } from "../../../src/templates/erc721/generate.js";
import type { Erc721Opts } from "../../../src/templates/erc721/opts.js";

// Golden snapshots match the fixtures committed in plan 04-01:
//   tests/fixtures/erc721/{bare-default,all-flags-on,all-flags-on-with-royalty}.sol
// Snapshot paths are RELATIVE to THIS spec file:
//   tests/templates/erc721/generate.spec.ts -> tests/fixtures/erc721/<name>.sol
//   == ../../fixtures/erc721/<name>.sol
// `toMatchFileSnapshot` is ASYNC in Vitest 4 — MUST await (PATTERNS §S5).

const ZERO = "0x0000000000000000000000000000000000000000";

/** Builds a minimal Erc721Opts with royalty disabled; override one flag per test. */
function opts(over: Partial<Erc721Opts>): Erc721Opts {
  return {
    name: "X",
    symbol: "X",
    baseUri: "",
    mintable: false,
    enumerable: false,
    burnable: false,
    pausable: false,
    uriStorage: false,
    royalty: { enabled: false, feeNumerator: 0, receiver: ZERO },
    access: false,
    ...over,
  };
}

describe("erc721 generate — golden snapshots", () => {
  it("bare default matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyNFT",
      symbol: "MNFT",
      baseUri: "",
      mintable: false,
      enumerable: false,
      burnable: false,
      pausable: false,
      uriStorage: false,
      royalty: { enabled: false, feeNumerator: 0, receiver: ZERO },
      access: false,
    });
    await expect(source).toMatchFileSnapshot(
      "../../fixtures/erc721/bare-default.sol",
    );
  });

  it("all-flags-on matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyNFT",
      symbol: "MNFT",
      baseUri: "https://example.com/api/token/",
      mintable: true,
      enumerable: true,
      burnable: true,
      pausable: true,
      uriStorage: false,
      royalty: { enabled: false, feeNumerator: 0, receiver: ZERO },
      access: "roles",
    });
    await expect(source).toMatchFileSnapshot(
      "../../fixtures/erc721/all-flags-on.sol",
    );
  });

  it("all-flags-on-with-royalty matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyNFT",
      symbol: "MNFT",
      baseUri: "https://example.com/api/token/",
      mintable: true,
      enumerable: true,
      burnable: true,
      pausable: true,
      uriStorage: false,
      royalty: { enabled: true, feeNumerator: 250, receiver: ZERO },
      access: "roles",
    });
    await expect(source).toMatchFileSnapshot(
      "../../fixtures/erc721/all-flags-on-with-royalty.sol",
    );
  });
});

describe("erc721 generate — per-flag assertions", () => {
  it("burnable=true includes ERC721Burnable import + parent", () => {
    const { source } = generate(opts({ burnable: true }));
    expect(source).toContain("ERC721Burnable");
    expect(source).toContain("token/ERC721/extensions/ERC721Burnable.sol");
  });

  it("enumerable=true includes ERC721Enumerable import + parent", () => {
    const { source } = generate(opts({ enumerable: true }));
    expect(source).toContain("ERC721Enumerable");
    expect(source).toContain("token/ERC721/extensions/ERC721Enumerable.sol");
  });

  it("mintable=true with access=ownable includes Ownable + safeMint()", () => {
    const { source } = generate(opts({ mintable: true, access: "ownable" }));
    expect(source).toContain("Ownable");
    expect(source).toContain("safeMint(");
  });

  it("mintable=true with access=roles includes AccessControl + MINTER_ROLE", () => {
    const { source } = generate(opts({ mintable: true, access: "roles" }));
    expect(source).toContain("AccessControl");
    expect(source).toContain("MINTER_ROLE");
  });

  it("pausable=true with access=ownable includes Pausable + pause()", () => {
    const { source } = generate(opts({ pausable: true, access: "ownable" }));
    expect(source).toContain("Pausable");
    expect(source).toContain("pause()");
  });

  it("royalty enabled injects ERC2981 + _setDefaultRoyalty()", () => {
    const { source } = generate(
      opts({
        royalty: { enabled: true, feeNumerator: 500, receiver: ZERO },
      }),
    );
    expect(source).toContain("ERC2981");
    expect(source).toContain("_setDefaultRoyalty(");
  });

  it("royalty disabled returns source byte-for-byte equal to erc721.print (no injection)", () => {
    const base = generate(opts({ mintable: true, access: "ownable" }));
    expect(base.source).not.toContain("ERC2981");
    expect(base.source).not.toContain("_setDefaultRoyalty(");
  });
});

describe("erc721 generate — return shape", () => {
  it("returns { filename, source } with filename derived from opts.name", () => {
    const result = generate(opts({ name: "My NFT" }));
    expect(result).toHaveProperty("filename");
    expect(result).toHaveProperty("source");
    expect(result.filename).toBe("MyNFT.sol");
    expect(typeof result.source).toBe("string");
    expect(result.source.length).toBeGreaterThan(0);
  });
});
