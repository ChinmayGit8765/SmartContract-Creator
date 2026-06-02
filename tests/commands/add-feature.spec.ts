import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock the Ollama client (no daemon in tests) and @clack confirm. Keep the pure
// helpers (resolveOllamaHost/Model) real via importActual.
vi.mock("../../src/ai/ollama.js", async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>;
  return {
    ...actual,
    isOllamaReachable: vi.fn(async () => true),
    generateCompletion: vi.fn(),
  };
});
vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  confirm: vi.fn(async () => true),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

const { buildProgram } = await import("../../src/program.js");
const ollama = await import("../../src/ai/ollama.js");
const clack = await import("@clack/prompts");

const reachableMock = ollama.isOllamaReachable as unknown as ReturnType<typeof vi.fn>;
const generateMock = ollama.generateCompletion as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

const ORIGINAL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyToken {}
`;

const VALID_PATCH = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyToken {
    uint256 public cap = 1000;
}
`;

const BROKEN_PATCH = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyToken { this is not valid solidity }
`;

async function capture(fn: () => Promise<void>): Promise<string> {
  const w: string[] = [];
  const o = vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => {
    w.push(typeof c === "string" ? c : String(c));
    return true;
  });
  const e = vi.spyOn(process.stderr, "write").mockImplementation((c: unknown) => {
    w.push(typeof c === "string" ? c : String(c));
    return true;
  });
  try {
    await fn();
  } finally {
    o.mockRestore();
    e.mockRestore();
  }
  return w.join("");
}

describe("add-feature command (AI patch flow)", () => {
  let tmpDir: string;
  let file: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-addfeat-"));
    file = join(tmpDir, "MyToken.sol");
    writeFileSync(file, ORIGINAL, "utf8");
    reachableMock.mockReset();
    reachableMock.mockResolvedValue(true);
    generateMock.mockReset();
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
    isCancelMock.mockReset();
    isCancelMock.mockReturnValue(false);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function run(args: string[]): Promise<string> {
    const program = buildProgram();
    return capture(async () => {
      await program.exitOverride().parseAsync(args, { from: "user" });
    });
  }

  it("AI-01/03/04: generates, previews a diff, sandbox-compiles, and writes on confirm", async () => {
    generateMock.mockResolvedValue("```solidity\n" + VALID_PATCH + "```");
    const out = await run(["add-feature", "--ai", "--file", file, "add a cap", "--no-color"]);
    expect(readFileSync(file, "utf8")).toContain("uint256 public cap");
    expect(out).toContain("Proposed change");
    expect(out).toContain("Updated");
  });

  it("AI-03: a non-compiling AI patch is rolled back — file unchanged + error", async () => {
    generateMock.mockResolvedValue(BROKEN_PATCH);
    await expect(run(["add-feature", "--ai", "--file", file, "break it"])).rejects.toMatchObject({
      code: "E_COMPILE_FAILED",
    });
    expect(readFileSync(file, "utf8")).toBe(ORIGINAL); // rolled back (never written)
  });

  it("AI-04: declining the confirmation leaves the file unchanged", async () => {
    generateMock.mockResolvedValue(VALID_PATCH);
    confirmMock.mockResolvedValue(false);
    const out = await run(["add-feature", "--ai", "--file", file, "add a cap"]);
    expect(out).toContain("Aborted");
    expect(readFileSync(file, "utf8")).toBe(ORIGINAL);
  });

  it("--force skips the confirmation and applies a compiling patch", async () => {
    generateMock.mockResolvedValue(VALID_PATCH);
    await run(["add-feature", "--ai", "--file", file, "add a cap", "--force"]);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(readFileSync(file, "utf8")).toContain("cap");
  });

  it("AI-05: unreachable Ollama -> E_AI_UNREACHABLE, file untouched, generate not called", async () => {
    reachableMock.mockResolvedValue(false);
    await expect(run(["add-feature", "--ai", "--file", file, "x"])).rejects.toMatchObject({
      code: "E_AI_UNREACHABLE",
    });
    expect(generateMock).not.toHaveBeenCalled();
    expect(readFileSync(file, "utf8")).toBe(ORIGINAL);
  });

  it("requires --ai", async () => {
    await expect(run(["add-feature", "--file", file, "x"])).rejects.toMatchObject({ code: "E_USAGE" });
  });

  it("errors when the file does not exist", async () => {
    await expect(
      run(["add-feature", "--ai", "--file", join(tmpDir, "nope.sol"), "x"]),
    ).rejects.toMatchObject({ code: "E_USAGE" });
  });

  it("errors on an unsupported file extension", async () => {
    const txt = join(tmpDir, "notes.txt");
    writeFileSync(txt, "hi", "utf8");
    await expect(run(["add-feature", "--ai", "--file", txt, "x"])).rejects.toMatchObject({
      code: "E_USAGE",
    });
  });
});
