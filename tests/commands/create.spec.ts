import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Vitest 4 ESM mock pattern: mock @clack/prompts BEFORE importing the SUT so
// the wizard + confirmOverwrite both pick up the mocked module.
vi.mock("@clack/prompts", () => {
  return {
    text: vi.fn(),
    select: vi.fn(),
    multiselect: vi.fn(),
    confirm: vi.fn(),
    isCancel: vi.fn(() => false),
    cancel: vi.fn(),
  };
});

const { buildProgram } = await import("../../src/program.js");
const { clear, get } = await import("../../src/registry/index.js");
const { registerErc20Template } = await import("../../src/templates/erc20/index.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

/** Captures writes to process.stdout for the duration of a callback. */
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

/** Convenience: prime the @clack mocks for the minimal happy-path wizard
 *  (no mintable / burnable / pausable so prompt 7 does not fire). */
function primeHappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyToken");
  textMock.mockResolvedValueOnce("MTK");
  textMock.mockResolvedValueOnce("1000000");
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // pausable
}

describe("create command (in-process dispatcher)", () => {
  let tmpDir: string;

  beforeEach(() => {
    clear();
    registerErc20Template();
    textMock.mockReset();
    selectMock.mockReset();
    confirmMock.mockReset();
    isCancelMock.mockReset();
    isCancelMock.mockReturnValue(false);
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-create-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    clear();
  });

  it("happy path — registry hit, wizard returns minimal opts, writes file at --out path", async () => {
    primeHappyPathMocks();
    const outPath = join(tmpDir, "MyToken.sol");
    const program = buildProgram();
    const captured = await captureStdout(async () => {
      await program.exitOverride().parseAsync(
        ["create", "--template", "erc20", "--out", outPath],
        { from: "user" },
      );
    });
    expect(existsSync(outPath)).toBe(true);
    const written = readFileSync(outPath, "utf8");
    expect(written).toContain("contract MyToken");
    expect(written).toContain("SPDX-License-Identifier: MIT");
    expect(captured).toContain(`Wrote ${outPath}`);
  });

  it("--template unknown — throws CliError(E_USAGE) with FIX pointing at list-templates", async () => {
    const program = buildProgram();
    await expect(
      program.exitOverride().parseAsync(
        ["create", "--template", "does-not-exist"],
        { from: "user" },
      ),
    ).rejects.toMatchObject({
      code: "E_USAGE",
      exitCode: 2,
    });
    // Re-throw a second time to inspect message fields.
    try {
      await buildProgram().exitOverride().parseAsync(
        ["create", "--template", "does-not-exist"],
        { from: "user" },
      );
    } catch (e: unknown) {
      const err = e as { code: string; what: string; fix: string };
      expect(err.code).toBe("E_USAGE");
      expect(err.what).toContain("does-not-exist");
      expect(err.fix).toContain("list-templates");
    }
    // Wizard side-effects must not have happened.
    expect(textMock).not.toHaveBeenCalled();
  });

  it("--json — refused with E_USAGE exit 2 BEFORE wizard runs (UI-10 locked copy)", async () => {
    const program = buildProgram();
    await expect(
      program.exitOverride().parseAsync(
        ["create", "--template", "erc20", "--json"],
        { from: "user" },
      ),
    ).rejects.toMatchObject({
      code: "E_USAGE",
      exitCode: 2,
      what: "'smartc create' cannot run in --json mode.",
      why: "The wizard requires an interactive TTY, which is incompatible with machine-readable output.",
      fix: "Re-run without --json. Flag-driven non-interactive generation is planned for a future release; track it in .planning/STATE.md.",
    });
    expect(textMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("create without --template — exit 2 with E_USAGE (W3 required-flag)", async () => {
    const program = buildProgram();
    await expect(
      program.exitOverride().parseAsync(["create"], { from: "user" }),
    ).rejects.toMatchObject({
      code: "E_USAGE",
      exitCode: 2,
      what: "Missing --template flag.",
    });
    // Inspect the FIX hint.
    try {
      await buildProgram().exitOverride().parseAsync(["create"], { from: "user" });
    } catch (e: unknown) {
      const err = e as { fix: string };
      expect(err.fix).toContain("--template erc20");
      expect(err.fix).toContain("smartc list-templates");
    }
    expect(textMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("wizard cancel — E_WIZARD_CANCEL propagates with exitCode 130, no file written", async () => {
    // First prompt (text -> contract name) resolves to a cancel symbol.
    const cancelSym = Symbol("cancel");
    textMock.mockResolvedValueOnce(cancelSym);
    isCancelMock.mockImplementationOnce((v: unknown) => v === cancelSym);
    const outPath = join(tmpDir, "MyToken.sol");
    const program = buildProgram();
    await expect(
      program.exitOverride().parseAsync(
        ["create", "--template", "erc20", "--out", outPath],
        { from: "user" },
      ),
    ).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
    });
    expect(existsSync(outPath)).toBe(false);
  });

  it("overwrite refused — E_FILE_EXISTS propagates and pre-existing content is unchanged", async () => {
    const outPath = join(tmpDir, "MyToken.sol");
    writeFileSync(outPath, "// stale content", "utf8");
    primeHappyPathMocks();
    // The overwrite confirm prompt is the next confirm call (after the 3 wizard
    // confirms above). Mock it to return false (user refuses).
    confirmMock.mockResolvedValueOnce(false); // overwrite refusal

    const program = buildProgram();
    await expect(
      program.exitOverride().parseAsync(
        ["create", "--template", "erc20", "--out", outPath],
        { from: "user" },
      ),
    ).rejects.toMatchObject({
      code: "E_FILE_EXISTS",
    });
    // Pre-existing file untouched.
    expect(readFileSync(outPath, "utf8")).toBe("// stale content");
  });

  it("--force bypasses overwrite prompt and overwrites stale content", async () => {
    const outPath = join(tmpDir, "MyToken.sol");
    writeFileSync(outPath, "// stale content", "utf8");
    primeHappyPathMocks();
    // We will NOT prime an overwrite confirm; --force should skip it entirely.
    const confirmCountBefore = confirmMock.mock.calls.length;

    const program = buildProgram();
    await program.exitOverride().parseAsync(
      ["create", "--template", "erc20", "--out", outPath, "--force"],
      { from: "user" },
    );

    // Exactly three confirm calls (the three wizard confirms) — no overwrite confirm.
    const confirmCountAfter = confirmMock.mock.calls.length;
    expect(confirmCountAfter - confirmCountBefore).toBe(3);
    // File overwritten with fresh contract source.
    const written = readFileSync(outPath, "utf8");
    expect(written).not.toBe("// stale content");
    expect(written).toContain("contract MyToken");
  });

  it("Phase 3 splice landed in src/commands/create.ts (marker consumed, compileVerify wired)", () => {
    const source = readFileSync("src/commands/create.ts", "utf8");
    // Marker consumed: zero occurrences of the Phase 2 placeholder.
    const markerMatches = source.match(/PHASE 3 SPLICE POINT/g) ?? [];
    expect(markerMatches.length).toBe(0);
    // compileVerify wired with the locked signature (source, tpl.chain).
    const callMatches =
      source.match(/compileVerify\(source,\s*tpl\.chain\)/g) ?? [];
    expect(callMatches.length).toBeGreaterThanOrEqual(1);
  });
});

// Sanity: ensure the registry-side helper used by beforeEach actually wires the
// erc20 template (cross-check with registry test).
describe("create command — registry precondition sanity", () => {
  beforeEach(() => {
    clear();
    registerErc20Template();
  });
  afterEach(() => {
    clear();
  });
  it("registers erc20 with runWizard + generate", () => {
    const tpl = get("erc20");
    expect(tpl).toBeDefined();
    expect(typeof (tpl as Record<string, unknown>).runWizard).toBe("function");
    expect(typeof (tpl as Record<string, unknown>).generate).toBe("function");
  });
});
