# Phase 3: Compile-Verify Safety Net - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 14 (8 new, 6 modified)
**Analogs found:** 14 / 14 (one with partial match; rest exact)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/compiler/index.ts` (NEW) | service (compile gate) | request-response (sync transform of source → diagnostics) | `src/templates/erc20/generate.ts` | role-match (both are pure-function modules behind a registry-like seam) |
| `src/compiler/imports.ts` (NEW) | utility (resolver factory) | request-response (path → contents) | `src/lib/version.ts` (`safeReadVersion` dual-strategy) | exact (same `createRequire` + `require.resolve("<pkg>/package.json")` pattern) |
| `src/compiler/types.ts` (NEW) | model (type-only) | n/a | `src/registry/types.ts` | exact (pure type module with locked interface contract) |
| `src/compiler/README.md` (NEW, optional) | doc | n/a | (no existing per-module README) | none — author from scratch |
| `src/commands/create.ts` (MODIFY @ line 95) | controller (dispatcher) | request-response | self — `src/commands/create.ts` (existing splice marker) | exact (in-place splice; pre-marked by Phase 2) |
| `src/lib/errors.ts` (MODIFY — add `ERR_COMPILE_FAILED`) | model (error codes) | n/a | self — existing `ERR_*` constant pattern | exact (one-line additive constant) |
| `tests/compiler/compile.spec.ts` (NEW) | test (unit, mocked) | request-response | `tests/templates/erc20/wizard.spec.ts` | exact (`vi.mock` + top-level `await import` pattern) |
| `tests/compiler/compile.integration.spec.ts` (NEW) | test (integration, real pkg) | request-response | `tests/templates/erc20/generate.spec.ts` | exact (real package, golden fixture, no mocks) |
| `tests/commands/create.compile.spec.ts` (NEW) | test (e2e in-process) | request-response | `tests/commands/create.spec.ts` | exact (parseAsync + dynamic import + registry clear/register) |
| `tests/commands/create.compile-fail.spec.ts` (NEW, D-15 load-bearing) | test (e2e failure path) | request-response | `tests/commands/create.spec.ts` (wizard cancel + overwrite refused cases) | exact (rejects.toMatchObject + existsSync(outPath) === false) |
| `tests/fixtures/broken.sol` (NEW, D-14) | test fixture (static) | n/a | `tests/fixtures/erc20/bare-default.sol` | role-match (deliberate-fail counterpart to golden fixtures) |
| `tests/fixtures/warns-no-error.sol` (NEW, Pitfall 6) | test fixture (static) | n/a | `tests/fixtures/erc20/bare-default.sol` | role-match (deliberate-warn counterpart) |
| `scripts/probe-compile.mjs` (NEW, Wave 0) | utility (throwaway probe) | request-response | (no existing scripts/ dir — author per RESEARCH §Wave 0 Probe) | partial (greenfield; full source already in RESEARCH lines 562-624) |
| `package.json` (MODIFY — add deps) | config | n/a | self — existing `dependencies` block | exact (one-line additive deps) |
| `tests/version.spec.ts` (MODIFY) | test | n/a | self — existing assertions | exact (flip "not bundled" → real-version asserts) |

## Pattern Assignments

### `src/compiler/index.ts` (service, request-response) — NEW

**Analog:** `src/templates/erc20/generate.ts` (module shape: thin wrapper around an upstream library; pure transform with documented contract)

**Imports pattern** (modeled on `src/lib/version.ts:1-6` + `src/commands/create.ts:1-10`):
```typescript
import { createRequire } from "node:module";
import { CliError, ERR_COMPILE_FAILED, ERR_NOT_IMPLEMENTED } from "../lib/errors.js";
import { safeReadVersion } from "../lib/version.js";
import { makeImportCallback } from "./imports.js";
import type { CompileDiagnostic, StandardJsonInput, SolcOutput } from "./types.js";

