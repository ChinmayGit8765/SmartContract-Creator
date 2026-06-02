import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../../src/program.js";

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

describe("doctor command", () => {
  afterEach(() => {
    // doctor sets process.exitCode; reset so a 1 from a probe can't leak into the runner.
    process.exitCode = 0;
  });

  it("renders a table listing all five probed tools", async () => {
    const program = buildProgram();
    const out = await captureStdout(async () => {
      await program.exitOverride().parseAsync(["doctor", "--no-color"], { from: "user" });
    });
    for (const tool of ["Node.js", "solc (bundled)", "anchor", "cargo-build-sbf", "ollama"]) {
      expect(out).toContain(tool);
    }
    expect(out).toMatch(/[│|]/); // table border
  });

  it("exits 0 on this machine (Node + bundled solc are present)", async () => {
    process.exitCode = 0;
    const program = buildProgram();
    await captureStdout(async () => {
      await program.exitOverride().parseAsync(["doctor", "--no-color"], { from: "user" });
    });
    expect(process.exitCode).toBe(0);
  });

  it("emits a stable JSON shape under --json", async () => {
    const program = buildProgram();
    const out = await captureStdout(async () => {
      await program.exitOverride().parseAsync(["doctor", "--json"], { from: "user" });
    });
    const parsed = JSON.parse(out) as {
      ok: boolean;
      tools: Array<Record<string, unknown>>;
    };
    expect(typeof parsed.ok).toBe("boolean");
    expect(parsed.tools).toHaveLength(5);
    const keys = parsed.tools.map((t) => t.key);
    expect(keys).toEqual(["node", "solc", "anchor", "cargo-build-sbf", "ollama"]);
    for (const t of parsed.tools) {
      expect(t).toHaveProperty("found");
      expect(t).toHaveProperty("version");
      expect(t).toHaveProperty("status");
      expect(t).toHaveProperty("required");
      expect(t).toHaveProperty("purpose");
    }
    // node + solc are required and present here, so the run is healthy.
    expect(parsed.ok).toBe(true);
  });
});
