# Phase 2: ERC-20 Canary Template - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 18 (10 source, 6 spec, 2 fixture; one of these — `package.json` — is build config)
**Analogs found:** 14 / 18 (4 genuinely net-new: snapshot fixtures x2, snapshot-mechanics spec, wizard.ts as the first interactive prompt sequence)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/templates/erc20/index.ts` | template-plugin (factory) | registration / pure | `src/registry/stub.ts` + `src/commands/list-templates.ts` factory shape | role-match (no template-plugin folder yet) |
| `src/templates/erc20/wizard.ts` | template-plugin (interactive) | request-response (TTY) | `src/lib/prompt.ts` (single @clack call + isCancel guard) | partial — first multi-prompt sequence in codebase |
| `src/templates/erc20/generate.ts` | template-plugin (pure transform) | transform (opts -> string) | none — net-new wrapping pattern; closest mental model is `src/lib/version.ts` (thin wrapper around an external resolve) | partial |
| `src/templates/erc20/opts.ts` | template-plugin (type) | N/A (types only) | `src/lib/output.ts` (`MakeOutputOpts` interface), `src/lib/errors.ts` (`CliErrorInit`) | role-match |
| `src/templates/erc20/filename.ts` | utility (pure function) | transform (string -> string) | `src/lib/env.ts` `parseBoolEnv` (small pure predicate / transform) | role-match |
| `src/templates/erc20/validators.ts` | utility (pure predicates) | transform (string -> string \| undefined) | `src/lib/env.ts` `parseBoolEnv` / `resolveNewbie` (predicate-shape) | role-match |
| `src/registry/types.ts` | registry (type) | N/A (types) | self (append-only edit) | exact |
| `src/commands/create.ts` | dispatcher / command | request-response (orchestrator) | self Phase 1 stub + `src/commands/list-templates.ts` (commander `.action()` body pattern) | exact for shape, replace for body |
| `src/cli.ts` | bootstrap (entry) | one-line change | self (line 9 swap) | exact |
| `src/lib/errors.ts` | lib (constants) | N/A (constants append) | self (lines 3-6 pattern) | exact |
| `src/lib/version.ts` | lib (formatter) | transform | self (optional `safeReadVersion("@openzeppelin/wizard")` append per UI-16) | exact |
| `tests/templates/erc20/wizard.spec.ts` | test-spec (unit, mocked) | request-response under mock | `tests/prompt.spec.ts` (the locked `vi.mock("@clack/prompts", ...)` + top-level await import pattern) | exact |
| `tests/templates/erc20/generate.spec.ts` | test-spec (snapshot + per-flag) | transform-snapshot | none for snapshot mechanics; `tests/errors.spec.ts` is closest for "deterministic-output assertion" shape | partial — flag as net-new |
| `tests/templates/erc20/filename.spec.ts` | test-spec (pure-function table) | transform-table | `tests/env.spec.ts` (case-by-case `expect(parseBoolEnv(...)).toBe(...)` style) | role-match |
| `tests/templates/erc20/validators.spec.ts` | test-spec (pure-function table) | transform-table | `tests/env.spec.ts` (same as above) | role-match |
| `tests/fixtures/erc20/bare-default.sol` | test-fixture (golden) | N/A (data) | none — first committed golden in the repo; closest mental model is the Phase 1 locked five-field registry shape ("lock-don't-relitigate") | net-new |
| `tests/fixtures/erc20/all-flags-on.sol` | test-fixture (golden) | N/A (data) | (as above) | net-new |
| `tests/cli.spec.ts` | test-spec (e2e modify) | spawned-process | self (line 106 `it.skip` placeholder; lines 13-28 `runCli` helper + 51-74 invocation pattern) | exact |
| `package.json` | build-config (modify) | N/A (manifest) | self (dependencies block lines 22-27) | exact |

## Pattern Assignments

### `src/templates/erc20/index.ts` (template-plugin, factory)

**Analog A:** `src/registry/stub.ts` — factory that registers a Template into the registry

**Imports + factory pattern** (`src/registry/stub.ts` lines 1-20):
```ts
import { register, get } from "./index.js";
import type { Template } from "./types.js";

const FOUNDATION_SMOKE: Template = {
  id: "foundation-smoke",
  name: "Foundation Smoke Test (stub)",
  chain: "any",
  status: "stub",
  description: "Phase 1 canary entry — exercises registry, list-templates table, and JSON output. Not generatable.",
};

/** Registers the Phase 1 canary template.
 *  Idempotent: safe to call multiple times (no-op if already registered).
 *  This guard lets tests import the module repeatedly.
 */
