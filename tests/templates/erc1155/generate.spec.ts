import { describe, it, expect } from "vitest";
import { generate } from "../../../src/templates/erc1155/generate.js";

// Golden snapshots match the committed plan-04-01 fixtures byte-for-byte.
//
// Snapshot fixture paths are relative to THIS spec file:
//   tests/templates/erc1155/generate.spec.ts ->
//   tests/fixtures/erc1155/<name>.sol           ==  ../../fixtures/erc1155/<name>.sol
//
// Input shapes are the locked Erc1155Opts from plan 04-01's Wizard -> Opts
// mapping table. bare-default omits all flags (access:false); the wizard default
// updatableUri:true (passed as a literal in generate.ts) adds Ownable + setURI.

describe("erc1155 generate — golden snapshots (match plan-04-01 fixtures)", () => {
  it("bare default matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyMulti",
      uri: "https://example.com/api/token/{id}.json",
      mintable: false,
      burnable: false,
      supply: false,
      pausable: false,
      access: false,
    });
    // toMatchFileSnapshot is async — MUST await per Vitest 4.
    await expect(source).toMatchFileSnapshot("../../fixtures/erc1155/bare-default.sol");
  });

  it("all-flags-on matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyMulti",
      uri: "https://example.com/api/token/{id}.json",
      mintable: true,
      burnable: true,
      supply: true,
      pausable: true,
      access: "roles",
    });
    await expect(source).toMatchFileSnapshot("../../fixtures/erc1155/all-flags-on.sol");
  });
});

describe("erc1155 generate — per-flag assertions", () => {
  // Each flag exercised independently. Per-flag axis coverage WITHOUT 2^N snapshots.

  it("burnable=true includes the ERC1155Burnable extension", () => {
    const { source } = generate({
      name: "X",
      uri: "https://example.com/api/token/{id}.json",
      mintable: false,
      burnable: true,
      supply: false,
      pausable: false,
      access: false,
    });
    expect(source).toContain("ERC1155Burnable");
    expect(source).toContain("token/ERC1155/extensions/ERC1155Burnable.sol");
  });

  it("mintable=true with access=ownable includes Ownable + mint()", () => {
    const { source } = generate({
      name: "X",
      uri: "https://example.com/api/token/{id}.json",
      mintable: true,
      burnable: false,
      supply: false,
      pausable: false,
      access: "ownable",
    });
    expect(source).toContain("Ownable");
    expect(source).toContain("mint(");
    expect(source).toContain("onlyOwner");
  });

  it("mintable=true with access=roles includes AccessControl + MINTER_ROLE", () => {
    const { source } = generate({
      name: "X",
      uri: "https://example.com/api/token/{id}.json",
      mintable: true,
      burnable: false,
      supply: false,
      pausable: false,
      access: "roles",
    });
    expect(source).toContain("AccessControl");
    expect(source).toContain("MINTER_ROLE");
    expect(source).toContain("onlyRole(MINTER_ROLE)");
  });

  it("supply=true includes the ERC1155Supply extension", () => {
    const { source } = generate({
      name: "X",
      uri: "https://example.com/api/token/{id}.json",
      mintable: false,
      burnable: false,
      supply: true,
      pausable: false,
      access: false,
    });
    expect(source).toContain("ERC1155Supply");
    expect(source).toContain("token/ERC1155/extensions/ERC1155Supply.sol");
  });

  it("pausable=true with access=roles includes ERC1155Pausable + PAUSER_ROLE", () => {
    const { source } = generate({
      name: "X",
      uri: "https://example.com/api/token/{id}.json",
      mintable: false,
      burnable: false,
      supply: false,
      pausable: true,
      access: "roles",
    });
    expect(source).toContain("ERC1155Pausable");
    expect(source).toContain("PAUSER_ROLE");
  });

  it("passes the URI verbatim into the ERC1155(...) constructor arg", () => {
    const { source } = generate({
      name: "X",
      uri: "https://example.com/api/token/{id}.json",
      mintable: false,
      burnable: false,
      supply: false,
      pausable: false,
      access: false,
    });
    expect(source).toContain('ERC1155("https://example.com/api/token/{id}.json")');
  });
});

describe("erc1155 generate — return shape", () => {
  it("returns { filename, source }; filename derived from opts.name", () => {
    const result = generate({
      name: "My Multi",
      uri: "https://example.com/api/token/{id}.json",
      mintable: false,
      burnable: false,
      supply: false,
      pausable: false,
      access: false,
    });
    expect(result.filename).toBe("MyMulti.sol");
    expect(typeof result.source).toBe("string");
    expect(result.source.length).toBeGreaterThan(0);
  });
});
