import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  erc20ConstructorArgs,
  erc721ConstructorArgs,
  erc1155ConstructorArgs,
} from "../../src/deploy/constructorArgs.js";
import type { ConstructorArg, DeployFlags } from "../../src/deploy/types.js";

// Fixture-lock test (05-RESEARCH §Constructor-Arg Matrix, the #1 footgun guard):
// parse each committed .sol's constructor(...) parameter NAMES in declaration
// order, build the matching DeployFlags, and assert the builder produces the
// same name list. Parsing lives ONLY here in the test — never in production.

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "../fixtures");

/** Parse the constructor(...) parameter NAMES from a .sol source, in order.
 *  Returns [] for a no-arg constructor(). */
function parseCtorArgNames(sol: string): string[] {
  const m = sol.match(/constructor\s*\(([^)]*)\)/);
  if (!m) throw new Error("no constructor found in fixture");
  const inside = m[1].trim();
  if (inside === "") return [];
  return inside.split(",").map((param) => {
    const tokens = param.trim().split(/\s+/);
    return tokens[tokens.length - 1]; // last token is the param name
  });
}

function readFixture(rel: string): string {
  return readFileSync(join(fixturesRoot, rel), "utf8");
}

interface Case {
  fixture: string;
  builder: (flags: DeployFlags) => ConstructorArg[];
  flags: DeployFlags;
  expectedNames: string[];
}

const cases: Case[] = [
  {
    fixture: "erc20/bare-default.sol",
    builder: erc20ConstructorArgs,
    flags: {
      premintNonZero: true,
      access: "none",
      mintable: false,
      burnable: false,
      pausable: false,
    },
    expectedNames: ["recipient"],
  },
  {
    fixture: "erc20/all-flags-on.sol",
    builder: erc20ConstructorArgs,
    flags: {
      premintNonZero: true,
      access: "roles",
      mintable: true,
      burnable: true,
      pausable: true,
    },
    expectedNames: ["recipient", "defaultAdmin", "pauser", "minter"],
  },
  {
    fixture: "erc721/bare-default.sol",
    builder: erc721ConstructorArgs,
    flags: { access: "none", mintable: false, burnable: false, pausable: false },
    expectedNames: [],
  },
  {
    fixture: "erc721/all-flags-on.sol",
    builder: erc721ConstructorArgs,
    flags: {
      access: "roles",
      mintable: true,
      burnable: true,
      pausable: true,
      enumerable: true,
    },
    expectedNames: ["defaultAdmin", "pauser", "minter"],
  },
  {
    fixture: "erc721/all-flags-on-with-royalty.sol",
    builder: erc721ConstructorArgs,
    flags: {
      access: "roles",
      mintable: true,
      burnable: true,
      pausable: true,
      enumerable: true,
      royalty: true,
    },
    expectedNames: ["defaultAdmin", "pauser", "minter"], // royalty adds NO ctor arg
  },
  {
    fixture: "erc1155/bare-default.sol",
    builder: erc1155ConstructorArgs,
    flags: {
      access: "none",
      mintable: false,
      burnable: false,
      pausable: false,
      updatableUri: true,
    },
    expectedNames: ["initialOwner"], // updatableUri forces Ownable
  },
  {
    fixture: "erc1155/all-flags-on.sol",
    builder: erc1155ConstructorArgs,
    flags: {
      access: "roles",
      mintable: true,
      burnable: true,
      pausable: true,
      supply: true,
      updatableUri: true,
    },
    expectedNames: ["defaultAdmin", "pauser", "minter"],
  },
];

describe("constructor-arg builders — fixture lock", () => {
  for (const c of cases) {
    it(`${c.fixture} → [${c.expectedNames.join(", ")}]`, () => {
      const parsed = parseCtorArgNames(readFixture(c.fixture));
      // Sanity: the fixture really has the signature we expect.
      expect(parsed).toEqual(c.expectedNames);
      // Lock: the builder reproduces it exactly.
      const built = c.builder(c.flags).map((a) => a.name);
      expect(built).toEqual(parsed);
    });
  }

  it("every ConstructorArg is an address placeholder (no real key) — T-05-01", () => {
    const all = [
      ...erc20ConstructorArgs(cases[1].flags),
      ...erc721ConstructorArgs(cases[3].flags),
      ...erc1155ConstructorArgs(cases[6].flags),
    ];
    for (const a of all) {
      expect(a.type).toBe("address");
      expect(a.exampleValue).toBe("<YOUR_WALLET_ADDRESS>");
      expect(a.exampleValue).not.toMatch(/0x[0-9a-fA-F]{40}/);
    }
  });

  it("erc20 zero-arg edge: premint=0 + access=none + no flags → []", () => {
    const built = erc20ConstructorArgs({
      premintNonZero: false,
      access: "none",
      mintable: false,
      burnable: false,
      pausable: false,
    });
    expect(built).toEqual([]);
  });

  it("source file contains no 0x-prefixed hex literal", () => {
    const src = readFileSync(
      join(__dirname, "../../src/deploy/constructorArgs.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });
});
