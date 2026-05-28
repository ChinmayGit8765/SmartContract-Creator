import { describe, it, expect } from "vitest";
import {
  isSolidityIdentifier,
  isAsciiSymbol,
  isEthAddress,
  isRoyaltyBps,
  isValidBaseUriOrEmpty,
} from "../../../src/templates/erc721/validators.js";

// Boundary cases for the three NEW ERC-721 validators (isEthAddress, isRoyaltyBps,
// isValidBaseUriOrEmpty) plus a smoke check on the cloned isSolidityIdentifier /
// isAsciiSymbol. Error strings are byte-locked per
// .planning/phases/04-erc-721-and-erc-1155-templates/04-RESEARCH.md §Validators
// (lines 729-755) — asserted exact via toBe(...).

describe("isSolidityIdentifier (cloned from erc20)", () => {
  it("rejects empty / undefined with the locked required message", () => {
    expect(isSolidityIdentifier(undefined)).toBe("Contract name is required.");
    expect(isSolidityIdentifier("")).toBe("Contract name is required.");
  });
  it("accepts a valid identifier and rejects a leading digit", () => {
    expect(isSolidityIdentifier("MyNFT")).toBeUndefined();
    expect(isSolidityIdentifier("3Bad")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
  });
});

describe("isAsciiSymbol (cloned from erc20)", () => {
  it("rejects empty / undefined with the locked required message", () => {
    expect(isAsciiSymbol(undefined)).toBe("Token symbol is required.");
    expect(isAsciiSymbol("")).toBe("Token symbol is required.");
  });
  it("accepts a 1-11 char symbol and rejects spaces", () => {
    expect(isAsciiSymbol("MNFT")).toBeUndefined();
    expect(isAsciiSymbol("MT K")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
  });
});

describe("isEthAddress", () => {
  it("rejects empty / undefined with the locked required message", () => {
    expect(isEthAddress(undefined)).toBe("Recipient address is required.");
    expect(isEthAddress("")).toBe("Recipient address is required.");
  });

  it("accepts canonical 0x... 40-hex addresses (all-zero + all-f)", () => {
    expect(isEthAddress("0x" + "0".repeat(40))).toBeUndefined();
    expect(isEthAddress("0x" + "f".repeat(40))).toBeUndefined();
    expect(isEthAddress("0x" + "F".repeat(40))).toBeUndefined(); // mixed-case hex ok
  });

  it("rejects wrong length (39 hex) with the locked message", () => {
    expect(isEthAddress("0x" + "0".repeat(39))).toBe(
      "Must be a 42-character hex address starting with 0x.",
    );
    expect(isEthAddress("0x" + "0".repeat(41))).toBe(
      "Must be a 42-character hex address starting with 0x.",
    );
  });

  it("rejects wrong prefix (0X) and missing prefix", () => {
    expect(isEthAddress("0X" + "0".repeat(40))).toBe(
      "Must be a 42-character hex address starting with 0x.",
    );
    expect(isEthAddress("0".repeat(40))).toBe(
      "Must be a 42-character hex address starting with 0x.",
    );
  });

  it("rejects non-hex characters", () => {
    expect(isEthAddress("0x" + "g".repeat(40))).toBe(
      "Must be a 42-character hex address starting with 0x.",
    );
  });
});

describe("isRoyaltyBps", () => {
  it("rejects empty / undefined with the locked required message", () => {
    expect(isRoyaltyBps(undefined)).toBe(
      "Basis points required (0-10000; 250 = 2.5%).",
    );
    expect(isRoyaltyBps("")).toBe("Basis points required (0-10000; 250 = 2.5%).");
  });

  it("accepts 0 (lower boundary)", () => {
    expect(isRoyaltyBps("0")).toBeUndefined();
  });

  it("accepts 250 and 10000 (upper boundary)", () => {
    expect(isRoyaltyBps("250")).toBeUndefined();
    expect(isRoyaltyBps("10000")).toBeUndefined();
  });

  it("rejects 10001 (over range) with the locked range message", () => {
    expect(isRoyaltyBps("10001")).toBe(
      "Must be between 0 and 10000 inclusive (10000 = 100%).",
    );
  });

  it("rejects '-1' (minus sign) with the integer message", () => {
    expect(isRoyaltyBps("-1")).toBe("Must be a non-negative integer.");
  });

  it("rejects '01' (leading zero) with the integer message", () => {
    expect(isRoyaltyBps("01")).toBe("Must be a non-negative integer.");
  });

  it("rejects decimals and non-numeric input", () => {
    expect(isRoyaltyBps("2.5")).toBe("Must be a non-negative integer.");
    expect(isRoyaltyBps("abc")).toBe("Must be a non-negative integer.");
  });
});

describe("isValidBaseUriOrEmpty", () => {
  it("accepts empty / undefined (empty baseUri is allowed — D-07)", () => {
    expect(isValidBaseUriOrEmpty(undefined)).toBeUndefined();
    expect(isValidBaseUriOrEmpty("")).toBeUndefined();
  });

  it("accepts a whitespace-free URI", () => {
    expect(isValidBaseUriOrEmpty("https://example.com/")).toBeUndefined();
    expect(
      isValidBaseUriOrEmpty("https://example.com/api/token/"),
    ).toBeUndefined();
  });

  it("rejects a URI containing whitespace with the locked message", () => {
    expect(isValidBaseUriOrEmpty("https://x x/")).toBe(
      "Base URI must not contain whitespace.",
    );
    expect(isValidBaseUriOrEmpty("https://example.com/ ")).toBe(
      "Base URI must not contain whitespace.",
    );
  });
});
