import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Output } from "../../../src/lib/output.js";

// Vitest 4 ESM mock pattern (PATTERNS §S3). Mock @clack/prompts BEFORE importing
// the SUT so the SUT picks up the mocked module.
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

const { runWizard } = await import("../../../src/templates/erc721/wizard.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

const ZERO = "0x0000000000000000000000000000000000000000";

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

describe("erc721 wizard — happy paths + warnings", () => {
  it("happy path A — no flags: returns bare Erc721Opts, no warnings, access prompt skipped", async () => {
    textMock.mockResolvedValueOnce("MyNFT"); // name
    textMock.mockResolvedValueOnce("MNFT"); // symbol
    textMock.mockResolvedValueOnce(""); // baseUri
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // enumerable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    confirmMock.mockResolvedValueOnce(false); // royalty

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts).toEqual({
      name: "MyNFT",
      symbol: "MNFT",
      baseUri: "",
      mintable: false,
      enumerable: false,
      burnable: false,
      pausable: false,
      uriStorage: false,
      royalty: { enabled: false, feeNumerator: 0, receiver: ZERO },
      access: false,
    });
    expect(selectMock).not.toHaveBeenCalled();
    expect(out.warn as Mock).not.toHaveBeenCalled();
  });

  it("happy path B — mintable + ownable: one Mintable+Ownable warning", async () => {
    textMock.mockResolvedValueOnce("MyNFT");
    textMock.mockResolvedValueOnce("MNFT");
    textMock.mockResolvedValueOnce("");
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // enumerable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    confirmMock.mockResolvedValueOnce(false); // royalty
    selectMock.mockResolvedValueOnce("ownable");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts.mintable).toBe(true);
    expect(opts.access).toBe("ownable");
    expect(opts.royalty.enabled).toBe(false);
    expect(selectMock).toHaveBeenCalledTimes(1);
    const warnMock = out.warn as Mock;
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock.mock.calls[0]?.[0]).toContain(
      "Mintable + Ownable: a single key can mint unlimited NFTs.",
    );
  });

  it("happy path C — royalty enabled + mintable + ownable: TWO warnings (Mintable+Ownable, Royalty+Ownable)", async () => {
    textMock.mockResolvedValueOnce("MyNFT"); // name
    textMock.mockResolvedValueOnce("MNFT"); // symbol
    textMock.mockResolvedValueOnce(""); // baseUri
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // enumerable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    confirmMock.mockResolvedValueOnce(true); // royalty
    textMock.mockResolvedValueOnce("250"); // bps
    textMock.mockResolvedValueOnce(ZERO); // receiver
    selectMock.mockResolvedValueOnce("ownable");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts.royalty).toEqual(
      expect.objectContaining({
        enabled: true,
        feeNumerator: 250,
        receiver: ZERO,
      }),
    );
    const warnMock = out.warn as Mock;
    expect(warnMock).toHaveBeenCalledTimes(2);
    const allWarn = warnMock.mock.calls.map((c) => c[0]).join("\n");
    expect(allWarn).toContain("Mintable + Ownable");
    expect(allWarn).toContain(
      "EIP-2981 + Ownable: the contract owner can change the royalty recipient",
    );
  });

  it("happy path D — all flags + roles: ZERO warnings (no Ownable triggers) + royalty enabled", async () => {
    textMock.mockResolvedValueOnce("MyNFT"); // name
    textMock.mockResolvedValueOnce("MNFT"); // symbol
    textMock.mockResolvedValueOnce("https://example.com/api/token/"); // baseUri
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(true); // enumerable
    confirmMock.mockResolvedValueOnce(true); // burnable
    confirmMock.mockResolvedValueOnce(true); // pausable
    confirmMock.mockResolvedValueOnce(true); // royalty
    textMock.mockResolvedValueOnce("250"); // bps
    textMock.mockResolvedValueOnce(ZERO); // receiver
    selectMock.mockResolvedValueOnce("roles");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts.access).toBe("roles");
    expect(opts.enumerable).toBe(true);
    expect(opts.burnable).toBe(true);
    expect(opts.pausable).toBe(true);
    expect(opts.royalty.enabled).toBe(true);
    expect(out.warn as Mock).not.toHaveBeenCalled();
  });

  it("pausable + ownable (no mintable): one Pausable+Ownable warning", async () => {
    textMock.mockResolvedValueOnce("MyNFT");
    textMock.mockResolvedValueOnce("MNFT");
    textMock.mockResolvedValueOnce("");
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // enumerable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(true); // pausable
    confirmMock.mockResolvedValueOnce(false); // royalty
    selectMock.mockResolvedValueOnce("ownable");

    const out = makeMockOutput();
    await runWizard({ output: out });

    const warnMock = out.warn as Mock;
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock.mock.calls[0]?.[0]).toContain(
      "Pausable + Ownable: a single key can halt all NFT transfers.",
    );
  });

  it("newbie preamble fires before prompt 1 (explain + 2 references with locked URLs)", async () => {
    textMock.mockResolvedValueOnce("MyNFT");
    textMock.mockResolvedValueOnce("MNFT");
    textMock.mockResolvedValueOnce("");
    confirmMock.mockResolvedValue(false);

    const out = makeMockOutput();
    await runWizard({ output: out });

    const explainMock = out.explain as Mock;
    const referenceMock = out.reference as Mock;
    expect(explainMock.mock.calls[0]?.[0]).toBe(
      "ERC-721 is the non-fungible-token (NFT) standard on Ethereum and EVM chains. This wizard asks for the basics, then a few optional features.",
    );
    expect(referenceMock).toHaveBeenCalledWith(
      "EIP-721 spec",
      "https://eips.ethereum.org/EIPS/eip-721",
    );
    expect(referenceMock).toHaveBeenCalledWith(
      "OpenZeppelin ERC721 docs",
      "https://docs.openzeppelin.com/contracts/5.x/erc721",
    );
  });

  it("royalty bps + receiver prompts are wired with isRoyaltyBps / isEthAddress validators", async () => {
    textMock.mockResolvedValueOnce("MyNFT");
    textMock.mockResolvedValueOnce("MNFT");
    textMock.mockResolvedValueOnce("");
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // enumerable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // pausable
    confirmMock.mockResolvedValueOnce(true); // royalty
    textMock.mockResolvedValueOnce("250"); // bps
    textMock.mockResolvedValueOnce(ZERO); // receiver

    await runWizard({ output: makeMockOutput() });

    const bpsArg = textMock.mock.calls[3]?.[0] as {
      message: string;
      validate: (v: string | undefined) => string | undefined;
    };
    expect(bpsArg.message).toBe("Royalty basis points (0-10000)");
    expect(bpsArg.validate("10001")).toBe(
      "Must be between 0 and 10000 inclusive (10000 = 100%).",
    );
    expect(bpsArg.validate("250")).toBeUndefined();

    const recvArg = textMock.mock.calls[4]?.[0] as {
      message: string;
      validate: (v: string | undefined) => string | undefined;
    };
    expect(recvArg.message).toBe("Royalty recipient address");
    expect(recvArg.validate("nope")).toBe(
      "Must be a 42-character hex address starting with 0x.",
    );
    expect(recvArg.validate(ZERO)).toBeUndefined();
  });
});

