import { describe, it, expect } from "vitest";
import { generate } from "../../../src/templates/erc20/generate.js";

// Locked test inputs per .planning/phases/02-erc-20-canary-template/02-CONTEXT.md
// D-09 + 02-UI-SPEC.md UI-12 (default wizard values: premint=1000000).
//
// Snapshot fixture paths are relative to THIS spec file:
//   tests/templates/erc20/generate.spec.ts  ->
//   tests/fixtures/erc20/<name>.sol            ==  ../../fixtures/erc20/<name>.sol
//
// Bodies adapted from .planning/phases/02-erc-20-canary-template/02-RESEARCH.md
// §Snapshot Test Mechanics (lines ~615-694), with `premint:"0"` replaced by
// `premint:"1000000"` for the golden snapshots per UI-12 (RESEARCH's "0"
// example is documentation-compact only — per Plan 02-02 task 3 action note).

describe("erc20 generate — golden snapshots (D-09)", () => {
  it("bare default matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyToken",
      symbol: "MTK",
      premint: "1000000",
      mintable: false,
      burnable: false,
      pausable: false,
      access: false,
    });
    // toMatchFileSnapshot is async — MUST await per Vitest 4 (RESEARCH Pitfall 2).
    await expect(source).toMatchFileSnapshot("../../fixtures/erc20/bare-default.sol");
  });

  it("all-flags-on matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyToken",
      symbol: "MTK",
      premint: "1000000",
      mintable: true,
      burnable: true,
      pausable: true,
      access: "roles",
    });
    await expect(source).toMatchFileSnapshot("../../fixtures/erc20/all-flags-on.sol");
  });
});

describe("erc20 generate — per-flag assertions (D-09)", () => {
  // Each flag is exercised independently. Per-flag axis coverage WITHOUT
  // 2^N snapshots (D-10). Six axes: burnable / mintable+ownable /
  // mintable+roles / pausable+roles / premint>0 / SPDX header.

  it("burnable=true includes ERC20Burnable import + parent", () => {
    const { source } = generate({
      name: "X",
      symbol: "X",
      premint: "0",
      mintable: false,
      burnable: true,
      pausable: false,
      access: false,
    });
    expect(source).toContain("ERC20Burnable");
    expect(source).toContain("token/ERC20/extensions/ERC20Burnable.sol");
  });

  it("mintable=true with access=ownable includes Ownable + mint() onlyOwner", () => {
    const { source } = generate({
      name: "X",
      symbol: "X",
      premint: "0",
      mintable: true,
      burnable: false,
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
      symbol: "X",
      premint: "0",
      mintable: true,
      burnable: false,
      pausable: false,
      access: "roles",
    });
    expect(source).toContain("AccessControl");
    expect(source).toContain("MINTER_ROLE");
    expect(source).toContain("onlyRole(MINTER_ROLE)");
  });

  it("pausable=true with access=roles includes ERC20Pausable + PAUSER_ROLE", () => {
    const { source } = generate({
      name: "X",
      symbol: "X",
      premint: "0",
      mintable: false,
      burnable: false,
      pausable: true,
      access: "roles",
    });
    expect(source).toContain("ERC20Pausable");
    expect(source).toContain("PAUSER_ROLE");
  });

  it("premint > 0 emits _mint(recipient, N * 10 ** decimals())", () => {
    const { source } = generate({
      name: "X",
      symbol: "X",
      premint: "1234",
      mintable: false,
      burnable: false,
      pausable: false,
      access: false,
    });
    expect(source).toMatch(/_mint\(recipient,\s*1234\s*\*\s*10\s*\*\*\s*decimals\(\)\)/);
  });

  it("emits SPDX-MIT and OZ-Contracts-5.x compatibility comment", () => {
    const { source } = generate({
      name: "X",
      symbol: "X",
      premint: "0",
      mintable: false,
      burnable: false,
      pausable: false,
      access: false,
    });
    expect(source).toMatch(/^\/\/ SPDX-License-Identifier: MIT/);
    expect(source).toContain("Compatible with OpenZeppelin Contracts");
  });
});

describe("erc20 generate — return shape", () => {
  it("returns { filename, source } per CONTEXT D-04", () => {
    const result = generate({
      name: "MyToken",
      symbol: "MTK",
      premint: "1000000",
      mintable: false,
      burnable: false,
      pausable: false,
      access: false,
    });
    expect(result).toHaveProperty("filename");
    expect(result).toHaveProperty("source");
    expect(result.filename).toBe("MyToken.sol");
    expect(typeof result.source).toBe("string");
    expect(result.source.length).toBeGreaterThan(0);
  });

  it("derives filename via contractNameToFilename from opts.name", () => {
    const result = generate({
      name: "My Token",
      symbol: "MTK",
      premint: "1000000",
      mintable: false,
      burnable: false,
      pausable: false,
      access: false,
    });
    expect(result.filename).toBe("MyToken.sol");
  });
});
