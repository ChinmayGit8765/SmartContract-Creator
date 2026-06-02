# Forking & extending smartc

`smartc` is MIT-licensed — fork it, ship your own templates, rename it, embed it.
This guide explains the layout, the invariants that keep the codebase coherent,
and how to add a template without touching existing ones.

## Get a fork running

```sh
git clone https://github.com/<you>/SmartContract-Creator.git
cd SmartContract-Creator
npm install
npm run dev -- create --template erc20   # run from TS source
npm test                                  # full suite
npm run typecheck
npm run build && node dist/cli.js --help  # bundled binary
```

Stack: TypeScript (ESM, NodeNext, strict + `noUncheckedIndexedAccess`),
[commander](https://github.com/tj/commander.js) for the CLI, [@clack/prompts](https://github.com/bombshell-dev/clack)
for the wizard, [tsup](https://tsup.egoist.dev) to bundle to a single
`dist/cli.js`, [vitest](https://vitest.dev) for tests.

## Project layout

```
src/
  cli.ts            # entry: registers templates, builds program, handles errors
  program.ts        # commander command tree (add new commands here)
  commands/         # create · list-templates · doctor · add-feature
  registry/         # the Template type + register()/list()/get()
  templates/<id>/   # one self-contained plugin per template
  compiler/         # compile-verify: index.ts (EVM/solc), solana.ts (anchor)
  deploy/           # DEPLOY.md: types, warnings, constructorArgs, sections/
  doctor/           # environment probes
  ai/               # local Ollama client + prompt + diff
  lib/              # errors, output, env, color, prompt, version (shared)
tests/              # mirrors src/ (unit · integration · e2e)
```

Every subsystem has its own `README.md` documenting its contract — read the one
nearest to what you're changing.

## The plugin model (the important part)

A template is a `Template<TOpts>` value registered with `register()`. The type
([src/registry/types.ts](../src/registry/types.ts)) has **five locked fields**
(`id`, `name`, `chain`, `status`, `description`) plus optional behavior:
`runWizard?`, `generate?`, `deployMeta?`. Later work may **add** optional fields,
never rename or remove the five.

The model is **additive**: adding a template is a new folder + one registration
line in [src/cli.ts](../src/cli.ts). Adding ERC-721/1155/SPL touched no existing
template — that's the design invariant to preserve in your fork.

A template folder typically contains:

| File | Responsibility |
|------|----------------|
| `opts.ts` | The `TOpts` shape the wizard returns and `generate` consumes (type-only). |
| `validators.ts` | `@clack` validate callbacks (return `undefined` when valid). |
| `wizard.ts` | `runWizard(io)` — the prompt sequence; emits critical warnings via `io.output.warn`. |
| `generate.ts` | Pure `generate(opts) → { filename, source }`. No I/O. |
| `deployMeta.ts` | Pure `deployMeta(opts) → DeployMeta` (drives the DEPLOY.md). |
| `index.ts` | `register<Id>Template()` — binds the above onto the `Template` literal. |
| `README.md` | The module contract. |

## Add a new EVM template (worked example)

Say you want a `vault` template.

1. **Create `src/templates/vault/`** with `opts.ts`, `validators.ts`, `wizard.ts`,
   `generate.ts`, `deployMeta.ts`, `index.ts`, `README.md`. Mirror an existing
   EVM template (erc20 is the simplest) — copy its shape and change the bodies.
2. **`generate.ts`** returns `{ filename, source }`. For EVM, prefer delegating to
   a real generator (e.g. `@openzeppelin/wizard`) rather than string-templating
   Solidity by hand — the project rule is "don't hand-template syntax."
3. **`deployMeta.ts`** returns a `DeployMeta` with `chain: "evm"`,
   `standard: "<your-standard>"` (extend the `DeployStandard` union in
   [src/deploy/types.ts](../src/deploy/types.ts)), `constructorArgs` (add a builder
   in `constructorArgs.ts`), and `warnings` (extend `centralizationWarnings`).
4. **Register it** in [src/cli.ts](../src/cli.ts): `registerVaultTemplate();`.
5. **Tests** — add `tests/templates/vault/` (validators, generate, wizard) and an
   E2E case. The `create` dispatcher and compile-verify already handle any EVM
   template generically.

That's it — `create`, `list-templates`, the overwrite gate, compile-verify, and
the DEPLOY.md all pick it up with no further changes.

## Add a new chain

Chains plug into two seams:

- **Compile-verify** — `compileVerify(source, chain, opts)` in
  [src/compiler/index.ts](../src/compiler/index.ts) returns a `CompileResult`
  (`{ warnings, skipped, skipReason? }`). Add a branch (see `solana.ts` for the
  shell-out + graceful-skip pattern). Use `skipped: true` when the toolchain is
  absent so the dispatcher writes-with-warning instead of failing.
- **DEPLOY.md sections** — `sectionsFor(chain, now?)` in
  [src/deploy/sections/index.ts](../src/deploy/sections/index.ts) is **chain-keyed**.
  Add a branch returning your chain's ordered section renderers (see
  `sections/solana/`). The assembler and `DeployMeta` are chain-agnostic.

## Invariants to preserve

- **Compile-before-write.** Nothing un-compilable should reach disk. The
  `create` flow is wizard → generate → compileVerify → overwrite-gate → write.
- **Errors are `CliError`** with a three-part `Error/Why/Fix` block and a stable
  `code` ([src/lib/errors.ts](../src/lib/errors.ts)). Don't throw raw strings.
- **Output goes through the `Output` channels** ([src/lib/output.ts](../src/lib/output.ts)).
  `result/warn/error` always show; `explain/reference/nextStep` are newbie-only and
  silenced under `--json`. Wizards never branch on verbosity themselves.
- **`--json` shapes are public contracts** (`list-templates`, `doctor`). Add fields,
  don't rename.
- **Centralization warnings are single-source** (`centralizationWarnings`). The
  wizard emits the `critical` subset; the DEPLOY.md renders all. Don't duplicate
  the text.

## Rename / rebrand your fork

Change `name`, `bin`, `repository`, `author` in `package.json` (the `bin` key is
the command name). The version string surfaces in `--version` and the DEPLOY.md
provenance line via `readOwnVersion()`. Update the golden DEPLOY.md fixtures under
`tests/fixtures/deploy/` if you change the displayed version or branding.

## Conventions

- ESM only, NodeNext imports use the `.js` extension on relative paths even in
  `.ts` files. `.gitattributes` pins LF — the `dist/cli.js` shebang depends on it.
- Pinned `solc` + `@openzeppelin/contracts` (exact versions) for golden-fixture
  stability. Bumping them is a deliberate change with snapshot updates.
- Run `npm test && npm run typecheck && npm run build` before opening a PR. CI runs
  the same on Windows/macOS/Linux × Node 20/22 plus a global-install smoke.