// Cancel-at-each-prompt. The 11 prompts in order:
//   0 contract name, 1 token symbol, 2 base URI, 3 mintable, 4 enumerable,
//   5 burnable, 6 pausable, 7 royalty, 8 royalty basis points,
//   9 royalty recipient, 10 access control.
// For each index we prime the prior prompts with valid values, make isCancel
// return false for them and true for the target prompt, and assert the thrown
// CliError carries the matching prompt label.
describe("erc721 wizard — cancel at each of the 11 prompts throws E_WIZARD_CANCEL exit 130", () => {
  type Case = { index: number; label: string };
  const cases: Case[] = [
    { index: 0, label: "contract name" },
    { index: 1, label: "token symbol" },
    { index: 2, label: "base URI" },
    { index: 3, label: "mintable" },
    { index: 4, label: "enumerable" },
    { index: 5, label: "burnable" },
    { index: 6, label: "pausable" },
    { index: 7, label: "royalty" },
    { index: 8, label: "royalty basis points" },
    { index: 9, label: "royalty recipient" },
    { index: 10, label: "access control" },
  ];

  it.each(cases)(
    "cancel at prompt $index ($label) throws E_WIZARD_CANCEL",
    async ({ index, label }) => {
      const cancel = Symbol("cancel");

      // Prompts 8 & 9 (royalty bps/receiver) require royalty opt-in (prompt 7 = true).
      // Prompt 10 (access) requires mintable||pausable — enable mintable (prompt 3).
      const royaltyBranch = index >= 8;
      const accessBranch = index === 10;

      // ---- text prompts (name, symbol, baseUri, [bps, receiver]) ----
      // name (0)
      textMock.mockResolvedValueOnce(index === 0 ? cancel : "MyNFT");
      // symbol (1)
      if (index >= 1) textMock.mockResolvedValueOnce(index === 1 ? cancel : "MNFT");
      // baseUri (2)
      if (index >= 2) textMock.mockResolvedValueOnce(index === 2 ? cancel : "");

      // ---- confirm prompts (mintable, enumerable, burnable, pausable, royalty) ----
      if (index >= 3)
        confirmMock.mockResolvedValueOnce(
          index === 3 ? cancel : accessBranch ? true : false,
        ); // mintable
      if (index >= 4) confirmMock.mockResolvedValueOnce(index === 4 ? cancel : false); // enumerable
      if (index >= 5) confirmMock.mockResolvedValueOnce(index === 5 ? cancel : false); // burnable
      if (index >= 6) confirmMock.mockResolvedValueOnce(index === 6 ? cancel : false); // pausable
      if (index >= 7)
        confirmMock.mockResolvedValueOnce(
          index === 7 ? cancel : royaltyBranch ? true : false,
        ); // royalty

      // ---- conditional royalty text prompts (bps=8, receiver=9) ----
      if (royaltyBranch) {
        textMock.mockResolvedValueOnce(index === 8 ? cancel : "250"); // bps
        if (index >= 9) textMock.mockResolvedValueOnce(index === 9 ? cancel : ZERO); // receiver
      }

      // ---- conditional access select (10) ----
      if (accessBranch) selectMock.mockResolvedValueOnce(cancel);

      // isCancel returns false for every prior prompt, true for the target.
      for (let i = 0; i < index; i++) isCancelMock.mockReturnValueOnce(false);
      isCancelMock.mockReturnValueOnce(true);

      await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
        code: "E_WIZARD_CANCEL",
        exitCode: 130,
        what: `Wizard cancelled at: ${label}.`,
      });
    },
  );
});