export function registerStubTemplates(): void {
  if (!get(FOUNDATION_SMOKE.id)) {
    register(FOUNDATION_SMOKE);
  }
}
```

**Copy these properties verbatim:**
- Module path imports with explicit `.js` (NodeNext ESM convention).
- Five-field locked shape on the literal: `id`, `name`, `chain`, `status`, `description` — append `runWizard` and `generate` AFTER per CONTEXT D-03.
- Exported function returns `void`; calls `register(tpl)` which throws on duplicate (the Phase 1 contract enforces canary retirement automatically — you cannot register `erc20` twice).
- Idempotency guard via `get(id)` — keep this so tests can re-import.

**For Phase 2, the literal becomes** (per UI-09):
```ts
const ERC20: Template = {
  id: "erc20",
  name: "ERC-20 Token",
  chain: "evm",
  status: "alpha",
  description: "Fungible token (ERC-20) on EVM chains. Opt-in Mintable/Burnable/Pausable.",
};
```

**Analog B (for the runWizard/generate field shape):** RESEARCH.md §Pattern 2, the `Erc20Template extends Template` interface example at lines 287-305.

---

### `src/templates/erc20/wizard.ts` (template-plugin, interactive)

**Analog:** `src/lib/prompt.ts` — the only existing file in the repo that calls `@clack/prompts` and handles `isCancel`.

**Single-prompt + cancel-guard pattern** (`src/lib/prompt.ts` lines 1-34):
```ts
import { confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_FILE_EXISTS } from "./errors.js";

export interface ConfirmOverwriteOpts {
  /** If true, skip prompt and return true. For --force. */
  force?: boolean;
}

export async function confirmOverwrite(
  path: string,
  opts: ConfirmOverwriteOpts = {},
): Promise<boolean> {
  if (opts.force) return true;
  const answer = await confirm({
    message: `File ${path} exists. Overwrite?`,
    initialValue: false,
  });
  if (isCancel(answer) || answer === false) {
    throw new CliError({
      code: ERR_FILE_EXISTS,
      what: `Refused to overwrite ${path}.`,
      why: "The output path already exists and you chose not to overwrite it.",
      fix: "Re-run with a different --out path, or pass --force to overwrite without prompting.",
    });
  }
  return true;
}
```

**Copy these properties verbatim:**
- Named imports from `@clack/prompts`: `text`, `select`, `confirm`, `isCancel` (extend Phase 1's `confirm + isCancel` import).
- Every `await <prompt>(...)` answer must pass through an `isCancel(answer)` check before being trusted.
- On cancel: throw `CliError` with locked WHAT/WHY/FIX three-part block — UI-SPEC §"E_WIZARD_CANCEL" lines 258-277 lock the copy. Use `ERR_WIZARD_CANCEL` constant (added in `src/lib/errors.ts` per Phase 2).
- `await <prompt>({ message, initialValue / defaultValue, placeholder, validate })` is the only @clack call shape used in the repo. Validators are inline functions returning `string | undefined`.

**Net-new in Phase 2 (no existing analog):**
- Multi-prompt sequential flow with conditional step 7 — first such flow in the repo.
- Newbie `output.explain` / `output.reference` line BEFORE each prompt — see UI-SPEC §"Wizard Prompt Sequence" lines 60-160 for locked copy.
- `cancelGuard<T>(answer, promptName): T` helper that wraps every prompt return (UI-11). Per UI-SPEC Components Inventory, KEEP INLINE in Phase 2; hoist to `src/lib/wizard.ts` in Phase 4 when ERC-721 is the second consumer.

**Centralization warning pattern** — also net-new but copy comes from UI-SPEC §"Post-prompt — Centralization warning" lines 165-180 verbatim. Call site: after prompt 7 resolves (or is skipped), before `runWizard()` returns. Fires in all modes; `output.warn` is always-on per Phase 1 contract.

---

### `src/templates/erc20/generate.ts` (template-plugin, pure transform)

**Analog (closest mental model only):** `src/lib/version.ts` — a thin wrapper around an external resolution call that returns a deterministic string.

**Imports under NodeNext + CJS interop** (RESEARCH §Pattern 1, defensive form):
```ts
// Source: nodejs.org/api/esm.html#commonjs-namespaces ; @openzeppelin/wizard is CJS
import wizard from "@openzeppelin/wizard";
const { erc20 } = wizard;
import type { ERC20Options } from "@openzeppelin/wizard";
```

The planner's Wave 0 spike (RESEARCH §Pattern 1) decides naive-vs-defensive. Default is defensive.

**Pure-transform shape (copy from `src/lib/version.ts` lines 79-86):**
```ts
export function formatVersionLine(): string {
  const ownVer = readOwnVersion();
  const solc = safeReadVersion("solc");
  const oz = safeReadVersion("@openzeppelin/contracts");
  const solcStr = solc ? `solc ${solc}` : "solc not bundled";
  const ozStr = oz ? `@openzeppelin/contracts ${oz}` : "@openzeppelin/contracts not bundled";
  return `smartc ${ownVer} (${solcStr}, ${ozStr})`;
}
```

**Copy these properties:**
- Synchronous, pure, no I/O.
- Returns a single value (Phase 2: `{ filename, source }` per CONTEXT D-04 instead of just `string`).
- No throwing in the happy path; surface failures via `CliError` at the dispatcher level, not here.

**Net-new for generate.ts:** mapping `Erc20Opts` → `ERC20Options` (the third-party type). Per RESEARCH anti-pattern at lines 386-387 of RESEARCH.md, the mapping is one-way; we never expose `ERC20Options` outside this module. Special-case: `premint === "0"` → `undefined` before passing through (RESEARCH Pitfall 5; UI-SPEC Prompt 3 note).

---

### `src/templates/erc20/opts.ts` (type module)

**Analog A:** `src/lib/output.ts` (`MakeOutputOpts` interface, lines 18-24)
**Analog B:** `src/lib/errors.ts` (`CliErrorInit` interface, lines 8-14)

**Interface declaration shape** (`src/lib/output.ts` lines 18-24):
```ts
export interface MakeOutputOpts {
  newbie: boolean;
  json: boolean;
  color: Colors;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}
