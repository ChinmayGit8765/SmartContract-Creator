import { describe, it, expect } from "vitest";
import { contractNameToFilename } from "../../../src/templates/erc20/filename.js";

// Test-case table is locked in .planning/phases/02-erc-20-canary-template/02-RESEARCH.md
// §Filename Derivation (lines ~530-541). One `it` per row of the table; eight rows total.
// Table-driven shape per tests/env.spec.ts and PATTERNS.md §filename.spec.ts.

describe("contractNameToFilename", () => {
  it("passthrough: MyToken -> MyToken.sol", () => {
    expect(contractNameToFilename("MyToken")).toBe("MyToken.sol");
  });

  it("space-separated PascalCase: 'My Token' -> MyToken.sol", () => {
    expect(contractNameToFilename("My Token")).toBe("MyToken.sol");
  });

  it("underscore: my_token -> MyToken.sol", () => {
    expect(contractNameToFilename("my_token")).toBe("MyToken.sol");
  });

  it("trailing digits preserved: MyToken123 -> MyToken123.sol", () => {
    expect(contractNameToFilename("MyToken123")).toBe("MyToken123.sol");
  });

  it("leading digits stripped: 123Token -> Token.sol", () => {
    expect(contractNameToFilename("123Token")).toBe("Token.sol");
  });

  it("hyphenated: my-cool-token -> MyCoolToken.sol", () => {
    expect(contractNameToFilename("my-cool-token")).toBe("MyCoolToken.sol");
  });

  it("whitespace-only fallback: '   ' -> Token.sol", () => {
    expect(contractNameToFilename("   ")).toBe("Token.sol");
  });

  it("all-symbol fallback: '$$$' -> Token.sol", () => {
    expect(contractNameToFilename("$$$")).toBe("Token.sol");
  });

  it("empty string fallback: '' -> Token.sol (defensive — validator should reject upstream)", () => {
    expect(contractNameToFilename("")).toBe("Token.sol");
  });

  it("does not throw on any input (pure function contract)", () => {
    expect(() => contractNameToFilename("")).not.toThrow();
    expect(() => contractNameToFilename("$$$")).not.toThrow();
    expect(() => contractNameToFilename("123")).not.toThrow();
  });
});
