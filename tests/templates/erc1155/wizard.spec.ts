import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Output } from "../../../src/lib/output.js";

// Vitest 4 ESM mock pattern. Mock @clack/prompts BEFORE importing the SUT so
// the SUT picks up the mocked module.
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

const { runWizard } = await import("../../../src/templates/erc1155/wizard.js");
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

const DEFAULT_URI = "https://example.com/api/token/{id}.json";
const UPDATABLE_URI_WARN =
  "ERC-1155 default-URI setter is owner-controlled";

beforeEach(() => {
  textMock.mockReset();
  selectMock.mockReset();
  confirmMock.mockReset();
  isCancelMock.mockReset();
  isCancelMock.mockReturnValue(false);
});

describe("erc1155 wizard — happy paths", () => {
  it("happy path A — no flags — returns bare Erc1155Opts, skips access prompt, fires only the always-on updatableUri warning", async () => {
    textMock.mockResolvedValueOnce("MyMulti"); // name
    textMock.mockResolvedValueOnce(DEFAULT_URI); // uri
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // supply
    confirmMock.mockResolvedValueOnce(false); // pausable

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts).toEqual({
      name: "MyMulti",
      uri: DEFAULT_URI,
      mintable: false,
      burnable: false,
      supply: false,
      pausable: false,
      access: false,
    });
    expect(selectMock).not.toHaveBeenCalled();
    // Only the always-on updatableUri warning fires.
    expect(out.warn as Mock).toHaveBeenCalledTimes(1);
    expect((out.warn as Mock).mock.calls[0]?.[0]).toContain(UPDATABLE_URI_WARN);
  });

  it("happy path B — mintable + ownable — fires TWO warnings (Mintable+Ownable + always-on updatableUri)", async () => {
    textMock.mockResolvedValueOnce("MyMulti");
    textMock.mockResolvedValueOnce(DEFAULT_URI);
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // supply
    confirmMock.mockResolvedValueOnce(false); // pausable
    selectMock.mockResolvedValueOnce("ownable");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts.mintable).toBe(true);
    expect(opts.access).toBe("ownable");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(out.warn as Mock).toHaveBeenCalledTimes(2);
    const warnCalls = (out.warn as Mock).mock.calls.map((c) => c[0] as string);
    expect(
      warnCalls.some((m) =>
        m.includes(
          "Mintable + Ownable: a single key can mint unlimited quantities of any token id.",
        ),
      ),
    ).toBe(true);
    expect(warnCalls.some((m) => m.includes(UPDATABLE_URI_WARN))).toBe(true);
  });

  it("happy path C — all flags + roles — fires ONLY the always-on updatableUri warning (no Ownable triggers)", async () => {
    textMock.mockResolvedValueOnce("MyMulti");
    textMock.mockResolvedValueOnce(DEFAULT_URI);
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(true); // burnable
    confirmMock.mockResolvedValueOnce(true); // supply
    confirmMock.mockResolvedValueOnce(true); // pausable
    selectMock.mockResolvedValueOnce("roles");

    const out = makeMockOutput();
    const opts = await runWizard({ output: out });

    expect(opts).toEqual({
      name: "MyMulti",
      uri: DEFAULT_URI,
      mintable: true,
      burnable: true,
      supply: true,
      pausable: true,
      access: "roles",
    });
    expect(out.warn as Mock).toHaveBeenCalledTimes(1);
    expect((out.warn as Mock).mock.calls[0]?.[0]).toContain(UPDATABLE_URI_WARN);
  });

  it("pausable + ownable fires the Pausable+Ownable warning plus the always-on updatableUri warning", async () => {
    textMock.mockResolvedValueOnce("MyMulti");
    textMock.mockResolvedValueOnce(DEFAULT_URI);
    confirmMock.mockResolvedValueOnce(false); // mintable
    confirmMock.mockResolvedValueOnce(false); // burnable
    confirmMock.mockResolvedValueOnce(false); // supply
    confirmMock.mockResolvedValueOnce(true); // pausable
    selectMock.mockResolvedValueOnce("ownable");

    const out = makeMockOutput();
    await runWizard({ output: out });

    expect(out.warn as Mock).toHaveBeenCalledTimes(2);
    const warnCalls = (out.warn as Mock).mock.calls.map((c) => c[0] as string);
    expect(
      warnCalls.some((m) =>
        m.includes(
          "Pausable + Ownable: a single key can halt all transfers across every token id.",
        ),
      ),
    ).toBe(true);
  });
});