```

**Copy these properties:**
- `export interface` (not `export type`) for the public-shape contracts. Both analogs use `interface`.
- Required fields first, optional fields (with `?`) last.
- No methods on the interface — this is a data type only.
- Comment with `/** ... */` JSDoc above the interface (see `CliErrorInit` immediate predecessor — line 7 of errors.ts is the constants block; the interface starts after).

**For Phase 2, the shape is roughly** (planner finalizes):
```ts
export interface Erc20Opts {
  name: string;
  symbol: string;
  premint: string;        // human-readable decimal string; "0" maps to undefined at generate time
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
  access: "ownable" | "roles" | false;   // false when neither mintable nor pausable
}
```

---

### `src/templates/erc20/filename.ts` (utility — Solidity-identifier slug)

**Analog:** `src/lib/env.ts` — small pure functions, no I/O.

**Pure-function module shape** (`src/lib/env.ts` lines 1-22):
```ts
/** Returns true for "1", "true", "yes", "on" (case-insensitive). */
export function parseBoolEnv(v: string | undefined | null): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}
```

**Copy these properties:**
- Single concept per file; module-level `export function` only.
- JSDoc above each export.
- Defensive on `undefined` / empty input.
- No throws — return a sensible default or empty string. (For `contractNameToFilename`, an empty/invalid name should already have been caught by `isSolidityIdentifier` at wizard time; if it slips through, return `"Contract.sol"` or similar — planner decides.)

---

### `src/templates/erc20/validators.ts` (utility — @clack validate callbacks)

**Analog:** `src/lib/env.ts` (same as filename.ts) for the pure-function module shape.

**Plus the validator signature from `src/lib/prompt.ts`** — implicit in the `await confirm({ ..., validate? ... })` call. Per RESEARCH §Validators lines 452-492, the @clack contract is: `(v: string | undefined) => string | undefined`. Return `undefined` on valid; return the error message string on invalid.

**Copy these properties from RESEARCH §Validators (locked regexes):**
```ts
const SOLIDITY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function isSolidityIdentifier(v: string | undefined): string | undefined {
  if (!v) return "Contract name is required.";
  if (!SOLIDITY_IDENTIFIER.test(v)) {
    return "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.";
  }
  return undefined;
}

const ASCII_SYMBOL = /^[A-Za-z0-9]{1,11}$/;
const DECIMAL_STRING = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
```

Failure-message copy is **locked by UI-SPEC** at lines 87-118 (per-prompt validator rows). Executor pastes the strings byte-exact.

---

### `src/registry/types.ts` (append-only edit)

**Analog:** self — the file is 13 lines and only needs an additive change.

**Existing locked shape** (`src/registry/types.ts` lines 1-13):
```ts
export type TemplateStatus = "stub" | "alpha" | "stable";
export type TemplateChain = "evm" | "solana" | "any";

/** Locked JSON contract from Phase 1.
 *  Later phases may ADD optional fields. NEVER remove or rename these five.
 */
