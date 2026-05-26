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
const { compileVerify } = await import("../../src/compiler/index.js");
const solcMod = await import("solc");
const compileMock = (
  solcMod as unknown as { default: { compile: Mock } }
).default.compile;

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

describe("compileVerify (mocked solc)", () => {
  beforeEach(() => {
    compileMock.mockReset();
  });

  it("chain='solana' throws CliError(E_NOT_IMPLEMENTED) with Phase 7 pointer in why", async () => {
    await expect(compileVerify("contract X {}", "solana")).rejects.toMatchObject({
      code: "E_NOT_IMPLEMENTED",
      exitCode: 1,
    });
    try {
      await compileVerify("contract X {}", "solana");
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as { why: string; what: string };
      expect(e.why).toMatch(/Phase 7/);
      expect(e.what.toLowerCase()).toContain("solana");
    }
  });

  it("chain='evm' calls solc.compile with the locked standard JSON shape", async () => {
    compileMock.mockReturnValue(JSON.stringify({ errors: [] }));
    await compileVerify("contract X {}", "evm");
    expect(compileMock).toHaveBeenCalledTimes(1);
    const firstArg = compileMock.mock.calls[0][0] as string;
    const parsed = JSON.parse(firstArg) as {
      language: string;
      sources: Record<string, { content: string }>;
      settings: {
        evmVersion: string;
        outputSelection: Record<string, Record<string, string[]>>;
      };
    };
    expect(parsed.language).toBe("Solidity");
    expect(parsed.sources["Contract.sol"].content).toBe("contract X {}");
    // Wave 0 probe (03-01) discovered OZ 5.6.1 requires "cancun" (mcopy in
    // utils/Bytes.sol). RESEARCH originally suggested "paris"; the runtime
    // probe is authoritative.
    expect(parsed.settings.evmVersion).toBe("cancun");
    expect(parsed.settings.outputSelection["*"]["*"]).toEqual(["abi"]);
  });

  it("chain='evm' passes a synchronous import callback as second arg", async () => {
    compileMock.mockReturnValue(JSON.stringify({ errors: [] }));
    await compileVerify("contract X {}", "evm");
    const secondArg = compileMock.mock.calls[0][1] as {
      import: (p: string) => unknown;
    };
    expect(typeof secondArg.import).toBe("function");
    const result = secondArg.import("some-other-package/file.sol");
    // Direct call must return an object (sync), not a Promise (Pitfall 1).
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("object");
    // Result shape: either { contents } or { error }.
    const r = result as { contents?: string; error?: string };
    expect(r.contents !== undefined || r.error !== undefined).toBe(true);
  });

  it("chain='evm' throws CliError(E_COMPILE_FAILED) when solc returns severity:'error' diagnostics", async () => {
    compileMock.mockReturnValue(
      JSON.stringify({
        errors: [
          {
            severity: "error",
            type: "ParserError",
            message: "Expected ';'",
            formattedMessage:
              "Contract.sol:5:13: ParserError: Expected ';' but got '}'.\n    uint x = \n            ^",
          },
        ],
      }),
    );
    await expect(compileVerify("bad", "evm")).rejects.toMatchObject({
      code: "E_COMPILE_FAILED",
      exitCode: 1,
    });
    // Reset the mock to set up the SAME response again — rejects.toMatchObject
    // consumed the first call.
    compileMock.mockReturnValue(
      JSON.stringify({
        errors: [
          {
            severity: "error",
            type: "ParserError",
            message: "Expected ';'",
            formattedMessage:
              "Contract.sol:5:13: ParserError: Expected ';' but got '}'.\n    uint x = \n            ^",
          },
        ],
      }),
    );
    try {
      await compileVerify("bad", "evm");
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as {
        what: string;
        why: string;
        fix: string;
        code: string;
      };
      expect(e.what).toBe("Generated source failed to compile.");
      expect(e.why).toContain("ParserError");
      expect(e.why).toContain("Compile errors come from solc");
      expect(e.fix.toLowerCase()).toContain("please report this");
    }
  });

  it("chain='evm' returns warnings (does not throw) for severity:'warning' diagnostics", async () => {
    compileMock.mockReturnValue(
      JSON.stringify({
        errors: [
          {
            severity: "warning",
            type: "Warning",
            message: "Unused local variable",
            formattedMessage:
              "Contract.sol:7:9: Warning: Unused local variable.\n        uint256 dead;\n        ^---------^",
          },
        ],
      }),
    );
    const result = await compileVerify("contract X {}", "evm");
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].severity).toBe("warning");
    expect(result.warnings[0].formattedMessage).toContain(
      "Unused local variable",
    );
  });

  it("chain='evm' normalizes CRLF in formattedMessage to LF", async () => {
    compileMock.mockReturnValue(
      JSON.stringify({
        errors: [
          {
            severity: "warning",
            type: "Warning",
            message: "warn",
            // Inject \r\n in the formattedMessage — Pitfall 5 mandates we strip
            // them so terminals render one logical line per logical line.
            formattedMessage:
              "Contract.sol:1:1: Warning: line1\r\nline2\r\nline3",
          },
        ],
      }),
    );
    const result = await compileVerify("contract X {}", "evm");
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].formattedMessage).not.toContain("\r");
  });

  it("chain='evm' collapses solc severity 'info' into the warning bucket", async () => {
    compileMock.mockReturnValue(
      JSON.stringify({
        errors: [
          {
            severity: "info",
            type: "Info",
            message: "informational note",
            formattedMessage:
              "Contract.sol:1:1: Info: informational note",
          },
        ],
      }),
    );
    // 'info' is neither 'error' nor 'warning' in solc's vocabulary; we
    // collapse it into warnings so the caller still gets the diagnostic
    // without a compile-failure throw (RESEARCH partition logic line 379).
    const result = await compileVerify("contract X {}", "evm");
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].severity).toBe("warning");
  });
});
