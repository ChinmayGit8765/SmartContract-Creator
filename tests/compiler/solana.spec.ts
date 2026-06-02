import { describe, it, expect, vi } from "vitest";
import { compileVerifySolana } from "../../src/compiler/solana.js";

const SRC = "// generated anchor program";

describe("compileVerifySolana", () => {
  it("skips (no throw) when anchor is not installed — SPL-05", async () => {
    const runBuild = vi.fn();
    const result = await compileVerifySolana(SRC, "my_token", {
      detectAnchor: async () => null,
      runBuild,
    });
    expect(result.skipped).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.skipReason).toMatch(/anchor/i);
    expect(result.skipReason).toMatch(/doctor/i);
    // The build must NOT run when the toolchain is absent.
    expect(runBuild).not.toHaveBeenCalled();
  });

  it("builds in a scratch workspace and returns skipped:false on success", async () => {
    const runBuild = vi.fn(async () => ({ code: 0, stdout: "Finished", stderr: "" }));
    const result = await compileVerifySolana(SRC, "my_token", {
      detectAnchor: async () => "anchor-cli 0.30.1",
      runBuild,
    });
    expect(result.skipped).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(runBuild).toHaveBeenCalledTimes(1);
    // The runner was handed a workspace directory path.
    expect(typeof runBuild.mock.calls[0]?.[0]).toBe("string");
  });

  it("throws E_COMPILE_FAILED with the build stderr when anchor build fails", async () => {
    await expect(
      compileVerifySolana(SRC, "my_token", {
        detectAnchor: async () => "anchor-cli 0.30.1",
        runBuild: async () => ({ code: 101, stdout: "", stderr: "error[E0277]: trait bound" }),
      }),
    ).rejects.toMatchObject({ code: "E_COMPILE_FAILED", exitCode: 1 });
  });
});
