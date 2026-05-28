import { describe, it, expect } from "vitest";
import {
  isSolidityIdentifier,
  isNonEmptyUri,
} from "../../../src/templates/erc1155/validators.js";

// Boundary cases for isNonEmptyUri. Error strings are byte-locked from
// .planning/phases/04-erc-721-and-erc-1155-templates/04-RESEARCH.md §Validators
// ERC-1155 (lines 763-768). The isSolidityIdentifier slim block confirms the
// clone did not diverge from the erc20 analog.

describe("isNonEmptyUri", () => {
  it("rejects empty string with the locked required message", () => {
    expect(isNonEmptyUri("")).toBe(
      "URI template is required (e.g. https://example.com/api/token/{id}.json).",
    );
  });

  it("rejects undefined with the locked required message", () => {
    expect(isNonEmptyUri(undefined)).toBe(
      "URI template is required (e.g. https://example.com/api/token/{id}.json).",
    );
  });

  it("rejects whitespace-only input with the locked required message", () => {
    expect(isNonEmptyUri("   ")).toBe(
      "URI template is required (e.g. https://example.com/api/token/{id}.json).",
    );
    expect(isNonEmptyUri("\t\n ")).toBe(
      "URI template is required (e.g. https://example.com/api/token/{id}.json).",
    );
  });

  it("rejects internal whitespace with the locked no-whitespace message", () => {
    expect(isNonEmptyUri("https://x x/")).toBe("URI must not contain whitespace.");
    expect(isNonEmptyUri("https://example.com/api/token/ {id}.json")).toBe(
      "URI must not contain whitespace.",
    );
  });

  it("accepts the default URI template with the literal {id} placeholder", () => {
    expect(isNonEmptyUri("https://example.com/api/token/{id}.json")).toBeUndefined();
  });

  it("accepts other well-formed URIs (ipfs, no placeholder)", () => {
    expect(isNonEmptyUri("ipfs://Qm.../{id}")).toBeUndefined();
    expect(isNonEmptyUri("https://example.com/")).toBeUndefined();
  });
});

describe("isSolidityIdentifier (clone) — must match the erc20 analog", () => {
  it("rejects empty / undefined with 'Contract name is required.'", () => {
    expect(isSolidityIdentifier(undefined)).toBe("Contract name is required.");
    expect(isSolidityIdentifier("")).toBe("Contract name is required.");
  });

  it("accepts leading letter / underscore identifiers", () => {
    expect(isSolidityIdentifier("MyMulti")).toBeUndefined();
    expect(isSolidityIdentifier("_Private")).toBeUndefined();
  });

  it("rejects leading digit and disallowed characters with the locked message", () => {
    const msg =
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.";
    expect(isSolidityIdentifier("3Multi")).toBe(msg);
    expect(isSolidityIdentifier("My Multi")).toBe(msg);
    expect(isSolidityIdentifier("a".repeat(65))).toBe(msg);
  });
});
