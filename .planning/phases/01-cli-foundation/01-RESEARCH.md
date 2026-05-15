# Phase 1: CLI Foundation - Research

**Researched:** 2026-05-15
**Domain:** Node.js + TypeScript ESM CLI scaffold (commander, prompts, color, table, error handling, registry)
**Confidence:** HIGH (core stack), MEDIUM (a few prescriptive patterns)

## Summary

Phase 1 needs a TypeScript ESM CLI shell that wires the entire command surface, verbosity modes, overwrite/force behavior, error rendering, and a stub template registry — without shipping any actual template logic. The standard 2026 stack for this in the Node ecosystem is well-established: **commander 14** for the CLI framework, **@clack/prompts** for interactive prompts, **picocolors** for color, **cli-table3** for the boxed-table renderer, **vitest** for tests, **tsup** (esbuild-based) for the production build, and **tsx** for development. All are TypeScript-native, ESM-friendly, and have stable APIs.

Two sets of decisions matter most for the planner: (1) framework choice (commander wins for this profile — hybrid subcommands, bare-help behavior, custom version output, global-option inheritance, native TS, smallest dep tree), and (2) the abstractions that other phases will plug into — the **Output** abstraction (terse vs newbie), the **Registry** (ID-keyed in-memory map with a locked JSON shape), and the **CliError** class (what/why/fix with stable codes). Get those three abstractions right in Phase 1 and Phases 2-9 plug in cleanly; get them wrong and every later phase pays.

