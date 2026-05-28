import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CliError } from "../src/lib/errors.js";

// Mock @clack/prompts BEFORE importing the SUT.
vi.mock("@clack/prompts", () => {
  return {
    confirm: vi.fn(),
    isCancel: vi.fn(() => false),
  };
});

// Import AFTER the mock so the SUT picks up the mocked module.
const { confirmOverwrite, confirmOverwriteMany } = await import("../src/lib/prompt.js");
const clack = await import("@clack/prompts");

const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  confirmMock.mockReset();
  isCancelMock.mockReset();
  isCancelMock.mockReturnValue(false);
});

describe("confirmOverwrite", () => {
  it("returns true immediately when force is set and does not prompt", async () => {
    const result = await confirmOverwrite("foo.sol", { force: true });
    expect(result).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("calls confirm with the spec'd message and initialValue:false", async () => {
    confirmMock.mockResolvedValueOnce(true);
    await confirmOverwrite("foo.sol");
    expect(confirmMock).toHaveBeenCalledTimes(1);
    const arg = confirmMock.mock.calls[0]?.[0] as { message: string; initialValue: boolean };
    expect(arg.message).toMatch(/^File foo\.sol exists\. Overwrite\?$/);
    expect(arg.initialValue).toBe(false);
  });

  it("returns true when user answers yes (confirm resolves true)", async () => {
    confirmMock.mockResolvedValueOnce(true);
    const result = await confirmOverwrite("bar.sol");
    expect(result).toBe(true);
  });

  it("throws CliError(E_FILE_EXISTS) when user answers no (confirm resolves false)", async () => {
    confirmMock.mockResolvedValueOnce(false);
    await expect(confirmOverwrite("bar.sol")).rejects.toMatchObject({
      code: "E_FILE_EXISTS",
    });
    try {
      await confirmOverwrite("bar.sol");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      const err = e as CliError;
      expect(err.code).toBe("E_FILE_EXISTS");
      expect(err.what).toContain("bar.sol");
      expect(err.fix).toContain("--force");
    }
    // Two invocations above — confirm called once per call.
    expect(confirmMock).toHaveBeenCalledTimes(2);
  });

  it("throws CliError(E_FILE_EXISTS) when user cancels (Ctrl+C)", async () => {
    // confirm resolves to whatever cancel symbol; isCancel returns true.
    confirmMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(true);
    await expect(confirmOverwrite("baz.sol")).rejects.toMatchObject({
      code: "E_FILE_EXISTS",
    });
  });

  it("force=true wins even if confirm would have thrown", async () => {
    confirmMock.mockResolvedValueOnce(false);
    const result = await confirmOverwrite("foo.sol", { force: true });
    expect(result).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });
});

describe("confirmOverwriteMany (D-08)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-overwrite-many-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("force=true returns true without prompting (even if files exist)", async () => {
    const a = join(tmpDir, "a.sol");
    writeFileSync(a, "x");
    const result = await confirmOverwriteMany([a], { force: true });
    expect(result).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("returns true without prompting when none of the paths exist", async () => {
    const result = await confirmOverwriteMany([
      join(tmpDir, "missing1.sol"),
      join(tmpDir, "missing2.DEPLOY.md"),
    ]);
    expect(result).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("prompts once listing existing files and returns true on confirm", async () => {
    const a = join(tmpDir, "a.sol");
    const b = join(tmpDir, "a.DEPLOY.md");
    writeFileSync(a, "x");
    writeFileSync(b, "y");
    confirmMock.mockResolvedValueOnce(true);
    const result = await confirmOverwriteMany([a, b]);
    expect(result).toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    const arg = confirmMock.mock.calls[0]?.[0] as { message: string };
    expect(arg.message).toContain(a);
    expect(arg.message).toContain(b);
  });

  it("throws CliError(E_FILE_EXISTS) listing the existing paths on decline", async () => {
    const a = join(tmpDir, "a.sol");
    writeFileSync(a, "x");
    confirmMock.mockResolvedValueOnce(false);
    await expect(confirmOverwriteMany([a])).rejects.toMatchObject({
      code: "E_FILE_EXISTS",
    });
    try {
      writeFileSync(a, "x");
      confirmMock.mockResolvedValueOnce(false);
      await confirmOverwriteMany([a]);
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      const err = e as CliError;
      expect(err.what).toContain(a);
      expect(err.fix).toContain("--force");
    }
  });

  it("throws on cancel (Ctrl+C)", async () => {
    const a = join(tmpDir, "a.sol");
    writeFileSync(a, "x");
    confirmMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(true);
    await expect(confirmOverwriteMany([a])).rejects.toMatchObject({
      code: "E_FILE_EXISTS",
    });
  });
});
