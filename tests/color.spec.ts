import { describe, it, expect } from "vitest";
import { makeColor } from "../src/lib/color.js";

describe("makeColor", () => {
  it("returns identity functions when noColorFlag is true", () => {
    const c = makeColor(true);
    expect(c.red("test")).toBe("test");
    expect(c.yellow("test")).toBe("test");
    expect(c.cyan("test")).toBe("test");
    expect(c.green("test")).toBe("test");
    expect(c.dim("test")).toBe("test");
    expect(c.bold("test")).toBe("test");
  });

  it("exposes all six methods as callable functions when noColorFlag is false", () => {
    const c = makeColor(false);
    // We don't assert ANSI codes (brittle across CI/no-tty/etc.).
    // Just verify presence + callable + returns string.
    for (const k of ["red", "yellow", "cyan", "green", "dim", "bold"] as const) {
      expect(typeof c[k]).toBe("function");
      expect(typeof c[k]("test")).toBe("string");
      // identity in CI, ANSI-wrapped on a tty — either way it must contain the input.
      expect(c[k]("test")).toContain("test");
    }
  });

  it("returned object has stable shape", () => {
    const c = makeColor(true);
    expect(Object.keys(c).sort()).toEqual(
      ["bold", "cyan", "dim", "green", "red", "yellow"].sort(),
    );
  });
});
