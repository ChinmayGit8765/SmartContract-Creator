import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

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
const { clear, register } = await import("../../src/registry/index.js");
const { registerErc20Template } = await import(
  "../../src/templates/erc20/index.js"
);
const { registerErc721Template } = await import(
  "../../src/templates/erc721/index.js"
);
const { registerErc1155Template } = await import(
  "../../src/templates/erc1155/index.js"
);
const { safeReadVersion, formatVersionLine } = await import(
  "../../src/lib/version.js"
);
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Captures writes to process.stdout AND process.stderr for the duration of
 *  a callback. Warnings (output.warn) go to stderr; nextStep/result go to
 *  stdout — both surfaces are part of the E2E user experience under test. */
async function captureStdio(fn: () => Promise<void>): Promise<string> {
  const writes: string[] = [];
  const outSpy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: unknown) => {
      writes.push(typeof chunk === "string" ? chunk : String(chunk));
      return true;
    });
  const errSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: unknown) => {
      writes.push(typeof chunk === "string" ? chunk : String(chunk));
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

function primeHappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyToken");
  textMock.mockResolvedValueOnce("MTK");
  textMock.mockResolvedValueOnce("1000000");
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // pausable
}

// ERC-721 happy path (no flags, no royalty): prompt order from plan 04-02
// SUMMARY — name -> symbol -> baseUri -> mintable -> enumerable -> burnable ->
// pausable -> royalty. No royalty pair (royalty=false), no access select
// (mintable=pausable=false). 3 text + 5 confirm.
function primeErc721HappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyNFT");
  textMock.mockResolvedValueOnce("MNFT");
  textMock.mockResolvedValueOnce(""); // baseUri (empty)
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // enumerable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // pausable
  confirmMock.mockResolvedValueOnce(false); // royalty
}

// ERC-1155 happy path (no flags): prompt order from plan 04-03 SUMMARY —
// name -> uri -> mintable -> burnable -> supply -> pausable. No access select
// (mintable=pausable=false). 2 text + 4 confirm.
function primeErc1155HappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyMulti");
  textMock.mockResolvedValueOnce("https://example.com/api/token/{id}.json");
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // supply
  confirmMock.mockResolvedValueOnce(false); // pausable
}

// Test-only template that returns the warns-no-error fixture. Used to prove
// warning pass-through through the dispatcher without entangling the erc20
// wizard mocks.
const warnsTemplate = {
  id: "warns-test-only",
  name: "Warns (test only)",
  chain: "evm" as const,
  status: "stub" as const,
  description: "DO NOT USE — surfaces a deliberate solc warning",
  runWizard: async () => ({}),
  generate: () => ({
    filename: "Warns.sol",
    source: readFileSync(
      join(__dirname, "../fixtures/warns-no-error.sol"),
      "utf8",
    ),
  }),
};

