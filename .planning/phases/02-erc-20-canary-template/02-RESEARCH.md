# Phase 2: ERC-20 Canary Template - Research

**Researched:** 2026-05-20
**Domain:** OpenZeppelin Wizard SDK integration, interactive @clack/prompts wizard, ESM/CJS interop, golden-snapshot test strategy
**Confidence:** HIGH

## Summary

`@openzeppelin/wizard` 0.10.8 (latest, published 2026-04-08) ships a stable, well-documented programmatic API: `erc20.print(opts)` returns a Solidity source string, `erc20.defaults` provides the default option object, and `erc20.isAccessControlRequired(opts)` predicts whether access control will be enabled. All eight contract wizards (erc20, erc721, erc1155, stablecoin, realWorldAsset, account, governor, custom) share the same shape. The package is CJS-only (no `type: module`, no `exports` map) — under our NodeNext ESM project the named import `import { erc20 } from '@openzeppelin/wizard'` works because Node's cjs-module-lexer detects exported names, but the **defensive pattern** is the default-import-then-destructure form so we never depend on lexer detection.

`@openzeppelin/wizard@0.10.8` emits Solidity 0.8.27 source with SPDX-MIT, an `// Compatible with OpenZeppelin Contracts ^5.6.0` comment, and — critically — `ERC20Permit` is enabled by default (`permit: true`). This is OpenZeppelin Wizard's convention and the wizard.openzeppelin.com web UI behaves identically; turning it off would diverge byte-for-byte. The license is **AGPL-3.0-only**, which is fine to consume as a library at code-generation time (no derived work obligation flows to the generated `.sol` files, which carry their own SPDX) but should be acknowledged in a Phase 9 README / NOTICE.

The wizard's `premint` option is a human-readable decimal string (e.g., `"1000000"` or `"1.5"`) and the wizard emits `_mint(recipient, premint * 10 ** decimals())` — we accept what the user types verbatim and the contract handles scaling at runtime. The contract constructor takes per-role address arguments (e.g., `address recipient`, `address defaultAdmin`, `address pauser`, `address minter`) but those are deploy-time concerns — not Phase 2's problem. Phase 5 (DEPLOY.md) and the deployer's wallet pick those at deploy time.

**Primary recommendation:** Install `@openzeppelin/wizard@0.10.8` exact-pinned (no caret), build a thin `Erc20Template` plugin that wraps `erc20.print()`, drive the wizard via @clack/prompts using a sequential prompt flow with validators (Solidity-identifier name, ASCII-uppercase 1-11 symbol, decimal-string premint), derive filename via Solidity-identifier-slug, and lock outputs with two committed `toMatchFileSnapshot` fixtures plus per-flag `toContain` assertions. The dispatcher seam is one line of code Phase 3 will splice between `template.generate(opts)` and `confirmOverwrite → writeFile`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use `@openzeppelin/wizard` directly — thin wrapper around `erc20.print(opts)`. OpenZeppelin owns the generator + contract evolution; SmartC owns the wizard UI, plugin contract, and (later) DEPLOY.md. Literal satisfaction of ROADMAP SC-4.
- **D-02:** No string templating with sentinels, ever. Any project-specific content around OZ output (headers, banners) is a post-process on the *complete* string, not interpolation into a template body. Applies to all future template plugins.
- **D-03:** Two-step `Template` interface — `runWizard(io)` → `generate(opts)`. The locked Phase 1 five-field shape (`id`, `name`, `chain`, `status`, `description`) is preserved; Phase 2 *adds* two optional method fields. Dispatcher in `src/commands/create.ts` orchestrates: wizard → (Phase 3 splices compile-verify here) → write. Seam exists explicitly so Phase 3 can insert the compile gate without changing the plugin contract.
- **D-04:** `generate()` returns `{ filename, source }`, not raw string. Filename derivation lives in the template (per-template conventions: `.sol` for EVM, `.rs` for SPL). Dispatcher only knows `--out <path>` overrides the suggested filename.
- **D-05:** Template plugin is typed-per-template, not generic-with-schema. Each template owns its `Opts` type. `Template<TOpts>` is generic but `registry.get(id)` returns `Template<unknown>`. Dispatcher accepts the opacity; templates round-trip their own opts between `runWizard` and `generate`. No runtime opts schema in Phase 2.
- **D-06:** No third `validate(opts)` method. Wizard-time validators (in @clack/prompts callbacks) cover input shape. Phase 3 owns real validation (compile-verify).
- **D-07:** `@openzeppelin/wizard` installs in Phase 2; `@openzeppelin/contracts` waits for Phase 3. Phase 2 emits `.sol` files referencing `@openzeppelin/contracts/...` imports, but those imports won't resolve until Phase 3 installs the pinned version. File lands on disk — it just isn't compilable through SmartC's bundled toolchain until Phase 3.
- **D-08:** `formatVersionLine` unchanged in Phase 2 (default). Planner may decide to surface `@openzeppelin/wizard` version.
- **D-09:** Hybrid golden-snapshot + per-flag assertion. Two committed snapshots: (a) bare-default ERC-20 (`name`/`symbol`/`supply`, no flags); (b) all-flags-on canonical (`mintable + burnable + pausable + access:roles`). Plus per-flag assertions: `expect(source).toContain("ERC20Burnable")` when burnable=true; etc.
- **D-10:** No exhaustive option-combinatorial snapshots. Two snapshots + per-flag axis coverage is sufficient.

### Claude's Discretion

- **Wizard flow & validation** — Question order, prompt styles (@clack/prompts `text` / `select` / `confirm` / `multiselect`), validator rules for Solidity identifier safety on `name`, validator for ASCII-only `symbol`, validator for `initialSupply` as a non-negative decimal-string. Standard: sequential single-question prompts in natural reading order (name → symbol → initial supply → mintable → burnable → pausable → access-control if any of mintable/pausable). Researcher/planner picks the exact validator regexes.
- **Generated file conventions** — Whatever `@openzeppelin/wizard` emits (SPDX, pragma version, contract name normalization, decimals, initial-supply scaling). No second-guessing OZ in Phase 2. Optional SmartC-attribution header goes *above* the SPDX line; default is no header so output matches wizard.openzeppelin.com byte-for-byte.
- **Canary stub fate** — `foundation-smoke (stub)` is retired the moment ERC-20 registers. `src/cli.ts` registers ERC-20 *instead of* calling `registerStubTemplates()` — drop the import.
- **Default output filename** — Derive from contract name via a Solidity-identifier slug. `My Token` → `MyToken.sol`; `LongName` → `LongName.sol`. Lives in the template (per D-04). If `--out` is given, it wins.
- **Newbie-mode content for ERC-20 wizard** — Planner picks actual `explain` / `reference` / `nextStep` copy. Required content (non-negotiable per Phase 1 newbie-mode contract): centralization warning when Mintable+Ownable is selected (fires even outside newbie mode — uses `output.warn`); reference to EIP-20 spec; pointer to OpenZeppelin's ERC20 docs; post-generation `nextStep` directing the user toward `smartc list-templates` and the (future) compile-verify gate.

### Deferred Ideas (OUT OF SCOPE)

- Flag-driven non-interactive ERC-20 generation (`smartc create --template erc20 --name MyToken --symbol MTK --supply 1000000 --mintable --access roles`). Capture for future "CLI ergonomics" iteration (Phase 9 or v2).
- SmartC-attribution header in generated files (`// Generated by SmartC vX.Y.Z` above SPDX). Diverges from OZ Wizard byte-for-byte; Phase 5 DEPLOY.md is a more honest attribution surface.
- Pre-deploy safety checklist surfacing during wizard. Phase 5 DEPLOY.md concern (DEPLOY-08).
- Versioned snapshot fixture naming for @openzeppelin/wizard major bumps. Not a Phase 2 deliverable.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERC20-01 | User can generate an ERC-20 with configurable name, symbol, and initial supply | `erc20.print({ name, symbol, premint })` directly maps; validators in §Wizard Order |
| ERC20-02 | User can opt in to Mintable | `mintable: boolean` in `ERC20Options` [CITED: contracts-wizard/packages/core/solidity/src/erc20.ts] |
| ERC20-03 | User can opt in to Burnable | `burnable: boolean` in `ERC20Options` |
| ERC20-04 | User can opt in to Pausable | `pausable: boolean` in `ERC20Options` |
| ERC20-05 | When Mintable or Pausable is selected, user picks Ownable or AccessControl | `access: 'ownable' \| 'roles' \| 'managed' \| false` from `CommonOptions` (we surface only `'ownable'` and `'roles'` per requirement); `isAccessControlRequired(opts)` returns true when mintable or pausable is set |

## Project Constraints (from CLAUDE.md)

