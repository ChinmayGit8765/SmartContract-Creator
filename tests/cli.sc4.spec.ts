// SC-4 (CLI-07 residual) in-process e2e per RESEARCH §e2e Test Strategy. Moved out of
// tests/cli.spec.ts (W5) so the spawn-based suite stays free of module-top
// vi.mock("@clack/prompts") hoisting that could interfere with subprocess invocations.
// True TTY-driven e2e is deferred to a later cross-platform-distribution hardening phase.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Vitest 4 ESM mock pattern (locked Phase 1 shape): mock @clack/prompts BEFORE
// importing the SUT so both the wizard prompts and confirmOverwrite pick up the
// mocked module. Hoisted by Vitest's transformer.
vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

const { buildProgram } = await import("../src/program.js");
const { clear } = await import("../src/registry/index.js");
const { registerErc20Template } = await import("../src/templates/erc20/index.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

/** Captures writes to process.stdout for the duration of a callback so the test
 *  runner output stays clean even when the dispatcher's result/nextStep calls
 *  fire. The captured string is returned for optional assertions. */
async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const writes: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    writes.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  });
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return writes.join("");
}

/** Primes the @clack mocks for the minimal happy-path wizard (no flags so
 *  prompt 7 / select is skipped). The wizard issues three text() then three
 *  confirm() calls in this order — see src/templates/erc20/wizard.ts. */
function primeHappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyToken");
  textMock.mockResolvedValueOnce("MTK");
  textMock.mockResolvedValueOnce("1000000");
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // pausable
}

describe("SC-4 (CLI-07 residual): overwrite gate end-to-end (in-process dispatcher)", () => {
  let tmpDir: string;
  let outPath: string;

  beforeEach(() => {
    clear();
    registerErc20Template();
    vi.clearAllMocks();
    isCancelMock.mockReturnValue(false);
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-sc4-"));
    outPath = join(tmpDir, "MyToken.sol");
    // Pre-create a stale file at the target path so every test exercises the
    // existsSync-true branch in src/commands/create.ts step 5.
    writeFileSync(outPath, "// stale content", "utf8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    clear();
  });

  it("SC-4: --force overwrites an existing file without prompting", async () => {
    primeHappyPathMocks();
    const program = buildProgram();
    await captureStdout(async () => {
      await program
        .exitOverride()
        .parseAsync(
          ["create", "--template", "erc20", "--out", outPath, "--force"],
          { from: "user" },
        );
    });

    // File overwritten with the freshly generated ERC-20 source.
    const written = readFileSync(outPath, "utf8");
    expect(written).toContain("contract MyToken");
    expect(written).not.toBe("// stale content");

    // confirmOverwrite is bypassed under --force, so only the three wizard
    // confirm prompts fired — not a fourth overwrite-prompt confirm.
    expect(confirmMock).toHaveBeenCalledTimes(3);
    // None of the calls carry an "overwrite" message.
    for (const call of confirmMock.mock.calls) {
      const arg = call[0] as { message?: string } | undefined;
      expect(arg?.message ?? "").not.toMatch(/overwrite/i);
    }
    // The wizard's text/select prompts ran as expected.
    expect(textMock).toHaveBeenCalledTimes(3);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("SC-4: without --force, the overwrite prompt fires and user can accept (overwrites)", async () => {
    primeHappyPathMocks();
    // Fourth confirm call is the overwrite-prompt — user accepts.
    confirmMock.mockResolvedValueOnce(true);
    const program = buildProgram();
    await captureStdout(async () => {
      await program
        .exitOverride()
        .parseAsync(
          ["create", "--template", "erc20", "--out", outPath],
          { from: "user" },
        );
    });

    const written = readFileSync(outPath, "utf8");
    expect(written).toContain("contract MyToken");
    expect(written).not.toBe("// stale content");

    // Exactly four confirm calls: three wizard + one overwrite prompt.
    expect(confirmMock).toHaveBeenCalledTimes(4);
    const overwriteCall = confirmMock.mock.calls[3]?.[0] as
      | { message: string; initialValue?: boolean }
      | undefined;
    expect(overwriteCall?.message ?? "").toMatch(/overwrite/i);
  });

  it("SC-4: without --force, the overwrite prompt fires and user can decline (E_FILE_EXISTS)", async () => {
    primeHappyPathMocks();
    // Fourth confirm call is the overwrite-prompt — user declines.
    confirmMock.mockResolvedValueOnce(false);
    const program = buildProgram();
    await expect(
      captureStdout(async () => {
        await program
          .exitOverride()
          .parseAsync(
            ["create", "--template", "erc20", "--out", outPath],
            { from: "user" },
          );
      }),
    ).rejects.toMatchObject({ code: "E_FILE_EXISTS" });

    // Pre-existing stale content is preserved (no partial write).
    expect(readFileSync(outPath, "utf8")).toBe("// stale content");

    // Exactly four confirm calls: three wizard + one overwrite-prompt that
    // returned false and triggered the CliError.
    expect(confirmMock).toHaveBeenCalledTimes(4);
  });
});