describe("create dispatcher — compile-verify E2E", () => {
  let tmpDir: string;

  beforeEach(() => {
    clear();
    registerErc20Template();
    registerErc721Template();
    registerErc1155Template();
    textMock.mockReset();
    selectMock.mockReset();
    confirmMock.mockReset();
    isCancelMock.mockReset();
    isCancelMock.mockReturnValue(false);
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-compile-e2e-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    clear();
  });

  it("happy path with real solc — file is compile-verified, written to disk, and footer shows real solc + @oz/contracts versions", async () => {
    primeHappyPathMocks();
    const outPath = join(tmpDir, "MyToken.sol");
    const program = buildProgram();
    const captured = await captureStdio(async () => {
      await program
        .exitOverride()
        .parseAsync(
          [
            "create",
            "--template",
            "erc20",
            "--newbie",
            "--out",
            outPath,
          ],
          { from: "user" },
        );
    });
    expect(existsSync(outPath)).toBe(true);
    const written = readFileSync(outPath, "utf8");
    expect(written).toContain("contract MyToken");
    expect(captured).toContain(`Wrote ${outPath}`);
    // D-12 footer: real pinned versions surfaced.
    expect(captured).toContain("Compile-verified against solc");
    expect(captured).toContain("@openzeppelin/contracts");
    // Sanity: safeReadVersion succeeded for both deps (no "unknown" fallback).
    expect(captured).not.toContain("solc unknown");
    expect(captured).not.toContain("@openzeppelin/contracts unknown");

    // D-01/D-09/D-14: the DEPLOY.md is written alongside the .sol.
    const deployPath = join(tmpDir, "MyToken.DEPLOY.md");
    expect(existsSync(deployPath)).toBe(true);
    const deployDoc = readFileSync(deployPath, "utf8");
    expect(deployDoc).toContain("## Deploy via Hardhat");
    expect(deployDoc).toContain("## Deploy via Foundry");
    expect(deployDoc).toContain("## Deploy via Remix");
    expect(deployDoc).toContain("## Verify on Etherscan");
    expect(deployDoc).toContain("--broadcast");
    expect(deployDoc).toContain("v0.8.35+commit.47b9dedd");
    // stdout mentions the DEPLOY.md path + the nextStep references it.
    expect(captured).toContain(`Wrote ${deployPath}`);
    expect(captured).toContain("for copy-pasteable deploy + verify commands");
  });

  it("D-06/D-14: mintable+ownable erc20 writes a DEPLOY.md containing the critical centralization warning", async () => {
    // name, symbol, premint (3 text) → mintable=true, burnable=false, pausable=false
    // (3 confirm) → access select = "ownable".
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    selectMock.mockResolvedValueOnce("ownable"); // access

    const outPath = join(tmpDir, "MyToken.sol");
    const deployPath = join(tmpDir, "MyToken.DEPLOY.md");
    const program = buildProgram();
    const captured = await captureStdio(async () => {
      await program
        .exitOverride()
        .parseAsync(["create", "--template", "erc20", "--out", outPath], {
          from: "user",
        });
    });
    expect(existsSync(outPath)).toBe(true);
    expect(existsSync(deployPath)).toBe(true);
    const deployDoc = readFileSync(deployPath, "utf8");
    // The DEPLOY.md discloses the mintable+ownable centralization risk (DEPLOY-06).
    expect(deployDoc).toContain("a single key can mint unlimited tokens");
    // The wizard surfaced the SAME critical warning (single-source / parity).
    expect(captured).toContain("a single key can mint unlimited tokens");
  });

  it("happy path ERC-721 (no flags, no royalty) — file is compile-verified, written to disk, contains contract MyNFT, footer shows version line", async () => {
    primeErc721HappyPathMocks();
    const outPath = join(tmpDir, "MyNFT.sol");
    const program = buildProgram();
    const captured = await captureStdio(async () => {
      await program
        .exitOverride()
        .parseAsync(
          ["create", "--template", "erc721", "--newbie", "--out", outPath],
          { from: "user" },
        );
    });
    expect(existsSync(outPath)).toBe(true);
    const written = readFileSync(outPath, "utf8");
    expect(written).toContain("contract MyNFT");
    expect(captured).toContain(`Wrote ${outPath}`);
    expect(captured).toContain("Compile-verified against solc");
    expect(captured).toContain("@openzeppelin/contracts");
  });

  it("happy path ERC-1155 (no flags) — file is compile-verified, written to disk, contains contract MyMulti, footer shows version line", async () => {
    primeErc1155HappyPathMocks();
    const outPath = join(tmpDir, "MyMulti.sol");
    const program = buildProgram();
    const captured = await captureStdio(async () => {
      await program
        .exitOverride()
        .parseAsync(
          ["create", "--template", "erc1155", "--newbie", "--out", outPath],
          { from: "user" },
        );
    });
    expect(existsSync(outPath)).toBe(true);
    const written = readFileSync(outPath, "utf8");
    expect(written).toContain("contract MyMulti");
    expect(captured).toContain(`Wrote ${outPath}`);
    expect(captured).toContain("Compile-verified against solc");
    expect(captured).toContain("@openzeppelin/contracts");
  });

  it("warning pass-through — register test-only template returning warns-no-error source; dispatcher writes file AND emits warning on stderr", async () => {
    clear();
    register(warnsTemplate as never);
    const outPath = join(tmpDir, "Warns.sol");
    const program = buildProgram();
    const captured = await captureStdio(async () => {
      await program
        .exitOverride()
        .parseAsync(
          [
            "create",
            "--template",
            "warns-test-only",
            "--out",
            outPath,
          ],
          { from: "user" },
        );
    });
    // File IS written despite warnings (COMP-04 / SC-3).
    expect(existsSync(outPath)).toBe(true);
    // output.warn prefix from src/lib/output.ts:51 — emitted to stderr.
    expect(captured.toLowerCase()).toContain("warn:");
    // D-09: a template WITHOUT deployMeta gets no DEPLOY.md (no error).
    expect(existsSync(join(tmpDir, "Warns.DEPLOY.md"))).toBe(false);
  });

  it("--version line surfaces real pinned versions (SC-5 user-facing surface)", () => {
    expect(safeReadVersion("solc")).toBe("0.8.35");
    expect(safeReadVersion("@openzeppelin/contracts")).toBe("5.6.1");
    const line = formatVersionLine();
    expect(line).toContain("solc 0.8.35");
    expect(line).toContain("@openzeppelin/contracts 5.6.1");
    expect(line).not.toContain("solc not bundled");
    expect(line).not.toContain("@openzeppelin/contracts not bundled");
  });
});
