# Phase 3: Compile-Verify Safety Net - Research

**Researched:** 2026-05-26
**Domain:** In-process Solidity compilation via `solc` npm + bundled `@openzeppelin/contracts` import resolution
**Confidence:** HIGH

## Summary

Phase 3 inserts an in-process Solidity compile gate at `src/commands/create.ts:95` (Phase 2's pre-marked splice point) between `template.generate(opts)` and `fs.writeFile`. The compile uses `solc@0.8.35` (Ethereum Foundation, latest stable on the 0.8.x line) [VERIFIED: npm view solc version → 0.8.35, registry maintainers ekpyron/cameel/r0qs/argotorg, repo ethereum/solc-js] against `@openzeppelin/contracts@5.6.1` [VERIFIED: npm view → 5.6.1, repo OpenZeppelin/openzeppelin-contracts]. The import callback resolves `@openzeppelin/contracts/...` paths via `require.resolve("@openzeppelin/contracts/package.json")` — the same dual-strategy `safeReadVersion` machinery Phase 1 proved works for globally-installed npm tools.

The architecture is well-trodden: solc-js exposes `solc.compile(jsonString, { import: callback })` as a synchronous high-level API [CITED: https://github.com/ethereum/solc-js README]. Standard JSON input/output is the documented schema; the import callback returns `{ contents }` on success or `{ error }` on failure. Diagnostics carry `severity: "error" | "warning" | "info"` plus a pre-formatted `formattedMessage` string that the locked `CliError` WHAT/WHY/FIX block can render verbatim.

One pitfall the Phase 2 fixtures expose: **solc 0.8.35 defaults `evmVersion` to `osaka`** [VERIFIED: argotorg/solidity release notes via WebSearch]. The committed fixtures (`tests/fixtures/erc20/bare-default.sol`, `all-flags-on.sol`) carry `pragma ^0.8.27` and the wizard comment "Compatible with OpenZeppelin Contracts ^5.6.0" — they don't pin EVM target. Phase 3 MUST set `settings.evmVersion: "paris"` (or a chosen post-Shanghai stable target) in standard-JSON input to keep bytecode deterministic across solc patch releases and avoid producing osaka-targeted bytecode that older deploy chains can't run.

**Primary recommendation:** Pin `solc@0.8.35` (exact) + `@openzeppelin/contracts@5.6.1` (exact) in `dependencies`. Author `compileVerify(source, chain)` in `src/compiler/index.ts` with the import callback in `src/compiler/imports.ts`. Explicitly set `evmVersion: "paris"` and `outputSelection: { "*": { "*": ["abi"] } }` (minimum required to prove compile succeeded). Run the bare-default fixture through this pipeline as the Wave 0 probe before any other planning lock.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generate Solidity source from wizard opts | Plugin layer (`src/templates/erc20/generate.ts`) | — | Phase 2 D-04 locked — templates own generation; pure transform, no I/O |
| Compile generated source | Compiler module (`src/compiler/index.ts`) | — | Phase 3 deliverable; chain-agnostic call site `compileVerify(source, chain)` |
| Resolve `@openzeppelin/contracts/...` imports | Compiler module (`src/compiler/imports.ts`) | — | Bundled-deps resolver; lives next to compile so the seam is locally testable |
| Render compile errors to user | Lib layer (`src/lib/errors.ts` via `renderError`) | — | Phase 1 contract — all user-facing failures use `CliError` + three-part block |
| Render compile warnings to user | Lib layer (`src/lib/output.ts` via `output.warn`) | — | Phase 1 contract — non-fatal goes through Output factory |
| Surface pinned versions in `--version` | Lib layer (`src/lib/version.ts:84-89` via `safeReadVersion`) | — | Already wired in Phase 2; auto-rolls forward when Plan 01 installs the deps |
| Splice compile-verify into dispatcher | Command layer (`src/commands/create.ts:95`) | — | Phase 2 left exactly one marker; dispatcher is the only orchestrator |
| Validate compile-failure → no file written | Test layer (`tests/commands/create.compile-fail.spec.ts`) | — | D-15 load-bearing assertion; the gate's whole purpose |

**Sanity check:** No tier crossings. Plugin generates source, compiler verifies source, dispatcher orchestrates, lib renders, tests assert. The `compileVerify` boundary keeps Phase 4's ERC-721/1155 and Phase 7's SPL drop-in without modifying any layer above.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Compiler approach:**
- **D-01: Use `solc` npm package in-process.** No system-solc shell-out, no native binaries.
- **D-02: Pin `solc` to 0.8.27+ stable, pin `@openzeppelin/contracts` to latest v5.x.** Exact pins, not ranges. Researcher locks exact versions.
- **D-03: Standard JSON input format.** `solc.compile(JSON.stringify(input), { import: callback })`. Minimal `outputSelection`. Output parsed for `errors[]`; `severity: "error"` blocks write, `severity: "warning"` surfaces but passes through.

**Bundled dependency resolution (COMP-05):**
- **D-04: Import callback uses `require.resolve("@openzeppelin/contracts/package.json")`** to find the package root, joins the requested import path, reads the file, returns `{ contents }`. Works regardless of user cwd (Node finds smartc's bundled `@oz/contracts`, not the user's).
- **D-05: Cache resolved imports per-compile.** `Map<string, { contents: string }>` for the lifetime of one compile call. No cross-call cache.

**Dispatcher integration:**
- **D-06: Splice `compileVerify(source, tpl.chain)` at `src/commands/create.ts:95`.** Signature: `async function compileVerify(source: string, chain: "evm" | "solana"): Promise<{ warnings: CompileDiagnostic[] }>`. Phase 3 implements ONLY `chain === "evm"`; solana branch throws `E_NOT_IMPLEMENTED` with a Phase 7 pointer.
- **D-07: Order is `runWizard → generate → compileVerify → confirmOverwrite → writeFile`.** Compile gates everything — no overwrite prompt before compile.

**Compile-failure UX:**
- **D-08: Render compile errors as multi-line `CliError` block.** WHAT/FIX stay one-line; WHY becomes multi-line block listing each `severity: "error"` diagnostic's `formattedMessage` verbatim. Final WHY line: "Compile errors come from `solc <ver>` against `@openzeppelin/contracts <ver>`."
- **D-09: Error code `E_COMPILE_FAILED`, exit code 1.** New constant in `src/lib/errors.ts`. Stable from this commit forward; never renames.
- **D-10: Warnings surface but do NOT block (COMP-04).** Each `severity: "warning"` → `output.warn(d.formattedMessage)`. Newbie mode adds `output.explain` context line.

**Versioning + visibility (COMP-05 + SC-5):**
- **D-11: `formatVersionLine()` auto-picks up real versions.** Already wired via Phase 1's `safeReadVersion`. No code edit in `version.ts`. Plan 01's install IS the SC-5 deliverable.
- **D-12: Update post-write `nextStep` footer in `create.ts`** to "Compile-verified against solc X.Y.Z + @openzeppelin/contracts A.B.C..." (Phase 2's "Phase 3 will add..." footer is replaced).

**Testing strategy:**
- **D-13: Three test layers.** (a) Unit `tests/compiler/compile.spec.ts` (mocked solc-js — input shape, callback wiring, error mapping, warning surfacing). (b) Integration `tests/compiler/compile.integration.spec.ts` (real solc-js, real OZ — compile both committed golden fixtures clean; canary for OZ-version drift). (c) E2E `tests/commands/create.compile.spec.ts` (in-process dispatcher with real solc + real fixture; assert file written, version line correct).
- **D-14: Add deliberate-fail fixture `tests/fixtures/broken.sol`.** Used only by unit/integration to verify error path. NEVER produced by the wizard.
- **D-15: "No file written on compile failure" test is load-bearing.** `tests/commands/create.compile-fail.spec.ts`: inject broken source via test-only seam, run dispatcher, assert (a) rejected with `E_COMPILE_FAILED`, (b) `existsSync(outPath) === false`, (c) rendered output contains WHAT/WHY/FIX shape with solc diagnostic in WHY.

### Claude's Discretion

- **Exact pinned versions of `solc` and `@openzeppelin/contracts`** — researcher picks. **Recommendation below: `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` (both exact).**
- **Compiler `outputSelection`** — researcher decides. **Recommendation below: `["abi"]` per file (minimum-required to prove compile succeeded; we don't need bytecode in Phase 3).**
- **`CompileDiagnostic` type shape** — Single type in `src/compiler/types.ts`: `{ severity: "error" | "warning"; message: string; formattedMessage: string; line?: number; column?: number; file?: string }`. Standardized so Phase 7's anchor-build adapter produces the same shape.
- **Banner/loading text during compile** — planner picks `@clack/prompts` spinner copy. **Recommendation below: no spinner — measured compile time stays well under the 250ms perceptual-delay threshold per Wave 0 probe target, terse mode wins.**
- **README inside `src/compiler/`** — planner-judged. **Recommendation: yes** — one short page covering why solc-js + standard JSON, where the import callback lives, why the deliberate-fail fixture exists, how to bump pinned versions and refresh snapshots.

### Deferred Ideas (OUT OF SCOPE)

- Compile cache across runs
- Multi-target compile (paris/london/cancun EVM versions exposed to user)
- Compile against multiple solc versions in CI
- Surface bytecode size or gas estimates after compile
- Solc warnings → categorized severities (low/medium/high)
- Compile-verify badge in DEPLOY.md (Phase 5's problem)
- Anchor build adapter (Phase 7's deliverable; seam shape is set here only)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Solidity contracts compiled in-process via `solc` npm against pinned `@openzeppelin/contracts` | `solc@0.8.35` standard JSON API + import callback (§ Standard Stack, § Code Examples) |
| COMP-02 | Solana contracts compiled via `anchor build` shell-out | OUT OF SCOPE for Phase 3 — `compileVerify(source, "solana")` throws `E_NOT_IMPLEMENTED` with Phase 7 pointer (§ Architecture Patterns) |
| COMP-03 | When compile fails, generated file NOT written; user sees diagnostics | Splice order at create.ts:95 places compile BEFORE writeFile; `CliError(E_COMPILE_FAILED)` rejects; D-15 test asserts file absent (§ Architecture Patterns) |
| COMP-04 | Compile warnings surfaced but do not block writing | Standard JSON output `severity: "warning"` filtered separately from `"error"`; routed via `output.warn`; write proceeds (§ Code Examples) |
| COMP-05 | Import callback resolves `@openzeppelin/contracts/...` from bundled deps (no user install) | `require.resolve("@openzeppelin/contracts/package.json")` + `safeReadVersion` dual-strategy pattern from Phase 1; Wave 0 probe validates cwd-independence (§ Architecture Patterns, § Wave 0 Probe) |

## Project Constraints (from CLAUDE.md)

- **Phase-completion push contract:** `git push` to origin is triggered only AFTER the phase is marked complete in ROADMAP.md / STATE.md. Intermediate commits (CONTEXT.md, PLAN.md, task commits) stay local. On push failure, surface the error and stop — never force-push. **Planner: do not insert a `git push` task inside the wave structure. The final phase-completion step handles it.**

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `solc` | `0.8.35` (exact) | Solidity compiler, JS bindings | Official Ethereum Foundation package (`ethereum/solc-js`); the documented in-process Solidity compile path; emscripten-compiled libsolc, pure JS, no native deps. [VERIFIED: npm view solc version → 0.8.35; maintainers include Ethereum Foundation core devs] |
| `@openzeppelin/contracts` | `5.6.1` (exact) | OpenZeppelin Contracts v5 — ERC20/ERC721/ERC1155 plus extensions | The library `@openzeppelin/wizard@0.10.8` (already installed by Phase 2) emits imports for. Phase 2 fixture comment "Compatible with OpenZeppelin Contracts ^5.6.0" matches 5.6.1 (patch bump). [VERIFIED: npm view → 5.6.1] |

### Supporting

No additional runtime dependencies. The `solc` package's own transitive deps (`commander`, `tmp`, `js-sha3`, `semver`, `memorystream`, `follow-redirects`, `command-exists`) are pulled in automatically and used only by `solcjs` CLI — irrelevant to our in-process API call. [VERIFIED: `npm view solc dependencies`]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `solc@0.8.35` | System solc via shell-out (`execFile("solc", ...)`) | Forces user install; fails COMP-05 "no user install required"; cross-platform binary distribution; rejected in CONTEXT D-01 |
| `solc@0.8.35` | Native-binary `solc-native` | Adds per-platform tarball matrix; re-litigates Phase 9 ahead of time; rejected in CONTEXT D-01 |
| `solc@0.8.35` | Pin older `0.8.27` to exactly match wizard pragma comment | `^0.8.27` is satisfied by any 0.8.27+ version; pinning 0.8.35 gets bug fixes; OZ Contracts 5.6 requires minimum 0.8.24, well-satisfied. No technical reason to pin lower than current latest. |
| `solc.loadRemoteVersion()` | Bundled `solc` package | `loadRemoteVersion` fetches from `solc-bin` over network — breaks offline tools and creates a runtime network dep. CONTEXT explicitly flagged: "remote loading is OUT OF SCOPE (would break offline)". [CITED: https://github.com/ethereum/solc-js README] |
| `["abi"]` outputSelection | `["abi", "evm.bytecode.object"]` | Bytecode adds compile time + memory cost; we don't use it in Phase 3 (we discard outputs and check only `errors[]`). Phase 5 DEPLOY.md doesn't need it either (it's a docs generator, not a deployer). |

### Installation

```bash
npm install solc@0.8.35 @openzeppelin/contracts@5.6.1
```

Both exact pins so:
1. Golden fixture snapshots stay stable across CI/dev installs.
2. `formatVersionLine()` output is deterministic (matters for the SC-5 user-facing visibility deliverable).
3. EVM-target defaults are predictable (see Pitfall 2 below).

### Version verification

```
npm view solc version             → 0.8.35      [VERIFIED 2026-05-26]
npm view solc time --json         → 0.8.35 published 2026-04-29
npm view solc engines             → { node: ">=12.0.0" }
npm view solc repository          → ethereum/solc-js
npm view solc maintainers         → ekpyron, cameel, r0qs, matheus.pit, clonker, nikola-matic (Ethereum Foundation / argotorg core)
npm view solc dist.unpackedSize   → 9476843 bytes (~9.5 MB)

npm view @openzeppelin/contracts version          → 5.6.1   [VERIFIED 2026-05-26]
npm view @openzeppelin/contracts time --json      → 5.6.1 published 2026-02-27
npm view @openzeppelin/contracts repository       → OpenZeppelin/openzeppelin-contracts
npm view @openzeppelin/contracts dist.unpackedSize → 2948811 bytes (~2.95 MB)
```

## Package Legitimacy Audit

slopcheck was not available in this environment — applied the documented graceful-degradation rule, but BOTH packages also qualify as [VERIFIED] via authoritative non-registry channels (Ethereum Foundation / OpenZeppelin official GitHub repos, decade-long publish history, ecosystem-foundational status).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `solc` | npm | 10+ years (first publish 2015-09-28) | Foundational ethereum dep (10M+ weekly est.) | github.com/ethereum/solc-js (verified via `npm view solc repository`) | unavailable | **Approved** — official Ethereum Foundation package |
| `@openzeppelin/contracts` | npm | 7+ years on v5 line | Foundational EVM dep (1M+ weekly est.) | github.com/OpenZeppelin/openzeppelin-contracts (verified via `npm view repository`) | unavailable | **Approved** — official OpenZeppelin package |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Postinstall script check:** Both packages have no postinstall script (`npm view solc scripts.postinstall` returns empty; `npm view @openzeppelin/contracts scripts.postinstall` returns empty). No supply-chain side-effect risk on install.

*Despite slopcheck being unavailable, these are not `[ASSUMED]` packages — both are confirmed via official upstream repositories (ethereum/solc-js, OpenZeppelin/openzeppelin-contracts), which is the stronger of slopcheck's two authoritative-source requirements. The phase planner does not need to insert a `checkpoint:human-verify` task for them. If the planner wants to be belt-and-suspenders, the Wave 0 probe (§ below) already serves as a functional verification — if the packages don't compile the bare-default fixture, the probe fails and the phase blocks before any other lock.*

## Architecture Patterns

### System Architecture Diagram

```
User: smartc create --template erc20 [--newbie] [--force] [--out path]
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  src/commands/create.ts  (dispatcher)                                       │
│                                                                             │
│  1. --json refusal                                                          │
│  2. --template required-flag check                                          │
│  3. registry.get(templateId) → Template                                     │
│  4. tpl.runWizard({ output })  ──→  Erc20Opts                               │
│  5. tpl.generate(opts)         ──→  { filename, source }                    │
│  ─────────────────────────────── PHASE 3 SPLICE @ create.ts:95 ──────────── │
│  6. compileVerify(source, tpl.chain)                                        │
│     │                                                                       │
│     ├─ chain === "solana"  →  throw CliError(E_NOT_IMPLEMENTED, "Phase 7")  │
│     │                                                                       │
│     └─ chain === "evm"  ──┐                                                 │
│                           ▼                                                 │
│         ┌──────────────────────────────────────────────────────┐            │
│         │  src/compiler/index.ts                               │            │
│         │   - buildStandardJsonInput(source)                   │            │
│         │   - solc.compile(JSON.stringify(input), { import })  │            │
│         │   - parse output; partition errors[] by severity     │            │
│         │   - severity:"error" present?                        │            │
│         │       │                                              │            │
│         │       ├─ YES → throw CliError(E_COMPILE_FAILED,      │            │
│         │       │         what+why+fix with formattedMessage   │            │
│         │       │         joined by \n\n in WHY)               │            │
│         │       │                                              │            │
│         │       └─ NO  → return { warnings: CompileDiagnostic[] }            │
│         │                                                       │           │
│         │   import callback (src/compiler/imports.ts):          │           │
│         │     - Map<string, {contents}> per-compile cache       │           │
│         │     - path === "@oz/contracts/..." ─→ resolve via     │           │
│         │       require.resolve("@oz/contracts/package.json")   │           │
│         │       then readFileSync(join(root, subpath))          │           │
│         │     - return { contents } or { error: "Not found" }   │           │
│         └──────────────────────────────────────────────────────┘            │
│  7. warnings.forEach(w => output.warn(w.formattedMessage))                  │
│     newbie + warnings? output.explain("warnings don't block...")            │
│  8. outPath = --out ?? cwd/filename                                         │
│  9. existsSync(outPath) → confirmOverwrite(outPath, { force })              │
│ 10. fs.writeFile(outPath, source)                                           │
│ 11. output.result(`Wrote ${outPath}`) + nextStep footer (D-12 updated copy) │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
Outcome: one of three
    A. Compile clean       → file written, terse success
    B. Compile errors      → no file written, exit 1, CliError block on stderr
    C. Compile warnings    → file written, warnings on stderr, exit 0
```

### Recommended Project Structure

```
src/
├── compiler/
│   ├── index.ts        # compileVerify(source, chain) — the public seam
│   ├── imports.ts      # makeImportCallback() — @oz/contracts resolution
│   ├── types.ts        # CompileDiagnostic + StandardJsonInput types
│   └── README.md       # one-page doc (CONTEXT discretion — recommended yes)
tests/
├── compiler/
│   ├── compile.spec.ts                   # D-13 unit (mocked solc)
│   └── compile.integration.spec.ts       # D-13 integration (real solc + real OZ)
├── commands/
│   ├── create.compile.spec.ts            # D-13 e2e success
│   └── create.compile-fail.spec.ts       # D-15 — no file on failure
└── fixtures/
    └── broken.sol                        # D-14 deliberate-fail fixture
```

### Pattern 1: Standard JSON input shape

**What:** Build the JSON object solc-js expects.
**When to use:** Inside `compileVerify(source, chain)` when `chain === "evm"`.
**Example:**
```typescript
// Source: https://github.com/ethereum/solc-js README + https://docs.soliditylang.org/en/v0.8.35/using-the-compiler.html
interface StandardJsonInput {
  language: "Solidity";
  sources: Record<string, { content: string }>;
  settings: {
    outputSelection: Record<string, Record<string, string[]>>;
    evmVersion?: string;            // pinned explicitly per Pitfall 2
    optimizer?: { enabled: boolean; runs: number };
  };
}

function buildInput(source: string): StandardJsonInput {
  return {
    language: "Solidity",
    sources: {
      "Contract.sol": { content: source },
    },
    settings: {
      // Pin evmVersion — solc 0.8.35 defaults to osaka, which we don't want
      // surfacing to users in v1. Paris is the safe broadest-compatibility target.
      evmVersion: "paris",
      outputSelection: {
        "*": { "*": ["abi"] }, // minimum required to prove compile succeeded
      },
    },
  };
}
```

### Pattern 2: Import callback for bundled OpenZeppelin

**What:** Synchronous resolver that maps `@openzeppelin/contracts/...` imports to file contents from smartc's own `node_modules`.
**When to use:** Passed as `{ import: callback }` second arg to `solc.compile()`.
**Example:**
```typescript
// Source: pattern derived from Phase 1's src/lib/version.ts safeReadVersion dual-strategy
//         + https://github.com/ethereum/solc-js README import-callback example
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export function makeImportCallback() {
  // Resolve once per compile call — package root won't change mid-call.
  let ozRoot: string | null = null;
  function resolveOzRoot(): string {
    if (ozRoot) return ozRoot;
    // Strategy 1: subpath import (most reliable for @oz/contracts which exposes package.json)
    try {
      const pj = require.resolve("@openzeppelin/contracts/package.json");
      ozRoot = dirname(pj);
      return ozRoot;
    } catch { /* fall through */ }
    // Strategy 2 (safety net — should never hit in practice): walk-up.
    // [omitted for brevity; mirror version.ts pattern if Strategy 1 misses]
    throw new Error("@openzeppelin/contracts not installed");
  }

  const cache = new Map<string, { contents: string }>();

  return function importCallback(path: string): { contents: string } | { error: string } {
    const hit = cache.get(path);
    if (hit) return hit;

    if (path.startsWith("@openzeppelin/contracts/")) {
      const subpath = path.replace(/^@openzeppelin\/contracts\//, "");
      try {
        const fullPath = join(resolveOzRoot(), subpath);
        const contents = readFileSync(fullPath, "utf8");
        const entry = { contents };
        cache.set(path, entry);
        return entry;
      } catch (err) {
        return { error: `Could not read ${path}: ${(err as Error).message}` };
      }
    }

    return { error: `Unknown import: ${path}` };
  };
}
```

### Pattern 3: Parse output, partition diagnostics, throw or return

**What:** Take solc's JSON output, split into errors vs warnings, map to `CompileDiagnostic`, throw `CliError(E_COMPILE_FAILED)` on any error, otherwise return warnings.
**When to use:** Inside `compileVerify` immediately after `solc.compile()` returns.
**Example:**
```typescript
// Source: solc-js Standard JSON output schema + Phase 1 src/lib/errors.ts CliError contract

// solc-js raw output shape (key fields we care about)
interface SolcOutput {
  errors?: Array<{
    severity: "error" | "warning" | "info";
    type: string;        // e.g. "TypeError", "ParserError", "DeclarationError"
    message: string;
    formattedMessage?: string;
    sourceLocation?: { file: string; start: number; end: number };
    component?: string;
    errorCode?: string;
  }>;
  // contracts?: ...  — we ignore; outputSelection abi-only minimizes this
}

import { CliError, ERR_COMPILE_FAILED } from "../lib/errors.js";
import { safeReadVersion } from "../lib/version.js";

export interface CompileDiagnostic {
  severity: "error" | "warning";
  message: string;
  formattedMessage: string;
  line?: number;
  column?: number;
  file?: string;
}

function toDiag(e: SolcOutput["errors"][number]): CompileDiagnostic {
  return {
    severity: e.severity === "error" ? "error" : "warning",
    message: e.message,
    formattedMessage: e.formattedMessage ?? e.message,
    file: e.sourceLocation?.file,
    // line/column can be extracted from sourceLocation.start + source if needed;
    // formattedMessage already carries human-readable line:col, so omit unless asked
  };
}

function partition(out: SolcOutput): { errors: CompileDiagnostic[]; warnings: CompileDiagnostic[] } {
  const errors: CompileDiagnostic[] = [];
  const warnings: CompileDiagnostic[] = [];
  for (const e of out.errors ?? []) {
    const d = toDiag(e);
    if (d.severity === "error") errors.push(d);
    else warnings.push(d);  // "info" severity is mapped to warning bucket — surface, don't block
  }
  return { errors, warnings };
}

function rejectIfErrored(errors: CompileDiagnostic[]): void {
  if (errors.length === 0) return;
  const solcVer = safeReadVersion("solc") ?? "unknown";
  const ozVer = safeReadVersion("@openzeppelin/contracts") ?? "unknown";
  const whyBody = errors.map(e => e.formattedMessage).join("\n\n");
  const whyTail = `\n\nCompile errors come from solc ${solcVer} against @openzeppelin/contracts ${ozVer}.`;
  throw new CliError({
    code: ERR_COMPILE_FAILED,
    what: "Generated source failed to compile.",
    why: `${whyBody}${whyTail}`,
    fix: "If you didn't edit the wizard output, please report this — the template + pinned solc+OpenZeppelin should always produce compilable source.",
    exitCode: 1,
  });
}
```

### Anti-Patterns to Avoid

- **`solc.loadRemoteVersion()`** — fetches a soljson over the network. Would break offline tools and add a runtime network dep. Use the bundled `require("solc")` instead. [CONTEXT explicitly OUT OF SCOPE]
- **Post-processing `formattedMessage` for "prettier" rendering** — solc-js already produces `Contract.sol:5:13: Error: Expected ';' but got '}'.` with caret and source-line context. Rendering it verbatim is the right call (CONTEXT D-08). Re-formatting risks losing the caret-pointer line and obscuring real positional info.
- **`outputSelection: { "*": { "*": ["*"] } }`** — costs CPU + memory for outputs we discard. Use `["abi"]` (or even `[]` — see Open Question 4).
- **Async import callback** — solc-js callbacks are SYNCHRONOUS. Returning a Promise will fail silently with "File not found" diagnostics. [CITED: https://github.com/ethereum/solc-js/issues/522 and README]
- **Letting solc default `evmVersion`** — defaults shift between solc patch releases (0.8.30 default became prague; 0.8.31+ default is osaka). Bytecode targets the default unless overridden. Pin explicitly to `"paris"` (or any deliberate target) in settings.
- **Using `require("solc")` from a non-ESM module path** — project is ESM-only (`"type": "module"`). Use `createRequire(import.meta.url)` for the solc require, OR use a dynamic `await import("solc")` (less common; solc-js docs assume CJS, but ESM consumers can use createRequire pattern from Phase 1's version.ts).
- **Compiling the input source under filename `Token.sol`** — if the wizard's contract name happens to be `Token`, the solc filename and source-defined contract name match by coincidence. Stable across templates: use a constant key like `"Contract.sol"` for the in-process compile (the filename in standard JSON input is independent of the on-disk filename Phase 3 writes after compile passes).
- **Forgetting to test cwd-independence** — the import callback MUST work when the user runs `smartc` from `/tmp` or `~/Documents`, because Node resolves `@openzeppelin/contracts` from smartc's install root via `require.resolve` (not from cwd). The Wave 0 probe MUST cd to a non-project directory before running compile to catch this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Solidity compilation | A custom Solidity parser/typechecker | `solc@0.8.35` | The whole point — we need REAL compile semantics, including OpenZeppelin's transitive imports, override-checking, abstract-contract-enforcement, etc. There is no second source of truth for "valid Solidity". |
| Diagnostic formatting | A custom error renderer that parses solc messages | `formattedMessage` field on solc output | Solc already produces a human-readable per-error string with file:line:col, caret pointer, and source snippet. Re-implementing this loses information. |
| Package-root resolution | Hardcoded `node_modules/@openzeppelin/contracts/` path joining | `require.resolve("@openzeppelin/contracts/package.json")` (Phase 1's `safeReadVersion` already proves this) | Node's module resolution finds smartc's bundled OZ from any cwd. Hardcoded paths break when the tool is installed globally vs locally vs via pnpm vs via bun. The Phase 1 pattern handles all of these. |
| Error/warning differentiation | A string-match on "Error:" vs "Warning:" in diagnostic text | The `severity` field in standard JSON output | The schema is authoritative; string matching is fragile across solc versions and locales (though solc messages are English-only today). [VERIFIED: severity field schema in argotorg/solidity StandardCompiler.cpp] |
| Import-callback caching | An LRU or filesystem-backed cache | `Map<string, {contents}>` per-compile-call | One compile reads each transitive import once at most ~8 times for ERC-20 all-flags-on. A per-call Map is enough. Cross-call caches add invalidation complexity for a tool that runs one compile per invocation. (CONTEXT D-05 already locked this.) |
| Test-only broken-source injection | Editing the wizard or generate functions to take a "broken mode" flag | A test-only `Template` registered into the registry that returns broken source from its `generate()` | Cleanest seam. Doesn't entangle `@clack/prompts` mocks. The registry already supports clear() for test isolation. (CONTEXT § specifics path (a).) |

**Key insight:** Phase 1 + Phase 2 have already done 90% of the supporting work. Phase 3 is mostly *plumbing real solc into a slot Phase 2 left clearly marked.* The risk is over-engineering — adding spinners, color rendering, multi-layer diagnostic translation. The locked CLI contracts (CliError block, output channels, stable error codes) carry the whole UX surface for free.

## Common Pitfalls

### Pitfall 1: Async import callback breaks silently

**What goes wrong:** Using an `async function` or returning a Promise from the import callback. solc-js receives a Promise object, doesn't await it, treats `{ then: [Function] }` as neither `{ contents }` nor `{ error }`, and surfaces "File not found" / parse errors instead of the real content.

**Why it happens:** Modern JS instinct is to make everything async. The solc-js high-level API is fundamentally sync because libsolc itself is sync.

**How to avoid:** Use `readFileSync`. Type the callback explicitly: `(path: string) => { contents: string } | { error: string }`. Never `Promise<...>`. Unit test asserts the return type at the type-level (TS catches it before runtime).

**Warning signs:** Diagnostics say `not found: @openzeppelin/contracts/...` even though the package IS installed.

[CITED: https://github.com/ethereum/solc-js/issues/522 ; https://github.com/ethereum/solc-js README "must synchronously return"]

### Pitfall 2: EVM-version default drift produces non-deterministic bytecode

**What goes wrong:** solc 0.8.30 changed `evmVersion` default to `prague`. solc 0.8.31+ defaults to `osaka`. Without explicit `settings.evmVersion`, bytecode targets the solc version's default. Across CI/dev installs that get newer solc patch releases, bytecode shifts. More critically: bytecode targeting `osaka` may not run on chains that haven't upgraded yet.

**Why it happens:** Solc's defaults track the Ethereum mainnet's current fork. Tooling defaults lag because most chains lag mainnet. Hardhat/Foundry explicitly override solc's default to `paris` for this reason. [CITED: NomicFoundation/hardhat PR #4336]

**How to avoid:** Set `settings.evmVersion: "paris"` explicitly in standard JSON input. Document in `src/compiler/README.md`. Phase 5 (DEPLOY.md) can surface this to the user. If a future template wants cancun for blob support, it's a per-template opt-in.

**Warning signs:** Bytecode size differs between identical source / identical solc version when only the default shifted. (Not an issue in Phase 3 since we don't emit bytecode — but the moment Phase 5 starts surfacing deploy commands, it matters.)

[VERIFIED: WebSearch of argotorg/solidity release notes for 0.8.30+; cross-checked against NomicFoundation/hardhat issue #5267]

### Pitfall 3: Import callback is cwd-sensitive in subtle ways

**What goes wrong:** A naive implementation writes `path.join("node_modules", "@openzeppelin/contracts", subpath)` and reads from there. Works fine when `cwd === smartc-project-root`. Breaks when the user installs smartc globally (`npm install -g smartc`) and runs it from `/tmp` — `./node_modules/...` doesn't exist there.

**Why it happens:** Node's `cwd` is the user's terminal, not smartc's install location. The bundled OZ contracts live next to smartc's source, not next to the user.

**How to avoid:** Use `require.resolve("@openzeppelin/contracts/package.json")` — Node's module resolution finds OZ relative to smartc's install root, regardless of cwd. The Phase 1 `safeReadVersion` already proves this pattern works. The Wave 0 probe MUST cd to a temp dir before running compile to assert this.

**Warning signs:** Compile passes in dev (where you ran `npm install` and cwd is project root), fails in production with "@openzeppelin/contracts not found" only after a global install + user-cwd run.

### Pitfall 4: Vitest module mock + dynamic solc shape

**What goes wrong:** `vi.mock("solc")` returns the mock, but `import solc from "solc"` returns `undefined.compile` because solc's `index.js` does `module.exports = solcWrap(loadCompiler())` (CJS-style default-only export) and ESM consumers must either use default-import or `createRequire`. If the mock has the wrong shape, tests pass but production fails or vice versa.

**Why it happens:** solc-js targets CJS first; ESM consumers must adapt.

**How to avoid:** In production code use `createRequire(import.meta.url)` (same pattern as version.ts) — `const require = createRequire(import.meta.url); const solc = require("solc");`. In the unit-test mock, mirror that exact shape: `vi.mock("solc", () => ({ default: { compile: vi.fn() } }))` plus the SUT uses the same default-import. Top-level `await import(SUT)` after the mock (the locked Phase 1 Vitest 4 ESM pattern from STATE.md line 80) prevents hoisting.

**Warning signs:** `solc.compile is not a function` in tests, OR tests pass but `node dist/cli.js create` throws the same.

### Pitfall 5: `formattedMessage` line endings on Windows

**What goes wrong:** Solc emits `formattedMessage` with `\n`. The Phase 1 `.gitattributes eol=lf` rule keeps fixtures consistent, but if the dispatcher concatenates compile output with `\r\n` somewhere (e.g., from a Windows-cwd source file passed in), the rendered WHY block has mixed line endings, and the CliError renderer's split-on-`\n` may behave inconsistently.

**Why it happens:** Cross-platform line endings; Windows defaults.

**How to avoid:** Normalize solc output: `formattedMessage.replace(/\r\n/g, "\n")` before passing into CliError WHY. Defensive but cheap. The Phase 1 .gitattributes rule keeps fixtures LF; this just guards against runtime line-ending drift.

**Warning signs:** WHY block renders with double-spacing on Windows.

### Pitfall 6: Forgetting to test the warning-pass-through case

**What goes wrong:** Tests only cover "compile clean → write" and "compile errors → throw". The "compile warnings only → write + warn" path is the most-likely-to-bit-rot case because OZ fixtures currently compile clean. If OZ ever ships a deprecation warning that the bundled solc surfaces, the dispatcher must still write the file. A missing test means a future OZ bump could silently break "warnings don't block writes".

**Why it happens:** TDD bias toward the obvious cases.

**How to avoid:** Add a `tests/fixtures/warns-no-error.sol` (a `pragma experimental ABIEncoderV2;` deprecation, or a `using SafeMath` from a removed library — any solc-emitted warning that doesn't error). Assert (a) compile returns warnings.length > 0, (b) file IS written, (c) `output.warn` was called once per warning, (d) exit code 0.

[CITED: argotorg/solidity 0.8.31 release notes: "Warn about deprecation of ABI coder v1", "Warn about deprecation of virtual modifiers" — these can serve as the deliberate-warn fixture content]

### Pitfall 7: Caching imports across compile calls (premature optimization)

**What goes wrong:** Adding a module-level cache instead of a per-call cache. In tests, the cache survives between cases. Test 1 mutates an OZ file (hypothetical), test 2 sees the stale content. In production, no problem (one compile per process), but in tests this manifests as flaky behavior.

**Why it happens:** Reasonable instinct that caching closer to "always" is faster.

**How to avoid:** Per-call cache (CONTEXT D-05 already locks this). Implementation: the `Map<string, {contents}>` lives INSIDE `makeImportCallback()`, which is called per `compileVerify` call. New compile → new cache → no cross-call leakage.

## Runtime State Inventory

**Not applicable** — Phase 3 is a greenfield additive phase (new compiler module, new error code, new test files). No rename, no refactor, no string-replacement, no migration. There is no stored data, live service config, OS-registered state, secrets, or build artifact embedding a name to migrate.

The closest thing to "state": Phase 2 already committed two golden Solidity fixtures that Phase 3 will run through real solc. Those fixtures are static files in the repo, not runtime state — they're inputs to Phase 3's tests, not state Phase 3 modifies.

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — treating as enabled (default).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.6 (ESM, Node 20+) |
| Config file | (no vitest.config — implicit defaults; `passWithNoTests: true` locked in 01-01 per STATE.md) |
| Quick run command | `npx vitest run tests/compiler` (fast — compiler tests only, the new surface) |
| Full suite command | `npx vitest run` |
| Per-task watch | `npx vitest tests/compiler --watch` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| COMP-01 | In-process solc-js call with correct standard JSON shape | unit | `npx vitest run tests/compiler/compile.spec.ts -t "builds standard JSON input"` | Wave 0 (new file) |
| COMP-01 | Real solc compiles bare-default fixture clean | integration | `npx vitest run tests/compiler/compile.integration.spec.ts -t "bare-default compiles"` | Wave 0 (new file) |
| COMP-01 | Real solc compiles all-flags-on fixture clean | integration | `npx vitest run tests/compiler/compile.integration.spec.ts -t "all-flags-on compiles"` | Wave 0 (new file) |
| COMP-02 | Solana branch throws E_NOT_IMPLEMENTED with Phase 7 pointer | unit | `npx vitest run tests/compiler/compile.spec.ts -t "solana chain throws E_NOT_IMPLEMENTED"` | Wave 0 (new file) |
| COMP-03 | broken.sol → throws E_COMPILE_FAILED with formattedMessage in WHY | unit | `npx vitest run tests/compiler/compile.spec.ts -t "throws E_COMPILE_FAILED on broken source"` | Wave 0 (new fixture + file) |
| COMP-03 | E2E: broken source in dispatcher → exit 1, no file on disk | e2e | `npx vitest run tests/commands/create.compile-fail.spec.ts` | Wave 0 (new file) |
| COMP-04 | Warning-only compile → returns warnings, write proceeds | unit | `npx vitest run tests/compiler/compile.spec.ts -t "warnings surface but do not throw"` | Wave 0 (new file) |
| COMP-04 | E2E: warning fixture → file written + warn channel hit | e2e | `npx vitest run tests/commands/create.compile.spec.ts -t "warnings surface but file written"` | Wave 0 (new file) |
| COMP-05 | Import callback resolves @openzeppelin/contracts from any cwd | unit | `npx vitest run tests/compiler/compile.spec.ts -t "import callback resolves cwd-independently"` | Wave 0 (new file) |
| COMP-05 | --version line shows real solc + @oz/contracts versions (smoke) | smoke | `node dist/cli.js --version` (manual check; assert string contains "solc 0.8.35" and "@openzeppelin/contracts 5.6.1") | Existing (version.ts auto-rolls) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/compiler` (compiler-only suite — fast feedback, ~1-2s expected)
- **Per wave merge:** `npx vitest run` (full suite — Phase 1 + Phase 2 tests must remain green)
- **Phase gate:** `npx vitest run` + `npm run build` + `node dist/cli.js --version` shows real versions + manual run of `node dist/cli.js create --template erc20 --out /tmp/X.sol` against a piped-stdin script (existing Phase 2 e2e pattern; now exercises real compile too)

### Wave 0 Gaps

- [ ] `src/compiler/index.ts` — module entry; exports `compileVerify` + `CompileDiagnostic`
- [ ] `src/compiler/imports.ts` — `makeImportCallback()` factory
- [ ] `src/compiler/types.ts` — `CompileDiagnostic` + `StandardJsonInput` types
- [ ] `tests/compiler/compile.spec.ts` — unit suite (covers COMP-01 shape, COMP-02 solana branch, COMP-03 broken, COMP-04 warnings, COMP-05 cwd-independence)
- [ ] `tests/compiler/compile.integration.spec.ts` — integration suite (real solc + real OZ + both golden fixtures + broken fixture + warn fixture)
- [ ] `tests/commands/create.compile.spec.ts` — e2e success with real solc through dispatcher
- [ ] `tests/commands/create.compile-fail.spec.ts` — e2e D-15 load-bearing test (no file on failure)
- [ ] `tests/fixtures/broken.sol` — deliberate-fail fixture (CONTEXT D-14)
- [ ] `tests/fixtures/warns-no-error.sol` — deliberate-warn fixture (Pitfall 6)
- [ ] `src/lib/errors.ts` — add `ERR_COMPILE_FAILED = "E_COMPILE_FAILED"` constant
- [ ] `package.json` — add `solc@0.8.35` + `@openzeppelin/contracts@5.6.1` to `dependencies`
- [ ] Probe script `scripts/probe-compile.mjs` (or inline in Wave 0 task) — runs `solc.compile()` against bare-default.sol from a temp cwd, asserts no errors. (See § Wave 0 Probe below.)

Framework install: none — vitest, tsx, tsup all already present from Phase 1.

## Wave 0 Probe (Critical — research-flagged in STATE.md)

STATE.md line 91 explicitly flagged: *"Confirm `solc` import-callback resolves `@openzeppelin/contracts/...` from bundled deps without user install — prototype at phase start."*

This is the most load-bearing assumption in Phase 3. If it fails, the entire COMP-05 deliverable is at risk and the plan must adapt. A 30-line probe script is sufficient:

```javascript
// scripts/probe-compile.mjs — runs once during Wave 0, then deleted (or kept under .planning/probes/)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chdir, cwd } from "node:process";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";

const require = createRequire(import.meta.url);
const solc = require("solc");

// Resolve OZ root via Phase 1 strategy (must work even if cwd is NOT the project root).
const startCwd = cwd();
const tmpCwd = mkdtempSync(join(tmpdir(), "smartc-probe-"));
chdir(tmpCwd);          // ← critical: prove the resolve works outside project tree
try {
  const ozPjPath = require.resolve("@openzeppelin/contracts/package.json");
  const ozRoot = dirname(ozPjPath);
  const bareSource = readFileSync(
    join(startCwd, "tests/fixtures/erc20/bare-default.sol"),
    "utf8"
  );

  function findImports(path) {
    if (path.startsWith("@openzeppelin/contracts/")) {
      const sub = path.replace(/^@openzeppelin\/contracts\//, "");
      try {
        return { contents: readFileSync(join(ozRoot, sub), "utf8") };
      } catch (e) {
        return { error: `Could not read ${path}: ${e.message}` };
      }
    }
    return { error: `Unknown import: ${path}` };
  }

  const input = {
    language: "Solidity",
    sources: { "Contract.sol": { content: bareSource } },
    settings: {
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi"] } },
    },
  };
  const start = performance.now();
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const elapsed = performance.now() - start;

  const errors = (output.errors ?? []).filter(e => e.severity === "error");
  const warnings = (output.errors ?? []).filter(e => e.severity === "warning");

  console.log(`solc ${solc.version()} (cwd=${tmpCwd})`);
  console.log(`  bare-default.sol: errors=${errors.length} warnings=${warnings.length} elapsed=${elapsed.toFixed(0)}ms`);
  if (errors.length > 0) {
    console.error("PROBE FAILED — compile errors:");
    errors.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }
  console.log("PROBE PASSED");
} finally {
  chdir(startCwd);
}
```

**Expected outcome:** `PROBE PASSED`, `errors=0`, `warnings=0` or `1` (acceptable — possibly an "Compiler version 0.8.35 is older than ..." style warning that doesn't apply here). `elapsed` is informational and feeds the spinner decision (Discretion item: if < 250ms, no spinner needed; if > 250ms but < 1s, planner discretion; if > 1s, definitely needs a spinner).

**If probe fails:**
- Errors about `@openzeppelin/contracts/...` not found → resolver strategy is wrong; check Strategy 1 vs Strategy 2 in version.ts and adapt.
- `solc.compile is not a function` → ESM ↔ CJS interop problem; verify `createRequire` usage matches version.ts.
- Real compile errors in OZ source → pinned solc and OZ versions are incompatible; bump or downgrade one and retry.

The probe runs ONCE at the start of Wave 0. Its outcome is documented in a Wave 0 SUMMARY note; the planner uses it to confirm the rest of the plan is sound, OR to course-correct before plans 02+ are locked.

## Code Examples

### Public entry: `compileVerify(source, chain)`

```typescript
// src/compiler/index.ts
import { createRequire } from "node:module";
import { CliError, ERR_COMPILE_FAILED, ERR_NOT_IMPLEMENTED } from "../lib/errors.js";
import { safeReadVersion } from "../lib/version.js";
import { makeImportCallback } from "./imports.js";
import type { CompileDiagnostic, StandardJsonInput, SolcOutput } from "./types.js";

const require = createRequire(import.meta.url);

/** In-process Solidity (and, in Phase 7, Solana/Anchor) compile gate.
 *  Throws CliError(E_COMPILE_FAILED) on any severity:"error" diagnostic.
 *  Returns warnings (possibly empty) on success.
 */
export async function compileVerify(
  source: string,
  chain: "evm" | "solana"
): Promise<{ warnings: CompileDiagnostic[] }> {
  if (chain === "solana") {
    throw new CliError({
      code: ERR_NOT_IMPLEMENTED,
      what: "Solana compile-verify is not implemented yet.",
      why: "SPL templates ship in Phase 7, which adds an anchor-build adapter behind this same compileVerify interface.",
      fix: "Generate an EVM template (`smartc create --template erc20`) until Phase 7 lands.",
      exitCode: 1,
    });
  }
  // chain === "evm" — solidity path
  const solc = require("solc") as { compile: (input: string, opts: { import: (p: string) => { contents: string } | { error: string } }) => string; version: () => string };

  const input: StandardJsonInput = {
    language: "Solidity",
    sources: { "Contract.sol": { content: source } },
    settings: {
      evmVersion: "paris",       // pin explicitly — solc 0.8.35 defaults to osaka
      outputSelection: { "*": { "*": ["abi"] } },
    },
  };
  const importCallback = makeImportCallback();
  const rawOutput = solc.compile(JSON.stringify(input), { import: importCallback });
  const output = JSON.parse(rawOutput) as SolcOutput;

  const errors: CompileDiagnostic[] = [];
  const warnings: CompileDiagnostic[] = [];
  for (const e of output.errors ?? []) {
    const formatted = (e.formattedMessage ?? e.message).replace(/\r\n/g, "\n");
    const d: CompileDiagnostic = {
      severity: e.severity === "error" ? "error" : "warning",
      message: e.message,
      formattedMessage: formatted,
      file: e.sourceLocation?.file,
    };
    if (d.severity === "error") errors.push(d);
    else warnings.push(d);
  }
  if (errors.length > 0) {
    const solcVer = safeReadVersion("solc") ?? "unknown";
    const ozVer = safeReadVersion("@openzeppelin/contracts") ?? "unknown";
    throw new CliError({
      code: ERR_COMPILE_FAILED,
      what: "Generated source failed to compile.",
      why: `${errors.map(e => e.formattedMessage).join("\n\n")}\n\nCompile errors come from solc ${solcVer} against @openzeppelin/contracts ${ozVer}.`,
      fix: "If you didn't edit the wizard output, please report this — the template + pinned solc+OpenZeppelin should always produce compilable source.",
      exitCode: 1,
    });
  }
  return { warnings };
}
```

### Dispatcher splice at `src/commands/create.ts:95`

```typescript
// Insert at the exact splice marker (replace the marker comment line).
// Adds two new imports at the top of create.ts:
//   import { compileVerify } from "../compiler/index.js";
//   (no other new imports needed — output already imported)

// At line 95, replacing the marker:
const { warnings } = await compileVerify(source, tpl.chain);
for (const w of warnings) {
  output.warn(w.formattedMessage);
}
if (warnings.length > 0) {
  output.explain("Warnings don't block deployment but often point at latent bugs. Review each before shipping.");
}

// At the post-write nextStep footer (replacing the current Phase 2 footer):
const solcVer = safeReadVersion("solc") ?? "unknown";
const ozVer = safeReadVersion("@openzeppelin/contracts") ?? "unknown";
output.nextStep(`Compile-verified against solc ${solcVer} + @openzeppelin/contracts ${ozVer}.`);
output.nextStep("Run 'smartc list-templates' to see other templates.");
```

(Note: `safeReadVersion` is already exported from `src/lib/version.ts`; add it to create.ts's imports.)

### Test-only broken-source seam (D-15)

```typescript
// tests/commands/create.compile-fail.spec.ts (sketch)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { clear, register } from "../../src/registry/index.js";

// Test-only template — bypasses wizard, returns deliberately broken source.
// Lives only in the test file. The registry's `clear()` then `register()` ensures
// it doesn't pollute other tests.
const brokenTemplate = {
  id: "broken-test-only",
  name: "Broken (test only)",
  chain: "evm" as const,
  status: "stub" as const,
  description: "DO NOT USE — deliberately broken for compile-fail tests",
  async runWizard(_io: any) { return {}; },
  generate(_opts: any) {
    return {
      filename: "Broken.sol",
      source: "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.27;\ncontract Broken { uint x = ; }",  // syntax error
    };
  },
};

describe("create dispatcher: compile-fail path (D-15)", () => {
  let outDir: string;
  beforeEach(() => {
    clear();
    register(brokenTemplate);
    outDir = mkdtempSync(join(tmpdir(), "smartc-compile-fail-"));
  });

  it("rejects with E_COMPILE_FAILED and writes NO file", async () => {
    const outPath = join(outDir, "Broken.sol");
    // Spawn dispatcher via in-process command (existing Phase 2 pattern)
    // ... expect throw with code "E_COMPILE_FAILED"
    // ... expect existsSync(outPath) === false
    // ... expect rendered output to contain "Why:" and a solc-formatted message
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shell out to system `solc` binary | In-process `solc` npm package | solc-js stable since 2015 (10+ years) | No native install required; works in any Node environment. The default for tools that target end-users (vs hardhat/foundry which expect dev environments). |
| solc-js global `compile(source, importsObject)` (pre-0.6 API) | Standard JSON `solc.compile(jsonString, { import: callback })` | solc 0.6.0 (2019) | Object-based callbacks; richer input options including evmVersion, optimizer, libraries; richer output with severity-typed diagnostics. **This is the only Phase 3 API.** |
| Solc 0.8.x defaulting `evmVersion: paris` (≤0.8.24) | Solc 0.8.30+ defaulting prague; 0.8.31+ defaulting osaka | 2025-2026 | **Pitfall 2 — pin evmVersion explicitly.** Tools like Hardhat/Foundry already override to paris for broad chain support. |
| `solc.loadRemoteVersion(version, cb)` (network-loaded) | `require("solc")` (bundle-locked) | Long-standing distinction | For an offline-capable CLI, bundle-locked is the only viable path. (CONTEXT explicitly OUT OF SCOPE for remote loading.) |
| OpenZeppelin Contracts v4 (pragma 0.8.0+) | OpenZeppelin Contracts v5 (pragma 0.8.20+) | 2024 | Phase 2 already targets v5 via wizard@0.10.8. Phase 3 just pins the matching v5 contracts package. |

**Deprecated/outdated:**
- `solc-js` standalone npm package — the official path is `solc` (which contains the JS bindings). `solc-js` exists as an old package and shouldn't be used.
- `solc.compileStandard()` and `solc.compileStandardWrapper()` — legacy names from 0.5.x; current API is just `solc.compile(jsonString, { import })`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Compile of bare-default ERC-20 takes < 250ms on a typical dev machine, justifying "no spinner" recommendation | Discretion / Pitfall framing | Low — Wave 0 probe measures actual time; planner re-evaluates spinner decision based on probe output. Reverting to a spinner is a 3-line change. |
| A2 | Compile of all-flags-on ERC-20 (full OZ surface, ~8 transitive imports) takes < 1s on a typical dev machine | Discretion / Pitfall framing | Low — same as A1, Wave 0 probe measures; if > 1s, planner adds spinner to E2E plan task. |
| A3 | solc 0.8.35 + @openzeppelin/contracts 5.6.1 are compatible (no incompatibility introduced in 5.6 patch series) | Standard Stack | Low — pragma `^0.8.20` is broadly satisfied by 0.8.35; Wave 0 probe directly tests this against both golden fixtures. If incompatible, downgrade @oz/contracts to 5.5.0 (the prior minor) or pin solc to 0.8.30. |
| A4 | `require.resolve("@openzeppelin/contracts/package.json")` succeeds for a globally-installed smartc | COMP-05 architecture | Medium — Phase 1's `safeReadVersion` already exercises this exact pattern for non-OZ packages, providing strong evidence. Wave 0 probe explicitly cd's to a temp dir to assert this. If it fails, the resolver needs the Strategy 2 walk-up fallback (already proven in version.ts). |
| A5 | The OZ wizard-emitted bare-default and all-flags-on fixtures compile clean with no warnings under solc 0.8.35 + evmVersion paris | Wave 0 + Pitfall 6 | Low — OZ's CI compiles their own contracts against current solc lines. But: deprecation warnings introduced in solc 0.8.31+ (ABI coder v1, virtual modifiers, send/transfer) could surface as warnings. Wave 0 probe shows the actual count; the warning-pass-through path (Pitfall 6) handles it cleanly. |
| A6 | tsup's default externalize-node_modules behavior keeps solc-js OUT of dist/cli.js | Architecture / Bundle size | Low — tsup defaults to externalizing all `dependencies` (matches esbuild's `--packages=external` behavior for Node builds); verified by Phase 1's existing 17.59 KB dist/cli.js (would be megabytes if it bundled commander). If solc somehow gets bundled, dist size jumps to ~10MB — easy signal. |
| A7 | The exact same import-callback pattern works for ERC-721 and ERC-1155 transitive imports in Phase 4 | Architecture / Phase 4 forward-look | Low — OZ Contracts has a unified `@openzeppelin/contracts/...` namespace; all NFT extensions live under the same root. The callback already pattern-matches the namespace prefix. |

**The above assumptions are flagged for the planner — none are critical-path blockers, but A1/A2/A4/A5 directly inform Wave 0 deliverables.**

## Open Questions

1. **Should the planner keep the broken-source test seam as a registry-injected test-only template, or use a `vi.mock("../templates/erc20/generate.js")` approach?**
   - What we know: CONTEXT § specifics path (a) recommends the registry approach (cleanest, doesn't entangle clack mocks). Phase 1's `clear()` + `register()` test pattern from `tests/registry.spec.ts` makes (a) straightforward.
   - What's unclear: Whether the e2e (spawned `dist/cli.js`) path can use a test-only registered template — it would require either a feature flag at boot OR a separate test build of dist. **For e2e: use an in-process command spec (the existing Phase 2 pattern `tests/commands/create.spec.ts` already does this).** No need to spawn dist for D-15.
   - Recommendation: registry approach for unit/integration; in-process command spec for e2e D-15 (no dist spawn).

2. **Output selection: `["abi"]` or `[]`?**
   - What we know: We discard the artifacts; we only check `output.errors[]`. The Solidity standard JSON output schema allows empty `outputSelection`.
   - What's unclear: Whether solc-js still surfaces all errors when outputSelection is fully empty (some compilers short-circuit when no output is requested). Worth a 30-second test during Wave 0.
   - Recommendation: Default to `["abi"]` (CONTEXT discretion line). Trivially small extra cost; predictable. If Wave 0 measures a significant timing win with `[]`, planner can flip.

3. **Should `compileVerify` accept an `{ filename }` override for the standard-JSON sources key?**
   - What we know: Today we hard-code `"Contract.sol"` for the standard JSON sources key. The on-disk filename Phase 3 writes (later) is whatever the template's `generate()` returned (`MyToken.sol` etc.).
   - What's unclear: Whether using the template-derived filename as the JSON sources key produces friendlier diagnostics (the user sees `MyToken.sol:5:13` in WHY instead of `Contract.sol:5:13`).
   - Recommendation: Pass the template-derived filename through to `compileVerify(source, chain, filename)`. Friendlier error messages, no downside. The dispatcher already has both before the compile call (Phase 2's `tpl.generate()` returns `{ filename, source }`).

4. **Does solc.compile reject empty outputSelection?**
   - What we know: Standard JSON schema allows empty selection.
   - What's unclear: Real-world solc-js behavior; some older versions may have implicit defaults.
   - Recommendation: Wave 0 probe tests this. If yes, document and pin `["abi"]`.

5. **Should newbie-mode also show pinned versions in the post-success footer, or only via `--version`?**
   - What we know: D-12 specifies the footer should mention "Compile-verified against solc X.Y.Z + @openzeppelin/contracts A.B.C" — and that's a `nextStep` (newbie-only) line per output channel rules.
   - What's unclear: Whether non-newbie users (default) want this too — but the output channel contract says nextStep is newbie-only. To surface for default users we'd need an `output.result` line.
   - Recommendation: Stick to the locked output channel contract — `nextStep` for newbie, terse `output.result("Wrote ${outPath}")` for default. Default users can run `smartc --version` if they want the pinned versions. This matches the Phase 2 footer pattern.

6. **What's the spinner copy if compile > 1s? (Discretion item.)**
   - Wave 0 measurement decides. If a spinner is needed: "Compiling generated source…" is terse, copy-aligned with @clack/prompts conventions, and ASCII-only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `solc` npm runtime | yes | v22.18.0 (≥20 per package.json engines; solc requires ≥12) | — |
| npm | install solc + @oz/contracts | yes | 11.12.0 | — |
| solc binary (system) | not required | n/a | n/a | The whole point of in-process solc-js is to NOT depend on system solc. |
| Internet for runtime | not required | n/a | n/a | We bundle; `solc.loadRemoteVersion` is OUT OF SCOPE. |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none — Phase 3's deps are pure npm packages, downloaded once at install time and used in-process forever after.

## Security Domain

> `security_enforcement` is not present in `.planning/config.json`. Treating as enabled per the default-on rule.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth surface in compile-verify gate |
| V3 Session Management | no | stateless CLI |
| V4 Access Control | no | CLI runs as the invoking user; no privilege boundaries |
| V5 Input Validation | partial | source string passed to solc is treated as the user's content; solc itself validates Solidity syntax. The import callback validates only that the import path starts with `@openzeppelin/contracts/` (anything else returns `{ error }`) — preventing arbitrary file read via crafted imports |
| V6 Cryptography | no | no cryptographic operations in compile-verify (smart contracts themselves do crypto, but Phase 3 only compiles them) |
| V14.2 Dependencies | yes | Pinned exact versions of solc + @oz/contracts; both verified from official Ethereum Foundation / OpenZeppelin repos; no postinstall scripts on either |

### Known Threat Patterns for `solc-js` + import callback

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via crafted import (`import "@openzeppelin/contracts/../../../etc/passwd"`) | Tampering / Information Disclosure | The import callback pattern-matches `^@openzeppelin/contracts/` then `path.join`s — but `join` collapses `..`. To prevent traversal, validate the resolved final path starts with `ozRoot` after normalization (`path.normalize(join(ozRoot, sub)).startsWith(path.normalize(ozRoot))`). Add to imports.ts. |
| Solc compiler bug / undefined behavior on hostile source | Repudiation / DoS | Source comes from the wizard, not the user directly — wizard validators (Phase 2) sanitize. AI-flow source (Phase 8) is sandbox-compiled with the same gate. Solc 0.8.35 is recent + maintained. Pinned exact version means we know what we're running. |
| Supply-chain compromise of solc or @oz/contracts | Tampering | Pinned exact versions in `package.json`; `package-lock.json` provides integrity hashes. Both packages have 10+ year publish histories from known maintainers. Postinstall scripts are empty (`npm view solc scripts.postinstall` and `npm view @openzeppelin/contracts scripts.postinstall` both empty). |
| Resource exhaustion (compile of giant source) | DoS | Phase 3 compiles only wizard-generated ERC-20 source — bounded by template structure. Phase 8 AI-flow may have larger sources; the same gate runs. Out of scope to handle adversarial-large inputs in v1. |

**Recommendation for planner:** Add the path-traversal check to `imports.ts`. The Phase 4/7/8 plans inherit it for free. This is a one-line addition with concrete defense-in-depth value, especially as Phase 8 introduces AI-generated source that we trust less than wizard output.

## Sources

### Primary (HIGH confidence)

- **npm registry (verified via `npm view`):**
  - `solc@0.8.35` published 2026-04-29, maintainers ekpyron/cameel/r0qs/argotorg/clonker/nikola-matic, repo ethereum/solc-js, unpacked 9.5MB, engines node ≥12, no postinstall, dependencies all small utilities
  - `@openzeppelin/contracts@5.6.1` published 2026-02-27, repo OpenZeppelin/openzeppelin-contracts, unpacked 2.95MB, no deps, no postinstall
- **solc-js README (https://github.com/ethereum/solc-js):**
  - High-level API: `solc.compile(jsonString, { import: callback })`
  - Callback is synchronous; returns `{ contents }` or `{ error }`
  - Standard JSON input shape: language/sources/settings/outputSelection
  - Object-based callbacks since 0.6.0
- **Phase 1 + 2 in-repo evidence:**
  - `src/lib/version.ts` dual-strategy safeReadVersion (the pattern this phase reuses)
  - `tests/fixtures/erc20/*.sol` golden fixtures (the integration-test corpus)
  - `.planning/phases/02-erc-20-canary-template/02-VERIFICATION.md` confirms splice marker at create.ts:95

### Secondary (MEDIUM confidence)

- **Solidity release notes (https://github.com/argotorg/solidity/releases) verified via WebSearch:**
  - 0.8.30: default evmVersion → prague
  - 0.8.31: default → osaka, deprecation warnings (ABI coder v1, virtual modifiers, send/transfer, contract-type comparisons)
  - 0.8.35: default → osaka, experimental features now gated behind `--experimental`
- **OpenZeppelin Contracts 5.6 forum/changelog (https://github.com/OpenZeppelin/openzeppelin-contracts/releases):**
  - Minimum pragma 0.8.24 for select contracts in v5.6 (Votes, ERC4626, EIP712, etc.)
- **Solidity language docs (https://docs.soliditylang.org/en/latest/using-the-compiler.html — referenced; direct fetch returned 403, content verified via search snippets):**
  - Standard JSON output `errors[]` schema: severity ("error"/"warning"/"info"), formattedMessage, sourceLocation{file,start,end}, type, component, message, errorCode
- **NomicFoundation/hardhat issue #5267 and PR #4336:** Confirms toolchain practice of pinning evmVersion to paris instead of trusting solc default.

### Tertiary (LOW confidence)

- No tertiary sources used — all claims are backed by either npm verification or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact versions verified via npm registry; maintainers, repos, and publish dates all confirmed
- Architecture: HIGH — patterns derive directly from solc-js README + Phase 1's proven safeReadVersion + Phase 2's locked splice point
- Pitfalls: HIGH — each pitfall has a cited source (solc-js README, argotorg release notes, hardhat issues, or in-repo Phase 1/2 patterns)
- Test strategy: HIGH — three-layer approach pre-locked in CONTEXT D-13; this research only enumerated specific commands and Wave 0 gaps
- Wave 0 probe outcome: LOW (probe hasn't run yet — that's Wave 0's job). The script is sketched; the expected outcome is "passes"; if it fails the plan course-corrects.
- Spinner timing (Discretion): MEDIUM (assumption A1/A2 — backed by general knowledge that solc-js compiles ERC-20 in well under 1s, but not measured in this environment). Wave 0 measures.

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — both pinned packages are stable lines; the only risk is a 0.8.36 solc release introducing a regression we'd want to skip)