- **Push after each phase completes** — Run `git push` to publish the phase's commits to `origin` after the phase is marked complete in ROADMAP.md / STATE.md. Trigger is phase completion, not intermediate commits. Planner does NOT add a push task per plan; it's a phase-finalization step the orchestrator handles after `/gsd:execute-phase`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template definition (id, name, chain, status, description, runWizard, generate) | Template plugin (`src/templates/erc20/`) | Registry (`src/registry/`) — surfaces it via `list()/get()` | Plugin owns its own metadata and methods; registry is a dumb store |
| Interactive prompts (name/symbol/supply/options) | Template plugin (`runWizard()` calls @clack/prompts directly) | `src/lib/output.ts` for newbie channels | Each template owns its prompt sequence (different templates have different option spaces) |
| Solidity source code emission | `@openzeppelin/wizard` (external library, called from `generate()`) | Template plugin (passes opts through, returns `{filename, source}`) | We delegate to OZ — they own the contract code, we own the wizard UI |
| Filename derivation (e.g. `MyToken` → `MyToken.sol`) | Template plugin (`generate()` returns `filename`) | Dispatcher (`--out` override wins) | Per-template convention (D-04); SPL will emit `.rs` later |
| Overwrite confirmation | `src/lib/prompt.ts` (`confirmOverwrite`) called from dispatcher | Template plugin (does not know about overwrite — separation of concerns) | Filesystem concern, not template concern |
| File write | Dispatcher (`src/commands/create.ts` calls `fs.writeFile`) | Template (cannot write — keeps `generate()` pure for Phase 3 compile-verify) | Template returns string; dispatcher commits to disk |
| Error rendering | `src/lib/errors.ts` (`CliError` + `renderError`) called from `src/cli.ts` top-level handler | Template / dispatcher throw `CliError`; never write to stderr themselves | One sanctioned error surface (Phase 1 contract) |
| Wizard cancellation (Ctrl+C) | Template plugin (`runWizard()` detects `isCancel(answer)` and throws `CliError(E_WIZARD_CANCEL)`) | Dispatcher (lets it bubble) | Each prompt is the only thing that knows it was cancelled |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@openzeppelin/wizard` | 0.10.8 (latest, published 2026-04-08) [VERIFIED: npm view @openzeppelin/wizard] | Programmatic API: `erc20.print(opts) → string`, `erc20.defaults`, `erc20.isAccessControlRequired(opts)` | Same engine that powers wizard.openzeppelin.com; literal satisfaction of ROADMAP SC-4; D-01 |

### Supporting (already installed in Phase 1)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@clack/prompts` | ^0.11.0 (we are on 0.11; latest is 1.4.0 — see Open Question Q1) [VERIFIED: package.json + npm view] | Drives the interactive wizard (`text`, `select`, `multiselect`, `confirm`, `isCancel`, `cancel`) | Per-prompt in `template.runWizard()` |
| `commander` | ^14.0.3 | Already wired in Phase 1; `--template` and `--out` options on `create` are locked | No new commander work in Phase 2 |
| `picocolors` | ^1.1.1 | Already wired; powers `makeColor()` and `output.*` | Used transitively via `output` instance |
| `vitest` | ^4.1.6 | Already wired; `toMatchFileSnapshot()` is the locked snapshot mechanism (D-09) | New unit specs in `tests/templates/erc20/`, new e2e case in `tests/cli.spec.ts` |

### Dependencies of `@openzeppelin/wizard`
| Dep | Version | Notes |
|-----|---------|-------|
| `ethereum-cryptography` | ^3.2.0 | Sole runtime dep [VERIFIED: npm view]. Mature, well-known package from `github.com/ethereum/js-ethereum-cryptography` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@openzeppelin/wizard` | Hand-rolled template strings | Would violate D-02 (no sentinels) and ROADMAP SC-4 ("matches OpenZeppelin Wizard output conventions"); would require us to track every OZ contract version manually |
| `@openzeppelin/wizard` | `wizard.openzeppelin.com` HTTP API | Adds a network dep at codegen time, breaks offline use, no version pinning, breaks the "self-contained generator" framing |
| `toMatchFileSnapshot()` (D-09 default) | `toMatchSnapshot()` (inline `.snap` blob) | `.snap` blobs are escaped, less readable, no `.sol` syntax highlight in editor; `toMatchFileSnapshot` writes a real `.sol` file you can open |
| `toMatchFileSnapshot()` | `expect(source).toBe(readFileSync(fixture, "utf8"))` | Manual approach works but loses Vitest's update-on-diff workflow (`vitest -u`); slightly worse DX |

**Installation:**
```bash
npm install @openzeppelin/wizard@0.10.8
```

Use an **exact** version pin (no caret). The wizard's output is the locked artifact (D-09 snapshots); a minor version bump shipping cosmetic-only template changes would still break our snapshot tests and demand a deliberate snapshot-regeneration commit. Pinning makes that explicit.

**Version verification:**
```bash
npm view @openzeppelin/wizard version          # 0.10.8 (2026-04-08)
npm view @openzeppelin/wizard main             # dist/index.js (CJS)
npm view @openzeppelin/wizard dependencies     # only ethereum-cryptography ^3.2.0
npm view @openzeppelin/wizard scripts.postinstall   # (empty — no postinstall risk)
```

## Package Legitimacy Audit

slopcheck was unavailable in this environment (no `pip` on PATH). Each package was therefore verified manually via the npm registry, ecosystem repo, and download/age signals. The `[ASSUMED]` tag is **not** applied because each package was independently discovered via the OpenZeppelin official README / npm registry rather than from training-only knowledge.

| Package | Registry | Age | Downloads | Source Repo | Manual check | Disposition |
|---------|----------|-----|-----------|-------------|--------------|-------------|
| `@openzeppelin/wizard` | npm | 3.9 yrs (since 2022-06-15); v0.10.8 published 2026-04-08 [VERIFIED: npm view time] | High (powers wizard.openzeppelin.com) | github.com/OpenZeppelin/contracts-wizard (official OZ org) [VERIFIED: npm view repository.url] | No postinstall scripts; sole dep is `ethereum-cryptography` (well-known ETH foundation package); 14 official OZ maintainers; AGPL-3.0-only license | **Approved** |
| `ethereum-cryptography` | npm (transitive) | Long-standing | High | github.com/ethereum/js-ethereum-cryptography [VERIFIED: npm view homepage] | Transitive only; ethers/web3.js use it | **Approved (transitive)** |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**License note:** `@openzeppelin/wizard` is **AGPL-3.0-only**. Using it as a library at codegen time does not impose AGPL obligations on the *generated* `.sol` files (each generated file carries its own SPDX header, default `MIT`). However, distributing the SmartC binary itself with `@openzeppelin/wizard` bundled means SmartC's distribution must comply with AGPL — primarily the source-code-availability requirement. SmartC is open-source via the planned Phase 9 public GitHub repo, so this is naturally satisfied. **Action for Phase 9 planner:** add a NOTICE / THIRD_PARTY_LICENSES section to README that names `@openzeppelin/wizard` and its license.

## Architecture Patterns

### System Architecture Diagram

```
                            ┌──────────────────────────────┐
                            │   user types: smartc create  │
                            │   [--template erc20] [--out] │
                            └──────────────┬───────────────┘
                                           │
                                           ▼
                            ┌──────────────────────────────┐
                            │ src/cli.ts                   │
                            │   registerErc20Template()    │
                            │   buildProgram()             │
                            │   parseAsync(argv)           │
                            └──────────────┬───────────────┘
                                           │
                                           ▼
                            ┌──────────────────────────────┐
                            │ src/commands/create.ts       │
                            │ .action() dispatcher         │
                            └──────────────┬───────────────┘
                                           │
                  ┌────────────────────────┼────────────────────────┐
                  │                        │                        │
                  ▼                        ▼                        ▼
        ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
        │ resolve template │    │ build Output     │    │ build color      │
        │ from registry.get│    │ (newbie/json)    │    │ (no-color flag)  │
        │ (--template id   │    └────────┬─────────┘    └──────────────────┘
        │  or interactive  │             │
        │  picker)         │             │
        └────────┬─────────┘             │
                 │                       │
                 ▼                       ▼
        ┌─────────────────────────────────────────┐
        │ template.runWizard(io)                  │
        │   → @clack/prompts: text, select,       │
        │     multiselect, confirm                │
        │   → output.explain/.reference (newbie)  │
        │   → output.warn (centralization!)       │
        │   → throws CliError(E_WIZARD_CANCEL)    │
        │     on isCancel(answer)                 │
        │ returns: opts: unknown                  │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ template.generate(opts)                 │
        │   → erc20.print(mapToErc20Options(opts))│
        │   → derive filename via Solidity slug   │
        │ returns: { filename, source }           │
        └─────────────────┬───────────────────────┘
                          │
        ◄─── Phase 3 splices compile-verify HERE ───►
        (in-process solc against bundled @openzeppelin/contracts;
         throws CliError(E_COMPILE_FAIL) before any disk write)
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ resolve output path:                    │
        │   --out wins; else <cwd>/<filename>     │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ confirmOverwrite(outPath, {force})      │
        │   → if exists & !force: prompt          │
        │   → throws CliError(E_FILE_EXISTS) on no│
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ fs.writeFile(outPath, source, "utf8")   │
        └─────────────────┬───────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ output.result(`Wrote ${outPath}`)       │
        │ output.nextStep("smartc list-templates")│
        │ output.nextStep("Phase 3 compile gate") │
        └─────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── cli.ts                    # MODIFIED: drop registerStubTemplates(); call registerErc20Template()
