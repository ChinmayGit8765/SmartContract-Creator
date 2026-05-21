import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Output } from "../../../src/lib/output.js";

// Vitest 4 ESM mock pattern (see tests/prompt.spec.ts). Mock @clack/prompts
// BEFORE importing the SUT so the SUT picks up the mocked module.
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

const { runWizard } = await import("../../../src/templates/erc20/wizard.js");
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

beforeEach(() => {
  textMock.mockReset();
  selectMock.mockReset();
  confirmMock.mockReset();
  isCancelMock.mockReset();
  isCancelMock.mockReturnValue(false);
});

describe("erc20 wizard — happy paths and conditional step 7", () => {
  it("happy path — no flags set — returns Erc20Opts with access:false and skips prompt 7", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts).toEqual({
      name: "MyToken",
      symbol: "MTK",
      premint: "1000000",
      mintable: false,
      burnable: false,
      pausable: false,
      access: false,
    });
    expect(selectMock).not.toHaveBeenCalled();
    expect(out.warn as Mock).not.toHaveBeenCalled();
  });

  it("step 7 fires when mintable is true and returns 'ownable' selection", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    selectMock.mockResolvedValueOnce("ownable");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts.access).toBe("ownable");
    expect(selectMock).toHaveBeenCalledTimes(1);
    const warnArg = (out.warn as Mock).mock.calls[0]?.[0];
    expect(warnArg).toContain("Mintable + Ownable: a single key can mint unlimited tokens");
  });

  it("step 7 fires when pausable is true and returns 'roles' selection (no warn for Pausable+Roles)", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(true); // pausable
    selectMock.mockResolvedValueOnce("roles");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts.access).toBe("roles");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(out.warn as Mock).not.toHaveBeenCalled();
  });

  it("step 7 returns 'roles' when both mintable and pausable are true (Mintable+Roles is the mitigation — no warn)", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(true); // pausable
    selectMock.mockResolvedValueOnce("roles");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts.access).toBe("roles");
    expect(out.warn as Mock).not.toHaveBeenCalled();
  });

  it("step 7 select is configured with both ownable and roles options (locked labels + initialValue)", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    selectMock.mockResolvedValueOnce("ownable");

    await runWizard({ output: makeMockOutput() });

    const arg = selectMock.mock.calls[0]?.[0] as {
      message: string;
      options: Array<{ value: string; label: string }>;
      initialValue: string;
    };
    expect(arg.message).toBe("Access control style:");
    expect(arg.options).toEqual([
      { value: "ownable", label: "Ownable — one address controls Mint/Pause" },
      {
        value: "roles",
        label:
          "AccessControl — separate MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE",
      },
    ]);
    expect(arg.initialValue).toBe("ownable");
  });
});

describe("erc20 wizard — prompt-message + validator wiring (prompts 1-3)", () => {
  it("prompt 1 message and validator are wired correctly", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValue(false);

    await runWizard({ output: makeMockOutput() });

    const arg = textMock.mock.calls[0]?.[0] as {
      message: string;
      placeholder: string;
      defaultValue: string;
      validate: (v: string | undefined) => string | undefined;
    };
    expect(arg.message).toBe("Contract name (Solidity identifier)");
    expect(arg.placeholder).toBe("MyToken");
    expect(arg.defaultValue).toBe("MyToken");
    expect(arg.validate("3Bad")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );
    expect(arg.validate("Valid_Name")).toBeUndefined();
  });

  it("prompt 2 message and validator wired", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValue(false);

    await runWizard({ output: makeMockOutput() });

    const arg = textMock.mock.calls[1]?.[0] as {
      message: string;
      placeholder: string;
      defaultValue: string;
      validate: (v: string | undefined) => string | undefined;
    };
    expect(arg.message).toBe("Token symbol (1-11 ASCII letters/digits)");
    expect(arg.placeholder).toBe("MTK");
    expect(arg.defaultValue).toBe("MTK");
    expect(arg.validate("has space")).toBe(
      "Must be 1-11 ASCII letters/digits, no spaces or punctuation.",
    );
    expect(arg.validate("MTK")).toBeUndefined();
  });

  it("prompt 3 message and validator wired", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValue(false);

    await runWizard({ output: makeMockOutput() });

    const arg = textMock.mock.calls[2]?.[0] as {
      message: string;
      placeholder: string;
      defaultValue: string;
      validate: (v: string | undefined) => string | undefined;
    };
    expect(arg.message).toBe("Initial supply (human-readable, e.g. 1000000 or 1.5)");
    expect(arg.placeholder).toBe("1000000");
    expect(arg.defaultValue).toBe("1000000");
    expect(arg.validate("not-a-number")).toBe(
      "Must be a non-negative decimal number, e.g. 1000000 or 1.5.",
    );
    expect(arg.validate("1000000")).toBeUndefined();
    expect(arg.validate("1.5")).toBeUndefined();
    expect(arg.validate("0")).toBeUndefined();
  });
});

