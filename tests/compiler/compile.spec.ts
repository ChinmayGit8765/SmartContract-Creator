import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chdir, cwd } from "node:process";

// Vitest 4 ESM mock pattern (mirrors tests/templates/erc20/wizard.spec.ts:1-23).
// Mock solc BEFORE importing the SUT so the SUT picks up the mocked module.
// Pitfall 4: solc-js is CJS — we mock it as a default export to match
// `require("solc")` interop.
vi.mock("solc", () => ({
  default: {
    compile: vi.fn(),
    version: vi.fn(() => "0.8.35+commit.fake"),
  },
}));

const { makeImportCallback } = await import(
  "../../src/compiler/imports.js"
);

describe("makeImportCallback", () => {
  it("resolves @openzeppelin/contracts/token/ERC20/ERC20.sol from any cwd", () => {
    // Pitfall 3: prove cwd-independence by chdir'ing into a fresh temp dir
    // BEFORE invoking the callback (the OZ resolver must walk smartc's install
    // root, not the user's cwd).
    const startCwd = cwd();
    const tmpCwd = mkdtempSync(join(tmpdir(), "imports-test-"));
    try {
      chdir(tmpCwd);
      const cb = makeImportCallback();
      const result = cb("@openzeppelin/contracts/token/ERC20/ERC20.sol");
      expect("contents" in result).toBe(true);
      if (!("contents" in result)) throw new Error("expected contents");
      expect(result.contents).toContain("contract ERC20");
    } finally {
      chdir(startCwd);
    }
  });

  it("caches resolved imports within one callback instance", () => {
    const cb = makeImportCallback();
    const first = cb("@openzeppelin/contracts/token/ERC20/ERC20.sol");
    const second = cb("@openzeppelin/contracts/token/ERC20/ERC20.sol");
    expect("contents" in first).toBe(true);
    expect("contents" in second).toBe(true);
    // Reference equality — second call hits the cache and returns the same object.
    expect(second).toBe(first);
  });

  it("blocks path traversal attempts", () => {
    const cb = makeImportCallback();
    const result = cb(
      "@openzeppelin/contracts/../../etc/passwd",
    );
    expect("error" in result).toBe(true);
    if (!("error" in result)) throw new Error("expected error");
    // Mention either "traversal" or "blocked" so the user knows it's a security refusal,
    // not a missing-file message.
    expect(result.error.toLowerCase()).toMatch(/traversal|blocked/);
  });

  it("rejects unknown import prefixes", () => {
    const cb = makeImportCallback();
    const result = cb("some-other-package/file.sol");
    expect("error" in result).toBe(true);
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("fresh instance has independent cache", () => {
    // Two instances; first resolves a path so its internal cache is populated.
    // Second instance's first lookup of the same path must NOT return the same
    // object reference (proves no cross-instance leakage / no module-level cache).
    const first = makeImportCallback();
    const second = makeImportCallback();
    const path = "@openzeppelin/contracts/token/ERC20/ERC20.sol";
    const fromFirst = first(path);
    const fromSecond = second(path);
    expect("contents" in fromFirst).toBe(true);
    expect("contents" in fromSecond).toBe(true);
    // Different instances → different result objects (each instance has its own cache).
    expect(fromSecond).not.toBe(fromFirst);
  });
});