const require = createRequire(import.meta.url);
```
Source: pattern from `src/lib/version.ts:1-6` (the `createRequire(import.meta.url)` ESM→CJS bridge) + `src/templates/erc20/generate.ts:15-17` (named-import-from-upstream + types-from-sibling).

**Core CRUD/transform pattern** (modeled on `src/templates/erc20/generate.ts:35-49` — pure synchronous transform with documented "no throws on the happy path"):
The Phase 3 module is async (compile is potentially long) but the same shape: validate inputs, call upstream library, normalize output, return result. See RESEARCH lines 653-706 for the full body — feed source → buildInput → solc.compile → partition diagnostics → throw CliError on errors / return warnings on success.

**Error handling pattern** (modeled on `src/commands/create.ts:39-47` and `:71-77`):
```typescript
// Solana branch — throw CliError(ERR_NOT_IMPLEMENTED) with WHAT/WHY/FIX block,
// mirroring create.ts:39-47 (--json refusal) and :52-59 (--template missing).
if (chain === "solana") {
  throw new CliError({
    code: ERR_NOT_IMPLEMENTED,
    what: "Solana compile-verify is not implemented yet.",
    why: "SPL templates ship in Phase 7, which adds an anchor-build adapter behind this same compileVerify interface.",
    fix: "Generate an EVM template (`smartc create --template erc20`) until Phase 7 lands.",
    exitCode: 1,
  });
}
```

**Multi-line WHY error pattern** (NEW idiom for Phase 3 — D-08; no existing analog uses multi-line WHY yet, but `renderError` at `src/lib/errors.ts:43-49` already supports `\n` in the why string):
```typescript
// D-08 — WHY is multi-line: each solc formattedMessage block separated by \n\n,
// then a final tail line stating "Compile errors come from solc X against @oz/contracts Y".
throw new CliError({
  code: ERR_COMPILE_FAILED,
  what: "Generated source failed to compile.",
  why: `${errors.map(e => e.formattedMessage).join("\n\n")}\n\nCompile errors come from solc ${solcVer} against @openzeppelin/contracts ${ozVer}.`,
  fix: "If you didn't edit the wizard output, please report this — the template + pinned solc+OpenZeppelin should always produce compilable source.",
  exitCode: 1,
});
```
Source: RESEARCH lines 694-704. Verify that `renderError` (errors.ts:43-49) emits the WHY string verbatim — it does (concatenates `${color.yellow("Why:  ")} ${err.why}`); multi-line WHY surfaces correctly.

---

### `src/compiler/imports.ts` (utility, request-response) — NEW

**Analog:** `src/lib/version.ts:18-50` (`safeReadVersion` dual-strategy — exact match for the bundled-package-resolution pattern Phase 3 needs).

**Imports + createRequire pattern** (lines 1-6 of `src/lib/version.ts`, copy verbatim):
```typescript
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
```

**Core resolver pattern — Strategy 1: subpath package.json** (lines 19-26 of `src/lib/version.ts`, adapt to return root directory instead of version string):
```typescript
// Phase 1's Strategy 1 — works for packages w/o exports-restriction on ./package.json.
// @openzeppelin/contracts qualifies (no exports map restriction).
try {
  const pkgJsonPath = require.resolve(`@openzeppelin/contracts/package.json`);
  ozRoot = dirname(pkgJsonPath);
  return ozRoot;
} catch {
  /* fall through to Strategy 2 */
}
```

**Strategy 2 walk-up fallback** (lines 28-48 of `src/lib/version.ts`):
For Phase 3 the OZ Contracts package has no `exports` restriction so Strategy 1 should always work — but the RESEARCH §Pitfall 3 explicitly recommends keeping Strategy 2 as a safety net. Copy the walk-up loop pattern (`for (let i = 0; i < 10; i++)`, `join(dir, "package.json")`, `dirname(dir)`) from version.ts:31-44.

**Per-call cache + sync return shape** (NEW pattern — driven by RESEARCH Pitfall 1 + CONTEXT D-05):
```typescript
// Per-CALL cache lives inside the closure returned by makeImportCallback().
// New compile → new makeImportCallback() call → new cache. CONTEXT D-05.
export function makeImportCallback() {
  let ozRoot: string | null = null;
  const cache = new Map<string, { contents: string }>();
  // SYNCHRONOUS return — RESEARCH Pitfall 1: async breaks silently.
  return function importCallback(path: string): { contents: string } | { error: string } {
    const hit = cache.get(path);
    if (hit) return hit;
    // ... pattern-match @openzeppelin/contracts/ prefix; readFileSync; cache; return
  };
}
```

**Path-traversal guard** (NEW idiom per RESEARCH §Security Domain — one-line defense-in-depth):
```typescript
// Defense-in-depth: validate resolved path stays within ozRoot after normalization.
// Phase 4/7/8 inherit this for free.
const sub = path.replace(/^@openzeppelin\/contracts\//, "");
const fullPath = path.normalize(join(ozRoot, sub));
if (!fullPath.startsWith(path.normalize(ozRoot))) {
  return { error: `Path traversal blocked: ${path}` };
}
```

---

### `src/compiler/types.ts` (model, type-only) — NEW

**Analog:** `src/registry/types.ts` (exact — pure type module with locked interface contract, documentary comments on field stability)

**Type module pattern** (entire file `src/registry/types.ts:1-20` — copy structure exactly):
```typescript
// Header comment naming the contract + locked-fields rules.
// Then small `type` aliases for closed unions.
// Then a documented `interface` with `readonly` fields.

export type Severity = "error" | "warning";

export interface CompileDiagnostic {
  readonly severity: Severity;
  readonly message: string;
  readonly formattedMessage: string;
  readonly line?: number;
  readonly column?: number;
  readonly file?: string;
}

export interface StandardJsonInput {
  readonly language: "Solidity";
  readonly sources: Record<string, { content: string }>;
  readonly settings: {
    readonly outputSelection: Record<string, Record<string, string[]>>;
    readonly evmVersion?: string;
    readonly optimizer?: { enabled: boolean; runs: number };
  };
}

export interface SolcOutput {
  readonly errors?: Array<{
    severity: "error" | "warning" | "info";
    type: string;
    message: string;
    formattedMessage?: string;
    sourceLocation?: { file: string; start: number; end: number };
    component?: string;
    errorCode?: string;
  }>;
}
```
Source: shape from RESEARCH lines 337-349 + 246-254. Header-comment style from `src/registry/types.ts:1-9`. Standardized across Phase 7 (anchor adapter must produce same `CompileDiagnostic` shape — CONTEXT discretion).

---

### `src/commands/create.ts` (controller, dispatcher) — MODIFY @ line 95

**Analog:** self — Phase 2 dispatcher with pre-marked splice point.

**Splice insertion** (replace marker comment at `src/commands/create.ts:95`):
```typescript
// At line 95, REPLACING the marker:
const { warnings } = await compileVerify(source, tpl.chain);
for (const w of warnings) {
  output.warn(w.formattedMessage);
}
if (warnings.length > 0 && newbie) {
  output.explain("Warnings don't block deployment but often point at latent bugs. Review each before shipping.");
}
```
Source: RESEARCH lines 718-724 + CONTEXT D-10 ("Newbie mode gets an additional `output.explain`"). Note the `newbie` gate — Phase 2 already resolves `newbie` at create.ts:64.

**New imports added** (top of file, before line 11):
```typescript
import { compileVerify } from "../compiler/index.js";
import { safeReadVersion } from "../lib/version.js";  // for footer (D-12)
```

**Post-write footer update** (replace `src/commands/create.ts:110-111`):
```typescript
// REPLACE the Phase 2 footer (lines 110-111):
//   output.nextStep("Run 'smartc list-templates' to see other templates.");
//   output.nextStep("Phase 3 will add automatic compile-verify before write...");
// WITH:
const solcVer = safeReadVersion("solc") ?? "unknown";
const ozVer = safeReadVersion("@openzeppelin/contracts") ?? "unknown";
output.nextStep(`Compile-verified against solc ${solcVer} + @openzeppelin/contracts ${ozVer}.`);
output.nextStep("Run 'smartc list-templates' to see other templates.");
```
Source: RESEARCH lines 726-730 + CONTEXT D-12.

---

### `src/lib/errors.ts` (model, error codes) — MODIFY

**Analog:** self — `ERR_*` constant pattern (errors.ts:3-9).

**One-line additive constant** (insert after errors.ts:9):
```typescript
// Phase 3 addition — stable from this commit forward; never rename or remove.
// Thrown by src/compiler/index.ts when solc returns any severity:"error" diagnostic.
export const ERR_COMPILE_FAILED = "E_COMPILE_FAILED" as const;
```
Source: `src/lib/errors.ts:3-9` style (`as const` literal, header comment naming the phase that introduced it, "stable from this commit forward; never rename" rule).

---

### `tests/compiler/compile.spec.ts` (test, unit, mocked solc) — NEW

**Analog:** `tests/templates/erc20/wizard.spec.ts` (exact — `vi.mock` + top-level `await import` ESM pattern)

**Imports + mock + dynamic-import preamble** (lines 1-23 of `tests/templates/erc20/wizard.spec.ts`):
```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Vitest 4 ESM mock pattern. Mock solc BEFORE importing the SUT.
// Shape per RESEARCH Pitfall 4: default-export wrapper mirroring solc-js's
// CJS `module.exports = solcWrap(loadCompiler())`.
vi.mock("solc", () => ({
  default: {
    compile: vi.fn(),
    version: vi.fn(() => "0.8.35+commit.fake"),
  },
}));

const { compileVerify } = await import("../../src/compiler/index.js");
const solcMod = await import("solc");
const compileMock = (solcMod as unknown as { default: { compile: Mock } }).default.compile;
```
Source: pattern from `tests/templates/erc20/wizard.spec.ts:1-23`. Adapted for solc's default-export shape per RESEARCH Pitfall 4 (lines 462-469).

**beforeEach reset pattern** (lines 36-42 of `tests/templates/erc20/wizard.spec.ts`):
```typescript
beforeEach(() => {
  compileMock.mockReset();
});
```

**rejects.toMatchObject pattern for CliError assertions** (lines 226-231 of `tests/templates/erc20/wizard.spec.ts`):
```typescript
// COMP-02 — solana branch throws E_NOT_IMPLEMENTED
await expect(compileVerify("", "solana")).rejects.toMatchObject({
  code: "E_NOT_IMPLEMENTED",
  exitCode: 1,
  what: "Solana compile-verify is not implemented yet.",
});

// COMP-03 — broken source throws E_COMPILE_FAILED with formattedMessage in WHY
compileMock.mockReturnValueOnce(JSON.stringify({
  errors: [{ severity: "error", message: "Expected ';'", formattedMessage: "Contract.sol:5:13: ParserError: Expected ';' but got '}'.\n    uint x = \n            ^", type: "ParserError" }],
}));
await expect(compileVerify("contract X { uint x = }", "evm")).rejects.toMatchObject({
  code: "E_COMPILE_FAILED",
  exitCode: 1,
});
```

**Warning pass-through assertion pattern** (idiom — no exact analog; closest is wizard.spec.ts:79-84 inspecting mock call args):
```typescript
// COMP-04 — warning-only compile returns warnings, does not throw
compileMock.mockReturnValueOnce(JSON.stringify({
  errors: [{ severity: "warning", message: "Unused variable", formattedMessage: "Contract.sol:3:5: Warning: Unused local variable.", type: "Warning" }],
}));
const { warnings } = await compileVerify("contract X { uint x; function f() pure {} }", "evm");
expect(warnings).toHaveLength(1);
expect(warnings[0].severity).toBe("warning");
```

---

### `tests/compiler/compile.integration.spec.ts` (test, integration, real solc) — NEW

**Analog:** `tests/templates/erc20/generate.spec.ts` (exact — real upstream package, golden fixtures, no mocks)

**Imports + structure pattern** (lines 1-2 of `tests/templates/erc20/generate.spec.ts`):
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileVerify } from "../../src/compiler/index.js";

// Real solc + real OZ — no mocks. The canary for OZ-version drift across bumps.
```

**Golden fixture compile assertion pattern** (lines 17-29 of `tests/templates/erc20/generate.spec.ts`, adapted from snapshot-match to compile-clean assertion):
```typescript
describe("compileVerify — integration with real solc + real OZ", () => {
  it("bare-default fixture compiles clean (zero errors)", async () => {
    const source = readFileSync(
      join(__dirname, "../fixtures/erc20/bare-default.sol"),
      "utf8",
    );
    const { warnings } = await compileVerify(source, "evm");
    // Warnings may exist (e.g., deprecation notices from solc 0.8.31+) — just assert no throw.
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("all-flags-on fixture compiles clean (zero errors)", async () => {
    const source = readFileSync(
      join(__dirname, "../fixtures/erc20/all-flags-on.sol"),
      "utf8",
    );
    const { warnings } = await compileVerify(source, "evm");
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("broken.sol throws E_COMPILE_FAILED with multi-line WHY", async () => {
    const source = readFileSync(join(__dirname, "../fixtures/broken.sol"), "utf8");
    await expect(compileVerify(source, "evm")).rejects.toMatchObject({
      code: "E_COMPILE_FAILED",
      exitCode: 1,
    });
  });
});
```

**Fixture-path resolution** (mirror `generate.spec.ts:28` use of relative paths from spec file):
- `tests/compiler/compile.integration.spec.ts` → `tests/fixtures/erc20/bare-default.sol` = `../fixtures/erc20/bare-default.sol`

---

### `tests/commands/create.compile.spec.ts` (test, e2e in-process success) — NEW

**Analog:** `tests/commands/create.spec.ts` (exact — `vi.mock("@clack/prompts")` + dynamic-import + `buildProgram().exitOverride().parseAsync(...)` + registry clear/register pattern)

**Imports + mock + helpers preamble** (lines 1-53 of `tests/commands/create.spec.ts` — copy verbatim including `captureStdout` helper and `primeHappyPathMocks` helper).

**Happy-path test pattern** (lines 74-89 of `tests/commands/create.spec.ts`, extended to assert compile-verified footer):
```typescript
it("happy path with real solc — file written + version footer shows real versions", async () => {
  primeHappyPathMocks();
  const outPath = join(tmpDir, "MyToken.sol");
  const program = buildProgram();
  const captured = await captureStdout(async () => {
    await program.exitOverride().parseAsync(
      ["create", "--template", "erc20", "--newbie", "--out", outPath],
      { from: "user" },
    );
  });
  expect(existsSync(outPath)).toBe(true);
  const written = readFileSync(outPath, "utf8");
  expect(written).toContain("contract MyToken");
  expect(captured).toContain(`Wrote ${outPath}`);
  // D-12: post-write footer mentions real versions (newbie-only, hence --newbie flag above)
  expect(captured).toContain("Compile-verified against solc");
  expect(captured).toContain("@openzeppelin/contracts");
});
```

**Warning pass-through e2e** (Pitfall 6 case — extend with the warns-no-error fixture via a test-only template, mirroring D-15 seam):
The cleanest seam: register a test-only template returning the warns-no-error source. Pattern follows RESEARCH lines 745-761.

---

### `tests/commands/create.compile-fail.spec.ts` (test, e2e failure — D-15 load-bearing) — NEW

**Analog:** `tests/commands/create.spec.ts` (the wizard-cancel case at lines 159-176 + overwrite-refused at 178-197 — both assert "throws CliError" + "file not written")

**Test-only broken template registration** (lines 159-176 of `tests/commands/create.spec.ts` with the broken-template injection from RESEARCH lines 748-761):
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
const { clear, register } = await import("../../src/registry/index.js");

// Test-only template that bypasses wizard + returns deliberately broken source.
// Per CONTEXT § specifics path (a) — cleanest seam, doesn't entangle clack mocks.
const brokenTemplate = {
  id: "broken-test-only",
  name: "Broken (test only)",
  chain: "evm" as const,
  status: "stub" as const,
  description: "DO NOT USE — deliberately broken",
  async runWizard() { return {}; },
  generate() {
    return {
      filename: "Broken.sol",
      source: "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.27;\ncontract Broken { uint x = ; }",
    };
  },
};
```

**D-15 load-bearing assertions** (modeled on wizard-cancel case at `tests/commands/create.spec.ts:159-176`):
```typescript
describe("create dispatcher — compile-fail path (D-15)", () => {
  let tmpDir: string;
  beforeEach(() => {
    clear();
    register(brokenTemplate as never);
    tmpDir = mkdtempSync(join(tmpdir(), "smartc-compile-fail-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    clear();
  });

  it("D-15 (a)(b): rejects with E_COMPILE_FAILED and writes NO file", async () => {
    const outPath = join(tmpDir, "Broken.sol");
    const program = buildProgram();
    await expect(
      program.exitOverride().parseAsync(
        ["create", "--template", "broken-test-only", "--out", outPath],
        { from: "user" },
      ),
    ).rejects.toMatchObject({
      code: "E_COMPILE_FAILED",
      exitCode: 1,
    });
    // (b) load-bearing: NO file written on compile failure.
    expect(existsSync(outPath)).toBe(false);
  });

  it("D-15 (c): rendered output contains WHAT/WHY/FIX shape with solc diagnostic in WHY", async () => {
    const outPath = join(tmpDir, "Broken.sol");
    try {
      await buildProgram().exitOverride().parseAsync(
        ["create", "--template", "broken-test-only", "--out", outPath],
        { from: "user" },
      );
    } catch (e: unknown) {
      const err = e as { what: string; why: string; fix: string };
      expect(err.what).toBe("Generated source failed to compile.");
      // WHY contains solc formattedMessage (line:col + caret) + version tail
      expect(err.why).toContain("ParserError");
      expect(err.why).toContain("Compile errors come from solc");
      expect(err.fix).toContain("please report this");
    }
  });
});
```
Source pattern: `tests/commands/create.spec.ts:159-176` (rejects.toMatchObject + existsSync false) + `tests/commands/create.spec.ts:104-113` (try/catch re-throw to inspect fields).

---

### `tests/fixtures/broken.sol` (test fixture, static) — NEW (D-14)

**Analog:** `tests/fixtures/erc20/bare-default.sol` (role-match — both are static .sol fixtures committed as test inputs)

**Pattern** (mirror the structure of `bare-default.sol`: SPDX header, OZ compat comment, pragma, then deliberately broken body):
```solidity
// SPDX-License-Identifier: MIT
// Deliberately broken fixture for Phase 3 compile-fail tests — DO NOT USE.
pragma solidity ^0.8.27;

contract Broken {
    uint256 x = ; // ParserError: expected expression
}
```
Source: structure mirrors `tests/fixtures/erc20/bare-default.sol:1-15`; broken-body content per RESEARCH line 759.

---

### `tests/fixtures/warns-no-error.sol` (test fixture, static) — NEW (Pitfall 6)

**Analog:** `tests/fixtures/erc20/bare-default.sol` (same shape, but with content that triggers a solc warning without erroring).

**Pattern** (RESEARCH Pitfall 6 cites solc 0.8.31 deprecation warnings — pick one that's stable across pinned 0.8.35):
```solidity
// SPDX-License-Identifier: MIT
// Deliberately-warns fixture for Phase 3 warning-pass-through tests.
pragma solidity ^0.8.27;

contract Warns {
    function unused() external pure returns (uint256) {
        uint256 dead;  // Warning: unused local variable
        return 42;
    }
}
```
Note: planner may iterate the exact warning trigger after the Wave 0 probe measures what 0.8.35 actually emits. The fixture is replaceable; the test pattern stays the same.

---

### `scripts/probe-compile.mjs` (utility, Wave 0 throwaway probe) — NEW

**Analog:** None — `scripts/` directory does not yet exist in the repo. The full source already lives in RESEARCH lines 562-624.

**Pattern (one-shot probe script):**
- Use `.mjs` extension (not `.ts`) — avoids needing `tsx` and lets Node run it directly.
- Use `createRequire(import.meta.url)` for the solc require (same as `src/lib/version.ts:6`).
- `chdir(mkdtempSync(...))` BEFORE the resolve — RESEARCH §Pitfall 3 + §Wave 0 Probe insist the probe must verify cwd-independence.
- `console.log` for human output (this is a probe, not a library — `output.ts` channels don't apply).
- Exit 1 on probe failure (`process.exit(1)`).

The verbatim source is in RESEARCH lines 562-624 — Plan 01's Wave 0 task can copy it directly.

---

### `package.json` (config) — MODIFY

**Analog:** self — `package.json:22-28` existing `dependencies` block.

**Pattern** (exact pins, sorted alphabetically — matches existing `@openzeppelin/wizard: "0.10.8"` exact-pin convention):
```json
"dependencies": {
  "@clack/prompts": "^0.11.0",
  "@openzeppelin/contracts": "5.6.1",
  "@openzeppelin/wizard": "0.10.8",
  "cli-table3": "^0.6.5",
  "commander": "^14.0.3",
  "picocolors": "^1.1.1",
  "solc": "0.8.35"
}
```
Source: `package.json:22-28` style (exact-pin for OZ packages, caret-pin for utility libs). Solc + @oz/contracts MUST be exact pins per RESEARCH §Installation lines 124-127 ("golden fixture snapshots stay stable; formatVersionLine output is deterministic; EVM-target defaults are predictable").

---

### `tests/version.spec.ts` (test) — MODIFY

**Analog:** self — `tests/version.spec.ts:15-21` ("returns null for solc in Phase 1" + same for @oz/contracts).

**Pattern** — flip the "not bundled" assertions to real-version assertions:
```typescript
// REPLACE tests/version.spec.ts:15-21 with:
it("returns the installed solc version in Phase 3", () => {
  const v = safeReadVersion("solc");
  expect(v).not.toBeNull();
  expect(v).toMatch(/^\d+\.\d+\.\d+/);
});

it("returns the installed @openzeppelin/contracts version in Phase 3", () => {
  const v = safeReadVersion("@openzeppelin/contracts");
  expect(v).not.toBeNull();
  expect(v).toMatch(/^\d+\.\d+\.\d+/);
});

// REPLACE tests/version.spec.ts:40-44 ("reports the two Phase-3-gated deps as 'not bundled'"):
it("includes solc + @openzeppelin/contracts segments with real versions (UI-16 + Phase 3)", () => {
  const line = formatVersionLine();
  expect(line).toContain("solc 0.8.35");
  expect(line).toContain("@openzeppelin/contracts 5.6.1");
  expect(line).not.toContain("solc not bundled");
  expect(line).not.toContain("@openzeppelin/contracts not bundled");
});
```
Source: mirror `tests/version.spec.ts:23-27` (the Phase 2 wizard test that already asserts a real version). Use exact `0.8.35` and `5.6.1` strings per RESEARCH-locked pinned versions (note: like `tests/version.spec.ts:51`, drift = deliberate commit, not a churn).

---

## Shared Patterns

### Authentication / Authorization
**Not applicable** — CLI tool, no auth surface (per RESEARCH §Security Domain ASVS V2/V3/V4 → "no").

### Error Handling — CliError(WHAT/WHY/FIX) block
**Source:** `src/lib/errors.ts:11-34` (CliError class) + `src/lib/errors.ts:43-49` (renderError)
**Apply to:** `src/compiler/index.ts` (both solana branch and compile-error branch); test files asserting on `code/exitCode/what/why/fix` fields.

```typescript
// errors.ts:11-34 — locked four-field shape with exitCode default 1
export interface CliErrorInit {
  code: string;
  what: string;   // ONE-LINE
  why: string;    // can be multi-line (Phase 3 D-08 introduces this idiom)
  fix: string;    // ONE-LINE
  exitCode?: number; // default 1
}
```
Phase 3 introduces the multi-line WHY idiom — renderError at errors.ts:43-49 already handles it because the rendered output just concatenates `${color.yellow("Why:  ")} ${err.why}` and the runtime newlines flow through.

### Output channels — warn for non-fatal, explain for newbie-context
**Source:** `src/lib/output.ts:6-15` (Output interface) + `src/lib/output.ts:49-63` (newbie-gated channels)
**Apply to:** `src/commands/create.ts` splice (post-compileVerify warnings loop) — `output.warn(w.formattedMessage)` per diagnostic, `output.explain("...")` newbie-only.

```typescript
// output.ts:51 — warn always goes to stderr with "warn: " prefix
warn: (t: string) => writeErr(`${c.yellow("warn:")} ${t}`),
// output.ts:53 — explain is newbie-only no-op otherwise
explain: opts.newbie && !opts.json ? (t: string) => writeOut(c.dim(t)) : noopOne,
```
Phase 3 uses `output.warn` for solc warnings (the formattedMessage already includes file:line:col + caret) and `output.explain` only in newbie mode to add the "warnings ≠ deployment blockers" context line.

### Validation — solc severity field is authoritative
**Source:** RESEARCH §Don't Hand-Roll line 418 ("Error/warning differentiation: use `severity` field in standard JSON output, not string match")
**Apply to:** `src/compiler/index.ts` partition logic (mapping solc's `"error" | "warning" | "info"` → `CompileDiagnostic.severity: "error" | "warning"` where info collapses into the warning bucket).

### Testing — vi.mock + top-level await import (Vitest 4 ESM)
**Source:** `tests/templates/erc20/wizard.spec.ts:1-23` and `tests/commands/create.spec.ts:1-23`
**Apply to:** `tests/compiler/compile.spec.ts` (mocks solc), `tests/commands/create.compile.spec.ts` (mocks @clack), `tests/commands/create.compile-fail.spec.ts` (mocks @clack).

```typescript
// LOCKED Vitest 4 ESM pattern — STATE.md line 80, see also tests/prompt.spec.ts comment
vi.mock("<module>", () => ({ /* shape mirrors the SUT's import form */ }));
const { SUT } = await import("...");  // TOP-LEVEL await import, NOT inside describe
const mockedDep = await import("<module>");
```
The mock must mirror the SUT's import form. The SUT uses `createRequire(import.meta.url); const solc = require("solc")`, which receives whatever `vi.mock("solc")` returns as `default` — so the mock must be `{ default: { compile: vi.fn() } }` (RESEARCH Pitfall 4 lines 462-469).

### Logging — no console.log; everything routes through Output or renderError
**Source:** RESEARCH line 109 ("Three-channel diagnostic rendering — no `console.log` ever; everything routes through the output factory or the error renderer")
**Apply to:** All Phase 3 production code (`src/compiler/*`, `src/commands/create.ts` modification). The only exception is `scripts/probe-compile.mjs` which is a throwaway probe, not production code — `console.log` is fine there.

### Stable error codes — once shipped, never rename
**Source:** RESEARCH line 110 + `src/lib/errors.ts:7` ("stable from this commit forward; never rename or remove")
**Apply to:** `ERR_COMPILE_FAILED` constant + every test that asserts `code: "E_COMPILE_FAILED"`. The constant ships in Phase 3 and is reused by Phase 7 (anchor-build adapter) and Phase 8 (AI-patch sandbox-compile).

---

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|------|------|-----------|---------------------|
| `src/compiler/README.md` | doc | n/a | No existing per-module README in the repo. CONTEXT discretion says yes-recommended. Author one-page free-form: why solc-js + standard JSON, where the import callback lives, why the deliberate-fail fixture exists, how to bump pinned versions and refresh snapshots. |
| `scripts/probe-compile.mjs` | utility (throwaway probe) | request-response | No `scripts/` directory exists. Greenfield; full source is in RESEARCH lines 562-624 — Plan 01 copies it verbatim. After Wave 0, the script may stay under `scripts/` or be moved to `.planning/probes/` per planner judgement. |

Note: both no-analog files have full source/structure spec'd in RESEARCH.md — planner doesn't need a codebase pattern, the research IS the pattern.

---

## Metadata

**Analog search scope:**
- `src/commands/` (dispatcher pattern)
- `src/templates/erc20/` (pure-transform module shape + test patterns)
- `src/lib/` (errors, output, version, prompt)
- `src/registry/` (types module pattern)
- `tests/commands/` (e2e in-process pattern)
- `tests/templates/erc20/` (unit + integration test patterns)
- `tests/fixtures/erc20/` (static fixture convention)

**Files scanned:** 12 (4 src/, 4 tests/, 2 fixtures, package.json, tests/version.spec.ts)
**Pattern extraction date:** 2026-05-26

**Cross-cutting evidence:**
- The `createRequire(import.meta.url) + require.resolve("<pkg>/package.json")` pattern is proven in `src/lib/version.ts:1-22` and used by `safeReadVersion` for `commander`, `@openzeppelin/wizard`, smartc's own package.json — Phase 3's import-callback reuses it for `@openzeppelin/contracts`.
- The `vi.mock(...) → top-level await import(SUT)` pattern is proven in `tests/templates/erc20/wizard.spec.ts` (mocks `@clack/prompts`) and `tests/commands/create.spec.ts` (mocks `@clack/prompts`); Phase 3's compile.spec.ts repeats with `solc`.
- The "test-only template registered via registry.clear()+register()" seam is established by `tests/commands/create.spec.ts:58-72` (clear/registerErc20Template in beforeEach/afterEach); Phase 3's compile-fail.spec.ts reuses the same shape with a broken template instead.

---

*Phase: 03-compile-verify-safety-net*
*Pattern map produced: 2026-05-26*