The biggest pitfalls are ESM/TypeScript ergonomics (`__dirname` doesn't exist, `.js` extensions required in source imports, top-level `await` only in entry files), Windows shebang/line-ending behavior (npm handles `.cmd` shim generation, but the source bin file still needs LF line endings), and async error handling around commander's `parseAsync` + `exitOverride`.

**Primary recommendation:** Scaffold with commander 14 + @clack/prompts + picocolors + cli-table3 + vitest, building with tsup to a single ESM bundle in `dist/`, run locally via `tsx` and `npm link` during development. Lock in three core abstractions in Phase 1: `Output` (verbosity-aware printer), `Registry` (template registration), and `CliError` (three-part error class). Default `--version` reads `solc` and `@openzeppelin/contracts` versions out of `node_modules/.../package.json` at runtime, not baked into source.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | ^14.0.3 | CLI framework — parses argv, dispatches subcommands, renders help/version | TJ Holowaychuk's commander is the most-downloaded Node CLI framework (~250M weekly DLs). Native TS types. Smallest dep tree of the major frameworks (0 runtime deps). v14 is ESM-first and has every API needed for the locked decisions: hybrid action handlers, `optsWithGlobals()`, `showGlobalOptions`, `option:version` event for custom version output, `outputHelp()` for bare invocation, `parseAsync()` for async actions, `exitOverride()` for testable error flow, `configureOutput()` for stdout/stderr capture. |
| @clack/prompts | ^0.11.x (uses @clack/core ^1.3.x) | Interactive prompts (overwrite y/N now; full wizard later) | Modern, TS-native, 2KB, ESM-only, minimal visual style (no emojis by default — fits the "formal/manual-style" tone decision). `confirm()` returns a boolean, `isCancel()` guard for Ctrl+C. Used by Astro, Vite create-, and many 2025-2026 scaffolders. |
| picocolors | ^1.1.x | Terminal color (only bold + dim, per the formal tone) | 14× smaller than chalk (7KB vs 101KB), 2× faster, NO_COLOR-friendly out of the box, ships TS types, supports both CJS and ESM, has `isColorSupported` boolean and `createColors(enabled)` for explicit override (which the `--no-color` flag will use). |
| cli-table3 | ^0.6.5 | Boxed-table renderer for `list-templates` default output | Standard table library for Node CLIs, has TS types, optional color via `ansis` peer (won't fight `--no-color` if you don't pass colored cell content). API is stable, low risk. |

### Supporting (build & dev only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | ^5.6.x or ^5.7.x | Type checker + compiler | Always — source authoring |
| tsup | ^8.x | Production bundler (esbuild under the hood) | Production build → single `dist/cli.js` ESM file with shebang preserved |
| tsx | ^4.x | TypeScript execution runtime (esbuild-powered) | Local dev — run `tsx src/cli.ts` directly, or `tsx watch` for hot-reload |
| vitest | ^2.x or ^3.x | Test runner with native ESM + TS | All test files; integrates cleanly with tsx-style ESM |
| @types/node | ^22.x | Node typings | Always |

### Alternatives Considered (and rejected)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| commander | yargs | Heavier (~7 deps), more features than needed, less idiomatic for hybrid action+executable subcommand mix; commander's `optsWithGlobals` is exactly what the global-flags decision wants. |
| commander | oclif | Massive (~30 deps, 85ms cold start vs commander's 18ms), opinionated to the point of fighting our project layout, plugin system overkill for Phase 1. Oclif's only real win — lazy-loaded commands at scale — doesn't apply (we'll have ~6 commands total). |
| commander | clipanion | Smaller community, class-based command definition feels heavy for a CLI this size, used by yarn but not broadly idiomatic. Fine choice technically but commander is the safer default. |
| @clack/prompts | inquirer | Inquirer v9+ rewrite to ESM-only fractured the ecosystem and the modular `@inquirer/prompts` API is more verbose. Bigger bundle. Visual style is more conventional but also more cluttered. |
| @clack/prompts | enquirer | Used by hardhat/eslint/yarn so it's web3-adjacent, but visually busier and APIs less ergonomic for TS than clack. Last release cadence has slowed. |
| @clack/prompts | prompts (terkelg) | Excellent and minimal but de-facto unmaintained since 2022. |
| picocolors | chalk | 14× larger, more deps, no functional advantage for our needs (bold + dim only). |
| picocolors | ansis | Ansis is a fine drop-in chalk replacement with FORCE_COLOR support and is faster on multi-style use, but picocolors is more established and our color use is trivially simple. Ansis becomes interesting only if we want chalk's chained API. |
| tsup | tsdown | tsdown (Rolldown-based) is faster and the emerging successor, but tsup is still the safe, battle-tested choice with ~6M weekly DLs vs tsdown's ~500k. Pick tsdown only if build speed becomes a real concern, which it won't for a CLI of this size. |
| tsup | tsc only | tsc emits one `.js` per `.ts` which works but produces a fragmented `dist/` with lots of files; tsup gives a single ESM bundle that's easier to ship and easier to keep the shebang on. |
| vitest | node:test | node:test is built in (zero deps) and fine for libraries, but lacks watch UX, coverage UI, and the rich matchers Phase 3+ will benefit from (compile-verify, snapshot of generated contracts). Vitest is the modern default. |
| vitest | jest | Jest 30 closed the gap somewhat but still fights ESM and is slower; vitest is unambiguously the 2026 choice for new TS-ESM projects. |

**Installation (Phase 1):**
```bash
npm install commander @clack/prompts picocolors cli-table3
npm install -D typescript tsup tsx vitest @types/node
```

## Architecture Patterns

### Recommended Project Structure

```
SmartContract-Creator/
├── src/
│   ├── cli.ts                 # Entry: shebang, top-level await, dispatch to commander
│   ├── program.ts             # Builds the Command tree (root + subcommands), wires global flags
│   ├── commands/
│   │   ├── list-templates.ts  # `smartc list-templates` action
│   │   └── create.ts          # `smartc create` action (stub in Phase 1, real in Phase 2+)
│   ├── lib/
│   │   ├── output.ts          # Output abstraction (terse vs --newbie); spontaneous warning hook
│   │   ├── errors.ts          # CliError class (what/why/fix) + render + error-code constants
│   │   ├── env.ts             # Truthy env-var parser (SMARTC_NEWBIE) + NO_COLOR detection
│   │   ├── color.ts           # picocolors wrapper that respects --no-color flag override
│   │   ├── prompt.ts          # Thin wrapper around @clack/prompts (overwrite confirm + force gate)
│   │   └── version.ts         # Resolves bundled solc + @oz/contracts versions for --version
│   └── registry/
│       ├── index.ts           # Registry singleton: register(), list(), get()
│       ├── types.ts           # Template type (locked JSON shape) + TemplateStatus enum
│       └── stub.ts            # Phase-1 canary: registers `foundation-smoke (stub)`
├── tests/
│   ├── cli.spec.ts            # End-to-end via spawning the built bin
│   ├── output.spec.ts
│   ├── errors.spec.ts
│   ├── env.spec.ts
│   ├── registry.spec.ts
│   └── commands/
│       └── list-templates.spec.ts
├── dist/                      # Build output (gitignored)
├── package.json               # type: "module", bin: { smartc: "./dist/cli.js" }
├── tsconfig.json              # NodeNext + ESNext target
├── tsup.config.ts             # Bundle src/cli.ts → dist/cli.js with shebang preserved
├── vitest.config.ts
└── .gitignore                 # adds dist/, node_modules/, coverage/
```

**Rationale:** `src/cli.ts` is a tiny entry that just imports from `program.ts` and runs. Keeping `program.ts` separate makes the command tree testable without spawning a process. `lib/` holds cross-cutting infra; `commands/` holds user-facing actions; `registry/` is its own module so Phases 2/4/7 can drop new templates in without touching `commands/` or `lib/`.

### Pattern 1: Bin entry + ESM shebang

**What:** Single ESM bundle in `dist/cli.js` with `#!/usr/bin/env node` shebang preserved by the bundler.
**When to use:** Always for a CLI that ships via npm.
**Example:**
```ts
// src/cli.ts
#!/usr/bin/env node
import { run } from "./program.js"; // .js extension required in NodeNext source

run(process.argv).catch((err) => {
  // last-resort handler — program.ts already renders CliError instances
  process.stderr.write(String(err?.stack ?? err) + "\n");
  process.exit(1);
});
```

```json
// package.json
{
  "name": "smartc",
  "version": "0.1.0",
  "type": "module",
  "bin": { "smartc": "./dist/cli.js" },
  "files": ["dist"],
  "engines": { "node": ">=20" }
}
```

**Cross-platform note:** npm itself generates the `.cmd` shim on Windows when the package is installed globally — you do NOT write `.cmd` files yourself. But the bin source file MUST end with LF (not CRLF) line endings or the `env` shebang will choke on Linux/macOS. Add `* text=auto eol=lf` for `*.js` and `*.ts` in `.gitattributes`, or configure tsup to strip CR.

### Pattern 2: Commander root + subcommands with global options

**What:** Define global options on the root `program`; subcommands access them via `cmd.optsWithGlobals()`.
**When to use:** Always — this is the locked decision (`--newbie`, `--force`, `--no-color`, `--json` work on every command).
**Example:**
```ts
// src/program.ts (sketch)
import { Command } from "commander";
import { listTemplatesCommand } from "./commands/list-templates.js";

export function buildProgram(): Command {
  const program = new Command()
    .name("smartc")
    .description("Generate audited smart contract templates from a wizard.")
    .version(formatVersionLine(), "-V, --version", "output version info") // long-only is fine; -V avoids -v collision
    .option("--newbie", "Show explanatory output (overrides SMARTC_NEWBIE env var)")
    .option("--force", "Skip ALL confirmation prompts (CI/automation)")
    .option("--no-color", "Disable ANSI color")
    .option("--json", "Emit JSON instead of human output (when supported)")
    .showHelpAfterError("(run 'smartc --help' for usage)")
    .configureHelp({ showGlobalOptions: true })  // global flags appear in subcommand help too
    .addCommand(listTemplatesCommand());

  // Bare invocation: print help with the highlighted "Get started" line at top
  program.action(() => {
    process.stdout.write(formatBareBanner() + "\n");
    program.outputHelp();
  });

  return program;
}

export async function run(argv: string[]): Promise<void> {
  const program = buildProgram();
  program.exitOverride(); // throw on parse errors instead of process.exit, so we can render CliError nicely
  try {
    await program.parseAsync(argv);
  } catch (err) {
    handleTopLevelError(err); // renders CliError as 3-part block, falls through to process.exit(code)
  }
}
```

**Critical commander APIs the planner must know:**
- `.optsWithGlobals()` — call from subcommand action handlers to get root + subcommand options merged. Source: [commander.js readme](https://github.com/tj/commander.js)
- `.showHelpAfterError(msg)` — appends a "run --help" hint after parse errors. Added v8.0.0.
- `.configureHelp({ showGlobalOptions: true })` — surfaces root options in subcommand help. Required so `smartc list-templates --help` shows `--json`/`--no-color`/etc. Source: [help-in-depth.md docs page](https://github.com/tj/commander.js)
- `.parseAsync(argv)` — REQUIRED if any action is async (and most will be in later phases). Use this from day one.
- `.exitOverride()` — makes commander throw `CommanderError` instead of calling `process.exit`. Wrap `parseAsync` in try/catch to render errors with our own formatting.
- `.action(handler)` on the root program runs ONLY when no subcommand was matched and no help/version flag was used — perfect for bare-invocation behavior.

### Pattern 3: Custom --version with extra strings

**What:** The `--version` line bundles solc and @openzeppelin/contracts versions, e.g., `smartc 0.1.0 (solc 0.8.x, @openzeppelin/contracts 5.x)`.
**When to use:** Always (locked decision).
**How to build the string at runtime:** Read the bundled package versions from `node_modules/<pkg>/package.json` at startup. Don't hardcode them — they change when you bump deps.
**Example:**
```ts
// src/lib/version.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// In ESM, __dirname doesn't exist. Use import.meta.url (Node 20+) or import.meta.dirname (Node 21.2+).
const __dirname = dirname(fileURLToPath(import.meta.url));

function readPkgVersion(pkgName: string): string {
  // Resolve from the CLI's own node_modules
  const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
  // ... but require isn't in ESM. Use createRequire:
  // or use import.meta.resolve (Node 20.6+) → still returns file:// URL
  // Pragmatic: walk up from __dirname to find node_modules/<pkg>/package.json
  const candidate = join(__dirname, "..", "..", "node_modules", pkgName, "package.json");
  return JSON.parse(readFileSync(candidate, "utf8")).version;
}

export function formatVersionLine(): string {
  // Read this CLI's own version from its package.json the same way
  const cliVersion = readOwnPackageVersion();
  // In Phase 1, solc + @oz/contracts may not be installed yet — wrap in try/catch and show "(not bundled)"
  try {
    const solc = readPkgVersion("solc");
    const oz   = readPkgVersion("@openzeppelin/contracts");
    return `smartc ${cliVersion} (solc ${solc}, @openzeppelin/contracts ${oz})`;
  } catch {
    return `smartc ${cliVersion} (solc not bundled, @openzeppelin/contracts not bundled)`;
  }
}
```

**Gotcha:** In ESM you cannot use `__dirname` directly — see Pitfall 3. Also note `import.meta.resolve` is sync and returns a URL string (Node 20.6+); `createRequire(import.meta.url)` is the universal fallback.

### Pattern 4: Output abstraction (terse vs newbie)

**What:** A single `Output` interface that all commands use; verbosity flag flips its mode. The locked decision says default mode still spontaneously prints critical warnings — so the abstraction has a separate path for those.
**When to use:** Every user-facing print. No `console.log` in command code.
**Example:**
```ts
// src/lib/output.ts
import * as pc from "picocolors";

export interface Output {
  // Always printed
  result(text: string): void;
  // Always printed; goes to stderr
  warn(text: string): void;        // critical/spontaneous (centralization risks etc.)
  error(text: string): void;       // goes to stderr
  // Newbie-only (silent in terse mode)
  explain(text: string): void;     // why-this-question-matters
  reference(label: string, url: string): void; // pointers to docs/EIPs/OZ
  nextStep(text: string): void;    // post-action guidance
}

export interface OutputOptions {
  newbie: boolean;
  color: boolean;
  json: boolean;
}

export function makeOutput(opts: OutputOptions): Output { /* ... */ }
```

**Key insight from the locked decisions:** `warn()` is NOT gated on `--newbie`. Centralization risks must surface even in terse mode. The abstraction enforces that by making `warn()` always-print.

### Pattern 5: Three-part error class

**What:** Every error renders as three labeled lines: WHAT went wrong, WHY, WHAT TO DO.
**When to use:** Every error path. Hand-rolling error strings inline drifts from the format over time.
**Example:**
```ts
// src/lib/errors.ts
export class CliError extends Error {
  readonly code: string;
  readonly what: string;
  readonly why: string;
  readonly fix: string;
  readonly exitCode: number;

  constructor(args: { code: string; what: string; why: string; fix: string; exitCode?: number }) {
    super(args.what);
    this.name = "CliError";
    this.code = args.code;
    this.what = args.what;
    this.why = args.why;
    this.fix = args.fix;
    this.exitCode = args.exitCode ?? 1;
  }
}

// Stable error codes (open whether to ship in Phase 1; recommend YES — easy now, hard later)
export const ERR_FILE_EXISTS    = "E_FILE_EXISTS";
export const ERR_TEMPLATE_NOT_FOUND = "E_TEMPLATE_NOT_FOUND";
export const ERR_INVALID_INPUT  = "E_INVALID_INPUT";
// ... add as needed; document in DEPLOY.md / docs

// Renderer
export function renderError(err: CliError, color: boolean): string {
  const c = color ? colorWrappers : noWrappers;
  return [
    `${c.bold(c.red("ERROR"))} [${err.code}]`,
    `${c.bold("What:")}        ${err.what}`,
    `${c.bold("Why:")}         ${err.why}`,
    `${c.bold("What to do:")}  ${err.fix}`,
  ].join("\n");
}
```

**Recommendation on stable codes:** Ship them in Phase 1. Cost is near-zero (one constants file), the upside is that `--json` output and CI scripts get stable identifiers from day one, and adding them later is harder than adding them now. CLI-08 ("actionable error message") is satisfied either way; codes are bonus durability.

### Pattern 6: Template registry

**What:** In-memory map keyed by template ID; populated at module-load time; serialized to the locked JSON shape.
**When to use:** Phase 2+ register real templates here. Phase 1 registers exactly one canary (`foundation-smoke (stub)`).
**Example:**
```ts
// src/registry/types.ts
export type TemplateStatus = "stub" | "alpha" | "stable";
export type TemplateChain = "evm" | "solana" | "any"; // expand as needed

export interface Template {
  id: string;            // kebab-case, stable
  name: string;          // Display name
  chain: TemplateChain;
  status: TemplateStatus;
  description: string;
}

// src/registry/index.ts
import type { Template } from "./types.js";

const templates = new Map<string, Template>();

export function register(t: Template): void {
  if (templates.has(t.id)) throw new Error(`Template id collision: ${t.id}`);
  templates.set(t.id, t);
}
export function list(): Template[]           { return [...templates.values()]; }
export function get(id: string): Template|undefined { return templates.get(id); }

// src/registry/stub.ts (Phase 1 only — replace/augment in Phase 2)
import { register } from "./index.js";
register({
  id: "foundation-smoke",
  name: "Foundation Smoke Test (stub)",
  chain: "any",
  status: "stub",
  description: "Phase 1 canary entry — exercises registry + table + JSON renderers end-to-end.",
});
```

**JSON output shape (locked):**
```json
{
  "templates": [
    { "id": "foundation-smoke", "name": "Foundation Smoke Test (stub)",
      "chain": "any", "status": "stub",
      "description": "Phase 1 canary entry — exercises registry + table + JSON renderers end-to-end." }
  ]
}
```

**Important:** Future phases must add fields without breaking this shape. Document in code comments that consumers should ignore unknown fields.

### Anti-Patterns to Avoid

- **`console.log` directly in command actions:** breaks the Output abstraction; verbosity gating won't work uniformly. Always go through `Output`.
- **Hand-rolled string interpolation for the WHAT/WHY/FIX block:** the format will drift across files. Always go through `renderError(CliError)`.
- **Hardcoded solc/@oz versions in source:** these go stale silently. Always read from `node_modules/.../package.json` at startup.
- **`process.exit(...)` scattered in command actions:** loses commander's `exitOverride` integration and breaks tests. Throw `CliError`; let the top-level handler exit.
- **Custom argv parsing:** commander handles every edge case (bundled short flags, `--`, `--no-X` negation). Don't reach for `process.argv` slicing.
- **Reading template list from disk in Phase 1:** the registry is in-memory by design (compiled-in). Disk-based discovery is a Phase 4+ topic.
- **Banner ASCII art / emojis on bare invocation:** locked decision says highlighted "Get started: smartc create" line above default help. Keep it simple — one bold line, then the framework's default help block. No FIGlet, no rainbows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| argv parsing, subcommands, help generation | Custom `process.argv` slicer | **commander 14** | Commander handles bundled short flags (`-fv`), `--` separator, value coercion, required/optional args, help indentation, all of which are subtly wrong in hand-rolled code. |
| Interactive y/N prompts | `readline` + manual key handling | **@clack/prompts** `confirm()` | Raw mode handling, Ctrl+C, terminal restoration, non-TTY detection. Doing this right is 50 lines of code and a perpetual bug source. |
| ANSI colors | Embedding `\x1b[31m` literals | **picocolors** | TTY detection, NO_COLOR detection, FORCE_COLOR override, Windows console differences. |
| Boxed table output | Manual padding loops | **cli-table3** | Wide-character handling (CJK), Unicode box-drawing fallback, alignment with multi-line cells. |
| Reading dep versions | Pinning strings in source | `JSON.parse(readFileSync(<pkg>/package.json))` via resolved path | Strings drift from reality. Always read from the actual installed package. |
| Writing the `bin` shim for Windows | Hand-writing `.cmd`/`.ps1` files | npm's automatic shim generation via the `bin` field in package.json | npm generates `smartc`, `smartc.cmd`, and `smartc.ps1` automatically when installed globally. Source: npm docs on `bin` field. |
| Logger with levels (info/warn/error) | Wrapping console with custom verbosity gates | The Output abstraction described above (built on picocolors) | We don't need a full logger — the Output abstraction is ~50 lines and enforces the verbosity decision. consola/signale add deps for features we won't use (transports, file rotation, JSON streaming). |
| Detecting NO_COLOR / TTY | Manual env checks | `picocolors.isColorSupported` (already does both) + a thin wrapper that also honors `--no-color` flag | `isColorSupported` already checks NO_COLOR, FORCE_COLOR, and TTY. We just need to OR in the explicit flag. |
| Truthy-string env-var parsing for `SMARTC_NEWBIE` | `if (process.env.SMARTC_NEWBIE)` (broken — `"false"` is truthy as a string) | Tiny helper: `parseBoolEnv(v)` accepts `1`, `true`, `yes`, `on` (case-insensitive), rejects everything else | Standard Node CLI gotcha — string `"false"` is truthy in JS, but env vars are strings. Always use a helper. |

**Key insight:** every item above looks like 5 lines of code. Each has at least one platform/edge-case bug that takes a day to find. Use the libraries.

## Common Pitfalls

### Pitfall 1: ESM `__dirname` doesn't exist

**What goes wrong:** `__dirname` and `__filename` are undefined in ESM modules; code that uses them throws `ReferenceError: __dirname is not defined`.
**Why it happens:** Those globals are CommonJS module-wrapper injections. ESM has no module wrapper.
**How to avoid:** Use `import.meta.dirname` (Node 21.2+) or `dirname(fileURLToPath(import.meta.url))` for backwards compatibility with Node 20.
**Warning signs:** Any code path that resolves files relative to its own location (e.g., reading `node_modules/.../package.json` for `--version`).
**Source:** [Node ESM docs](https://nodejs.org/api/esm.html), [Sonar blog 2026](https://www.sonarsource.com/blog/dirname-node-js-es-modules)

### Pitfall 2: NodeNext source imports require `.js` extensions

**What goes wrong:** `import { foo } from "./bar"` works in CJS and bundler-style ESM, fails at runtime with `ERR_MODULE_NOT_FOUND` under NodeNext because Node refuses to guess extensions.
**Why it happens:** `module: "NodeNext"` enforces real Node ESM resolution rules. The TypeScript compiler doesn't add extensions for you.
**How to avoid:** ALWAYS write `import { foo } from "./bar.js"` in source, even though the file is `bar.ts`. TypeScript resolves it correctly during type-checking; the bundler/runtime sees the `.js` it expects.
**Warning signs:** New devs see "but the file is `.ts`!" — the answer is "yes, and that's correct under NodeNext."
**Source:** [TypeScript handbook on modules](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)

### Pitfall 3: Async errors swallowed by commander

**What goes wrong:** Action handlers using `async/await` throw, but commander silently exits 0 if you used `program.parse()` instead of `program.parseAsync()`.
**Why it happens:** `parse()` doesn't await action returns; the rejected promise floats off into `unhandledRejection`.
**How to avoid:** ALWAYS use `program.parseAsync(argv)` and wrap it in `try/catch` after calling `.exitOverride()`. The top-level `cli.ts` should have a final `.catch()` as a safety net for any escapee.
**Warning signs:** Tests that "pass" but production fails; errors that print and exit 0 instead of 1.

### Pitfall 4: Windows shebang + line endings

**What goes wrong:** Source `cli.ts` is committed with CRLF line endings (Windows default); the `#!/usr/bin/env node` shebang becomes `#!/usr/bin/env node\r`, and Linux/macOS treat the literal `node\r` as the binary name → `env: 'node\r': No such file or directory`.
**Why it happens:** Git on Windows defaults `core.autocrlf=true`. Cross-platform CLI tools must enforce LF for executable files.
**How to avoid:**
- Add `.gitattributes`:
  ```
  * text=auto eol=lf
  *.bat text eol=crlf
  *.cmd text eol=crlf
  ```
- Optionally configure tsup to strip CR from output (it shouldn't add any, but a CI sanity check helps).
**Warning signs:** "Works on my machine" but breaks for Linux/macOS users.

### Pitfall 5: `npm link` quirks during dev

**What goes wrong:** `npm link` symlinks the global `smartc` to your local `dist/cli.js`; if you forget to run the build, the symlink points at a stale file or no file at all.
**Why it happens:** `npm link` doesn't trigger a build.
**How to avoid:**
- Provide a dev workflow that uses `tsx` directly: `npm run dev -- list-templates` runs `tsx src/cli.ts list-templates` without needing a build.
- For the linked-binary path, document `npm run build && npm link` as the install dance.
- `tsx watch src/cli.ts` is the hot-reload story for active development.

### Pitfall 6: picocolors `--no-color` flag handling

**What goes wrong:** `picocolors.isColorSupported` checks NO_COLOR/FORCE_COLOR/TTY but knows nothing about your `--no-color` CLI flag.
**Why it happens:** picocolors detects environment, not flags.
**How to avoid:** Wrap picocolors in `src/lib/color.ts` that takes the `--no-color` flag value and uses `pc.createColors(enabled)` to produce the right set. Pattern:
```ts
import * as pc from "picocolors";
export function makeColor(noColorFlag: boolean) {
  const enabled = !noColorFlag && pc.isColorSupported;
  return pc.createColors(enabled);
}
```
**Warning signs:** Color shows up even with `--no-color`; or NO_COLOR=1 is ignored.

### Pitfall 7: top-level `await` only works at module top level in entry files

**What goes wrong:** Some bundler configs or older Node versions choke on top-level `await` outside the entry. With `"target": "ESNext"` and Node 20+ this should be fine, but tsup needs `format: ["esm"]` and `target: "node20"` to emit it.
**How to avoid:** Use top-level `await` only in `src/cli.ts`. Other modules should expose `async` functions instead.

### Pitfall 8: commander's `exitOverride` doesn't override `process.exit` in every path

**What goes wrong:** Some commander error paths call `process.exit` directly even with `exitOverride()` set (per [commander issue #1444](https://github.com/tj/commander.js/issues/1444)).
**Why it happens:** Bug/quirk in commander's older error paths; mostly fixed by v14 but worth verifying.
**How to avoid:** Don't rely solely on `exitOverride` for testability. Tests that need to run commander in-process should also stub `process.exit` (vitest's `vi.spyOn(process, "exit")` works), or run the CLI as a child process for end-to-end tests.

### Pitfall 9: Errors must go to stderr, not stdout

**What goes wrong:** `console.log(renderError(err))` prints to stdout, which pollutes pipelines and breaks `--json` output for tools that consume it.
**Why it happens:** `console.log` is stdout; `console.error` is stderr.
**How to avoid:** All error rendering in the Output abstraction routes through `process.stderr.write` (or `console.error`). Same for warnings printed via `--newbie`-style channels that aren't part of the requested output.
**Source:** [lirantal/nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)

### Pitfall 10: Don't accidentally publish source maps or `src/`

**What goes wrong:** `npm publish` includes everything not gitignored unless restricted.
**How to avoid:** Set `"files": ["dist"]` in package.json and verify with `npm pack --dry-run` before any real publish. (Phase 1 doesn't publish, but the planner should set this now to avoid Phase 9 surprises.)

## Code Examples

### Example 1: Minimal commander program with global flags + bare-help

```ts
// src/program.ts
// Source: https://github.com/tj/commander.js (readme + global-options-nested example)
import { Command } from "commander";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("smartc")
    .description("Generate audited smart contract templates from a wizard.")
    .version(buildVersionLine(), "-V, --version", "output version info")
    .option("--newbie",   "Show explanatory output (env: SMARTC_NEWBIE=1)")
    .option("--force",    "Skip ALL confirmation prompts")
    .option("--no-color", "Disable ANSI color")
    .option("--json",     "Emit JSON instead of human output (when supported)")
    .showHelpAfterError("(run 'smartc --help' for usage)")
    .configureHelp({ showGlobalOptions: true });

  // list-templates subcommand (sketch)
  program
    .command("list-templates")
    .description("List all registered contract templates")
    .action(function (this: Command) {
      const opts = this.optsWithGlobals();
      // ... call into commands/list-templates.ts
    });

  // Bare invocation: print "Get started" highlight then default help
  program.action(function (this: Command) {
    process.stdout.write("Get started: smartc create\n\n"); // bold via output.ts in real impl
    this.outputHelp();
  });

  return program;
}
```

### Example 2: Confirm with @clack/prompts + force flag

```ts
// src/lib/prompt.ts
// Source: https://github.com/bombshell-dev/clack (prompts README)
import { confirm, isCancel } from "@clack/prompts";
import { CliError } from "./errors.js";

export async function confirmOverwrite(path: string, force: boolean): Promise<void> {
  if (force) return; // --force skips ALL prompts (locked decision)
  const answer = await confirm({
    message: `File ${path} exists. Overwrite?`,
    initialValue: false, // default no (locked decision: blank Enter = no)
  });
  if (isCancel(answer) || answer === false) {
    throw new CliError({
      code: "E_USER_ABORTED",
      what: `Refused to overwrite ${path}.`,
      why:  "Operation requires destroying existing file content; user declined.",
      fix:  "Re-run with --force to overwrite, or choose a different output path.",
      exitCode: 130, // POSIX: 128 + SIGINT(2). For plain decline, 1 is also fine.
    });
  }
}
```

### Example 3: Color wrapper that respects --no-color

```ts
// src/lib/color.ts
// Source: https://github.com/alexeyraspopov/picocolors (README)
import * as pc from "picocolors";
import type { Colors } from "picocolors/types";

export function makeColor(noColorFlag: boolean): Colors {
  const enabled = !noColorFlag && pc.isColorSupported; // isColorSupported already honors NO_COLOR + FORCE_COLOR + TTY
  return pc.createColors(enabled);
}
```

### Example 4: Truthy env-var parser for SMARTC_NEWBIE

```ts
// src/lib/env.ts
// Source: convention; verified against multiple CLI patterns
const TRUTHY = new Set(["1", "true", "yes", "on"]);

export function parseBoolEnv(value: string | undefined): boolean {
  if (value == null) return false;
  return TRUTHY.has(value.trim().toLowerCase());
}

// In program.ts, the resolution order is:
//   --newbie flag (highest precedence)
//   else SMARTC_NEWBIE env var
//   else false (terse default)
export function resolveNewbie(flag: boolean | undefined): boolean {
  if (flag != null) return flag;
  return parseBoolEnv(process.env.SMARTC_NEWBIE);
}
```

### Example 5: tsup config

```ts
// tsup.config.ts
// Source: https://tsup.egoist.dev/
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,    // single bundle file → easier shebang preservation + simpler bin
  dts: false,          // CLI; we don't ship types
  shims: false,        // we use real ESM, no CJS shims
  banner: { js: "#!/usr/bin/env node" }, // tsup preserves shebang from entry, but explicit is safer
});
```

### Example 6: tsconfig.json

```json
// tsconfig.json
// Source: TypeScript handbook on modules (verified against 2026 best practices)
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "moduleDetection": "force",
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

Note: `tests/` is excluded from the production tsconfig; vitest uses its own resolution that picks them up automatically (or use a separate `tsconfig.test.json` if needed).

### Example 7: Reading bundled package versions

```ts
// src/lib/version.ts (excerpt — see Pattern 3 above for full)
// Source: Node.js ESM docs + Sonar 2026 article
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);

function safeReadVersion(pkgName: string): string | null {
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    return JSON.parse(readFileSync(pkgJsonPath, "utf8")).version;
  } catch {
    return null;
  }
}
```

`createRequire(import.meta.url)` is the standard ESM trick to get `require.resolve`-style package resolution. Source: Node.js ESM docs.

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| ts-node for dev execution | **tsx** | ~2023; tsx is now the de-facto runner | Faster startup, easier ESM, no config dance |
| chalk for colors | **picocolors** for simple needs (chalk still fine for complex chained API) | ~2023 | 14× smaller, no functional regression for our usage |
| inquirer 8 for prompts | **@clack/prompts** for greenfield CLIs | ~2023-2024 | Smaller, ESM-native, minimal style fits a formal tone |
| jest + babel | **vitest** | ~2023 | Native ESM, native TS, much faster |
| `tsc` to many `dist/*.js` files | **tsup** to a single bundle (or **tsdown** if speed matters) | ~2022 | Single-file bin is easier to ship and easier to preserve shebang |
| `module: "ESNext"` + bundler-style import resolution | **`module: "NodeNext"`** + explicit `.js` extensions in source | TypeScript 4.7+; mainstream by 2024 | Source compiles to runnable Node ESM without bundler-specific magic |
| commander `parse()` | **`parseAsync()`** for any async action | always, but commonly missed | Avoids swallowed promise rejections |

**Deprecated/outdated:**
- **ts-node** — still works, but `tsx` is faster and simpler for new projects.
- **chalk v4** — last CJS-compatible version; chalk 5+ is ESM-only. For our minimal needs, picocolors is the better default than either.
- **jest's experimental ESM mode** — still flagged as experimental; vitest is unambiguously the better choice for ESM-first projects.
- **`__dirname` polyfills via webpack DefinePlugin** — unnecessary; `import.meta.url` + `fileURLToPath` is the standard ESM idiom.

## Open Questions

### Question 1: Stable error codes — ship in Phase 1 or defer?

**What we know:** Locked decision marks this as Claude's discretion. Adding stable codes is cheap now (one constants file). Adding them later requires touching every error site.
**What's unclear:** Whether the user wants the surface-area commitment of stable codes documented for users.
**Recommendation:** Ship them in Phase 1 with internal-only documentation (a brief comment in `errors.ts` explaining the convention). Don't promise them as a public API in user docs yet; that promotion can happen in Phase 9 when we publish.

### Question 2: Exact wording of the bare-invocation "Get started" line

**What we know:** Locked: "highlighted 'Get started: smartc create' line at the top of help output." Marked as Claude's discretion for exact wording.
**What's unclear:** Whether it should be exactly `Get started: smartc create` or something like `Quick start: smartc create` or `→ smartc create   (start the wizard)`.
**Recommendation:** Use `Get started: smartc create` literally, rendered in **bold**, followed by a blank line, then commander's default help output. This matches the locked decision verbatim and avoids invention.

### Question 3: Short flag for `--version`

**What we know:** Locked: "make `--version` long-only if needed" to avoid `-v` ambiguity with verbose. Phase 1 doesn't have a `--verbose` flag (we have `--newbie` instead).
**What's unclear:** Whether to use `-V` (capital, commander's default) or skip the short flag entirely.
**Recommendation:** Use `-V` (capital) — it's commander's default for `--version`, avoids any confusion with future `-v`/`--verbose` if added, and is well-precedented.

### Question 4: Exit code scheme

**What we know:** Locked: "POSIX vs granular is open; pick what's idiomatic for the chosen framework."
**What's unclear:** Whether to follow strict POSIX (0 = success, 1 = anything else) or granular (1 = generic, 2 = misuse, 3 = file conflict, etc.).
**Recommendation:** Hybrid: use 0 for success, 1 for general errors, 2 for usage errors (commander's default for parse failures), 130 for SIGINT (POSIX 128+2). Don't invent more — keep granular meaning in `CliError.code` (the `E_*` strings). This satisfies POSIX habits while leaving room to expand. Document the scheme in a brief comment in `errors.ts`.

### Question 5: Vitest version

**What we know:** Vitest 2.x and 3.x are both in wide use as of mid-2026. 3.x has better browser-mode support but we're a Node CLI.
**What's unclear:** Whether to pin the latest 3.x or stick with the more battle-tested 2.x.
**Recommendation:** Use whatever `npm install -D vitest@latest` gives; both work for our needs.

### Question 6: Commander 14 ESM patterns — verified against docs but not personally tested

**What we know:** Commander 14.0.3 (released 2026-01-31) is current. ESM-friendly. All APIs cited (`optsWithGlobals`, `showGlobalOptions`, `showHelpAfterError`, `parseAsync`, `exitOverride`, `outputHelp`) are documented in the readme and changelog.
**What's unclear:** Subtle interaction edge cases between `exitOverride` + `parseAsync` + a root `.action()` handler for bare invocation are documented but slightly under-specified for our exact combination.
**Recommendation:** Plan for a small "spike" task early in Phase 1 that builds the minimum program (root + one subcommand + global flags + bare-action) and verifies all four interact as expected, BEFORE building out the abstractions. If something doesn't work as documented, we discover it in 30 minutes instead of after writing 500 lines.

## Sources

### Primary (HIGH confidence)
- [commander.js GitHub repo](https://github.com/tj/commander.js) - command tree, global options, version customization, parseAsync, exitOverride
- [commander.js changelog](https://github.com/tj/commander.js/blob/master/CHANGELOG.md) - v14.0.3 (released 2026-01-31), ESM support history, custom version output history
- [commander.js examples directory](https://github.com/tj/commander.js/tree/master/examples) - global-options-nested.js, custom-version, custom-help, ESM .mjs examples
- [commander.js help-in-depth docs](https://github.com/tj/commander.js) - showGlobalOptions, configureHelp
- [picocolors README](https://github.com/alexeyraspopov/picocolors) - API, NO_COLOR support, isColorSupported, createColors, ESM/CJS dual
- [@clack/prompts README](https://github.com/bombshell-dev/clack) - confirm, intro/outro, log, isCancel cancellation handling
- [cli-table3 README](https://github.com/cli-table/cli-table3) - v0.6.5, TS types, optional ansis dependency
- [Node.js ESM docs](https://nodejs.org/api/esm.html) - import.meta.url, createRequire, no __dirname/__filename
- [TypeScript handbook on modules](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html) - NodeNext, .js extension requirement
- [NO_COLOR standard](https://no-color.org/) - any non-empty value disables color
- [tsup official docs](https://tsup.egoist.dev/) - bundler config, ESM target, banner for shebang
- [lirantal/nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) - exit codes, NO_COLOR, --json, signal handling, stderr for errors

### Secondary (MEDIUM confidence)
- [PkgPulse 2026 prompts comparison](https://www.pkgpulse.com/guides/ink-vs-clack-vs-enquirer-interactive-cli-nodejs-2026) - clack download stats, modern recommendation
- [PkgPulse 2026 testing comparison](https://www.pkgpulse.com/blog/node-test-vs-vitest-vs-jest-native-test-runner-2026) - vitest as default 2026 choice
- [PkgPulse 2026 bundler comparison](https://www.pkgpulse.com/guides/tsup-vs-tsdown-vs-unbuild-typescript-library-bundling-2026) - tsup ~6M weekly DLs, safe choice
- [PkgPulse 2026 tsx vs ts-node](https://www.pkgpulse.com/guides/tsx-vs-ts-node-vs-bun-running-typescript-directly-2026) - tsx is the modern dev runner
- [Sonar __dirname in ES modules](https://www.sonarsource.com/blog/dirname-node-js-es-modules) - import.meta.dirname (Node 21.2+)
- [2ality ESM shell scripts](https://2ality.com/2022/07/nodejs-esm-shell-scripts.html) - cross-platform shebang considerations
- [jsDocs.io commander 14.0.3](https://www.jsdocs.io/package/commander) - API surface confirmation
- [Grizzly Peak CLI framework comparison](https://www.grizzlypeaksoftware.com/library/cli-framework-comparison-commander-vs-yargs-vs-oclif-utxlf9v9) - commander/yargs/oclif tradeoffs
- [Bloomberg Stricli "Alternatives Considered"](https://bloomberg.github.io/stricli/docs/getting-started/alternatives) - cross-framework feature matrix

### Tertiary (LOW confidence — verify if used)
- [DEV.to clack vs inquirer](https://dev.to/chengyixu/clackprompts-the-modern-alternative-to-inquirerjs-1ohb) - community comparison, used to corroborate clack's tone
- [LogRocket TypeScript CLI with commander](https://blog.logrocket.com/building-typescript-cli-node-js-commander/) - basic patterns, used to corroborate ESM bin shape
- [DEV.to TypeScript ESM not painful](https://dev.to/a0viedo/nodejs-typescript-and-esm-it-doesnt-have-to-be-painful-438e) - tsconfig conventions
- [commander.js issue #7](https://github.com/tj/commander.js/issues/7) and [#1444](https://github.com/tj/commander.js/issues/1444) - bare-help & exitOverride quirks (worth re-verifying with v14)

## Metadata

**Confidence breakdown:**
- Standard stack (commander, picocolors, @clack/prompts, cli-table3, tsup, vitest, tsx): **HIGH** — multiple authoritative sources, current versions verified, all libraries actively maintained as of 2026-05-15
- Architecture patterns (project structure, abstractions, registry shape): **HIGH** for shape (locked decisions enforce most of it); **MEDIUM** for some implementation specifics (exact commander method-chaining for bare-action + exitOverride + parseAsync should be spike-verified)
- Don't-hand-roll list: **HIGH** — all items are well-known Node CLI gotchas
- Common pitfalls: **HIGH** — all 10 pitfalls are documented in primary or multiple secondary sources
- Code examples: **HIGH** — all patterns map directly to documented APIs; minor uncertainty on exact `import.meta.dirname` vs `fileURLToPath` choice (both work; both documented)

**Research date:** 2026-05-15
**Valid until:** 2026-06-14 (30 days — stack is stable; revisit if any of commander/clack/picocolors release a major version)
