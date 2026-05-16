import { describe, it, expect } from "vitest";
import { safeReadVersion, formatVersionLine } from "../src/lib/version.js";

describe("safeReadVersion", () => {
  it("returns null for a non-existent package", () => {
    expect(safeReadVersion("this-package-definitely-does-not-exist-xyz")).toBeNull();
  });

  it("returns a semver-shaped string for an installed dependency", () => {
    const v = safeReadVersion("commander");
    expect(v).not.toBeNull();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns null for solc in Phase 1 (not yet a dependency)", () => {
    expect(safeReadVersion("solc")).toBeNull();
  });

  it("returns null for @openzeppelin/contracts in Phase 1 (not yet a dependency)", () => {
    expect(safeReadVersion("@openzeppelin/contracts")).toBeNull();
  });
});

describe("formatVersionLine", () => {
  it("matches the Phase 1 shape: smartc <ver> (solc..., @openzeppelin/contracts...)", () => {
    const line = formatVersionLine();
    expect(line).toMatch(
      /^smartc \d+\.\d+\.\d+ \(solc.*, @openzeppelin\/contracts.*\)$/,
    );
  });

  it("reports both gated deps as 'not bundled' in Phase 1", () => {
    const line = formatVersionLine();
    expect(line).toContain("solc not bundled");
    expect(line).toContain("@openzeppelin/contracts not bundled");
  });

  it("includes our own package version (from package.json)", () => {
    const line = formatVersionLine();
    // Phase 1 ships 0.1.0; assert it's there OR at least a non-zero version.
    expect(line).toMatch(/^smartc \d+\.\d+\.\d+/);
    // Not the fallback "0.0.0" — we should be reading the real package.json.
    expect(line.startsWith("smartc 0.0.0 ")).toBe(false);
  });
});
