import { describe, it, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Vitest 4 ESM mock pattern (see tests/prompt.spec.ts). The wizard imports the full
// @clack/prompts surface; mock everything it touches BEFORE importing the SUT.
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

// SUT lands in Plan 02-02. Until then the module does not exist; conditionally
// import so spec collection does not fail during Wave 0. Once Plan 02-02 ships
// the file, the conditional flips and the it.todo placeholders below become
// real tests filled in by Plan 02-02 author.
const SUT_PATH = "../../../src/templates/erc20/wizard.js";
const SUT_FS_PATH = fileURLToPath(new URL("../../../src/templates/erc20/wizard.ts", import.meta.url));
let runErc20Wizard: unknown;
if (existsSync(SUT_FS_PATH)) {
  try {
    const mod = await import(SUT_PATH);
    runErc20Wizard = (mod as { runErc20Wizard?: unknown }).runErc20Wizard;
  } catch {
    runErc20Wizard = undefined;
  }
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("erc20 wizard — prompts and cancel/centralization (D-04, UI-SPEC)", () => {
  it.todo("happy path returns Erc20Opts for no-flags-set");
  it.todo("step 7 fires only when mintable||pausable");
  it.todo("step 7 returns 'ownable' or 'roles' selection");
  it.todo("cancel at each of 7 prompts throws E_WIZARD_CANCEL with the prompt name");
  it.todo("Mintable+Ownable triggers output.warn (centralization)");
  it.todo("newbie mode emits the locked preamble + per-prompt explain lines per UI-SPEC");
});

// Sentinel: keep the conditional import binding referenced so the linter does not
// strip it once Plan 02-02 lands; future commits will replace it.todo with real tests
// that call `await runErc20Wizard({ output: fakeOutput })`.
void runErc20Wizard;
