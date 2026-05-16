import { describe, it, expect } from "vitest";
import { parseBoolEnv, resolveNewbie } from "../src/lib/env.js";

describe("parseBoolEnv", () => {
  it("returns false for undefined / null / empty", () => {
    expect(parseBoolEnv(undefined)).toBe(false);
    expect(parseBoolEnv(null)).toBe(false);
    expect(parseBoolEnv("")).toBe(false);
  });

  it("returns true for 1, true, yes, on (case-insensitive, trimmed)", () => {
    expect(parseBoolEnv("1")).toBe(true);
    expect(parseBoolEnv("true")).toBe(true);
    expect(parseBoolEnv("TRUE")).toBe(true);
    expect(parseBoolEnv(" True ")).toBe(true);
    expect(parseBoolEnv("yes")).toBe(true);
    expect(parseBoolEnv(" yes ")).toBe(true);
    expect(parseBoolEnv("YES")).toBe(true);
    expect(parseBoolEnv("on")).toBe(true);
    expect(parseBoolEnv("ON")).toBe(true);
  });

  it("returns false for anything else", () => {
    expect(parseBoolEnv("0")).toBe(false);
    expect(parseBoolEnv("false")).toBe(false);
    expect(parseBoolEnv("FALSE")).toBe(false);
    expect(parseBoolEnv("no")).toBe(false);
    expect(parseBoolEnv("off")).toBe(false);
    expect(parseBoolEnv("anything")).toBe(false);
    expect(parseBoolEnv("2")).toBe(false);
    expect(parseBoolEnv("truthy")).toBe(false);
  });
});

describe("resolveNewbie", () => {
  it("returns true when flag is true regardless of env", () => {
    expect(resolveNewbie({ newbieFlag: true, env: {} })).toBe(true);
    expect(resolveNewbie({ newbieFlag: true, env: { SMARTC_NEWBIE: "0" } })).toBe(true);
  });

  it("returns false when flag is explicitly false (wins over env)", () => {
    expect(resolveNewbie({ newbieFlag: false, env: { SMARTC_NEWBIE: "1" } })).toBe(false);
    expect(resolveNewbie({ newbieFlag: false, env: {} })).toBe(false);
  });

  it("falls back to env SMARTC_NEWBIE when flag undefined", () => {
    expect(resolveNewbie({ env: {} })).toBe(false);
    expect(resolveNewbie({ env: { SMARTC_NEWBIE: "1" } })).toBe(true);
    expect(resolveNewbie({ env: { SMARTC_NEWBIE: "yes" } })).toBe(true);
    expect(resolveNewbie({ env: { SMARTC_NEWBIE: "0" } })).toBe(false);
    expect(resolveNewbie({ env: { SMARTC_NEWBIE: "" } })).toBe(false);
  });

  it("uses process.env by default when env not provided", () => {
    // Just verify it doesn't throw; we can't assume process.env contents.
    const result = resolveNewbie({});
    expect(typeof result).toBe("boolean");
  });
});