├── program.ts                # UNCHANGED
├── commands/
│   ├── create.ts             # MODIFIED: replace .action() body with the dispatcher above
│   └── list-templates.ts     # UNCHANGED
├── lib/                      # UNCHANGED
├── registry/                 # UNCHANGED (already supports adding optional runWizard/generate)
└── templates/                # NEW
    └── erc20/
        ├── index.ts          # registerErc20Template(): registers Template { ..., runWizard, generate }
        ├── wizard.ts         # runWizard(io): interactive prompts → Erc20Opts
        ├── generate.ts       # generate(opts): erc20.print + filename derivation → { filename, source }
        ├── opts.ts           # Erc20Opts type (our internal shape, NOT erc20.ERC20Options directly)
        ├── filename.ts       # contractNameToSlug(name): "My Token" → "MyToken"
        └── validators.ts     # isSolidityIdentifier, isAsciiSymbol, isNonNegativeDecimal

tests/
├── templates/
│   └── erc20/
│       ├── wizard.spec.ts    # mock @clack/prompts; exercise runWizard branches
│       ├── generate.spec.ts  # golden snapshots (D-09) + per-flag assertions
│       ├── filename.spec.ts  # contractNameToSlug edge cases
│       └── validators.spec.ts# regex / boundary checks
├── fixtures/
│   └── erc20/
│       ├── bare-default.sol  # COMMITTED snapshot (D-09)
│       └── all-flags-on.sol  # COMMITTED snapshot (D-09)
└── cli.spec.ts               # MODIFIED: unskip + fill SC-4 e2e case
```

### Pattern 1: CJS-package-from-NodeNext-ESM defensive import

**What:** `@openzeppelin/wizard@0.10.8` is CJS (`main: dist/index.js`, no `type: module`, no `exports` map). Under our NodeNext + verbatimModuleSyntax + esModuleInterop config, the named-import form *should* work because Node's cjs-module-lexer detects `module.exports.erc20 = ...` at load time. But lexer detection can fail for dynamically-assigned exports.

**When to use:** `src/templates/erc20/generate.ts`.

**Defensive form (recommended):**
```ts
// Source: nodejs.org/api/esm.html#commonjs-namespaces ; works for any CJS package under NodeNext
import wizard from "@openzeppelin/wizard";
const { erc20 } = wizard;
import type { ERC20Options } from "@openzeppelin/wizard";  // types still come from the named export
```

**Naive form (try first, fall back to defensive if it fails):**
```ts
// Works in practice with @openzeppelin/wizard@0.10.8 because cjs-module-lexer detects the exports
import { erc20 } from "@openzeppelin/wizard";
import type { ERC20Options } from "@openzeppelin/wizard";
```

**Verification step the planner MUST schedule:** a Wave 0 spike — install `@openzeppelin/wizard@0.10.8` and run `node --input-type=module -e "import { erc20 } from '@openzeppelin/wizard'; console.log(typeof erc20.print);"`. If it logs `function`, use the naive form. If it throws `SyntaxError: Named export 'erc20' not found`, use the defensive form. This is a 30-second probe that locks the import style for the whole phase.

### Pattern 2: Two-step Template plugin (D-03 seam)

**What:** Template ships `runWizard` (interactive, returns user opts) and `generate` (pure transform, returns `{filename, source}`). Dispatcher orchestrates them with a clean splice point.

**When to use:** `src/templates/erc20/index.ts`, and every future template plugin.

**Example:**
```ts
// Source: CONTEXT.md D-03/D-04 + Phase 1 registry contract
import type { Template } from "../../registry/types.js";
import { register } from "../../registry/index.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import type { Erc20Opts } from "./opts.js";

// Template generic over its own opts type (D-05).
export interface Erc20Template extends Template {
  runWizard(io: WizardIo): Promise<Erc20Opts>;
  generate(opts: Erc20Opts): { filename: string; source: string };
}

export function registerErc20Template(): void {
  const tpl: Erc20Template = {
    id: "erc20",
    name: "ERC-20 Token",
    chain: "evm",
    status: "alpha",  // status:"stable" only after Phase 3 compile-verify proves it
    description: "Fungible token (ERC-20) on EVM chains. Opt-in: Mintable/Burnable/Pausable.",
    runWizard,
    generate,
  };
  register(tpl);  // throws on duplicate id (Phase 1 contract)
}
```

### Pattern 3: Dispatcher delta (`src/commands/create.ts`)

**What:** Replaces the Phase 1 `E_NOT_IMPLEMENTED` throw with the full pipeline. Phase 3 splices compile-verify between `generate` and `confirmOverwrite` with a single new step.

**Pseudocode (Phase 2 form):**
```ts
// Source: CONTEXT.md integration points + Phase 1 SUMMARYs
cmd.action(async () => {
  const globalOpts = cmd.optsWithGlobals() as {
    template?: string; out?: string; newbie?: boolean;
    json?: boolean; force?: boolean; color?: boolean;
  };
  const color = makeColor(globalOpts.color === false);
  const newbie = resolveNewbie({ newbieFlag: globalOpts.newbie });
  const output = makeOutput({ newbie, json: Boolean(globalOpts.json), color });

  // 1. Resolve template — either --template id or interactive picker.
  const tpl = await resolveTemplate(globalOpts.template, output);
  if (!isPlugin(tpl)) {
    throw new CliError({
      code: ERR_USAGE,
      what: `Template '${tpl.id}' is not generatable (status: ${tpl.status}).`,
      why: "This template is registered for discoverability but has no generator wired.",
      fix: "Run 'smartc list-templates' to see generatable templates.",
    });
  }

  // 2. Wizard — runs prompts, returns opts or throws E_WIZARD_CANCEL.
  const opts = await tpl.runWizard({ output });

  // 3. Generate — pure transform, no I/O.
  const { filename, source } = tpl.generate(opts);

  // ◄─── PHASE 3 SPLICE POINT: compileVerify(source, tpl.chain) throws E_COMPILE_FAIL here ─►

  // 4. Resolve output path.
  const outPath = globalOpts.out ?? path.resolve(process.cwd(), filename);

  // 5. Overwrite gate (already exists from Phase 1).
  if (existsSync(outPath)) {
    await confirmOverwrite(outPath, { force: globalOpts.force });
  }

  // 6. Write.
  await writeFile(outPath, source, "utf8");

  // 7. Surface result + newbie next steps.
  output.result(`Wrote ${outPath}`);
  output.nextStep("Run 'smartc list-templates' to see other templates.");
  output.nextStep("Phase 3 will add automatic compile-verify before write.");
});
```

**Phase 3 dispatcher delta (sketched, for seam validation):**
```ts
// Source: D-03 design intent
// 3. Generate.
const { filename, source } = tpl.generate(opts);

// 3.5. NEW IN PHASE 3 — single step inserted, no plugin changes.
const compileResult = await compileVerify({ source, chain: tpl.chain });
if (compileResult.errors.length > 0) {
  throw new CliError({
    code: "E_COMPILE_FAIL",
    what: "Generated source failed to compile.",
    why: compileResult.errors.map(e => e.formatted).join("\n"),
    fix: "Re-run with --newbie for details, or report at the issue tracker.",
  });
}
for (const w of compileResult.warnings) output.warn(w.message);

