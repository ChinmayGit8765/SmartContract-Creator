# Architecture Research: SmartContract Creator

**Domain:** Wizard-driven smart contract scaffolding CLI (TypeScript/Node, single-file output, multi-chain: EVM + Solana)
**Researched:** 2026-05-14
**Confidence:** MEDIUM-HIGH (Architecture patterns are well-established across surveyed tools; the OpenZeppelin Wizard comparable is HIGH-confidence verified; some specific library choices are MEDIUM)

---

## TL;DR

Use a **layered architecture** with a thin CLI shell, a stateless **wizard runner**, a **template registry** discovered from disk (plugin-friendly), a **programmatic contract builder** per language (not Handlebars on Solidity — too brittle), and an **adapter pattern** for compilers and AI. Build foundations first (CLI shell → registry → builder/renderer for one template), then fan out to more templates and the compile/doctor/AI features at the leaves. The AI module must live behind an interface and be loaded lazily so v1 can ship without Ollama working.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — CLI Shell (entry, parsing, lifecycle, output formatting)  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │
│  │ bin/smartc.ts│ │   create     │ │ add-feature  │ │   doctor    │  │
│  │ (commander)  │ │  command     │ │  command     │ │   command   │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬──────┘  │
└─────────┼────────────────┼────────────────┼────────────────┼─────────┘
          │                │                │                │
┌─────────┼────────────────┼────────────────┼────────────────┼─────────┐
│  LAYER 2 — Orchestration (use-case flows, no I/O directly)           │
│  ┌──────▼─────────────────▼────┐  ┌──────▼─────┐ ┌────────▼───────┐  │
│  │      CreateFlow             │  │ FeatureFlow│ │  DoctorFlow    │  │
│  │  prompts → build → write    │  │ (AI)       │ │ (env probes)   │  │
│  │  → compile → DEPLOY.md      │  │            │ │                │  │
│  └────┬────────┬────────┬──────┘  └─────┬──────┘ └────────┬───────┘  │
└───────┼────────┼────────┼────────────────┼────────────────┼──────────┘
        │        │        │                │                │
┌───────┼────────┼────────┼────────────────┼────────────────┼──────────┐
│  LAYER 3 — Domain Services                                           │
│  ┌────▼────┐ ┌─▼─────────┐ ┌▼──────────┐ ┌──▼────────┐ ┌▼─────────┐  │
│  │ Wizard  │ │ Template  │ │ Contract  │ │   AI      │ │   Env    │  │
│  │ Runner  │ │ Registry  │ │  Builder  │ │ Provider  │ │  Probe   │  │
│  │(prompts)│ │ (discovery│ │ (per lang)│ │ (Ollama)  │ │ (which/  │  │
│  │         │ │  + load)  │ │           │ │           │ │  version)│  │
│  └────┬────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────────┘  │
└───────┼────────────┼─────────────┼─────────────┼─────────────────────┘
        │            │             │             │
