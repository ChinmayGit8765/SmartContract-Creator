import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { compileVerify } from "../../src/compiler/index.js";

// Real solc + real OZ — NO vi.mock. This is the OZ-version drift canary
// (CONTEXT D-13 layer (b)): if anyone bumps @openzeppelin/contracts and the
// golden ERC-20 sources break, these tests catch it before E2E.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BARE_DEFAULT = join(
  __dirname,
  "../fixtures/erc20/bare-default.sol",
);
const ALL_FLAGS_ON = join(__dirname, "../fixtures/erc20/all-flags-on.sol");
const BROKEN = join(__dirname, "../fixtures/broken.sol");
const WARNS = join(__dirname, "../fixtures/warns-no-error.sol");

describe("compileVerify — integration with real solc + real OZ", () => {
  it("bare-default fixture compiles clean (zero errors)", async () => {
    const source = readFileSync(BARE_DEFAULT, "utf8");
    const result = await compileVerify(source, "evm");
    // Warnings may exist (deprecation notes from solc 0.8.31+); just assert no throw.
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("all-flags-on fixture compiles clean (zero errors)", async () => {
    const source = readFileSync(ALL_FLAGS_ON, "utf8");
    const result = await compileVerify(source, "evm");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("broken.sol throws E_COMPILE_FAILED with formattedMessage in WHY", async () => {
    const source = readFileSync(BROKEN, "utf8");
    await expect(compileVerify(source, "evm")).rejects.toMatchObject({
      code: "E_COMPILE_FAILED",
      exitCode: 1,
    });
    // Second call to catch the error and inspect WHY (dual-pattern from
    // tests/commands/create.spec.ts:91-113).
    try {
      await compileVerify(source, "evm");
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as { code: string; why: string; what: string };
      expect(e.code).toBe("E_COMPILE_FAILED");
      // solc 0.8.35 emits ParserError for `uint256 x = ;`
      expect(e.why).toContain("ParserError");
      // Version tail line (D-08) — locks the bug-report-friendly format.
      expect(e.why).toContain("Compile errors come from solc");
    }
  });

  it("warns-no-error.sol returns warnings.length >= 1 and does not throw", async () => {
    const source = readFileSync(WARNS, "utf8");
    const result = await compileVerify(source, "evm");
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0].severity).toBe("warning");
    expect(result.warnings[0].formattedMessage.toLowerCase()).toContain(
      "warning",
    );
  });
});