// 4. Resolve output path. (unchanged)
```

The seam holds. No `Template` interface change required. ✓

### Anti-Patterns to Avoid

- **Hand-rolled Solidity string templates with sentinels (D-02).** Locked rule. Anywhere we want to add SmartC-specific content around OZ output, do it as a post-process on the *complete* string (string concatenation above SPDX, etc.) — never interpolation into a template body.
- **Mapping our Erc20Opts 1:1 to `ERC20Options` types from the wizard.** We import the *types* but our internal `Erc20Opts` should be our own narrower shape. Reason: OZ may add fields (cross-chain bridging, votes, etc.) we don't surface in Phase 2 — pinning our internal type prevents leaky exposure of unsupported options to our test snapshots.
- **Running the wizard outside a TTY without falling back.** @clack/prompts will throw at runtime if stdin is not a TTY. For e2e tests we either (a) skip the wizard test and instead spawn the binary with a piped stdin (fragile), or (b) drive `template.generate(opts)` directly with synthesized opts and snapshot the result. The Phase 1 e2e SC-4 placeholder is best filled by option (b) for unit-shaped tests and a separate stdin-piped e2e for SC-4 specifically.
- **Calling `template.generate()` before `template.runWizard()` returns.** The two-step seam is sacred. If a future plan tries to "combine them for convenience," reject — Phase 3 needs the seam.
- **Writing the file before `confirmOverwrite`.** Always check existence + prompt first. Phase 1's `confirmOverwrite` already throws `CliError(E_FILE_EXISTS)` on refusal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Solidity ERC-20 source generation | Template-string-with-sentinels generator | `@openzeppelin/wizard` `erc20.print()` | Hand-rolling means tracking every OZ contract version manually, getting `_update` signature evolution right, handling Permit/Burnable/Pausable composition correctly; OZ does it for us |
| Premint decimal scaling | `BigInt(supply) * 10n**18n` math in TypeScript | `premint: "1000000"` string passed through; wizard emits `_mint(recipient, 1000000 * 10 ** decimals())` | The scaling happens in the contract at deploy time, not at codegen — we just pass the string |
| Interactive prompt rendering | `readline`-based question loops | `@clack/prompts.text/select/multiselect/confirm` | Already installed; clean cancel handling via `isCancel`; consistent visual style |
| Cancel handling | Custom SIGINT handlers per prompt | `isCancel(answer)` guard inside `runWizard` | @clack returns `Symbol('cancel')` from each prompt on Ctrl+C; one guard pattern covers all prompts |
| Solidity-identifier validation | Re-implementing the spec | Regex from official grammar (see Validators below) | The Solidity grammar is small; a 1-line regex is honest |
| Filename slug from contract name | Heavy slugify library (e.g., `slugify` npm pkg) | 6-line `contractNameToSlug` (see Code Examples) | Solidity-identifier slug is much narrower than URL slug — small custom function is clearer |
| Snapshot golden comparison | `expect(source).toBe(readFileSync(fixture))` with manual file writes | `expect(source).toMatchFileSnapshot("./fixtures/erc20/bare-default.sol")` | Vitest 4 builtin; auto-updates with `vitest -u`; CRLF normalized by Vitest (PR #3164) |

**Key insight:** This phase is almost entirely **wiring**, not implementation. The wizard output is OZ's responsibility; our value is the *flow* (prompts, validators, defaults, error handling, newbie guidance, file write) that wraps it. Resist the temptation to "add value" by post-processing OZ's output — the value is in the wizard UX and the seam for Phase 3.

## Wizard Order + Newbie-Mode Copy Hooks

Concrete prompt sequence in `template.runWizard(io)`. Question order matches CONTEXT decision: natural reading order; access-control prompt only appears if it is required.

| Step | Prompt | Type | Validator | Newbie hook |
|------|--------|------|-----------|-------------|
| 0 | — | — | — | `output.explain("ERC-20 is the fungible-token standard on Ethereum and EVM chains.")` |
| 0 | — | — | — | `output.reference("EIP-20 spec", "https://eips.ethereum.org/EIPS/eip-20")` |
| 0 | — | — | — | `output.reference("OpenZeppelin ERC20 docs", "https://docs.openzeppelin.com/contracts/5.x/erc20")` |
| 1 | `Contract name (Solidity identifier)` | `text` (placeholder: `MyToken`, defaultValue: `MyToken`) | `isSolidityIdentifier` | `output.explain("The on-chain contract name. Letters, digits, underscores, $; must start with letter/underscore/$.")` |
| 2 | `Token symbol (3-11 ASCII uppercase chars typical)` | `text` (placeholder: `MTK`, defaultValue: `MTK`) | `isAsciiSymbol` | `output.explain("Wallets display this. 3-5 chars is conventional; spec allows up to 11.")` |
| 3 | `Initial supply (human-readable, e.g. 1000000 or 1.5)` | `text` (placeholder: `1000000`, defaultValue: `0`) | `isNonNegativeDecimal` | `output.explain("Minted to the deployer at deploy time. The wizard will scale this by the token's decimals (default 18).")` |
| 4 | `Enable Mintable? (owner can mint more after deploy)` | `confirm` (initialValue: `false`) | — | `output.explain("Mintable means the supply is not fixed — an authorized account can mint more tokens later.")` |
| 5 | `Enable Burnable? (holders can burn their own tokens)` | `confirm` (initialValue: `false`) | — | `output.explain("Burnable lets any holder destroy their own tokens (e.g., for deflationary models). It does NOT let the owner burn other people's tokens.")` |
| 6 | `Enable Pausable? (authorized account can pause all transfers)` | `confirm` (initialValue: `false`) | — | `output.explain("Pausable lets an authorized account freeze transfers in emergencies. Adds centralization risk.")` |
| 7* | `Access control style:` `select` (`ownable` = single owner / `roles` = multi-role AccessControl) | `select` (default: `ownable` if asked) | — | `output.explain("Ownable: one address controls Mint/Pause. Simpler but a single key controls the contract.\nAccessControl: separate roles for MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE. More flexible, more setup.")` |

(\*) Step 7 fires **only** when `mintable || pausable` is true. This matches ERC20-05 and `isAccessControlRequired(opts)` from the wizard SDK.

### Non-negotiable centralization warning

Per CONTEXT.md and ROADMAP DEPLOY-06:

```ts
// After step 7, before runWizard() returns:
if (mintable && access === "ownable") {
  output.warn(
    "Mintable + Ownable: a single key can mint unlimited tokens. " +
    "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy."
  );
}
```

This fires **even in non-newbie mode** because `output.warn` is the always-on critical channel (Phase 1 contract: 01-02-SUMMARY.md). Newbie mode does NOT silence it; `--json` mode does NOT silence it.

### Post-generation newbie next-steps

```ts
// In the dispatcher after writeFile succeeds:
output.result(`Wrote ${outPath}`);
output.nextStep("Run 'smartc list-templates' to see other templates.");
output.nextStep("Phase 3 will add automatic compile-verify before write — for now the .sol references @openzeppelin/contracts which you'll need installed to compile.");
```

The "Phase 3" mention is the "honesty" framing (CONTEXT.md specifics): the file is honest about what it is — source, not compile-verified-source.

## Validators

Concrete regex/predicate recommendations for `validators.ts`. Each is small enough to inline.

```ts
// Source: docs.soliditylang.org Language Grammar — identifier = (letter | '_' | '$') (letter | digit | '_' | '$')*
// We intentionally do NOT permit '$' because it's legal-but-confusing in cross-language pipelines (SPL, Anchor).
const SOLIDITY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function isSolidityIdentifier(v: string | undefined): string | undefined {
  if (!v) return "Contract name is required.";
  if (!SOLIDITY_IDENTIFIER.test(v)) {
    return "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.";
  }
  return undefined;  // valid — @clack/prompts contract
}

// ERC-20 spec doesn't formally bound symbol length, but exchanges/wallets practically expect 1-11 ASCII chars.
const ASCII_SYMBOL = /^[A-Za-z0-9]{1,11}$/;

export function isAsciiSymbol(v: string | undefined): string | undefined {
  if (!v) return "Token symbol is required.";
  if (!ASCII_SYMBOL.test(v)) {
    return "Must be 1-11 ASCII letters/digits, no spaces or punctuation.";
  }
  return undefined;
}

// Premint: decimal string, no exponent (the wizard SUPPORTS exponent form like "1e6" but we keep our surface small;
// human-readable decimal-string-with-optional-fractional-part covers all realistic cases).
const DECIMAL_STRING = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
// uint256 max is 2^256 - 1 ~= 1.16e77. The wizard's checkPotentialPremintOverflow assumes 18 decimals,
// so the safe integer-part ceiling at default decimals is ~ 1.15e59. We don't need to hard-cap; let the
// wizard throw at print() time. We DO want to catch obviously-bad inputs at wizard time.
export function isNonNegativeDecimal(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return "Initial supply is required (use 0 for no premint).";
  if (!DECIMAL_STRING.test(v)) {
    return "Must be a non-negative decimal number, e.g. 1000000 or 1.5.";
  }
  return undefined;
}
```

Test cases for `tests/templates/erc20/validators.spec.ts`:

| Input | isSolidityIdentifier | isAsciiSymbol | isNonNegativeDecimal |
|-------|---------------------|---------------|----------------------|
| `""` / `undefined` | error | error | error |
| `"MyToken"` | undefined | undefined | error (not numeric) |
| `"_Private"` | undefined | error (underscore) | error |
| `"3Token"` | error (digit start) | undefined | error |
| `"My Token"` | error (space) | error (space) | error |
| `"MTK"` | undefined | undefined | error |
| `"1000000"` | error (digit start) | undefined | undefined |
| `"1.5"` | error (dot) | error (dot) | undefined |
| `"0"` | error (digit start) | undefined | undefined |
| `"-1"` | error | error | error (sign) |
| `"a".repeat(65)` | error (length) | error (length) | error |

## Filename Derivation

```ts
// Source: D-04 — template owns filename conventions.
// Algorithm: strip non-identifier chars, PascalCase if word boundaries appear, fallback to "Token" if empty.
export function contractNameToFilename(contractName: string): string {
  // Split on any non-identifier char (space, punctuation), PascalCase each word, join.
  const parts = contractName
    .split(/[^A-Za-z0-9_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1));
  let base = parts.join("");
  // Strip leading digits (Solidity identifier can't start with digit).
  base = base.replace(/^[0-9]+/, "");
  if (!base) base = "Token";
  return `${base}.sol`;
}
```

Test cases:

| Input | Output | Notes |
|-------|--------|-------|
| `"MyToken"` | `MyToken.sol` | Pass-through (already PascalCase identifier) |
| `"My Token"` | `MyToken.sol` | Space-separated, PascalCased |
| `"my_token"` | `MyToken.sol` | Underscore is identifier-safe but we PascalCase for filename convention |
| `"MyToken123"` | `MyToken123.sol` | Trailing digits preserved |
| `"123Token"` | `Token.sol` | Leading digits stripped |
| `"my-cool-token"` | `MyCoolToken.sol` | Hyphens split |
| `"   "` | `Token.sol` | Empty after sanitize → fallback |
| `"$$$"` | `Token.sol` | Empty after sanitize → fallback |

Note: when the user enters a wizard-time `name` like `"MyToken"`, the *Solidity contract name* (used inside the `.sol` source by `erc20.print({ name })`) stays `"MyToken"` — the validator already enforced it's a legal identifier. The filename function is only for the case where `--out` is not given AND the contract name happens to contain word-boundary chars (which our validator would reject — so in practice this function's "split on non-identifier" branch is mostly defensive).

## Vitest 4 Mock Pattern for @clack/prompts (Phase 1 locked)

Confirm from 01-02-SUMMARY.md: `vi.mock("@clack/prompts", ...)` + top-level `await import(SUT)` is the canonical pattern. It applies cleanly to Phase 2's wizard tests.

```ts
// Source: tests/prompt.spec.ts (Phase 1 baseline)
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @clack/prompts BEFORE importing the SUT.
vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