export interface Template {
  readonly id: string;
  readonly name: string;
  readonly chain: TemplateChain;
  readonly status: TemplateStatus;
  readonly description: string;
}
```

**Phase 2 delta — append-only:** add two optional method fields per CONTEXT D-03/D-04/D-05. The five existing fields stay `readonly` and unchanged. The new fields are optional so the registry still accepts the locked Phase 1 shape (and so `registry.get(id)` continues to return `Template<unknown>` per D-05).

Concrete delta:
```ts
export interface Template<TOpts = unknown> {
  readonly id: string;
  readonly name: string;
  readonly chain: TemplateChain;
  readonly status: TemplateStatus;
  readonly description: string;
  // Phase 2 additions (optional — preserves Phase 1 contract):
  readonly runWizard?: (io: { output: Output }) => Promise<TOpts>;
  readonly generate?: (opts: TOpts) => { filename: string; source: string };
}
```

The locked-comment must be preserved or amended to read "Phase 2 added optional `runWizard` and `generate`. The five required fields are still locked."

**Test guarantee preserved:** `tests/registry.spec.ts` line 58-68 asserts exactly five keys. That test should be modified to allow optional additional keys without failing — or the test is amended to assert the five required keys are present, not that there are no others. Planner decides; the registry-shape test is the canary that catches accidental contract widening.

---

### `src/commands/create.ts` (dispatcher — replace `.action()` body)

**Analog A:** self — the option surface (`--template`, `--out`) and the `commander` boilerplate are locked from Phase 1.

**Existing wrapper** (`src/commands/create.ts` lines 8-23):
```ts
export function createCommandStub(): Command {
  const cmd = new Command("create")
    .description("Launch the interactive wizard to scaffold a new contract")
    .addOption(new Option("--template <id>", "Skip template picker; use this template directly"))
    .addOption(new Option("--out <path>", "Write generated file to this path (default: ./<name>.sol)"));

  cmd.action(() => {
    throw new CliError({
      code: ERR_NOT_IMPLEMENTED,
      what: "The 'create' command is not yet implemented in Phase 1.",
      why: "Phase 1 ships the CLI foundation (help, list-templates, verbosity). Template generation lands in Phase 2 (ERC-20 canary template).",
      fix: "Track progress at .planning/ROADMAP.md. For now, run 'smartc list-templates' to see what is registered.",
    });
  });

  return cmd;
}
```

**Analog B:** `src/commands/list-templates.ts` lines 10-43 — the only existing `.action()` in the repo that reads global opts, builds a color, branches on `--json`, and writes output. Copy:

```ts
cmd.action(function (this: Command) {
  const opts = this.optsWithGlobals() as { json?: boolean; color?: boolean };
  // ... branch on opts.json ...
  const noColor = opts.color === false;
  const color = makeColor(noColor);
  // ... write to stdout ...
});
```

**Copy these properties:**
- `function (this: Command)` (not arrow) so `this.optsWithGlobals()` works.
- `optsWithGlobals()` returns the merged global + local opts.
- `opts.color === false` is the canonical no-color check (commander negates `--no-color`).
- Refuse `--json` early per UI-10 with a `CliError(E_USAGE, exitCode: 2)`.
- Throw `CliError` for all user-visible failures; never `console.error` or `process.exit` from inside `.action()` — let `src/cli.ts` top-level handler render and exit.

**Function name rename:** `createCommandStub()` → `createCommand()` (drop the "Stub" suffix). The export from `src/program.ts` line 5 must update accordingly. The factory pattern (export a function that returns a `Command`) is preserved.

**Full Phase 2 action-body shape:** RESEARCH §Pattern 3 lines 311-358 is the locked pseudocode. Use it verbatim as the skeleton. Key splice point for Phase 3 is line 340 (between `generate()` and overwrite check) — see UI-SPEC §"Coordination Seams" for the obligation to keep that splice exactly one line.

---

### `src/cli.ts` (one-line change)

**Analog:** self.

**Current line 3** (`src/cli.ts`):
```ts
import { registerStubTemplates } from "./registry/stub.js";
```

**Current line 9:**
```ts
registerStubTemplates();
```

**Phase 2 delta:** replace both. The import on line 3 becomes:
```ts
import { registerErc20Template } from "./templates/erc20/index.js";
```

And line 9:
```ts
registerErc20Template();
```

Per CONTEXT D-03 "Canary stub fate": drop the import. The Phase 1 stub registration disappears the moment ERC-20 lands — the canary's "honest intentionality" framing carries through.

**Do not change** the rest of `src/cli.ts`: error handling, `--no-color` detection, `SIGINT` exit-130, three-part error block rendering all stay (and Phase 2's new `E_WIZARD_CANCEL` flows through unchanged because it's a `CliError` subclass usage, not a new code path).

---

### `src/lib/errors.ts` (append constants)

**Analog:** self — lines 3-6 are an append-only block.

**Existing constants** (`src/lib/errors.ts` lines 3-6):
```ts
export const ERR_FILE_EXISTS = "E_FILE_EXISTS" as const;
export const ERR_NOT_IMPLEMENTED = "E_NOT_IMPLEMENTED" as const;
export const ERR_USAGE = "E_USAGE" as const;
export const ERR_UNKNOWN = "E_UNKNOWN" as const;
```

**Copy this property:**
- `as const` narrows the literal type so the string is treated as exact at compile time.
- Constant name is `ERR_<CODE_SUFFIX>`; value is `E_<CODE_SUFFIX>` (the "E_" prefix is the code that surfaces to users in the three-part block; the "ERR_" prefix is the TypeScript-side import name).

**Phase 2 additions (per UI-06):**
```ts
export const ERR_WIZARD_CANCEL = "E_WIZARD_CANCEL" as const;
export const ERR_INVALID_INPUT = "E_INVALID_INPUT" as const;
```

Both are stable codes once shipped — never rename per Phase 1 contract. `ERR_INVALID_INPUT` is reserved (UI-15: not constructed on Phase 2 happy path; reserved for Phase 3+ and future flag-driven mode). Ship the constant in Phase 2 so the seam is honest.

**Optional companion test addition** in `tests/errors.spec.ts` lines 44-49 (the `it("exposes stable error code constants")` block) — add the two new codes there for forward consistency.

---

### `src/lib/version.ts` (optional UI-16 extension)

**Analog:** self.

**Existing function** (`src/lib/version.ts` lines 79-86, shown in the generate.ts section above) reads two deps (`solc`, `@openzeppelin/contracts`) via `safeReadVersion`.

**Phase 2 optional delta** (UI-16 recommendation: ship it):
```ts
const wiz = safeReadVersion("@openzeppelin/wizard");
const wizStr = wiz ? `@openzeppelin/wizard ${wiz}` : "@openzeppelin/wizard not bundled";
return `smartc ${ownVer} (${solcStr}, ${ozStr}, ${wizStr})`;
```

Copy the existing `solcStr`/`ozStr` ternary pattern at line 83-84 verbatim. `safeReadVersion("@openzeppelin/wizard")` will now return a non-null value because Phase 2 installs the package. **Test impact:** `tests/version.spec.ts` lines 27-35 (the regex assertion in `formatVersionLine`) needs widening to allow the third parenthetical segment — planner decides whether to widen Phase 1's exact-match regex or split into two assertions.

---

### `tests/templates/erc20/wizard.spec.ts` (test-spec, mocked @clack)

**Analog:** `tests/prompt.spec.ts` — the canonical locked Vitest 4 ESM mock pattern.

**The locked pattern** (`tests/prompt.spec.ts` lines 1-23):
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CliError } from "../src/lib/errors.js";

// Mock @clack/prompts BEFORE importing the SUT.
vi.mock("@clack/prompts", () => {
  return {
    confirm: vi.fn(),
    isCancel: vi.fn(() => false),
  };
});

// Import AFTER the mock so the SUT picks up the mocked module.
const { confirmOverwrite } = await import("../src/lib/prompt.js");
const clack = await import("@clack/prompts");

const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  confirmMock.mockReset();
  isCancelMock.mockReset();
  isCancelMock.mockReturnValue(false);
});
```

