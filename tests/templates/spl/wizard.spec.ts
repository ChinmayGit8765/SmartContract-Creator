import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Output } from "../../../src/lib/output.js";

vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

const { runWizard } = await import("../../../src/templates/spl/wizard.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

function makeMockOutput(): Output {
  return {
    result: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    explain: vi.fn(),
    reference: vi.fn(),
    nextStep: vi.fn(),
  };
}

// Prompt order: name, symbol, decimals, supply (text) -> mintAuthority,
// freezeAuthority (select) -> metadata (confirm).
function prime(opts: {
  mint?: "revoke" | "deployer";
  freeze?: "none" | "deployer";
  metadata?: boolean;
}): void {
  textMock.mockResolvedValueOnce("My Token");
  textMock.mockResolvedValueOnce("MYTKN");
  textMock.mockResolvedValueOnce("9");
  textMock.mockResolvedValueOnce("1000000");
  selectMock.mockResolvedValueOnce(opts.mint ?? "revoke");
  selectMock.mockResolvedValueOnce(opts.freeze ?? "none");
  confirmMock.mockResolvedValueOnce(opts.metadata ?? false);
}

beforeEach(() => {
  textMock.mockReset();
  selectMock.mockReset();
  confirmMock.mockReset();
  isCancelMock.mockReset();
  isCancelMock.mockReturnValue(false);
});

describe("spl wizard", () => {
  it("returns SplOpts with parsed decimals and the authority choices", async () => {
    prime({ mint: "deployer", freeze: "deployer", metadata: true });
    const opts = await runWizard({ output: makeMockOutput() });
    expect(opts).toEqual({
      name: "My Token",
      symbol: "MYTKN",
      decimals: 9,
      supply: "1000000",
      mintAuthority: "deployer",
      freezeAuthority: "deployer",
      metadata: true,
    });
  });

  it("authority prompts have NO default (explicit choice — SPL-02/03)", async () => {
    prime({});
    await runWizard({ output: makeMockOutput() });
    const mintArg = selectMock.mock.calls[0]?.[0] as { initialValue?: unknown };
    const freezeArg = selectMock.mock.calls[1]?.[0] as { initialValue?: unknown };
    expect(mintArg.initialValue).toBeUndefined();
    expect(freezeArg.initialValue).toBeUndefined();
  });

  it("emits the mint-authority-retained critical warning when keeping mint authority", async () => {
    prime({ mint: "deployer" });
    const out = makeMockOutput();
    await runWizard({ output: out });
    const warned = (out.warn as Mock).mock.calls.map((c) => c[0]).join("\n");
    expect(warned).toContain("Mint authority retained");
  });

  it("emits the freeze-authority-retained warning when keeping freeze authority", async () => {
    prime({ freeze: "deployer" });
    const out = makeMockOutput();
    await runWizard({ output: out });
    const warned = (out.warn as Mock).mock.calls.map((c) => c[0]).join("\n");
    expect(warned).toContain("Freeze authority retained");
  });

  it("safest combo (revoke + none, no metadata) emits NO critical warnings", async () => {
    prime({ mint: "revoke", freeze: "none", metadata: false });
    const out = makeMockOutput();
    await runWizard({ output: out });
    expect(out.warn as Mock).not.toHaveBeenCalled();
  });

  it("cancel at the mint-authority prompt throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce("My Token");
    textMock.mockResolvedValueOnce("MYTKN");
    textMock.mockResolvedValueOnce("9");
    textMock.mockResolvedValueOnce("1000000");
    selectMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(false); // name
    isCancelMock.mockReturnValueOnce(false); // symbol
    isCancelMock.mockReturnValueOnce(false); // decimals
    isCancelMock.mockReturnValueOnce(false); // supply
    isCancelMock.mockReturnValueOnce(true); // mint authority
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: mint authority.",
    });
  });
});
