import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// Vitest 4 ESM mock pattern: mock @clack/prompts BEFORE importing the SUT so
// confirmOverwrite (and any wizard prompts the test-only template might use)
// pick up the mocked module. The test-only template's runWizard is a no-op
// returning {}, so the @clack mocks are never invoked — but keeping the mock
// declared keeps the load-order contract consistent with create.spec.ts.
vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

const { buildProgram } = await import("../../src/program.js");
const { clear, register } = await import("../../src/registry/index.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test-only template that returns the deliberately-broken Solidity fixture
// (parser error: `uint256 x = ;`). Registered via the locked registry seam —
// no @clack mock entanglement, no dist spawn.
const brokenTemplate = {
  id: "broken-test-only",
  name: "Broken (test only)",
  chain: "evm" as const,
  status: "stub" as const,
  description: "DO NOT USE — deliberately broken for compile-fail tests",
  runWizard: async () => ({}),
  generate: () => ({
    filename: "Broken.sol",
    source: readFileSync(
      join(__dirname, "../fixtures/broken.sol"),
      "utf8",
    ),
  }),
};

describe("create dispatcher — compile-fail path (D-15)", () => {
  let tmpDir: string;

  beforeEach(() => {
    clear();
    register(brokenTemplate as never);
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-compile-fail-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    clear();
  });

  it("D-15 (a)+(b): rejects with E_COMPILE_FAILED and writes NO file", async () => {
    const outPath = join(tmpDir, "Broken.sol");
    const program = buildProgram();
    await expect(
      program
        .exitOverride()
        .parseAsync(
          [
            "create",
            "--template",
            "broken-test-only",
            "--out",
            outPath,
          ],
          { from: "user" },
        ),
    ).rejects.toMatchObject({
      code: "E_COMPILE_FAILED",
      exitCode: 1,
    });
    // Load-bearing: file MUST NOT exist on disk after a compile failure
    // (COMP-03 / SC-2 / D-15 (b)).
    expect(existsSync(outPath)).toBe(false);
  });

  it("D-15 (c): rendered error contains WHAT/WHY/FIX shape with solc ParserError in WHY and version tail", async () => {
    const outPath = join(tmpDir, "Broken.sol");
    const program = buildProgram();
    try {
      await program
        .exitOverride()
        .parseAsync(
          [
            "create",
            "--template",
            "broken-test-only",
            "--out",
            outPath,
          ],
          { from: "user" },
        );
      throw new Error("expected throw");
    } catch (e: unknown) {
      const err = e as {
        code: string;
        what: string;
        why: string;
        fix: string;
      };
      // D-09 stable code.
      expect(err.code).toBe("E_COMPILE_FAILED");
      // D-08 one-line WHAT.
      expect(err.what).toBe("Generated source failed to compile.");
      // solc 0.8.35 emits ParserError for `uint256 x = ;`.
      expect(err.why).toContain("ParserError");
      // D-08 version tail line for reproducible bug reports.
      expect(err.why).toContain("Compile errors come from solc");
      // RESEARCH §Code Examples lines 701-702: locked FIX wording.
      expect(err.fix).toContain("please report this");
    }
    // The file MUST NOT exist even when the test inspects the error.
    expect(existsSync(outPath)).toBe(false);
  });
});