// Import the SUT AFTER the mock.
const { runWizard } = await import("../../../src/templates/erc20/wizard.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const multiselectMock = clack.multiselect as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  textMock.mockReset();
  selectMock.mockReset();
  confirmMock.mockReset();
  multiselectMock.mockReset();
  isCancelMock.mockReset();
  isCancelMock.mockReturnValue(false);
});

// Example: a wizard run with default opts and no flags.
it("returns opts with name/symbol/supply when no flags are toggled", async () => {
  textMock.mockResolvedValueOnce("MyToken");  // name
  textMock.mockResolvedValueOnce("MTK");      // symbol
  textMock.mockResolvedValueOnce("1000000");  // supply
  confirmMock.mockResolvedValueOnce(false);   // mintable
  confirmMock.mockResolvedValueOnce(false);   // burnable
  confirmMock.mockResolvedValueOnce(false);   // pausable
  // select NOT called because !mintable && !pausable

  const opts = await runWizard({ output: makeMockOutput() });
  expect(opts).toEqual({
    name: "MyToken", symbol: "MTK", premint: "1000000",
    mintable: false, burnable: false, pausable: false, access: false,
  });
  expect(selectMock).not.toHaveBeenCalled();
});

// Cancel-handling case
it("throws CliError(E_WIZARD_CANCEL) when user cancels at any prompt", async () => {
  textMock.mockResolvedValueOnce(Symbol("cancel"));
  isCancelMock.mockReturnValueOnce(true);
  await expect(runWizard({ output: makeMockOutput() })).rejects.toMatchObject({
    code: "E_WIZARD_CANCEL",
  });
});
```

## Snapshot Test Mechanics (D-09)

Per Vitest 4 docs: `toMatchFileSnapshot(filepath)` is async, writes the snapshot to a real file at `filepath` (so you can open `bare-default.sol` in your editor with Solidity syntax highlighting), and PR #3164 normalized EOL handling for cross-platform stability. Our `.gitattributes eol=lf` (Phase 1) further insulates us from Windows CRLF drift.

```ts
// tests/templates/erc20/generate.spec.ts
// Source: Vitest snapshot docs + D-09 strategy
import { describe, it, expect } from "vitest";
import { generate } from "../../../src/templates/erc20/generate.js";

describe("erc20 generate — golden snapshots (D-09)", () => {
  it("bare default matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyToken", symbol: "MTK", premint: "1000",
      mintable: false, burnable: false, pausable: false, access: false,
    });
    // toMatchFileSnapshot is async — MUST await per Vitest 4 (else test marked failed).
    await expect(source).toMatchFileSnapshot("../../fixtures/erc20/bare-default.sol");
  });

  it("all-flags-on matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyToken", symbol: "MTK", premint: "1000",
      mintable: true, burnable: true, pausable: true, access: "roles",
    });
    await expect(source).toMatchFileSnapshot("../../fixtures/erc20/all-flags-on.sol");
  });
});

describe("erc20 generate — per-flag assertions (D-09)", () => {
  // Each flag is exercised independently. Per-flag axis coverage WITHOUT 2^N snapshots (D-10).
  it("burnable=true includes ERC20Burnable import + parent", () => {
    const { source } = generate({
      name: "X", symbol: "X", premint: "0",
      mintable: false, burnable: true, pausable: false, access: false,
    });
    expect(source).toContain("ERC20Burnable");
    expect(source).toContain("token/ERC20/extensions/ERC20Burnable.sol");
  });

  it("mintable=true with access=ownable includes Ownable + mint() onlyOwner", () => {
    const { source } = generate({
      name: "X", symbol: "X", premint: "0",
      mintable: true, burnable: false, pausable: false, access: "ownable",
    });
    expect(source).toContain("Ownable");
    expect(source).toContain("mint(");
    expect(source).toContain("onlyOwner");
  });

  it("mintable=true with access=roles includes AccessControl + MINTER_ROLE", () => {
    const { source } = generate({
      name: "X", symbol: "X", premint: "0",
      mintable: true, burnable: false, pausable: false, access: "roles",
    });
    expect(source).toContain("AccessControl");
    expect(source).toContain("MINTER_ROLE");
    expect(source).toContain("onlyRole(MINTER_ROLE)");
  });

  it("pausable=true with access=roles includes ERC20Pausable + PAUSER_ROLE", () => {
    const { source } = generate({
      name: "X", symbol: "X", premint: "0",
      mintable: false, burnable: false, pausable: true, access: "roles",
    });
    expect(source).toContain("ERC20Pausable");
    expect(source).toContain("PAUSER_ROLE");
  });

  it("premint > 0 emits _mint(recipient, N * 10 ** decimals())", () => {
    const { source } = generate({
      name: "X", symbol: "X", premint: "1234",
      mintable: false, burnable: false, pausable: false, access: false,
    });
    expect(source).toMatch(/_mint\(recipient,\s*1234\s*\*\s*10\s*\*\*\s*decimals\(\)\)/);
  });

  it("emits SPDX-MIT and OZ-Contracts-5.x compatibility comment", () => {
    const { source } = generate({
      name: "X", symbol: "X", premint: "0",
      mintable: false, burnable: false, pausable: false, access: false,
    });
    expect(source).toMatch(/^\/\/ SPDX-License-Identifier: MIT/);
    expect(source).toContain("Compatible with OpenZeppelin Contracts");
  });
});
```

**Snapshot regeneration workflow:** When `@openzeppelin/wizard` is updated, run `vitest -u` to regenerate the two `.sol` fixtures. The diff IS the audit trail (CONTEXT specifics §2: "If OZ ships a behavior change we want, we regenerate the snapshots in a dedicated commit and the diff is the audit trail"). Commit message convention: `chore(erc20): regenerate snapshots for @openzeppelin/wizard@<new-version>`.

**Default OZ output for bare-default (sample of what fixture will contain):**

```solidity
// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MyToken is ERC20, ERC20Permit {
    constructor(address recipient)
        ERC20("MyToken", "MTK")
        ERC20Permit("MyToken")
    {
        _mint(recipient, 1000 * 10 ** decimals());
    }
}
```

[CITED: contracts-wizard/packages/core/solidity/test snapshot]. Note `ERC20Permit` appears by default — `permit: true` is the wizard default. We accept this to match wizard.openzeppelin.com byte-for-byte.

## Wizard Cancel Handling

Recommendation: **new stable error code `E_WIZARD_CANCEL`, exit code `130`** (Unix SIGINT convention). Phase 1's stable codes catalog already ships `E_FILE_EXISTS`, `E_NOT_IMPLEMENTED`, `E_USAGE`, `E_UNKNOWN`; adding `E_WIZARD_CANCEL` follows the "codes once shipped never rename" rule.

```ts
// src/lib/errors.ts — append:
export const ERR_WIZARD_CANCEL = "E_WIZARD_CANCEL" as const;
```

```ts
// src/templates/erc20/wizard.ts — central cancel guard:
import { text, select, multiselect, confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_WIZARD_CANCEL } from "../../lib/errors.js";