**Copy these properties VERBATIM (this is the locked Phase 1 pattern that every future wizard spec uses):**
- `vi.mock("@clack/prompts", () => { ... })` BEFORE any import of the system-under-test.
- Top-level `await import("../src/templates/erc20/wizard.js")` AFTER the mock block — ESM hoisting means the mock factory runs first, then the import sees the mocked module.
- `clack.text`, `clack.select`, `clack.confirm`, `clack.isCancel` are all `vi.fn()` — extend the mock factory to include `text` and `select` for Phase 2.
- `isCancelMock.mockReturnValue(false)` default — only flip to `true` in the cancel-specific test.

**Per-test method-call assertion pattern** (`tests/prompt.spec.ts` lines 33-39):
```ts
const arg = confirmMock.mock.calls[0]?.[0] as { message: string; initialValue: boolean };
expect(arg.message).toMatch(/^File foo\.sol exists\. Overwrite\?$/);
expect(arg.initialValue).toBe(false);
```

Use this shape to assert the prompt messages match UI-SPEC §"Wizard Prompt Sequence" locked copy (UI-SPEC lines 84-160). Each of seven prompts gets a per-prompt assertion: message, defaultValue/initialValue, and the validator function (sniffed by passing a known-bad value through `arg.validate?.("$$$")` and asserting the error message).

**Cancel-path assertion** (`tests/prompt.spec.ts` lines 65-72):
```ts
confirmMock.mockResolvedValueOnce(Symbol("cancel"));
isCancelMock.mockReturnValueOnce(true);
await expect(confirmOverwrite("baz.sol")).rejects.toMatchObject({
  code: "E_FILE_EXISTS",
});
```

Copy this exact shape. For Phase 2 the assertion becomes `code: "E_WIZARD_CANCEL"` and one test per prompt step covers the seven `{promptName}` interpolations (UI-SPEC §"E_WIZARD_CANCEL" line 270 names them).

---

### `tests/templates/erc20/generate.spec.ts` (test-spec, snapshot + per-flag)

**Analog (closest):** `tests/errors.spec.ts` — the only existing spec that asserts long, deterministic output. Lines 52-69 model the "compose, then assert pieces" approach.

```ts
const out = renderError(err, color);
const lines = out.split("\n");
expect(lines).toHaveLength(3);
expect(lines[0]).toMatch(/^Error:.*\(code: E_FILE_EXISTS\)$/);
expect(lines[0]).toContain("Refused to overwrite foo.sol.");
```

**Copy these properties:**
- Build the input opts inline at the top of the test (no helpers in Phase 2 — first consumer).
- For per-flag assertions: `expect(source).toContain("ERC20Burnable")` when `burnable=true`; `expect(source).toContain("AccessControl")` when `access === "roles"`; etc. Per CONTEXT D-09 — these are axis-by-axis coverage.

