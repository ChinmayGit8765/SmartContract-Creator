import { describe, it, expect, vi, beforeEach } from "vitest";
import { CliError } from "../src/lib/errors.js";

// Mock @clack/prompts BEFORE importing the SUT.
vi.mock("@clack/prompts", () => {
  return {
    confirm: vi.fn(),
    isCancel: vi.fn(() => false),
  };
});

// Import AFTER the mock so the SUT picks up the mocked module.
const { confirmOverwrite } = await import("../src/lib/prompt.js");
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