function cancelGuard<T>(answer: T | symbol, prompt: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${prompt}`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template erc20' to start over.",
      exitCode: 130,  // Unix SIGINT convention
    });
  }
  return answer;
}

// Usage:
const name = cancelGuard(
  await text({ message: "Contract name", validate: isSolidityIdentifier, ... }),
  "contract name",
);
```

The top-level error handler in `src/cli.ts` already does `process.exit(err.exitCode)` for `CliError`, so the `exitCode: 130` propagates naturally. **Phase 1 SIGINT handler check:** `src/cli.ts` line 49 already does `process.on("SIGINT", () => process.exit(130))` — but @clack/prompts intercepts SIGINT internally and surfaces it as the cancel-symbol return value, so our exit-130 path runs via the CliError mechanism, not via the SIGINT handler. Both paths give the same exit code; consistent UX.

## e2e Test Strategy for Interactive Wizard

The Phase 1 e2e (tests/cli.spec.ts) spawns `dist/cli.js` with `NO_COLOR=1`. Phase 2 needs to satisfy SC-4 (overwrite + `--force`) which currently has `it.skip` at line 106. Recommended split:

**Unit-level wizard coverage (in `tests/templates/erc20/wizard.spec.ts`)** — mocks @clack/prompts per the Vitest 4 pattern above. This is where prompt-order, validator, and cancel branches are tested. No real stdin needed; deterministic.

**E2e SC-4 case (in `tests/cli.spec.ts`)** — uses a *non-interactive* path for the wizard to avoid stdin-piping fragility, then exercises overwrite. The cleanest approach:

1. Pre-generate a known-good `.sol` directly via `template.generate()` in a `beforeAll` hook so the file exists on disk.
2. Spawn `smartc create --template erc20 --out tmp/X.sol --force` with `NO_COLOR=1` AND stdin that answers the wizard questions. Use `execFileSync` with `input:` option carrying newline-separated answers.
3. Assert the file content matches the pre-generated one (or just `existsSync` + non-empty).
4. Second test: same command without `--force`, with stdin answering "N" to the overwrite prompt → assert exit 1 + `E_FILE_EXISTS` in stderr.

Actually — @clack/prompts on stdin pipe is notoriously fragile in CI (it expects a TTY). **Recommendation:** for the e2e SC-4 case, write a tiny helper that runs the dispatcher *directly* (in-process, no `dist/cli.js`) but spies on the wizard so it returns a fixed Erc20Opts, then exercises the path through `confirmOverwrite + writeFile + --force`. This is what Phase 1 did for `tests/prompt.spec.ts` (in-process, mocked prompts). The "true" e2e (spawn binary + pipe stdin) can be deferred or replaced with a smoke test that just checks the binary doesn't crash with `--help create`.

Concrete sketch for the SC-4 in-process e2e fill-in:

```ts
// tests/cli.spec.ts — replaces the it.skip at line 106
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, existsSync, rmSync, writeFileSync, readFileSync } from "node:fs";

it("SC-4: overwrite prompt + --force is wired through create dispatcher", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smartc-sc4-"));
  const out = join(dir, "MyToken.sol");
  try {
    // Phase 2 will provide a non-interactive direct-generate path for tests; until then,
    // call template.generate() + writeFile to pre-seed, then spawn with --force.
    const tpl = await import("../src/templates/erc20/index.js");
    const { generate } = tpl;
    const { source } = generate({
      name: "MyToken", symbol: "MTK", premint: "0",
      mintable: false, burnable: false, pausable: false, access: false,
    });
    writeFileSync(out, "stale\n");  // pre-exist with different content

    // Spawn with --force — should overwrite without prompt.
    // (If stdin-piping the wizard turns out fragile, document the limitation
    // and rely on tests/templates/erc20/wizard.spec.ts for prompt coverage;
    // the e2e here proves --force bypasses the prompt path end-to-end.)
    const r = runCli(["create", "--template", "erc20", "--out", out, "--force"], {
      // pipe deterministic answers; if @clack doesn't accept piped stdin reliably,
      // gate this test on TTY detection or move to a wizard-test directly.
    });
    expect(r.status).toBe(0);
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, "utf8")).toContain("contract MyToken");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

**Planner decision needed:** confirm whether the SC-4 e2e fully spawns `dist/cli.js` with stdin (potentially flaky) or runs the dispatcher in-process with mocked prompts (deterministic but less "true" e2e). Recommend the latter for Phase 2, leave a follow-up TODO for proper TTY-driven e2e in a later cross-platform-distribution hardening phase.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-written Solidity templates with placeholders | Programmatic generators (OZ Wizard SDK, Foundry templates) | ~2023 onwards as OZ Wizard SDK matured | Lower correctness risk; one version-pinned source of truth |
| ERC20Permit as opt-in feature | ERC20Permit as wizard default | OZ Wizard 0.4.x → 0.5.x | We accept the default to match wizard.openzeppelin.com byte-for-byte |
| `solc.compile()` with custom resolvers | Pinned `solc-js` + `@openzeppelin/contracts` bundled | Established pattern | Phase 3 concern, not Phase 2 |
| `inquirer` for CLI prompts | `@clack/prompts` (smaller, more accessible, better cancel UX) | 2023+ for new TS CLIs | Already locked in Phase 1 |
| Snapshot via `toMatchSnapshot()` (`.snap` file) | `toMatchFileSnapshot()` (real file with syntax highlight) | Vitest 1.x feature, matured in v3+ | D-09 default; readable `.sol` fixtures |

**Deprecated/outdated (do not use):**
- `@openzeppelin/wizard` versions <0.10.x — older versions used different option vocabulary (e.g., `permit` only added in 0.4.x). Pin to 0.10.8 exactly.
- `inquirer` — replaced by `@clack/prompts` in Phase 1. Do not reintroduce.
- Pre-EIP-2098 manual permit signature handling — superseded by `ERC20Permit` parent contract (already used by the wizard).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Named-import `import { erc20 } from '@openzeppelin/wizard'` works under our NodeNext ESM config in practice via cjs-module-lexer detection. Defensive fallback documented. | Pattern 1 | Low — defensive form is one line away; Wave 0 spike resolves it |
| A2 | `permit: true` (wizard default) is acceptable for Phase 2 output (i.e., we are content for the generated contract to include `ERC20Permit`). | Standard Stack / Snapshot fixtures | Medium — if user wants permit OFF, we'd need to add a wizard prompt for it. Per D-09 byte-for-byte intent, the answer is "leave it on." But it's worth a 5-second planner confirmation |
| A3 | Solidity 0.8.27 pragma emitted by wizard@0.10.8 is acceptable (we don't override it) | Snapshot fixtures | Low — wizard owns the pragma version; Phase 3's bundled solc must match the pragma constraint |
| A4 | 30-second stdin-piped e2e for SC-4 is fragile under @clack/prompts; an in-process direct-dispatcher test is the right alternative | e2e Test Strategy | Low — planner can choose either; both satisfy SC-4 semantically |
| A5 | `E_WIZARD_CANCEL` is the correct new stable error code (vs. reusing an existing one or `E_USAGE`) | Wizard Cancel | Low — codes are append-only per Phase 1 contract; this one will also serve future templates' wizards |
| A6 | We surface only `ownable` and `roles` to the user — NOT `managed` (the third OZ option) | Wizard Order step 7 | Low — `managed` (AccessManager) is advanced; requirement ERC20-05 says "Ownable or AccessControl"; surfacing `managed` would exceed scope |
| A7 | `premint: "0"` is safe to pass even though `if (allOpts.premint)` in `buildERC20` treats `"0"` as truthy — confirm at Wave 0 whether `premint: "0"` emits a `_mint(recipient, 0 * 10 ** decimals())` line or whether the wizard short-circuits | Standard Stack | Low — either behavior is acceptable; if a stale `_mint(recipient, 0 * ...)` line appears, our default ought to be `premint: undefined`. Wave 0 probe answers this in seconds |
| A8 | Filename derivation strips `$` even though Solidity permits it in identifiers (file system + cross-toolchain hygiene) | Filename Derivation | Low — documented intent; user can override with `--out` |
| A9 | Symbol max length is 11 chars (practical convention, not spec-mandated) | Validators | Low — easy to relax later; tighter is safer for v1 |

**Empty assumptions table is NOT the case here — these are concrete decisions the planner should sanity-check, especially A2 (permit default) and A6 (no managed). All others are low-risk research judgments that survive into implementation.**

## Open Questions

1. **`permit: true` (wizard default) — accept or override to `permit: false`?**
   - What we know: wizard.openzeppelin.com always emits `ERC20Permit` when its checkbox is ticked, and the default is ticked. Setting `permit: false` would diverge from byte-for-byte wizard equality.
   - What's unclear: requirements ERC20-01..05 don't mention permit; ERC20-V2-02 lists Permit as v2. So technically v1 *doesn't require* permit.
   - Recommendation: accept the default. Planner can ask user at discuss time if v1 deliberately wants permit OFF; if so, fold it into Erc20Opts and pass `permit: false` to the wizard. Snapshots reflect the choice either way.

2. **Surface `@openzeppelin/wizard` version in `formatVersionLine` (D-08 deferred to planner)?**
   - Pro: honest disclosure of the codegen engine version, helps debugging when snapshot drift happens.
   - Con: lengthens an already-busy version line.
   - Recommendation: yes — append `, @openzeppelin/wizard 0.10.8` to the parenthetical. `safeReadVersion("@openzeppelin/wizard")` will work because that package's `main: dist/index.js` is exports-map-unrestricted (Strategy 1 will succeed). Phase 1's dual-strategy `safeReadVersion` was designed for exactly this case.

3. **In-process e2e vs. true stdin-piped binary spawn for SC-4?**
   - What we know: @clack/prompts requires a TTY; stdin piping in CI is fragile.
   - Recommendation: Phase 2 uses in-process; defer true stdin/TTY e2e to a later distribution-hardening phase. Add a follow-up TODO in tests/cli.spec.ts.

4. **`status` field for ERC-20 template — `alpha` or `stable`?**
   - The locked five-field shape has `status: 'stub' | 'alpha' | 'stable'`. Phase 2 ships a working generator but NOT compile-verified (Phase 3 adds that).
   - Recommendation: `status: "alpha"` for Phase 2; Phase 3 flips to `"stable"` once compile-verify is wired. Surfaces in `list-templates` so users see honest status.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >=20 | All phases | ✓ (project requires it via package.json engines) | (per dev's machine) | None — hard requirement |
| `@openzeppelin/wizard@0.10.8` | `template.generate()` | ✗ (not installed yet) | — | Install in Phase 2 via `npm install @openzeppelin/wizard@0.10.8` |
| `@clack/prompts@^0.11` | `template.runWizard()` | ✓ | 0.11.0 (per package.json) | None — installed in Phase 1 |
| `commander@^14` | dispatcher | ✓ | 14.0.3 | None — Phase 1 |
| `vitest@^4` | tests | ✓ | 4.1.6 | None — Phase 1 |
| `picocolors@^1` | color factory | ✓ | 1.1.1 | None — Phase 1 |
| TTY for live wizard | runtime UX | (depends on user env) | — | Detect with `process.stdin.isTTY`; if absent, throw `CliError(E_USAGE)` with fix pointing at deferred flag-driven mode |

**Missing dependencies with no fallback:** none (the wizard install IS the Phase 2 work).
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.6 |
| Config file | none committed; vitest auto-detects (vitest.config.* could be added but `passWithNoTests: true` is set via Phase 1 CLI flag) |
| Quick run command | `npx vitest run tests/templates/erc20` |
| Full suite command | `npx vitest run` (also runs Phase 1 specs + new e2e) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ERC20-01 | name/symbol/supply pass-through to generated source | unit + snapshot | `npx vitest run tests/templates/erc20/generate.spec.ts -t "bare default"` | ❌ Wave 0 |
| ERC20-02 | mintable=true adds `mint()` and access-control parent | unit (per-flag assertion) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "mintable"` | ❌ Wave 0 |
| ERC20-03 | burnable=true adds `ERC20Burnable` parent | unit (per-flag assertion) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "burnable"` | ❌ Wave 0 |
| ERC20-04 | pausable=true adds `ERC20Pausable` + `pause()/unpause()` | unit (per-flag assertion) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "pausable"` | ❌ Wave 0 |
| ERC20-05 | mintable\|\|pausable triggers access-control prompt; ownable vs roles select | unit (wizard.spec.ts mocks @clack) + per-flag (generate.spec.ts) | `npx vitest run tests/templates/erc20/wizard.spec.ts -t "access"` | ❌ Wave 0 |
| ROADMAP SC-1 | name/symbol/supply user-provided | unit | (covered by ERC20-01 test) | ❌ Wave 0 |
| ROADMAP SC-2 | Mintable/Burnable/Pausable independently opt-in | unit | (covered by ERC20-02/03/04) | ❌ Wave 0 |
| ROADMAP SC-3 | Mintable\|\|Pausable → Ownable vs AccessControl prompt | wizard.spec.ts (mocked prompts) | (covered by ERC20-05) | ❌ Wave 0 |
| ROADMAP SC-4 | Matches OpenZeppelin Wizard output (byte-for-byte) | snapshot | `npx vitest run tests/templates/erc20/generate.spec.ts -t "snapshot"` | ❌ Wave 0 |
| CLI-07 (residual) | Overwrite prompt + `--force` end-to-end | e2e (in-process recommended) | `npx vitest run tests/cli.spec.ts -t "SC-4"` | ✅ skip → fill |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/templates/erc20` (~ 1s; in-process specs + snapshots)
- **Per wave merge:** `npx vitest run` (full suite incl. e2e + build; ~ 5-10s)
- **Phase gate:** Full suite green before `/gsd:verify-work`; both committed `.sol` snapshots present and matching

### Wave 0 Gaps
- [ ] `tests/templates/erc20/wizard.spec.ts` — covers ERC20-05 (interactive access prompt), wizard cancel handling
- [ ] `tests/templates/erc20/generate.spec.ts` — covers ERC20-01..04 + ROADMAP SC-4 (snapshots)
- [ ] `tests/templates/erc20/filename.spec.ts` — covers filename derivation
- [ ] `tests/templates/erc20/validators.spec.ts` — covers validator regexes
- [ ] `tests/fixtures/erc20/bare-default.sol` — committed golden snapshot (D-09)
- [ ] `tests/fixtures/erc20/all-flags-on.sol` — committed golden snapshot (D-09)
- [ ] `tests/cli.spec.ts` line 106 — unskip + fill the SC-4 e2e case
- [ ] `tests/registry.spec.ts` — should NOT need changes (registry contract preserved); spot-verify `registerErc20Template()` doesn't break the canary-retirement (registry.list() returns exactly one entry for `erc20`, no `foundation-smoke`)

*(No new framework install needed — vitest 4 is already in Phase 1.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 2 has no user accounts |
| V3 Session Management | no | Stateless CLI |
| V4 Access Control | no (for SmartC) — yes for *generated* contracts | The generated contract's access control (`Ownable` / `AccessControl`) IS the on-chain access surface — we surface it correctly to the user but don't enforce it |
| V5 Input Validation | yes | Wizard validators (Solidity-identifier regex, ASCII symbol regex, decimal-string regex) reject malformed input before passing to `erc20.print()` |
| V6 Cryptography | no | Wizard SDK doesn't compute hashes/signatures at codegen; generated contract relies on `ERC20Permit` (which uses well-reviewed EIP-712 from `@openzeppelin/contracts`) |
| V8 Data Protection | no | No user data persisted; output `.sol` file is the only artifact |
| V12 File and Resources | yes | File-write step uses `fs.writeFile(outPath, source, "utf8")`; outPath is user-supplied (`--out`) → see threat below |
| V14 Configuration | partial | Pinned `@openzeppelin/wizard@0.10.8` (no caret); package legitimacy audit above |

### Known Threat Patterns for {Node.js CLI + Solidity codegen}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `--out` (e.g., `--out ../../etc/passwd`) | Tampering | The dispatcher should `path.resolve(cwd, outPath)` and refuse paths that resolve outside cwd OR a user-confirmed parent. **Minimum:** rely on `fs.writeFile` permissions; the user supplied the path so they own the consequence. **Recommended for Phase 2:** no extra check — this is a local dev tool, the user is the trust boundary |
| Centralization risk in generated contract (single key controls supply) | Information Disclosure / Repudiation (in deployed-contract sense) | `output.warn` fires on Mintable+Ownable combination (non-silenceable channel); DEPLOY.md (Phase 5) doubles down with safety checklist |
| Slopsquatted dependency | Tampering / Spoofing | Package Legitimacy Audit above; pin exact version; verify maintainer org is `OpenZeppelin` |
| Generated `.sol` references unpinned `@openzeppelin/contracts` | Tampering (downstream) | Phase 3 bundles the pinned version; Phase 2 documents the limitation in newbie `nextStep` ("you'll need @openzeppelin/contracts installed to compile") |
| Wizard input → command injection | Tampering | Validators reject characters that could escape Solidity-string contexts; `erc20.print` constructs the source programmatically (not via concatenation), so name/symbol are escaped by the wizard SDK itself |
| Snapshot file tampering | Tampering | `.sol` fixtures are committed to git; `vitest -u` updates only on intentional regen; commit signing (if configured) flags unexpected updates |

**Phase 2 security posture:** the CLI is a local dev tool — the user IS the trust boundary. The main on-chain security surface is the generated contract, which we delegate to OpenZeppelin's audited wizard SDK. Our SmartC-specific obligations are: (1) honest centralization warnings (`output.warn`), (2) pinned upstream version (no slopsquatting drift), (3) validators that prevent obviously-broken contract names from reaching `erc20.print()`.

## Common Pitfalls

### Pitfall 1: Named-import of CJS package fails at runtime under NodeNext ESM
**What goes wrong:** `import { erc20 } from "@openzeppelin/wizard"` typechecks (types are correct) but Node throws `SyntaxError: Named export 'erc20' not found` at module load.
**Why it happens:** Node's cjs-module-lexer scans the CJS file at load time looking for `module.exports.X = ...` patterns; if the wizard ships a transpiled bundle that assigns exports indirectly (e.g., via `Object.defineProperty(exports, "erc20", { ... })`), the lexer misses them.
**How to avoid:** Wave 0 spike — try the naive form; if it works, ship it. If it fails, use the default-then-destructure form documented in Pattern 1.
**Warning signs:** TypeScript compiles cleanly but `npm run dev` or `npm run test` fails with `SyntaxError: Named export 'X' not found`.

### Pitfall 2: Forgetting to `await` `toMatchFileSnapshot`
**What goes wrong:** Vitest 4 marks the test failed even if the snapshot matches.
**Why it happens:** `toMatchFileSnapshot` is async; Vitest 4 explicitly fails tests where async matchers are not awaited (new in v4).
**How to avoid:** Always `await expect(...).toMatchFileSnapshot(...)`. Eslint plugins like `eslint-plugin-vitest` flag this.
**Warning signs:** Test labeled "failed" with no obvious assertion message; CI green locally, red elsewhere.

### Pitfall 3: Snapshot fixture committed with CRLF on Windows
**What goes wrong:** Snapshot test passes on Windows (writes CRLF, reads CRLF) but fails on macOS/Linux CI (writes LF, reads LF — fixture has CRLF).
**Why it happens:** Default git behavior on Windows checks out CRLF unless `.gitattributes` says otherwise.
**How to avoid:** `.gitattributes` already has `* text=auto eol=lf` (Phase 1) — this covers it. Vitest 4's PR #3164 normalizes EOL in `toMatchFileSnapshot`. Combined, this should Just Work — but **verify** by running the snapshot tests on at least one POSIX-shell env (e.g., GitHub Actions ubuntu-latest) before declaring Phase 2 done.
**Warning signs:** Snapshot tests pass locally on Windows, fail in CI with diffs that are entirely EOL.

### Pitfall 4: Wizard prompt requires TTY; e2e via piped stdin breaks
**What goes wrong:** `execFileSync(..., { input: "MyToken\nMTK\n..." })` causes @clack/prompts to throw `Error: prompts requires a TTY`.
**Why it happens:** @clack uses `process.stdin.isTTY` to render the interactive UI; pipes set `isTTY` to undefined.
**How to avoid:** for e2e, either (a) test through the in-process dispatcher with mocked prompts (recommended for Phase 2), or (b) use a pty library like `node-pty` (heavy dep, cross-platform pain). Option (a) is enough for SC-4.
**Warning signs:** `Error: prompts requires a TTY` in stderr; tests pass interactively but fail in CI.

### Pitfall 5: Confusing `premint: "0"` with `premint: undefined`
**What goes wrong:** Setting `premint: "0"` may emit a no-op `_mint(recipient, 0 * 10 ** decimals())` line in the constructor (visually ugly, gas-wasteful at deploy time).
**Why it happens:** `buildERC20` checks `if (allOpts.premint)` — `"0"` is a non-empty string and truthy; only `undefined` / `""` skips the premint block.
**How to avoid:** Wave 0 probe — `console.log(erc20.print({ name:"X", symbol:"X", premint: "0" }))` and check whether a `_mint(recipient, 0 * ...)` line appears. If it does, map our internal `premint: "0"` to `premint: undefined` before passing to the wizard.
**Warning signs:** Snapshot diff shows a `_mint(recipient, 0 * 10 ** decimals())` line that wastes constructor gas.

### Pitfall 6: Calling `template.generate()` with the wrong opts shape
**What goes wrong:** TypeScript erases the generic at `registry.get()` boundary (`Template<unknown>` per D-05); dispatcher calls `tpl.generate(unknownOpts)` and the template crashes if opts shape is wrong.
**Why it happens:** Type system can't enforce that dispatcher-acquired opts came from THIS template's runWizard.
**How to avoid:** Each template's `runWizard` returns opts; dispatcher passes the SAME opts object to `generate()` without ever crossing template boundaries. Discipline > types here. Documented in Pattern 2.
**Warning signs:** Runtime `TypeError: Cannot read property 'X' of undefined` inside `generate()`.

### Pitfall 7: Registering `registerStubTemplates()` AND `registerErc20Template()`
**What goes wrong:** `register()` throws on duplicate id, but the IDs differ (`foundation-smoke` vs `erc20`), so it succeeds — leaving a phantom `foundation-smoke` entry in `list-templates`.
**Why it happens:** Phase 1's stub registration is still imported by `src/cli.ts`.
**How to avoid:** **Drop the `registerStubTemplates()` call AND the `import` line from `src/cli.ts`.** CONTEXT explicitly says "Phase 2 swaps the stub call for `registerErc20Template()` — one-line change" — make sure it's actually one line. Spot-verify by running `smartc list-templates` after the change and confirming only `erc20` appears.
**Warning signs:** `list-templates` shows two rows; `foundation-smoke` is one of them.

## Code Examples

### Importing the wizard SDK (after Wave 0 spike confirms which form works)

```ts
// Source: npm view @openzeppelin/wizard readme + CONTEXT D-01
// Naive form (try first):
import { erc20 } from "@openzeppelin/wizard";
import type { ERC20Options } from "@openzeppelin/wizard";

// Defensive form (use if naive throws SyntaxError at runtime):
import wizard from "@openzeppelin/wizard";
const { erc20 } = wizard;
import type { ERC20Options } from "@openzeppelin/wizard";
```

### Generating a contract

```ts
// Source: @openzeppelin/wizard@0.10.8 README + erc20.ts
const source: string = erc20.print({
  name: "MyToken",
  symbol: "MTK",
  premint: "1000000",     // human-readable; wizard emits `* 10 ** decimals()`
  mintable: true,
  burnable: true,
  pausable: true,
  access: "roles",         // 'ownable' | 'roles' | false; we don't surface 'managed'
  info: {
    license: "MIT",        // default; can override at user request
    securityContact: "",   // default empty; could be a wizard prompt in future
  },
});
```

### Building the Template plugin

```ts
// Source: D-03/D-04 + Phase 1 registry contract
import type { Template } from "../../registry/types.js";
import { register } from "../../registry/index.js";
import type { Output } from "../../lib/output.js";

export interface Erc20Opts {
  readonly name: string;
  readonly symbol: string;
  readonly premint: string;        // decimal string from wizard
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  readonly access: false | "ownable" | "roles";
}

export interface WizardIo {
  readonly output: Output;
}

export interface GenerateResult {
  readonly filename: string;
  readonly source: string;
}

export interface Erc20Template extends Template {
  runWizard(io: WizardIo): Promise<Erc20Opts>;
  generate(opts: Erc20Opts): GenerateResult;
}

export function registerErc20Template(): void {
  const tpl: Erc20Template = {
    id: "erc20",
    name: "ERC-20 Token",
    chain: "evm",
    status: "alpha",
    description: "Fungible token (ERC-20) on EVM chains. Opt-in Mintable/Burnable/Pausable.",
    runWizard,
    generate,
  };
  register(tpl);
}
```

### `generate.ts` body

```ts
// Source: D-01/D-04
import { erc20 } from "@openzeppelin/wizard";  // or default-destructure per Pattern 1
import { contractNameToFilename } from "./filename.js";
import type { Erc20Opts, GenerateResult } from "./opts.js";

export function generate(opts: Erc20Opts): GenerateResult {
  const source = erc20.print({
    name: opts.name,
    symbol: opts.symbol,
    premint: opts.premint === "0" ? undefined : opts.premint,  // Pitfall 5 mitigation
    mintable: opts.mintable,
    burnable: opts.burnable,
    pausable: opts.pausable,
    access: opts.access,
  });
  return { filename: contractNameToFilename(opts.name), source };
}
```

## Sources

### Primary (HIGH confidence)
- `npm view @openzeppelin/wizard` (verified version 0.10.8 published 2026-04-08; main=dist/index.js; deps=ethereum-cryptography^3.2.0; license AGPL-3.0-only; 35 versions back to 2022) — `[VERIFIED]`
- `npm view @openzeppelin/wizard readme` — full README content including `erc20.print(opts)` signature, defaults, isAccessControlRequired, usage examples — `[CITED: npm registry README]`
- `https://raw.githubusercontent.com/OpenZeppelin/contracts-wizard/master/packages/core/solidity/src/erc20.ts` — `ERC20Options` interface, defaults const, `printERC20` signature — `[CITED]`
- `https://raw.githubusercontent.com/OpenZeppelin/contracts-wizard/master/packages/core/solidity/src/common-options.ts` — `CommonOptions` interface (access, info, upgradeable) — `[CITED]`
- `https://raw.githubusercontent.com/OpenZeppelin/contracts-wizard/master/packages/core/solidity/src/set-access-control.ts` — Access type (`false | 'ownable' | 'roles' | 'managed'`) — `[CITED]`
- `https://raw.githubusercontent.com/OpenZeppelin/contracts-wizard/master/packages/core/solidity/src/set-info.ts` — Info type — `[CITED]`
- `https://eips.ethereum.org/EIPS/eip-20` — EIP-20 Token Standard (for newbie reference link) — `[CITED]`
- `https://docs.openzeppelin.com/contracts/5.x/erc20` — OZ Contracts 5.x ERC20 docs (for newbie reference link) — `[CITED]`
- `https://docs.soliditylang.org/en/latest/grammar.html` — Solidity identifier grammar — `[CITED]`
- `https://vitest.dev/guide/snapshot` — `toMatchFileSnapshot` docs + async-await requirement — `[CITED]`
- `https://github.com/vitest-dev/vitest/pull/3164` — EOL normalization in `toMatchFileSnapshot` — `[CITED]`
- Phase 1 SUMMARYs (01-02, 01-03, 01-04) — `[VERIFIED: read from .planning/]`
- CONTEXT.md decisions D-01..D-10 — `[VERIFIED: read]`

### Secondary (MEDIUM confidence)
- `https://bomb.sh/docs/clack/packages/prompts` — @clack/prompts API signatures (`text`, `select`, `multiselect`, `confirm`, `isCancel`, `cancel`, validate-callback shape) — verified against npm view output
- WebSearch for OpenZeppelin Wizard ERC20 mintable+ownable centralization risk — multiple corroborating sources (OZ docs, OZ forum, blog posts)

### Tertiary (LOW confidence — flagged)
- A1 (cjs-module-lexer success for `@openzeppelin/wizard`) — assertion is based on common Node behavior + the package's exports shape; resolves via Wave 0 spike
- A7 (`premint: "0"` behavior) — resolves via Wave 0 spike

## Metadata

**Confidence breakdown:**
- Standard stack (`@openzeppelin/wizard`@0.10.8 + ecosystem): **HIGH** — verified via npm registry + official OZ repo source code
- Architecture (Template plugin shape, dispatcher seam): **HIGH** — locked by CONTEXT.md D-01..D-10; Phase 1 contract preserved
- Pitfalls (ESM/CJS interop, snapshot CRLF, TTY/stdin, premint "0"): **MEDIUM-HIGH** — Wave 0 spikes resolve the two true unknowns (A1, A7)
- Wizard ergonomics (prompt order, validators, newbie copy): **HIGH** — driven by CONTEXT.md + Phase 1 newbie-mode contract; small concrete code
- Snapshot strategy (D-09 hybrid): **HIGH** — Vitest 4 `toMatchFileSnapshot` is well-documented; EOL normalization is in place
- License compliance (AGPL-3.0-only): **HIGH** — flagged for Phase 9 NOTICE, not a Phase 2 blocker

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (30 days for stable; re-verify if `@openzeppelin/wizard` ships a minor between research date and Phase 2 implementation start — `npm view @openzeppelin/wizard version`)