**Net-new for Phase 2 — snapshot mechanics.** There is no prior snapshot test in the repo. Per RESEARCH §"Don't Hand-Roll" line 401, use **Vitest 4's `toMatchFileSnapshot()`**:
```ts
const { source } = generate(bareDefaultOpts);
await expect(source).toMatchFileSnapshot("../../fixtures/erc20/bare-default.sol");
```

**Why `toMatchFileSnapshot()` over inline `.snap` (per RESEARCH alternatives table line 99):**
- File is a real `.sol` you can open with syntax highlighting.
- Vitest 4 normalizes CRLF (PR #3164) — the spec is portable across Windows / Linux CI.
- `vitest -u` updates the file in place; the diff in git is the audit trail.

**Mental-model precedent for the locked snapshots themselves:** the Phase 1 locked five-field registry shape (`tests/registry.spec.ts` lines 58-68) — "lock the contract, regenerate only in a deliberate commit." The two snapshot fixtures are the same kind of lock applied to `@openzeppelin/wizard` output.

---

### `tests/templates/erc20/filename.spec.ts` (test-spec, pure-function table)

**Analog:** `tests/env.spec.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseBoolEnv, resolveNewbie } from "../src/lib/env.js";

describe("parseBoolEnv", () => {
  it("returns true for '1'/'true'/'yes'/'on' (any case)", () => {
    expect(parseBoolEnv("1")).toBe(true);
    expect(parseBoolEnv("true")).toBe(true);
    expect(parseBoolEnv("TRUE")).toBe(true);
    expect(parseBoolEnv("yes")).toBe(true);
    expect(parseBoolEnv("on")).toBe(true);
  });

  it("returns false for everything else", () => {
    expect(parseBoolEnv(undefined)).toBe(false);
    expect(parseBoolEnv(null)).toBe(false);
    expect(parseBoolEnv("")).toBe(false);
    expect(parseBoolEnv("0")).toBe(false);
    expect(parseBoolEnv("nope")).toBe(false);
  });
});
```

**Copy these properties:**
- `describe(<function-name>, () => { ... })` per exported function.
- `it("<one-line behaviour>", ...)` grouped by branch.
- Multiple `expect` per `it` is fine when they're the same axis (true cases vs false cases).
- No `beforeEach` — pure functions don't need it.

Apply to: `contractNameToFilename("MyToken")` → `"MyToken.sol"`; `"My Token"` → `"MyToken.sol"`; edge cases (empty input, all-non-identifier chars) per UI-SPEC + RESEARCH discretion.

---

### `tests/templates/erc20/validators.spec.ts` (test-spec, pure-function table)

**Analog:** same as filename.spec.ts above — `tests/env.spec.ts` for the table-driven pure-function shape.

**Locked test-case table from RESEARCH §Validators lines 494-499:**
```text
| Input               | isSolidityIdentifier | isAsciiSymbol | isNonNegativeDecimal |
| ""/undefined        | error                | error         | error                |
| "MyToken"           | undefined            | undefined     | error (not numeric)  |
...
```

Use this exact table as the test cases — one `it` per row, three `expect`s per `it`. Or three `describe` blocks (one per validator) with one `it` per input class — planner's choice.

---

### `tests/fixtures/erc20/bare-default.sol` (test-fixture)
### `tests/fixtures/erc20/all-flags-on.sol` (test-fixture)

**Analog:** none. Genuinely net-new — first committed binary-ish golden in the repo.

**Mental model precedent:** the Phase 1 locked five-field registry shape (`tests/registry.spec.ts` lines 58-67 — "Object.keys equals these five exactly"). The fixtures are the same kind of declared contract: bytes lock to the output of `@openzeppelin/wizard@0.10.8`, and only a deliberate regeneration commit (`vitest -u`) changes them. The diff is the audit trail.

**Inputs (per CONTEXT D-09):**
- `bare-default.sol`: `{ name: "MyToken", symbol: "MTK", premint: "1000000" }`, all flags off, `access === false`.
- `all-flags-on.sol`: `{ name: "MyToken", symbol: "MTK", premint: "1000000", mintable: true, burnable: true, pausable: true, access: "roles" }`.

These two are the **only** snapshot fixtures committed in Phase 2 per CONTEXT D-10. Future phases get two more per template max.

**Initial population:** the first `npm test` after writing `generate.spec.ts` will fail with "snapshot file does not exist"; running `vitest -u` once writes both files. Inspect them by hand, verify the SPDX / pragma / contract name / `_mint` line / inheritance list match wizard.openzeppelin.com for the same inputs, then commit. This is a planning-time action item, not an executor blocker.

---

### `tests/cli.spec.ts` (modify — unskip SC-4)

**Analog:** self — the `runCli` helper and existing test bodies are the pattern.

**The skipped line** (`tests/cli.spec.ts` line 106):
```ts
it.skip("SC-4: overwrite prompt + --force (deferred to Phase 2 when create writes files)", () => {});
```

**Existing helper + invocation pattern** (`tests/cli.spec.ts` lines 13-28, 51-74):
```ts
function runCli(args: string[], env: Record<string, string> = {}): RunResult {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env, NO_COLOR: "1" },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
      status: err.status ?? 1,
    };
  }
}
```

**Copy these properties:**
- `execFileSync` (not `spawn`) for synchronous, line-by-line assertion. Already tested at line 38-49 (`--help`).
- `NO_COLOR: "1"` always set — keeps assertions ANSI-free.
- `beforeAll` runs `npm run build` once (line 31-36) — SC-4 reuses this; do NOT rebuild per test.

**SC-4 Phase 2 fill — the harder bits:**
- `execFileSync` is synchronous and doesn't pipe stdin easily; for a wizard-driven path, use `spawnSync("node", [CLI, "create", "--template", "erc20", "--out", "tmp/X.sol"], { input: "MyToken\nMTK\n1000000\nn\nn\nn\n", encoding: "utf8" })` — feed answers as newline-delimited stdin.
- Per RESEARCH Anti-Pattern line 387 ("Running the wizard outside a TTY without falling back"): the wizard spec may need to drive `generate(opts)` directly with synthesized opts for unit coverage, AND a separate stdin-piped e2e specifically for SC-4. Planner decides whether SC-4 e2e needs the TTY-piping at all — UI-10's `--json` refusal means Phase 2 cannot drive it non-interactively.
- Alternatively, the `--force` half of SC-4 is testable without a wizard: create a fixture `.sol` file, run `smartc create --template erc20 --out <existing> --force` with piped wizard answers, assert overwrite succeeded.

The existing `runCli` helper accepts a single `args` + `env` shape; SC-4 may need a sibling `runCliWithStdin(args, stdinText, env)` helper. Per project style (small inline helpers, see line 9-23 of `tests/commands/list-templates.spec.ts`), define it inline in `cli.spec.ts` next to `runCli`.

---

### `package.json` (modify — add dependency)

**Analog:** self.

**Existing dependencies block** (`package.json` lines 22-27):
```json
"dependencies": {
  "@clack/prompts": "^0.11.0",
  "cli-table3": "^0.6.5",
  "commander": "^14.0.3",
  "picocolors": "^1.1.1"
},
```

**Phase 2 delta** — add one entry, pin EXACT (no caret) per CONTEXT D-07 + RESEARCH §Installation lines 102-107:
```json
"dependencies": {
  "@clack/prompts": "^0.11.0",
  "@openzeppelin/wizard": "0.10.8",
  "cli-table3": "^0.6.5",
  "commander": "^14.0.3",
  "picocolors": "^1.1.1"
},
```

**Copy these properties:**
- Alphabetical sort within the block (npm preserves what you write but the existing file is alphabetical).
- Caret `^` for everything except `@openzeppelin/wizard` — that one is exact-pinned because its output is the locked snapshot artifact (D-09).
- Run `npm install @openzeppelin/wizard@0.10.8 --save-exact` to populate `package-lock.json` correctly.

---

## Shared Patterns

### Pattern: NodeNext ESM module paths (`.js` import suffix)

**Source:** every file in `src/` — e.g., `src/cli.ts` lines 2-6, `src/commands/list-templates.ts` lines 1-4.

**Apply to:** every new file in `src/templates/erc20/`.

```ts
import { register, get } from "./index.js";
import type { Template } from "./types.js";
import { CliError, ERR_FILE_EXISTS } from "./errors.js";
```

Even though TypeScript source is `.ts`, the import specifier is `.js` (NodeNext + verbatimModuleSyntax). Test specs import `../src/lib/foo.js`. Never use `.ts` extensions.

---

### Pattern: Three-part `CliError` block

**Source:** `src/lib/errors.ts` lines 8-31; example construction at `src/lib/prompt.ts` lines 26-32.

**Apply to:** every user-visible failure thrown from `src/templates/erc20/wizard.ts` (E_WIZARD_CANCEL) and `src/commands/create.ts` (E_USAGE for `--json` refusal).

```ts
throw new CliError({
  code: ERR_WIZARD_CANCEL,
  what: `Wizard cancelled at: ${promptName}.`,
  why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
  fix: "Re-run 'smartc create --template erc20' to start over.",
  exitCode: 130,    // SIGINT convention
});
```

**Copy text comes from UI-SPEC §"Three-Part Error Block Copy" lines 246-320** — byte-exact, no paraphrasing. The `exitCode` default is 1; explicitly set to 130 for cancel, 2 for E_USAGE.

---

### Pattern: `optsWithGlobals()` for merged commander opts

**Source:** `src/commands/list-templates.ts` line 11; `src/cli.ts` lines 32-35.

**Apply to:** `src/commands/create.ts` `.action()` body.

```ts
cmd.action(async function (this: Command) {
  const opts = this.optsWithGlobals() as {
    template?: string;
    out?: string;
    newbie?: boolean;
    json?: boolean;
    force?: boolean;
    color?: boolean;
  };
  const noColor = opts.color === false;     // canonical no-color check
  const newbie = resolveNewbie({ newbieFlag: opts.newbie });
  const color = makeColor(noColor);
  const output = makeOutput({ newbie, json: Boolean(opts.json), color });
  // ...
});
```

`function (this: Command)` (not arrow) so `this` is bound. Type assertion on opts is unavoidable — commander returns `unknown`.

---

### Pattern: `vi.mock("@clack/prompts", ...)` + top-level `await import(SUT)`

**Source:** `tests/prompt.spec.ts` lines 1-23 (the canonical locked pattern).

**Apply to:** `tests/templates/erc20/wizard.spec.ts`. Verbatim block; extend the factory to mock `text` and `select` in addition to `confirm`:

```ts
vi.mock("@clack/prompts", () => {
  return {
    text: vi.fn(),
    select: vi.fn(),
    confirm: vi.fn(),
    isCancel: vi.fn(() => false),
  };
});

const { runWizard } = await import("../../src/templates/erc20/wizard.js");
const clack = await import("@clack/prompts");
```

This is Phase 1's locked-and-restated Vitest 4 ESM mock contract. Every future wizard spec (ERC-721, ERC-1155, SPL) copies it.

---

### Pattern: Idempotent registration

**Source:** `src/registry/stub.ts` lines 16-20.

**Apply to:** `src/templates/erc20/index.ts` `registerErc20Template()`.

```ts
export function registerErc20Template(): void {
  if (!get("erc20")) {
    register(tpl);
  }
}
```

Required so tests can re-import the module without throwing on duplicate-id. `registry.register()` throws on duplicate (Phase 1 contract); the guard makes the factory idempotent.

---

### Pattern: Test isolation via `clear()` in beforeEach

**Source:** `tests/registry.spec.ts` lines 31-33, `tests/commands/list-templates.spec.ts` lines 26-33.

**Apply to:** any new spec that calls `registerErc20Template()`.

```ts
import { clear } from "../../src/registry/index.js";
import { registerErc20Template } from "../../src/templates/erc20/index.js";

beforeEach(() => {
  clear();
  registerErc20Template();
});

afterEach(() => {
  clear();
});
```

`registry.clear()` is "for test isolation ONLY" per its JSDoc (line 24 of `src/registry/index.ts`) — production code never calls it.

---

### Pattern: `output.warn` is the always-on critical channel

**Source:** `src/lib/output.ts` lines 49-51 (the `warn` channel is unconditional, no newbie/json gating); `tests/output.spec.ts` lines 53-64 and 180-193 lock this behavior.

**Apply to:** centralization warning in `src/templates/erc20/wizard.ts` (UI-02).

```ts
if (opts.mintable && opts.access === "ownable") {
  output.warn(
    "Mintable + Ownable: a single key can mint unlimited tokens. " +
    "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy."
  );
}
```

Fires in default, newbie, AND `--json` modes — `output.warn` does not check those flags. Copy verbatim from UI-SPEC §"Post-prompt — Centralization warning" lines 168-180.

---

## No Analog Found

Files with no close match in the codebase. Planner should refer to RESEARCH.md and UI-SPEC for the contract, and treat these as the first-of-kind that future phases will analog-copy from.

| File | Role | Data Flow | Reason | Closest Mental Model |
|------|------|-----------|--------|----------------------|
| `src/templates/erc20/wizard.ts` (multi-prompt flow) | template-plugin interactive | request-response (TTY) | Phase 1's `src/lib/prompt.ts` is single-prompt only; no precedent for a 7-prompt sequence with conditional steps | RESEARCH §Wizard Order table (lines 408-422) is the locked sequence |
| `src/templates/erc20/generate.ts` (CJS interop) | wrapper around external CJS package | transform | No prior CJS-from-NodeNext-ESM consumer in the codebase | RESEARCH §Pattern 1 lines 249-270 (defensive default-import-then-destructure) |
| `tests/templates/erc20/generate.spec.ts` (snapshot mechanics) | test-spec | snapshot | No prior `toMatchFileSnapshot` use in the repo | RESEARCH alternatives table line 99 + `tests/errors.spec.ts` "compose-then-assert-pieces" shape |
| `tests/fixtures/erc20/*.sol` | test-fixture (golden) | data | First committed binary-ish golden in repo | Phase 1's locked five-field registry-shape test (`tests/registry.spec.ts` lines 58-68) as the "lock contract; regenerate only on deliberate commit" precedent |

## Metadata

**Analog search scope:** `src/**/*.ts`, `tests/**/*.ts`, `package.json`
**Files scanned:** 22 source + spec files (10 in `src/`, 9 in `tests/`, 3 supporting)
**Pattern extraction date:** 2026-05-20

*Phase: 02-erc-20-canary-template*
