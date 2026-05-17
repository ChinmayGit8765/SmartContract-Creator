import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../../src/program.js";
import { clear } from "../../src/registry/index.js";
import { registerStubTemplates } from "../../src/registry/stub.js";

/** Captures writes to process.stdout for the duration of a callback,
 *  returning the captured text. Restores the original write after.
 */
async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const writes: string[] = [];
  const spy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: unknown) => {
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

describe("list-templates command", () => {
  beforeEach(() => {
    clear();
    registerStubTemplates();
  });

  afterEach(() => {
    clear();
  });

  it("renders the default table containing the foundation-smoke canary", async () => {
    const program = buildProgram();
    const captured = await captureStdout(async () => {
      // from: "user" means args are user args only — no node/program prefix.
      await program.exitOverride().parseAsync(
        ["list-templates"],
        { from: "user" }
      );
    });
    expect(captured).toContain("foundation-smoke");
    expect(captured).toContain("Foundation Smoke Test");
    // cli-table3 default border uses unicode box chars; ASCII pipes appear in some terms.
    // Assert at least one border char family is present.
    expect(captured).toMatch(/[│|]/);
  });

  it("renders valid JSON when --json is passed", async () => {
    const program = buildProgram();
    const captured = await captureStdout(async () => {
      await program.exitOverride().parseAsync(
        ["list-templates", "--json"],
        { from: "user" }
      );
    });
    const parsed = JSON.parse(captured) as {
      templates: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(parsed.templates)).toBe(true);
    expect(parsed.templates.length).toBeGreaterThan(0);
  });

  it("locks the JSON shape to exactly five fields per template", async () => {
    const program = buildProgram();
    const captured = await captureStdout(async () => {
      await program.exitOverride().parseAsync(
        ["list-templates", "--json"],
        { from: "user" }
      );
    });
    const parsed = JSON.parse(captured) as {
      templates: Array<Record<string, unknown>>;
    };
    const first = parsed.templates[0];
    expect(first).toBeDefined();
    expect(Object.keys(first!).sort()).toEqual([
      "chain",
      "description",
      "id",
      "name",
      "status",
    ]);
  });
});
