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

  it("returns the installed solc version in Phase 3 (now a dependency)", () => {
    const v = safeReadVersion("solc");
    expect(v).not.toBeNull();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns the installed @openzeppelin/contracts version in Phase 3 (now a dependency)", () => {
    const v = safeReadVersion("@openzeppelin/contracts");
    expect(v).not.toBeNull();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns the installed @openzeppelin/wizard version in Phase 2 (now a dependency)", () => {
    const v = safeReadVersion("@openzeppelin/wizard");
    expect(v).not.toBeNull();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("formatVersionLine", () => {
  // Plan 02-05 (UI-16, D-08 override): widened to allow a third parenthetical segment
  // (@openzeppelin/wizard). Per-segment toContain assertions are preferred over a
  // brittle exact regex so future dep additions don't churn this test (option (b)
  // from the plan's <action> notes).
  it("starts with `smartc <ver> (` and ends with `)`", () => {
    const line = formatVersionLine();
    expect(line).toMatch(/^smartc \d+\.\d+\.\d+ \(.+\)$/);
  });

  it("includes solc + @openzeppelin/contracts segments with their exact pinned versions in Phase 3 (UI-16 + SC-5)", () => {
    const line = formatVersionLine();
    // Plan 03-01 pinned solc@0.8.35 and @openzeppelin/contracts@5.6.1 (both exact).
    // Drift = deliberate commit (same convention as wizard@0.10.8 lock above).
    expect(line).toContain("solc 0.8.35");
    expect(line).toContain("@openzeppelin/contracts 5.6.1");
    expect(line).not.toContain("solc not bundled");
    expect(line).not.toContain("@openzeppelin/contracts not bundled");
  });

  it("includes the @openzeppelin/wizard segment with its installed version (UI-16)", () => {
    const line = formatVersionLine();
    // Plan 01 pinned @openzeppelin/wizard@0.10.8 (exact). If this drifts, regenerate
    // both this assertion and the snapshot fixtures in a deliberate commit.
    expect(line).toContain("@openzeppelin/wizard 0.10.8");
    expect(line).not.toContain("@openzeppelin/wizard not bundled");
  });

  it("includes our own package version (from package.json)", () => {
    const line = formatVersionLine();
    // Phase 1 ships 0.1.0; assert it's there OR at least a non-zero version.
    expect(line).toMatch(/^smartc \d+\.\d+\.\d+/);
    // Not the fallback "0.0.0" — we should be reading the real package.json.
    expect(line.startsWith("smartc 0.0.0 ")).toBe(false);
  });
});
