import { describe, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// SUT lands in Plan 02-03. Until then the module does not exist; conditionally
// import so spec collection does not fail during Wave 0.
const SUT_PATH = "../../../src/templates/erc20/generate.js";
const SUT_FS_PATH = fileURLToPath(new URL("../../../src/templates/erc20/generate.ts", import.meta.url));
let generate: unknown;
if (existsSync(SUT_FS_PATH)) {
  try {
    const mod = await import(SUT_PATH);
    generate = (mod as { generate?: unknown }).generate;
  } catch {
    generate = undefined;
  }
}

// Golden snapshots will live under `tests/templates/erc20/__snapshots__/`
// and are loaded via Vitest 4's `toMatchFileSnapshot(path)` API
// (see PATTERNS.md §generate.spec section).
describe("erc20 generate — golden snapshots (D-09)", () => {
  it.todo("bare default matches committed snapshot");
  it.todo("all-flags-on matches committed snapshot");
});

describe("erc20 generate — per-flag assertions (D-09)", () => {
  it.todo("burnable=true includes ERC20Burnable");
  it.todo("mintable=true + access=ownable includes Ownable + onlyOwner");
  it.todo("mintable=true + access=roles includes AccessControl + MINTER_ROLE");
  it.todo("pausable=true + access=roles includes ERC20Pausable + PAUSER_ROLE");
  it.todo("premint > 0 emits _mint(recipient, N * 10 ** decimals())");
  it.todo("emits SPDX-MIT and OZ-Contracts-5.x compatibility comment");
});

void generate;