describe("erc20 wizard — cancel at each of the seven prompts throws E_WIZARD_CANCEL exit 130", () => {
  it("cancel at 'contract name' (prompt 1) throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(true);
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: contract name.",
    });
  });

  it("cancel at 'token symbol' (prompt 2) throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(false); // prompt 1
    isCancelMock.mockReturnValueOnce(true); // prompt 2
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: token symbol.",
    });
  });

  it("cancel at 'initial supply' (prompt 3) throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(true);
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: initial supply.",
    });
  });

  it("cancel at 'mintable' (prompt 4) throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(true);
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: mintable.",
    });
  });

  it("cancel at 'burnable' (prompt 5) throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(true);
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: burnable.",
    });
  });

  it("cancel at 'pausable' (prompt 6) throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(Symbol("cancel"));
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(true);
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: pausable.",
    });
  });

  it("cancel at 'access control' (prompt 7) throws E_WIZARD_CANCEL", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(true); // mintable → step 7 fires
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    selectMock.mockResolvedValueOnce(Symbol("cancel"));
    // First six are non-cancels; the seventh is the cancel.
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(false);
    isCancelMock.mockReturnValueOnce(true);
    await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
      code: "E_WIZARD_CANCEL",
      exitCode: 130,
      what: "Wizard cancelled at: access control.",
    });
  });
});

describe("erc20 wizard — newbie preamble + centralization warning", () => {
  it("newbie preamble fires before prompt 1 (explain + 2 references with locked URLs)", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValue(false);

    const out = makeMockOutput();
    await runWizard({ output: out });

    const explainMock = out.explain as Mock;
    const referenceMock = out.reference as Mock;
    // The preamble explain is the FIRST explain call (per-prompt explains follow).
    expect(explainMock.mock.calls[0]?.[0]).toBe(
      "ERC-20 is the fungible-token standard on Ethereum and EVM chains. This wizard asks for the basics, then a few optional features.",
    );
    expect(referenceMock).toHaveBeenCalledWith(
      "EIP-20 spec",
      "https://eips.ethereum.org/EIPS/eip-20",
    );
    expect(referenceMock).toHaveBeenCalledWith(
      "OpenZeppelin ERC20 docs",
      "https://docs.openzeppelin.com/contracts/5.x/erc20",
    );
  });

  it("centralization warning fires for Mintable+Ownable with the locked UI-SPEC string", async () => {
    textMock.mockResolvedValueOnce("MyToken");
    textMock.mockResolvedValueOnce("MTK");
    textMock.mockResolvedValueOnce("1000000");
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    selectMock.mockResolvedValueOnce("ownable");

    const out = makeMockOutput();
    await runWizard({ output: out });

    const warnArg = (out.warn as Mock).mock.calls[0]?.[0];
    expect(warnArg).toContain("Mintable + Ownable: a single key can mint unlimited tokens");
    expect(warnArg).toContain(
      "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
    );
  });
});
