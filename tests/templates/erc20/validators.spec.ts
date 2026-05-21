import { describe, it, expect } from "vitest";
import {
  isSolidityIdentifier,
  isAsciiSymbol,
  isNonNegativeDecimal,
} from "../../../src/templates/erc20/validators.js";

// Locked test-case table from .planning/phases/02-erc-20-canary-template/02-RESEARCH.md
// §Validators (lines ~494-508). Each row of the table is asserted across all
// three validators per the table column intent. UI-SPEC-locked error strings
// (UI-SPEC §Prompts 1/2/3) are asserted byte-exact.

describe("isSolidityIdentifier", () => {
  it("rejects empty / undefined with 'Contract name is required.'", () => {
    expect(isSolidityIdentifier(undefined)).toBe("Contract name is required.");
    expect(isSolidityIdentifier("")).toBe("Contract name is required.");
  });

  it("accepts a leading letter followed by letters/digits/underscores", () => {
    expect(isSolidityIdentifier("MyToken")).toBe(undefined);
    expect(isSolidityIdentifier("MyToken123")).toBe(undefined);
    expect(isSolidityIdentifier("a")).toBe(undefined);
  });

  it("accepts leading underscore", () => {
    expect(isSolidityIdentifier("_Private")).toBe(undefined);
    expect(isSolidityIdentifier("_")).toBe(undefined);
  });

  it("rejects leading digit with the locked malformed message", () => {
    expect(isSolidityIdentifier("3Token")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
    expect(isSolidityIdentifier("1000000")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
    expect(isSolidityIdentifier("0")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
  });

  it("rejects hyphen, space, dot, and other non-identifier characters", () => {
    expect(isSolidityIdentifier("My Token")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
    expect(isSolidityIdentifier("my-cool-token")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
    expect(isSolidityIdentifier("1.5")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
    expect(isSolidityIdentifier("-1")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
    expect(isSolidityIdentifier("$Foo")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
  });

  it("rejects 65+ chars with the locked message (length boundary)", () => {
    expect(isSolidityIdentifier("a".repeat(64))).toBe(undefined);
    expect(isSolidityIdentifier("a".repeat(65))).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
  });
});

describe("isAsciiSymbol", () => {
  it("rejects empty / undefined with 'Token symbol is required.'", () => {
    expect(isAsciiSymbol(undefined)).toBe("Token symbol is required.");
    expect(isAsciiSymbol("")).toBe("Token symbol is required.");
  });

  it("accepts 1-11 ASCII letters/digits", () => {
    expect(isAsciiSymbol("MTK")).toBe(undefined);
    expect(isAsciiSymbol("A")).toBe(undefined);
    expect(isAsciiSymbol("MyToken")).toBe(undefined);
    expect(isAsciiSymbol("_Private")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    ); // underscore not allowed in symbol
    // numeric-only is allowed by symbol regex
    expect(isAsciiSymbol("1000000")).toBe(undefined);
    expect(isAsciiSymbol("0")).toBe(undefined);
    expect(isAsciiSymbol("12345678901")).toBe(undefined); // exactly 11 chars
  });

  it("rejects 12+ characters", () => {
    expect(isAsciiSymbol("a".repeat(12))).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
    expect(isAsciiSymbol("a".repeat(65))).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
  });

  it("rejects spaces, punctuation, and non-ASCII characters", () => {
    expect(isAsciiSymbol("MT K")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
    expect(isAsciiSymbol("My Token")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
    expect(isAsciiSymbol("1.5")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
    expect(isAsciiSymbol("-1")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
    expect(isAsciiSymbol("$$$")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
  });
});

describe("isNonNegativeDecimal", () => {
  it("rejects empty / undefined with the locked required message", () => {
    expect(isNonNegativeDecimal(undefined)).toBe(
      "Initial supply is required (use 0 for no premint).",
    );
    expect(isNonNegativeDecimal("")).toBe(
      "Initial supply is required (use 0 for no premint).",
    );
  });

  it("accepts '0'", () => {
    expect(isNonNegativeDecimal("0")).toBe(undefined);
  });

  it("accepts plain integers like '1000000'", () => {
    expect(isNonNegativeDecimal("1000000")).toBe(undefined);
    expect(isNonNegativeDecimal("1")).toBe(undefined);
  });

  it("accepts decimals like '1.5'", () => {
    expect(isNonNegativeDecimal("1.5")).toBe(undefined);
    expect(isNonNegativeDecimal("0.1")).toBe(undefined);
  });

  it("rejects negative numbers like '-1'", () => {
    expect(isNonNegativeDecimal("-1")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
  });

  it("rejects non-numeric input like 'MyToken' and 'MTK'", () => {
    expect(isNonNegativeDecimal("MyToken")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
    expect(isNonNegativeDecimal("MTK")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
    expect(isNonNegativeDecimal("My Token")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
    expect(isNonNegativeDecimal("_Private")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
  });

  it("rejects scientific notation like '1e6' (intentional surface narrowing — RESEARCH §Validators)", () => {
    expect(isNonNegativeDecimal("1e6")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
  });

  it("rejects leading zeros like '01' (decimal-string canonical form)", () => {
    expect(isNonNegativeDecimal("01")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
  });

  it("rejects 65+ chars of non-digit input", () => {
    expect(isNonNegativeDecimal("a".repeat(65))).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
  });
});
