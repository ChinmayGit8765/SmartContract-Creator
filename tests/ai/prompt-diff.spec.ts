import { describe, it, expect } from "vitest";
import { buildPatchPrompt, extractSource } from "../../src/ai/prompt.js";
import { diffLines, diffStat } from "../../src/ai/diff.js";

describe("buildPatchPrompt", () => {
  it("names the language by chain and embeds the description + source", () => {
    const evm = buildPatchPrompt({ source: "contract X {}", description: "add a cap", chain: "evm" });
    expect(evm).toContain("Solidity");
    expect(evm).toContain("add a cap");
    expect(evm).toContain("contract X {}");
    expect(evm).toContain("COMPLETE updated file");
    const sol = buildPatchPrompt({ source: "// rs", description: "x", chain: "solana" });
    expect(sol).toContain("Rust (Anchor / Solana)");
  });
});

describe("extractSource", () => {
  it("pulls the contents of a fenced code block (drops the language tag)", () => {
    const r = "Sure!\n```solidity\ncontract Y {}\n```\nDone.";
    expect(extractSource(r)).toBe("contract Y {}\n");
  });
  it("returns trimmed text when there is no fence", () => {
    expect(extractSource("  contract Z {}  ")).toBe("contract Z {}\n");
  });
});

describe("diffLines / diffStat", () => {
  it("reports added and removed lines", () => {
    const lines = diffLines("a\nb\nc", "a\nB\nc\nd");
    const stat = diffStat(lines);
    expect(stat.removed).toBe(1); // b
    expect(stat.added).toBe(2); // B, d
    // unchanged anchors preserved
    expect(lines.some((l) => l.kind === " " && l.text === "a")).toBe(true);
  });
  it("identical input yields no changes", () => {
    expect(diffStat(diffLines("x\ny", "x\ny"))).toEqual({ added: 0, removed: 0 });
  });
});
