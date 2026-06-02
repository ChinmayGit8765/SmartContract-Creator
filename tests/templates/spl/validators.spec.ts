import { describe, it, expect } from "vitest";
import {
  isTokenName,
  isSplSymbol,
  isDecimals,
  isWholeSupply,
} from "../../../src/templates/spl/validators.js";

describe("spl validators", () => {
  it("isTokenName: required, 1-32 chars", () => {
    expect(isTokenName("My Token")).toBeUndefined();
    expect(isTokenName("")).toBeDefined();
    expect(isTokenName("   ")).toBeDefined();
    expect(isTokenName("x".repeat(32))).toBeUndefined();
    expect(isTokenName("x".repeat(33))).toMatch(/32/);
  });

  it("isSplSymbol: 1-10 ASCII letters/digits", () => {
    expect(isSplSymbol("MYTKN")).toBeUndefined();
    expect(isSplSymbol("ABCDEFGHIJ")).toBeUndefined(); // 10
    expect(isSplSymbol("ABCDEFGHIJK")).toBeDefined(); // 11
    expect(isSplSymbol("has space")).toBeDefined();
    expect(isSplSymbol("")).toBeDefined();
  });

  it("isDecimals: single digit 0-9", () => {
    for (const d of ["0", "6", "9"]) expect(isDecimals(d)).toBeUndefined();
    expect(isDecimals("10")).toBeDefined();
    expect(isDecimals("")).toBeDefined();
    expect(isDecimals("-1")).toBeDefined();
  });

  it("isWholeSupply: non-negative whole number", () => {
    expect(isWholeSupply("0")).toBeUndefined();
    expect(isWholeSupply("1000000")).toBeUndefined();
    expect(isWholeSupply("1.5")).toBeDefined();
    expect(isWholeSupply("01")).toBeDefined();
    expect(isWholeSupply("")).toBeDefined();
  });
});