┌───────┼────────────┼─────────────┼─────────────┼─────────────────────┐
│  LAYER 4 — Adapters / Ports (one shape, many backends)               │
│  ┌────▼────────────▼──┐ ┌────────▼──────┐ ┌────▼─────┐               │
│  │  TemplatePlugin    │ │   Compiler    │ │   LLM    │               │
│  │  (one per template)│ │   Adapter     │ │  Client  │               │
│  │  erc20 / erc721 /  │ │  ┌─────────┐  │ │ (HTTP    │               │
│  │  erc1155 / spl     │ │  │ Solidity│  │ │  fetch   │               │
│  │                    │ │  │ (solc-js│  │ │  Ollama) │               │
│  │  exports:          │ │  │  in-proc│  │ │          │               │
│  │   - prompts schema │ │  └─────────┘  │ │          │               │
│  │   - build(answers) │ │  ┌─────────┐  │ │          │               │
│  │   - deploy doc     │ │  │ Anchor  │  │ │          │               │
│  │                    │ │  │ (execa  │  │ │          │               │
│  │                    │ │  │  spawn) │  │ │          │               │
│  │                    │ │  └─────────┘  │ │          │               │
│  └────────────────────┘ └───────────────┘ └──────────┘               │
└──────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│  LAYER 5 — Infrastructure (stateless utilities)                      │
│  fs (node:fs/promises) │ logger/output │ exec (execa) │ http (fetch) │
└──────────────────────────────────────────────────────────────────────┘
```

Key idea: each layer depends only on the layer below it. Templates are pluggable units that hang off Layer 4 — adding a fifth template means dropping a folder into `src/templates/<name>/`, not editing core.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|---|---|---|
| **CLI Shell** (`bin/smartc.ts`) | argv parsing, dispatch to commands, global flags (`--verbose`, `--newbie`), exit codes | Commander.js (35M weekly d/l, ~18ms startup, zero-dep, TS-native) |
| **Command modules** (`commands/`) | One file per subcommand. Wires flags → flow. Owns nothing else. | Thin functions that call a Flow |
| **Flow / Use-case** (`flows/`) | Sequences the steps for a user goal. No I/O directly; calls services. | Plain async functions, e.g. `runCreateFlow(opts, deps)` |
| **Wizard Runner** | Takes a prompt schema → renders prompts → returns typed answers. Knows nothing about Solidity. | `@clack/prompts` (TS-native, smaller bundle than inquirer, has `group()` for wizard flows) |
| **Template Registry** | Discovers available templates at startup, loads their `manifest`, returns the right plugin by id. | Static map for v1 (`{ erc20, erc721, erc1155, spl }`), file-system discovery later |
| **Template Plugin** (one per token type) | Exports: prompt schema, `build(answers) → SourceFile`, deploy-doc template, language tag (`solidity`\|`rust`), required env. | TS module implementing a `TemplatePlugin` interface |
| **Contract Builder** | The opinionated bit: turns structured answers into a single source string. **Programmatic, not Handlebars on raw Solidity** (see Pattern 1). | Per-language builder modules (`builders/solidity.ts`, `builders/rust.ts`) |
| **Compiler Adapter** | Single `compile(source, language) → CompileResult` interface; implementations dispatch on language. | `SolidityCompiler` uses `solc` npm package (in-proc, standard JSON I/O); `AnchorCompiler` shells out via `execa` |
| **AI Provider** | HTTP client for local LLM. Single method: `suggestFeature(currentSource, userIntent) → patch`. Strictly optional. | `fetch()` to `http://localhost:11434/api/generate` (Ollama default) |
| **Env Probe** | Checks `solc` (bundled), `anchor`, `cargo build-sbf`, `ollama`, node version. Returns a structured report. | `which`/`hasbin` + `execa('<bin>', ['--version'])` with timeout |
| **Output Formatter** | Newbie vs experienced verbosity. Single sink so prompts, logs, and final reports look consistent. | One module reading `--verbose`/`--newbie` flag; @clack handles spinners + boxes |

## Recommended Project Structure

```
smartc/
├── bin/
│   └── smartc.ts                 # shebang entry, argv → commander
├── src/
│   ├── cli/
│   │   ├── program.ts            # commander setup, global flags
│   │   ├── commands/
│   │   │   ├── create.ts         # `smartc create`
│   │   │   ├── add-feature.ts    # `smartc add-feature --ai`
│   │   │   ├── doctor.ts         # `smartc doctor`
│   │   │   └── list-templates.ts # discoverability
│   │   └── output.ts             # logger w/ verbosity modes
│   ├── flows/                    # use-case orchestration
│   │   ├── create-flow.ts        # the main happy path
│   │   ├── feature-flow.ts       # AI-assisted edit
│   │   └── doctor-flow.ts
│   ├── wizard/
│   │   ├── runner.ts             # schema → @clack prompts → typed answers
│   │   └── schema.ts             # PromptSchema type
│   ├── templates/                # ← PLUGIN BOUNDARY (one folder per template)
│   │   ├── _types.ts             # TemplatePlugin interface
│   │   ├── _registry.ts          # static map for v1
│   │   ├── erc20/
│   │   │   ├── index.ts          # default export: TemplatePlugin
│   │   │   ├── prompts.ts        # prompt schema for ERC-20
│   │   │   ├── build.ts          # answers → SourceFile (Solidity)
│   │   │   └── deploy.md.ts      # answers → DEPLOY.md
│   │   ├── erc721/
│   │   ├── erc1155/
│   │   └── spl/
│   │       ├── index.ts
│   │       ├── prompts.ts
│   │       ├── build.ts          # answers → SourceFile (Rust/Anchor)
│   │       └── deploy.md.ts
│   ├── builders/
│   │   ├── solidity/
│   │   │   ├── source-file.ts    # SourceFile builder (imports, contract, modifiers, fns)
│   │   │   ├── print.ts          # SourceFile → string (handles indentation, ordering)
│   │   │   └── snippets/         # tiny, named, parameterized snippets
│   │   └── rust/
│   │       ├── source-file.ts
│   │       ├── print.ts
│   │       └── snippets/
│   ├── compile/
│   │   ├── adapter.ts            # CompilerAdapter interface
│   │   ├── solidity.ts           # uses `solc` (in-process, no shell-out)
│   │   ├── anchor.ts             # uses execa to run `anchor build`
│   │   └── result.ts             # normalized CompileResult type
│   ├── ai/
│   │   ├── provider.ts           # AIProvider interface
│   │   ├── ollama.ts             # HTTP impl
│   │   └── prompts/              # system prompts for add-feature
│   ├── env/
│   │   ├── probe.ts              # detect installed tools & versions
│   │   └── checks.ts             # individual probe functions
│   └── fs/
│       └── writer.ts             # safe single-file write w/ overwrite guard
├── test/                         # mirror src/ layout
├── package.json                  # "bin": { "smartc": "./dist/bin/smartc.js" }
├── tsconfig.json
└── README.md
```

### Structure Rationale

- **`templates/` as a plugin boundary:** Everything specific to a token type lives in one folder. Adding ERC-4626 post-v1 = one new folder + one line in `_registry.ts`. No core code changes. (Pattern adopted by OpenZeppelin Wizard, which has per-token files like `erc20.ts`, `erc721.ts`, `erc1155.ts` in `packages/core/solidity/src/`.)
- **`builders/` split by language:** Solidity and Rust/Anchor are different enough that a shared "source file" abstraction is harmful. Templates pick their builder. Both builders implement the same minimal contract: `build() → string`.
- **`compile/` adapter:** Solidity is in-process (`solc` npm package, standard JSON I/O). Anchor must shell out. Hiding this behind one interface means `CreateFlow` doesn't branch on language — it just calls `compiler.compile(source)`.
- **`ai/` is its own folder, not entangled with wizard or builders:** The wizard and builders work fine with AI uninstalled or Ollama not running. The `add-feature` command is the only thing that imports from `ai/`.
- **`flows/` separate from `commands/`:** Commands are dumb argv-wiring. Flows are testable use cases. This means you can unit-test the create-flow without spawning the CLI.

## Architectural Patterns

### Pattern 1: Programmatic Contract Builder (NOT Handlebars-on-Solidity)

**What:** Represent the contract as a structured object (`SourceFile` with imports, contract name, inheritance, state vars, functions), then have a `print()` function emit the final string. Use small, named TS template-literal **snippets** for the leaf nodes (a single function body, an event declaration), never for the whole contract.

**Why this and not Handlebars/EJS over a `.sol` file:**
- Solidity uses `{` / `}` for every block. Mustache/Handlebars also uses `{{ }}`. Even with `\{{raw}}{{/raw}}` blocks, you end up escaping in 80% of the file — fragile and unreadable.
- Conditional features (Mintable, Burnable, Pausable) interact: enabling Pausable changes function modifiers across every other feature. Template engines force you to express this as nested conditionals; builders express it as composition.
- Output formatting (consistent indentation, import deduplication, function ordering) is trivial in code, miserable in templates.
- **OpenZeppelin Wizard's actual approach** (verified from their repo): files like `erc20.ts`, `print.ts`, `build-generic.ts`, `set-info.ts`, `set-upgradeable.ts`, `set-access-control.ts` — a builder pipeline with feature setters, finalized by a printer. Not a template engine. (HIGH confidence — OpenZeppelin solved this exact problem and chose builders.)

**When to use:** Always for the contract source itself.
**Trade-offs:** More code than `template.hbs`, but vastly easier to maintain, extend, and unit-test.

### Pattern 2: Template Plugin Interface

**What:** Every template implements one interface; the registry knows nothing else about it.

```typescript
// templates/_types.ts
export interface TemplatePlugin<TAnswers = unknown> {
  id: string;                                  // 'erc20', 'spl', ...
  displayName: string;                         // shown in selector
  language: 'solidity' | 'rust';               // routes to correct compiler/builder
  promptSchema: PromptSchema<TAnswers>;        // wizard reads this
  build(answers: TAnswers): SourceFile;        // returns builder result
  deployDoc(answers: TAnswers, compileMeta: CompileResult): string;
  requiredEnv: Array<'solc' | 'anchor' | 'cargo-build-sbf'>;
}
```

**When to use:** From day one. Even with one template, define the interface — it's free, and refactoring later costs real time.

### Pattern 3: Compile Adapter (Strategy Pattern)

**What:** One interface, one method, two implementations.

```typescript
// compile/adapter.ts
export interface CompilerAdapter {
  language: 'solidity' | 'rust';
  compile(source: string, opts: CompileOpts): Promise<CompileResult>;
}

export type CompileResult =
  | { ok: true; warnings: Diagnostic[]; abi?: object; bytecode?: string; meta: Record<string, unknown> }
  | { ok: false; errors: Diagnostic[]; warnings: Diagnostic[] };
```

- `solidity.ts`: `import solc from 'solc'`, build standard JSON input, call `solc.compile(JSON.stringify(input))`, parse output. In-process. Fast.
- `anchor.ts`: write source to a temp scratch project (or use `anchor build` on a minimal generated workspace), `execa('anchor', ['build'])`, parse stdout/stderr.

### Pattern 4: Verbosity as Cross-Cutting Concern (Single UI, One Flag)

**What:** One `Logger`/`Output` module reads `--newbie` / `--verbose` once at startup and exposes methods like `output.explain(text)`, `output.step(text)`, `output.success(text)`. In newbie mode, `explain()` prints; in experienced mode, it's a no-op. Prompts themselves stay identical; only the surrounding chatter changes.

**Why this works:** Avoids the two-UI trap (a code-fork where newbie and experienced paths diverge and drift). Same wizard, different narrator.

### Pattern 5: Dependency Injection at Flow Boundary

```typescript
// flows/create-flow.ts
interface CreateDeps {
  registry: TemplateRegistry;
  wizard: WizardRunner;
  compiler: CompilerAdapter;
  fs: FileWriter;
  output: Output;
}
export async function runCreateFlow(opts: CreateOpts, deps: CreateDeps) { ... }
```

**Why:** Testing — pass a fake `CompilerAdapter` in tests instead of needing `solc` installed in CI.

### Pattern 6: Lazy-Load AI

**What:** Never `import` from `ai/` at the top of any file outside `commands/add-feature.ts` and `flows/feature-flow.ts`. Use dynamic import inside the feature flow itself:
```typescript
const { OllamaProvider } = await import('../ai/ollama');
```

**Why:** If Ollama is broken/missing, `smartc create` should still work flawlessly. Lazy-loading guarantees the AI module's failure modes can't leak into the core path. Also keeps `smartc --help` fast.

## Data Flow

### Primary flow: `smartc create`

```
USER INPUT                                                   FILES
$ smartc create                                              ──────
       │
       ▼
[1] CLI Shell (bin/smartc.ts → commander)
       │
       ▼
[2] commands/create.ts (constructs Deps, calls flows/create-flow.ts)
       │
       ▼
[3] flows/create-flow.ts
       │  ┌─ 3a. registry.list() → show template picker via wizard
       │  ├─ 3b. template = registry.get(selectedId)
       │  ├─ 3c. answers = wizard.runner.run(template.promptSchema)
       │  ├─ 3d. sourceFile = template.build(answers); sourceString = sourceFile.print()
       │  ├─ 3e. fs.writer.write(outputPath, sourceString)  ──▶ MyToken.sol
       │  ├─ 3f. result = await compiler.compile(sourceString)
       │  │       (Solidity in-proc / Anchor execa)
       │  ├─ 3g. if (!result.ok) → output.error(diagnostics), exit 1
       │  └─ 3h. deployMd = template.deployDoc(answers, result)
       │        fs.writer.write(...DEPLOY.md)             ──▶ MyToken.DEPLOY.md
       ▼
[4] output.success(...) → EXIT 0
```

### Secondary flow: `smartc add-feature --ai`

```
$ smartc add-feature --ai --file MyToken.sol "add a transfer fee of 1%"
       │
       ▼
commands/add-feature.ts → dynamic import flows/feature-flow.ts
       │  ┌─ read source file
       │  ├─ detect language from extension
       │  ├─ dynamic import ai/ollama.ts
       │  ├─ aiResult = await provider.suggestFeature(source, intent)
       │  │   POST http://localhost:11434/api/generate
       │  ├─ show diff to user, confirm
       │  ├─ write modified source
       │  └─ re-run compiler adapter to verify still compiles (rollback on fail)
```

### Tertiary flow: `smartc doctor`

```
$ smartc doctor
       │
       ▼
flows/doctor-flow.ts (parallel probes)
       │  ├─ env.probe.node()
       │  ├─ env.probe.solc()       → bundled, always OK
       │  ├─ env.probe.anchor()     → which + --version
       │  ├─ env.probe.cargoBuildSbf()
       │  └─ env.probe.ollama()     → GET 127.0.0.1:11434/api/tags
       ▼
output.report(table {tool, found, version, status})
```

## Build Order (Foundational → Leaf)

| # | Component | Why this order |
|---|---|---|
| **1** | CLI shell + Commander wiring + `output` logger | Need invocation; logger first since every step prints |
| **2** | `TemplatePlugin` interface + empty registry + `WizardRunner` (@clack wrapper) | Defines the contract everything else implements |
| **3** | `SoliditySourceFile` + `print.ts` + minimal snippets | Riskiest piece; do on simplest template first |
| **4** | `templates/erc20/` (the canary) | First end-to-end template. Proves the architecture |
| **5** | `FileWriter` + `flows/create-flow.ts` (without compile yet) | `smartc create` produces a `.sol` file — demoable |
| **6** | `CompilerAdapter` interface + `compile/solidity.ts` (solc in-process) | Adds compile-verify to the loop |
| **7** | `templates/erc721/` + `templates/erc1155/` | Reuse builder + compiler. Validates plugin model |
| **8** | DEPLOY.md generation per template | Cross-cutting; not blocking but high value |
| **9** | `env/probe.ts` + `commands/doctor.ts` | Standalone; helps users debug step 10 |
| **10** | `RustSourceFile` + `templates/spl/` + `compile/anchor.ts` (execa) | Solana is its own beast; entire new builder + adapter |
| **11** | `ai/provider.ts` + `ai/ollama.ts` + `add-feature` command/flow | Truly optional. Dynamic import. Ship v1 without if not ready |
| **12** | Polish: `list-templates`, better newbie explanations, error rewrites | Last 10% that makes it feel good |

**Critical dependency chain:** Steps 1–5 are a hard sequential chain. Steps 6–12 can largely happen in any order, though 7 should follow 4 to validate the plugin model before too much is committed.

## Plugin / Extension Model (Adding a 5th Template Post-v1)

### Strategy A (v1): Static registry, in-tree templates

```typescript
// src/templates/_registry.ts
import erc20 from './erc20';
import erc721 from './erc721';
import erc1155 from './erc1155';
import spl from './spl';
import erc4626 from './erc4626'; // post-v1 addition

export const registry: Record<string, TemplatePlugin> = {
  erc20, erc721, erc1155, spl, erc4626,
};
```

Adding a fifth template = create `templates/<name>/index.ts` exporting `TemplatePlugin`, add one line. **Use this for v1.**

### Strategy B (post-v1): npm-package plugins

- Convention: any npm package named `smartc-template-*` exporting a default `TemplatePlugin` gets auto-loaded.
- Or explicit: a config file (`.smartcrc.json`) listing additional packages.
- Loading is dynamic at startup; one plugin failing doesn't break others.

The Strategy A interface is **exactly** the Strategy B interface, so no rewrite needed.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Templating Solidity with Handlebars/EJS
**Why wrong:** `{` / `{{` collision; conditional feature composition is ugly in templates; formatting nightmares.
**Do this instead:** Programmatic builder (Pattern 1). Template literals for tiny leaf snippets only.

### Anti-Pattern 2: Two Codepaths for Newbie vs Experienced Mode
**Why wrong:** Two UIs drift apart; double test surface.
**Do this instead:** One wizard, one prompt set. `Logger.explain()` is a no-op in experienced mode.

### Anti-Pattern 3: AI Coupled into the Wizard
**Why wrong:** `smartc create` becomes flaky when Ollama isn't running.
**Do this instead:** AI is a separate subcommand operating on already-generated files. Dynamic-imported.

### Anti-Pattern 4: Compile by Shell-Out for Solidity Too
**Why wrong:** Requires `solc` binary in PATH (it's not by default); slower; harder to capture errors.
**Do this instead:** Use the `solc` npm package — in-process. Anchor needs shell-out because it IS a separate toolchain.

### Anti-Pattern 5: `console.log` Scattered Through Source
**Why wrong:** Verbosity flag can't be honored; hard to test.
**Do this instead:** All output through the `output` logger. Lint rule against bare `console.log` outside `bin/`.

### Anti-Pattern 6: Generating a Full Project Instead of One File
**Why wrong:** Out of scope per spec. Forces opinions about test framework, package manager.
**Do this instead:** One source file + one `DEPLOY.md` that explains what tools the user needs.

## Integration Points

### External Toolchains

| Service | Integration Pattern | Notes |
|---|---|---|
| `solc` (Solidity compiler) | npm package, in-process, standard JSON I/O | Bundle as dep. Pin version. Cold-load ~200-400ms first call. |
| `anchor` (Solana toolchain) | `execa('anchor', ['build'], { cwd })` shell-out | Requires user install. Doctor command checks. Need scratch project skeleton on disk. |
| Ollama (local LLM) | HTTP `POST 127.0.0.1:11434/api/generate` via `fetch` | No SDK. Strict timeout (~60s). Graceful "not reachable" message. Lazy import. |

### Internal Boundaries

| Boundary | Communication |
|---|---|
| Command ↔ Flow | Direct function call with `Deps` injected |
| Flow ↔ Template plugin | Through `TemplatePlugin` interface only |
| Flow ↔ Compiler | Through `CompilerAdapter` interface |
| AI flow ↔ rest of CLI | Dynamic import boundary |

## Open Questions / Flag for Future Phases

- **`anchor build` against a single-file scratch project** — Anchor wants a workspace. Solana adapter may need to (a) generate a tiny throwaway workspace on the fly, or (b) skip compile-verify on Solana in v1. Feasibility check needed before Phase 10.
- **`solc` import resolution for `@openzeppelin/contracts`** — likely needs an import callback (`findImports`) resolving to local node_modules or bundled copies. Flag for Solidity-compile phase.
- **Solidity-aware AST emission library** — brief look found none mature; hand-rolled `SoliditySourceFile` is the path. One more targeted search worth doing before committing.

## Sources

- [OpenZeppelin/contracts-wizard repository](https://github.com/OpenZeppelin/contracts-wizard) — HIGH confidence: directly verified per-token-type modules, `print.ts`, modular feature setters. Strongest precedent for programmatic-builder pattern.
- [Hardhat Runtime Environment / Plugin docs](https://v2.hardhat.org/hardhat-runner/docs/advanced/hardhat-runtime-environment)
- [Anchor CLI references](https://www.anchor-lang.com/docs/references/cli) and [anchor init --template PR #2602](https://github.com/solana-foundation/anchor/pull/2602)
- [solc-js](https://github.com/ethereum/solc-js)
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts) and [Ink vs @clack vs Enquirer comparison 2026](https://www.pkgpulse.com/guides/ink-vs-clack-vs-enquirer-interactive-cli-nodejs-2026)
- [execa](https://github.com/sindresorhus/execa)
- [Foundry forge init reference](https://book.getfoundry.sh/reference/forge/forge-init)
- [thirdweb CLI create contract](https://blog.thirdweb.com/guides/the-ultimate-guide-to-thirdweb-cli/)

## Confidence Summary

- **HIGH** on: layered architecture, plugin interface, compiler adapter pattern, programmatic-builder-over-Handlebars, build order, lazy-load AI
- **MEDIUM** on: specific library picks (`@clack/prompts` vs alternatives is mostly DX-driven)
- **LOW** on: exact behavior of `anchor build` against a single-file scratch project (needs prototyping in Solana phase)
