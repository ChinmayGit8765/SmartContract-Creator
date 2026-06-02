import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

const { buildProgram } = await import("../../src/program.js");
const { clear } = await import("../../src/registry/index.js");
const { registerSplTemplate } = await import("../../src/templates/spl/index.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

async function captureStdio(fn: () => Promise<void>): Promise<string> {
  const writes: string[] = [];
  const outSpy = vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => {
    writes.push(typeof c === "string" ? c : String(c));
    return true;
  });
  const errSpy = vi.spyOn(process.stderr, "write").mockImplementation((c: unknown) => {
    writes.push(typeof c === "string" ? c : String(c));
    return true;
  });
  try {
    await fn();
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
  return writes.join("");
}

function primeSpl(opts: { mint?: "revoke" | "deployer"; freeze?: "none" | "deployer"; metadata?: boolean } = {}): void {
  textMock.mockResolvedValueOnce("My Token"); // name
  textMock.mockResolvedValueOnce("MYTKN"); // symbol
  textMock.mockResolvedValueOnce("9"); // decimals
  textMock.mockResolvedValueOnce("1000000"); // supply
  selectMock.mockResolvedValueOnce(opts.mint ?? "revoke");
  selectMock.mockResolvedValueOnce(opts.freeze ?? "none");
  confirmMock.mockResolvedValueOnce(opts.metadata ?? false);
}

describe("create dispatcher — SPL E2E (graceful degradation)", () => {
  let tmpDir: string;

  beforeEach(() => {
    clear();
    registerSplTemplate();
    textMock.mockReset();
    selectMock.mockReset();
    confirmMock.mockReset();
    isCancelMock.mockReset();
    isCancelMock.mockReturnValue(false);
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-spl-e2e-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    clear();
  });

  it("writes the .rs program AND its DEPLOY.md; warns that compile-verify was skipped (anchor absent)", async () => {
    primeSpl({ mint: "revoke", freeze: "none", metadata: true });
    const outPath = join(tmpDir, "my_token.rs");
    const deployPath = join(tmpDir, "my_token.DEPLOY.md");
    const program = buildProgram();
    const captured = await captureStdio(async () => {
      await program
        .exitOverride()
        .parseAsync(["create", "--template", "spl", "--out", outPath], { from: "user" });
    });

    expect(existsSync(outPath)).toBe(true);
    expect(existsSync(deployPath)).toBe(true);

    const rust = readFileSync(outPath, "utf8");
    expect(rust).toContain("pub mod my_token {");
    expect(rust).toContain("declare_id!(");

    const deploy = readFileSync(deployPath, "utf8");
    expect(deploy).toContain("## Deploy via spl-token CLI");
    expect(deploy).toContain("## Deploy via Anchor");
    expect(deploy).toContain("api.mainnet-beta.solana.com");

    // SPL-05: anchor is not installed in the test env, so compile-verify is
    // skipped and the user is warned — but the file is still written.
    expect(captured.toLowerCase()).toContain("anchor");
    expect(captured).toContain(`Wrote ${outPath}`);
    expect(captured).toContain(`Wrote ${deployPath}`);
  });

  it("keeping the mint authority surfaces the retained-authority warning on stderr", async () => {
    primeSpl({ mint: "deployer", freeze: "none", metadata: false });
    const outPath = join(tmpDir, "my_token.rs");
    const program = buildProgram();
    const captured = await captureStdio(async () => {
      await program
        .exitOverride()
        .parseAsync(["create", "--template", "spl", "--out", outPath], { from: "user" });
    });
    expect(captured).toContain("Mint authority retained");
  });
});