describe("erc1155 wizard — prompt wiring", () => {
  it("newbie preamble fires before prompt 1 (explain + 2 references with locked URLs)", async () => {
    textMock.mockResolvedValueOnce("MyMulti");
    textMock.mockResolvedValueOnce(DEFAULT_URI);
    confirmMock.mockResolvedValue(false);

    const out = makeMockOutput();
    await runWizard({ output: out });

    expect((out.explain as Mock).mock.calls[0]?.[0]).toBe(
      "ERC-1155 is the multi-token standard — one contract holds multiple token IDs (fungible OR non-fungible).",
    );
    expect(out.reference as Mock).toHaveBeenCalledWith(
      "EIP-1155",
      "https://eips.ethereum.org/EIPS/eip-1155",
    );
    expect(out.reference as Mock).toHaveBeenCalledWith(
      "OpenZeppelin ERC1155 docs",
      "https://docs.openzeppelin.com/contracts/5.x/erc1155",
    );
  });

  it("prompt 1 (name) and prompt 2 (uri) wire message/default/validator correctly", async () => {
    textMock.mockResolvedValueOnce("MyMulti");
    textMock.mockResolvedValueOnce(DEFAULT_URI);
    confirmMock.mockResolvedValue(false);

    await runWizard({ output: makeMockOutput() });

    const nameArg = textMock.mock.calls[0]?.[0] as {
      message: string;
      defaultValue: string;
      validate: (v: string | undefined) => string | undefined;
    };
    expect(nameArg.message).toBe("Contract name (Solidity identifier)");
    expect(nameArg.defaultValue).toBe("MyMulti");
    expect(nameArg.validate("3Bad")).toBe(
      "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.",
    );

    const uriArg = textMock.mock.calls[1]?.[0] as {
      defaultValue: string;
      validate: (v: string | undefined) => string | undefined;
    };
    expect(uriArg.defaultValue).toBe(DEFAULT_URI);
    expect(uriArg.validate("")).toBe(
      "URI template is required (e.g. https://example.com/api/token/{id}.json).",
    );
    expect(uriArg.validate(DEFAULT_URI)).toBeUndefined();
  });

  it("access prompt is configured with the locked ownable/roles options when mintable", async () => {
    textMock.mockResolvedValueOnce("MyMulti");
    textMock.mockResolvedValueOnce(DEFAULT_URI);
    confirmMock.mockResolvedValueOnce(true); // mintable
    confirmMock.mockResolvedValueOnce(false);
    confirmMock.mockResolvedValueOnce(false);
    confirmMock.mockResolvedValueOnce(false);
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

describe("erc1155 wizard — cancel at each prompt throws E_WIZARD_CANCEL exit 130", () => {
  // promptName labels in declaration order. The access prompt only fires when
  // mintable is true, so its priming sets mintable=true.
  const cases: Array<{
    index: number;
    promptName: string;
    prime: () => void;
  }> = [
    {
      index: 0,
      promptName: "contract name",
      prime: () => {
        textMock.mockResolvedValueOnce(Symbol("cancel"));
        isCancelMock.mockReturnValueOnce(true);
      },
    },
    {
      index: 1,
      promptName: "uri",
      prime: () => {
        textMock.mockResolvedValueOnce("MyMulti");
        textMock.mockResolvedValueOnce(Symbol("cancel"));
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(true);
      },
    },
    {
      index: 2,
      promptName: "mintable",
      prime: () => {
        textMock.mockResolvedValueOnce("MyMulti");
        textMock.mockResolvedValueOnce(DEFAULT_URI);
        confirmMock.mockResolvedValueOnce(Symbol("cancel"));
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(true);
      },
    },
    {
      index: 3,
      promptName: "burnable",
      prime: () => {
        textMock.mockResolvedValueOnce("MyMulti");
        textMock.mockResolvedValueOnce(DEFAULT_URI);
        confirmMock.mockResolvedValueOnce(false); // mintable
        confirmMock.mockResolvedValueOnce(Symbol("cancel"));
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(true);
      },
    },
    {
      index: 4,
      promptName: "supply",
      prime: () => {
        textMock.mockResolvedValueOnce("MyMulti");
        textMock.mockResolvedValueOnce(DEFAULT_URI);
        confirmMock.mockResolvedValueOnce(false); // mintable
        confirmMock.mockResolvedValueOnce(false); // burnable
        confirmMock.mockResolvedValueOnce(Symbol("cancel"));
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(true);
      },
    },
    {
      index: 5,
      promptName: "pausable",
      prime: () => {
        textMock.mockResolvedValueOnce("MyMulti");
        textMock.mockResolvedValueOnce(DEFAULT_URI);
        confirmMock.mockResolvedValueOnce(false); // mintable
        confirmMock.mockResolvedValueOnce(false); // burnable
        confirmMock.mockResolvedValueOnce(false); // supply
        confirmMock.mockResolvedValueOnce(Symbol("cancel"));
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(true);
      },
    },
    {
      index: 6,
      promptName: "access control",
      prime: () => {
        textMock.mockResolvedValueOnce("MyMulti");
        textMock.mockResolvedValueOnce(DEFAULT_URI);
        confirmMock.mockResolvedValueOnce(true); // mintable → access prompt fires
        confirmMock.mockResolvedValueOnce(false); // burnable
        confirmMock.mockResolvedValueOnce(false); // supply
        confirmMock.mockResolvedValueOnce(false); // pausable
        selectMock.mockResolvedValueOnce(Symbol("cancel"));
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(false);
        isCancelMock.mockReturnValueOnce(true);
      },
    },
  ];

  it.each(cases)(
    "cancel at prompt index $index ($promptName) throws E_WIZARD_CANCEL",
    async ({ promptName, prime }) => {
      prime();
      await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
        code: "E_WIZARD_CANCEL",
        exitCode: 130,
        what: `Wizard cancelled at: ${promptName}.`,
      });
    },
  );
});
