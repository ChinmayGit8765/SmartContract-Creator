# Phase 5: DEPLOY.md Generation - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 24 (16 new, 8 modified)
**Analogs found:** 22 / 24 (2 greenfield with documented composition pattern)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/deploy/index.ts` (NEW) | service (assembler) | transform | `src/templates/erc20/generate.ts` | role-match (pure transform returning `{filename,content}`) |
| `src/deploy/types.ts` (NEW) | model (type contract) | — | `src/templates/erc20/opts.ts` | exact (type-only module, locked shapes) |
| `src/deploy/warnings.ts` (NEW) | service (shared compute) | transform | `src/templates/erc20/wizard.ts` (warn block L145-150) | role-match (extracts inline warn literals → pure fn) |
| `src/deploy/constructorArgs.ts` (NEW) | utility (pure builder) | transform | RESEARCH §Constructor-Arg Matrix L256-286 | greenfield (spec-provided builders) |
| `src/deploy/sections/index.ts` (NEW) | config (registry) | transform | `src/registry/index.ts` (chain dispatch idea) | partial (chain-keyed array registry; greenfield composition) |
| `src/deploy/sections/header.ts` (NEW) | component (renderer) | transform | `src/templates/erc20/generate.ts` | greenfield (pure `(meta)=>string`) |
| `src/deploy/sections/safety-checklist.ts` (NEW) | component (renderer) | transform | RESEARCH §Pattern 2 L548-567 | greenfield |
| `src/deploy/sections/remix.ts` (NEW) | component (renderer) | transform | RESEARCH §Pattern 2 L548-567 | greenfield |
| `src/deploy/sections/hardhat.ts` (NEW) | component (renderer) | transform | RESEARCH §Pattern 2 L548-567 | greenfield |
| `src/deploy/sections/foundry.ts` (NEW) | component (renderer) | transform | RESEARCH §Pattern 2 L548-567 | greenfield |
| `src/deploy/sections/etherscan.ts` (NEW) | component (renderer) | transform | RESEARCH §Pattern 2 L548-567 | greenfield |
| `src/deploy/sections/constructor-args.ts` (NEW) | component (renderer) | transform | RESEARCH §Pattern 2 L548-567 | greenfield |
| `src/deploy/sections/warnings.ts` (NEW) | component (renderer) | transform | RESEARCH §Pattern 2 L548-567 | greenfield |
| `src/deploy/README.md` (NEW) | docs | — | `src/templates/erc721/README.md` | exact |
| `tests/deploy/warnings.spec.ts` (NEW) | test (matrix) | — | `tests/prompt.spec.ts` + `tests/templates/erc20/generate.spec.ts` | role-match |
| `tests/deploy/generate.spec.ts` (NEW) | test (golden+section) | — | `tests/templates/erc20/generate.spec.ts` | exact (toMatchFileSnapshot + per-section toContain) |
| `tests/fixtures/deploy/*.DEPLOY.md` (NEW ×4) | fixture | — | `tests/fixtures/erc20/all-flags-on.sol` | exact (committed golden discipline) |
| `src/registry/types.ts` (MODIFY) | model (interface) | — | `src/registry/types.ts` L16-19 (self — `runWizard?`/`generate?`) | exact |
| `src/templates/erc20/index.ts` (MODIFY) | config (binding) | — | `src/templates/erc20/index.ts` (self) | exact |
| `src/templates/erc721/index.ts` (MODIFY) | config (binding) | — | `src/templates/erc20/index.ts` | exact |
| `src/templates/erc1155/index.ts` (MODIFY) | config (binding) | — | `src/templates/erc20/index.ts` | exact |
| `src/templates/{erc20,erc721,erc1155}/deployMeta.ts` (NEW ×3) | service (opts→meta map) | transform | `src/templates/erc20/generate.ts` | role-match (pure opts→struct mapping) |
| `src/templates/{erc20,erc721,erc1155}/wizard.ts` (MODIFY) | controller (prompt flow) | event-driven | `src/templates/erc20/wizard.ts` (self — warn block) | exact (D-03 refactor in place) |
| `src/commands/create.ts` (MODIFY) | controller (dispatcher) | request-response | `src/commands/create.ts` (self) L121-139 | exact |
| `src/lib/prompt.ts` (MODIFY) | utility (prompt helper) | request-response | `src/lib/prompt.ts` `confirmOverwrite` L16-34 | exact |
| `src/lib/version.ts` (MODIFY) | utility (version read) | file-I/O | `src/lib/version.ts` `readOwnVersion` L53-73 | exact (just add `export`) |
| `tests/commands/create.compile.spec.ts` (MODIFY) | test (e2e) | — | `tests/commands/create.compile.spec.ts` (self) | exact |

## Pattern Assignments

### `src/deploy/index.ts` (service/assembler) — `generateDeployDoc(meta, { now? }): { filename, content }`

**Analog:** `src/templates/erc20/generate.ts` (pure-transform style: maps input → `{filename, source}`, no I/O, no throws on happy path).

**Pure-transform return-shape pattern** (`generate.ts` L35-49):
```typescript
export function generate(opts: Erc20Opts): GenerateResult {
  const source = erc20.print({ ... });
  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
```
Mirror this exactly: `generateDeployDoc` is a pure synchronous transform returning `{ filename, content }` (NOT `{filename, source}` — content is the doc body). The dispatcher writes it directly.

**Filename derivation** — do NOT re-derive from `meta.contractName`. RESEARCH §Filenaming L720-728 mandates a `deployDocPath(solPath): string` helper that swaps the suffix on the ALREADY-RESOLVED `.sol` path (so `--out` is honored):
```typescript
const deployPath = /\.sol$/i.test(outPath)
  ? outPath.replace(/\.sol$/i, ".DEPLOY.md")
  : `${outPath}.DEPLOY.md`;
```
Place `deployDocPath` here (exported, unit-testable). The dispatcher calls it; `generateDeployDoc` returns the bare `filename` for symmetry with `generate()` but the dispatcher uses the resolved `deployPath`.

**Determinism note (load-bearing for golden snapshots):** RESEARCH L796 — the header `<date>` makes output non-deterministic. Inject `{ now }: { now?: Date } = {}` into `generateDeployDoc` (default `new Date()`) so `generate.spec.ts` can freeze it to a fixed date. The signature `generateDeployDoc(meta, { now? })` in the file list reflects this.

**Body assembly** (RESEARCH §System Architecture L485-488):
```typescript
content = sectionsFor(meta.chain).map(render => render(meta)).join("\n");
```

---

### `src/deploy/types.ts` (model) — `DeployMeta`, `CentralizationWarning`, `ConstructorArg`, `DeployFlags`

**Analog:** `src/templates/erc20/opts.ts` — type-only module, no runtime code, `readonly` fields, doc comments fixing the locked contract.

**Type-only module convention** (`opts.ts` L9-24 — note the header comment + `readonly` everywhere):
```typescript
import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

export interface Erc20Opts {
  readonly name: string;
  readonly symbol: string;
  readonly premint: string;
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  readonly access: false | "ownable" | "roles";
}
```

**Exact `DeployMeta` shape to copy** — fully specified in RESEARCH §DeployMeta Design L114-159. Copy that block verbatim (all fields `readonly`, `DeployChain`/`DeployStandard`/`AccessMode` unions, `WarningSeverity`, `ConstructorArg`, `DeployFlags`, `CentralizationWarning`, `DeployMeta`). The `flags` keys MUST mirror Opts names (`mintable`/`burnable`/`pausable`/`access`) per CONTEXT Discretion — confirmed against the three `opts.ts` files (erc20 L16-24, erc721 L50-65, erc1155 L25-33).

---

### `src/deploy/warnings.ts` (service/shared compute) — `centralizationWarnings(meta): CentralizationWarning[]`

**Analog:** the inline warn blocks in all three wizards. This is the D-03 single-source-of-truth target.

**Current ERC-20 warn literal** (`src/templates/erc20/wizard.ts` L145-150) — the BYTE-LOCKED text to move into a `CentralizationWarning.body`:
```typescript
if (mintable && access === "ownable") {
  io.output.warn(
    "Mintable + Ownable: a single key can mint unlimited tokens. " +
      "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  );
}
```

**ERC-721 warn block** (`src/templates/erc721/wizard.ts` L219-236) — three conditionals: `mintable && ownable` (unlimited NFTs), `royalty.enabled && ownable` (royalty recipient), `pausable && ownable` (halt transfers). Move all three strings into warnings keyed `mintable-ownable` / `royalty-ownable` / `pausable-ownable`.

**ERC-1155 warn block** (`src/templates/erc1155/wizard.ts` L148-165) — `mintable && ownable`, `pausable && ownable`, plus the ALWAYS-ON URI warning (L162-165, fires every run — id `erc1155-uri-owner`).

**Full warning matrix** the function returns (RESEARCH L442-451):
| Standard | Condition | id | severity |
|----------|-----------|-----|----------|
| any | `mintable && access==="ownable"` | `mintable-ownable` | critical |
| any | `pausable && access==="ownable"` | `pausable-ownable` | critical |
| erc721 | `royalty && access==="ownable"` | `royalty-ownable` | critical |
| erc1155 | always | `erc1155-uri-owner` | critical |
| any | `access==="roles" && (mintable\|\|pausable)` | `roles-multi-key` | info (NEW — DEPLOY.md only) |
| any | no flags / `access==="none"` | (none) | — |

**Signature** (RESEARCH L184): `centralizationWarnings({ standard, flags }: { standard: DeployStandard; flags: DeployFlags }): CentralizationWarning[]`. The per-template `deployMeta()` calls this; the wizard ALSO calls it and emits only `severity === "critical"` via `output.warn` to preserve byte-identical visible wizard behavior.

**NOTE — text drift across standards:** the three "Mintable + Ownable" strings are NOT identical (erc20 says "unlimited tokens", erc721 "unlimited NFTs", erc1155 "unlimited quantities of any token id"). The shared function MUST branch on `meta.standard` to produce the right body, or the wizard byte-equality test will fail. This is the single most important detail in the refactor.

---

### `src/deploy/constructorArgs.ts` (utility/pure builder)

**Analog:** none in codebase (greenfield) — but RESEARCH §Constructor-Arg Matrix L256-286 provides the EXACT reference implementation. Copy it:
```typescript
const ADDR = (name: string): ConstructorArg => ({ name, type: "address", exampleValue: "<YOUR_WALLET_ADDRESS>" });

function rolesArgs(flags: DeployFlags): ConstructorArg[] {
  const out = [ADDR("defaultAdmin")];
  if (flags.pausable) out.push(ADDR("pauser"));
  if (flags.mintable) out.push(ADDR("minter"));
  return out;
}
function erc20ConstructorArgs(flags: DeployFlags): ConstructorArg[] {
  const out: ConstructorArg[] = [];
  if (flags.premintNonZero) out.push(ADDR("recipient"));
  if (flags.access === "ownable") out.push(ADDR("initialOwner"));
  else if (flags.access === "roles") out.push(...rolesArgs(flags));
  return out;
}
// erc721: ownable→[initialOwner], roles→rolesArgs, none→[]
// erc1155: roles→rolesArgs, else→[initialOwner]  (updatableUri forces Ownable)
```

**Fixture-lock requirement (#1 footgun, RESEARCH L288 + Pitfall 1):** the args MUST match the committed `.sol` constructors. Verified against `tests/fixtures/erc20/all-flags-on.sol` L15: `constructor(address recipient, address defaultAdmin, address pauser, address minter)` — exactly what `erc20ConstructorArgs({premintNonZero:true, access:"roles", pausable:true, mintable:true})` produces (recipient + rolesArgs[defaultAdmin, pauser, minter]). The test parses each fixture's `constructor(...)` and asserts equality.

---

### `src/deploy/sections/*.ts` (component/renderers) — GREENFIELD, documented composition

**Analog:** none exact. Use the pure `(meta: DeployMeta) => string` pattern from RESEARCH §Pattern 2 L548-567. Each section is its own pure function, independently testable, assembled by the registry. Reference renderer:
```typescript
// src/deploy/sections/foundry.ts
export function foundry(meta: DeployMeta): string {
  const id = `src/${meta.contractName}.sol:${meta.contractName}`;
  const argLine = meta.constructorArgs.length
    ? `  --constructor-args ${meta.constructorArgs.map(a => a.exampleValue).join(" ")} \\\n`
    : "";
  return [
    "## Deploy via Foundry",
    "```bash",
    `forge create ${id} \\`,
    "  --rpc-url <YOUR_RPC_URL> \\",
    "  --private-key <YOUR_PRIVATE_KEY> \\",
    argLine ? argLine.trimEnd() : null,
    "  --broadcast",
    "```",
  ].filter(Boolean).join("\n");
}
```

**Section content sources (all in RESEARCH §Deploy Snippet Templates):**
- `header.ts` — provenance line (RESEARCH L784-794, D-11). Reads `readOwnVersion()` + `safeReadVersion("solc")` + `safeReadVersion("@openzeppelin/contracts")` + injected date.
- `warnings.ts` — render `meta.warnings` array (D-06). Critical first.
- `safety-checklist.ts` — static items (RESEARCH L390-399) + option-derived items table (RESEARCH L403-410, keyed on `meta.flags`).
- `remix.ts` — open+paste instructions (RESEARCH L346-355, NO local deep-link).
- `hardhat.ts` — classic `scripts/deploy.js` + `npx hardhat run` (RESEARCH L315-340). No-arg ctor → `MyToken.deploy()`.
- `foundry.ts` — `forge create ... --broadcast` (RESEARCH L298-309). MUST include `--broadcast`; omit `--constructor-args` line entirely for no-arg ctor.
- `etherscan.ts` — `forge verify-contract` with `cast abi-encode "constructor(<types>)"` + FULL solc version `v0.8.35+commit.47b9dedd` (RESEARCH L366-383). Plus `npx hardhat verify`.
- `constructor-args.ts` — reference table from `meta.constructorArgs` (D-04 section 8).

**Chain-keyed registry** (`src/deploy/sections/index.ts`, RESEARCH §Pattern 1 L527-545) — the Phase 7 seam:
```typescript
type Section = (meta: DeployMeta) => string;
const EVM_SECTIONS: Section[] = [
  header, warningsSection, checklist, remix, hardhat, foundry, etherscan, constructorArgsSection,
];
export function sectionsFor(chain: DeployChain): Section[] {
  if (chain === "evm") return EVM_SECTIONS;
  // Phase 7: if (chain === "solana") return SOLANA_SECTIONS;
  throw new Error(`No deploy sections registered for chain '${chain}'`);
}
```
Note `.js` extension on relative imports (NodeNext) — see `generate.ts` L16 `from "./filename.js"`.

**Anti-pattern to avoid** (RESEARCH L569-573): do NOT build one giant template string for the whole doc — violates D-04. Each section is its own pure function.

---

### `src/templates/{erc20,erc721,erc1155}/deployMeta.ts` (service/opts→meta map) — NEW per template

**Analog:** `src/templates/erc20/generate.ts` (pure opts → struct mapping; reads the template's own Opts shape, returns a normalized struct).

**Exact mappings provided** in RESEARCH L172-223 (`deployMetaErc20` L173-186, `deployMetaErc721` L192-204, `deployMetaErc1155` L210-222). Copy them. Key shared step — `access` normalization (`false → "none"`):
```typescript
const access: AccessMode = opts.access === false ? "none" : opts.access;
```
Each builds `flags`, calls `ercXXConstructorArgs(flags)`, and `centralizationWarnings({ standard, flags })`. ERC-20 derives `premintNonZero = opts.premint !== "0" && opts.premint !== ""`; ERC-721 reads `opts.royalty.enabled` (confirmed `Erc721RoyaltyOpts.enabled` exists, erc721/opts.ts L32); ERC-1155 hardcodes `updatableUri: true` (no opts field — confirmed erc1155/opts.ts has no such field, L11-15 comment explains it).

**Planner decision (from file list):** inline in `index.ts` OR separate `deployMeta.ts`. Recommend separate file — mirrors the one-concern-per-file split (`generate.ts`, `wizard.ts`, `filename.ts` are each separate).

---

### `src/templates/{erc20,erc721,erc1155}/index.ts` (config/binding) — MODIFY

**Analog:** the binding pattern is identical across all three (erc20/index.ts L22-39, erc721/index.ts L20-38 is a "1:1 clone"). Add `deployMeta` to the literal exactly as `runWizard`/`generate` are added:
```typescript
import { deployMetaErc20 } from "./deployMeta.js";
// ...
const tpl: Template<Erc20Opts> = {
  id: "erc20",
  name: "ERC-20 Token",
  chain: "evm",
  status: "alpha",
  description: "...",
  runWizard,
  generate,
  deployMeta: deployMetaErc20,   // NEW — additive
};
```
The `register(tpl as unknown as Template)` cast at the boundary is unchanged.

---

### `src/registry/types.ts` (model/interface) — MODIFY

**Analog:** the SAME file's existing optional-field additions (L16-19). `runWizard?`/`generate?` show the exact additive pattern `deployMeta?` follows:
```typescript
/** Phase 2: optional wizard runner. Per-template wizards return parsed opts. */
readonly runWizard?: (io: { output: Output }) => Promise<TOpts>;
/** Phase 2: optional pure generator. Takes opts → returns filename + source. */
readonly generate?: (opts: TOpts) => { filename: string; source: string };
```
Add (D-01): `readonly deployMeta?: (opts: TOpts) => DeployMeta;` — import `DeployMeta` type-only from `../deploy/types.js`. The L6-9 header comment ("Later phases may ADD optional fields only") already sanctions this.

---

### `src/templates/{erc20,erc721,erc1155}/wizard.ts` (controller) — MODIFY (D-03 hybrid refactor)

**Analog:** the wizard's own warn block (erc20/wizard.ts L145-150, erc721 L219-236, erc1155 L148-165). Replace the inline literals with a call to the shared function, emitting only critical warnings:
```typescript
// BEFORE (erc20/wizard.ts L145-150): inline literal
// AFTER: call shared, emit critical subset
import { centralizationWarnings } from "../../deploy/warnings.js";
import { deployMetaErc20 } from "./deployMeta.js"; // or build flags inline
// ...
const flags = { mintable, burnable, pausable, access: access === false ? "none" : access, premintNonZero: premint !== "0" && premint !== "" };
for (const w of centralizationWarnings({ standard: "erc20", flags })) {
  if (w.severity === "critical") io.output.warn(w.body);
}
```
This is the ONE place Phase 5 touches existing template behavior — blast radius is ~7 `output.warn` blocks (RESEARCH L435). Fallback if invasive: duplicate strings in `warnings.ts`, leave wizards untouched, add byte-equality test (RESEARCH L440). The `output.warn` channel is the always-on critical channel (comments at erc20/wizard.ts L143-144).

---

### `src/commands/create.ts` (controller/dispatcher) — MODIFY

**Analog:** the same file's existing path-resolve + overwrite + write block (L121-139). RESEARCH §Dispatcher Integration L759-781 gives the exact splice. Current code:
```typescript
// 4. Resolve output path.
const outPath = globalOpts.out ?? path.resolve(process.cwd(), filename);
// 5. Overwrite gate
if (existsSync(outPath)) {
  await confirmOverwrite(outPath, { force: globalOpts.force });
}
// 6. Write.
await writeFile(outPath, source, "utf8");
```
Replace with (after compile-verify at L119, before write — D-09/D-10):
```typescript
const outPath = globalOpts.out ?? path.resolve(process.cwd(), filename);
const deployPath = tpl.deployMeta ? deployDocPath(outPath) : null;
const targets = deployPath ? [outPath, deployPath] : [outPath];
await confirmOverwriteMany(targets, { force: globalOpts.force });   // covers BOTH (D-08)
await writeFile(outPath, source, "utf8");
if (tpl.deployMeta && deployPath) {
  const meta = tpl.deployMeta(opts);
  const { content } = generateDeployDoc(meta);
  await writeFile(deployPath, content, "utf8");
  output.result(`Wrote ${deployPath}`);
}
```
Imports to add: `confirmOverwriteMany` from `../lib/prompt.js`, `generateDeployDoc` + `deployDocPath` from `../deploy/index.js`. The `existsSync` pre-check is no longer needed (`confirmOverwriteMany` filters internally) — can drop the `node:fs` `existsSync` import if unused elsewhere. Add a `nextStep` mentioning the DEPLOY.md (RESEARCH L781). The existing `safeReadVersion` footer (L134-139) stays.

---

### `src/lib/prompt.ts` (utility) — MODIFY: add `confirmOverwriteMany(paths)`

**Analog:** the same file's `confirmOverwrite` (L16-34). New function reuses the SAME `CliError(ERR_FILE_EXISTS)` shape (RESEARCH §Overwrite Gate L734-755):
```typescript
export async function confirmOverwriteMany(
  paths: string[],
  opts: ConfirmOverwriteOpts = {},
): Promise<boolean> {
  if (opts.force) return true;
  const existing = paths.filter((p) => existsSync(p));
  if (existing.length === 0) return true;
  const list = existing.map((p) => `  - ${p}`).join("\n");
  const answer = await confirm({
    message: `These files already exist and will be overwritten:\n${list}\nOverwrite?`,
    initialValue: false,
  });
  if (isCancel(answer) || answer === false) {
    throw new CliError({ code: ERR_FILE_EXISTS, what: `Refused to overwrite ${existing.length} existing file(s).`, why: "...", fix: "..." });
  }
  return true;
}
```
NEW import needed in prompt.ts: `import { existsSync } from "node:fs";` (currently only in create.ts). Keep `confirmOverwrite` for single-path callers (back-compat — `tests/prompt.spec.ts` still drives it).

---

### `src/lib/version.ts` (utility) — MODIFY: export `readOwnVersion`

**Analog:** the function already exists, just `private` (L53-73). RESEARCH L796 — change `function readOwnVersion()` to `export function readOwnVersion()` so `sections/header.ts` reads smartc's own version for the provenance line (D-11). Minimal additive change. Currently `formatVersionLine` (L82) is the only consumer; adding `export` doesn't change its behavior.

---

### `tests/deploy/warnings.spec.ts` (test/matrix — D-13)

**Analog:** `tests/templates/erc20/generate.spec.ts` per-flag assertion style (L45-134) + `tests/prompt.spec.ts` structure. Drive `centralizationWarnings()` across flag combos, assert exact warning IDs + bodies per RESEARCH matrix L442-451. ALSO assert wizard byte-equality (RESEARCH L438): import the wizard literal and `expect(deployWarning.body).toBe(wizardLiteral)` OR (post-refactor) confirm the wizard emits exactly the critical subset. Security test (RESEARCH L683): grep golden fixtures for `0x[0-9a-fA-F]{40,64}` and fail if any real-looking key appears.

---

### `tests/deploy/generate.spec.ts` (test/golden+section — D-12)

**Analog:** `tests/templates/erc20/generate.spec.ts` — EXACT pattern to copy.

**Golden snapshot** (L16-43) — `toMatchFileSnapshot` is async, MUST `await`:
```typescript
it("erc20-all-flags matches committed snapshot", async () => {
  const meta = deployMetaErc20({ name:"MyToken", symbol:"MTK", premint:"1000000", mintable:true, burnable:true, pausable:true, access:"roles" });
  const { content } = generateDeployDoc(meta, { now: new Date("2026-05-29T00:00:00Z") }); // FREEZE date
  await expect(content).toMatchFileSnapshot("../fixtures/deploy/erc20-all-flags.DEPLOY.md");
});
```
CRITICAL: inject the frozen `now` so the header date is deterministic (RESEARCH L796). The four fixtures: `erc20-bare`, `erc20-all-flags`, `erc721-all-flags-with-royalty`, `erc1155-all-flags` (RESEARCH L644-648).

**Per-section assertions** (mirror L45-134 `toContain` style) — assert Hardhat/Foundry/Remix/Etherscan headers present, `--broadcast` present, full solc version present, correct ctor-arg count, expected warning string.

---

### `tests/fixtures/deploy/*.DEPLOY.md` (fixtures ×4)

**Analog:** `tests/fixtures/erc20/all-flags-on.sol` — committed golden discipline. These are GENERATED by the golden test on first run (Vitest writes the file when missing), then committed and reviewed. Same as the `.sol` fixtures. Representative spread, NOT exhaustive (D-12, mirrors Phase 2 D-10).

---

### `tests/commands/create.compile.spec.ts` (test/e2e — D-14) — MODIFY

**Analog:** the same file's existing happy-path tests (L146-215). Extend: after a create run assert BOTH `<Name>.sol` AND `<Name>.DEPLOY.md` exist (`existsSync` already imported L2), and the DEPLOY.md `readFileSync` content contains Hardhat/Foundry/Remix headers + the expected centralization warning. RESEARCH L662 notes: add an all-flags mock run to exercise warnings (current `primeHappyPathMocks` L70-77 is no-flags → empty warnings). The `captureStdio` (L47-68) + `prime*HappyPathMocks` (L70-104) + per-template `beforeEach` register block (L128-139) are the harness to reuse — add a `--newbie` create then read the deploy path.

---

## Shared Patterns

### Pure-transform + `{ a, b }` return shape
**Source:** `src/templates/erc20/generate.ts` L35-49
**Apply to:** `src/deploy/index.ts`, `src/deploy/sections/*.ts`, `src/templates/*/deployMeta.ts`
All deploy-module logic is pure synchronous transform — no I/O, no throws on happy path. I/O (writeFile) lives ONLY in the dispatcher. `generateDeployDoc` returns `{ filename, content }`; sections return `string`.

### NodeNext relative imports use `.js`
**Source:** `src/templates/erc20/generate.ts` L16 (`from "./filename.js"`), `index.ts` L12 (`from "../../registry/index.js"`)
**Apply to:** every new `src/deploy/**` file and the modified imports in `create.ts`/`wizard.ts`. Relative imports carry the `.js` extension even for `.ts` source (type:module + NodeNext).

### CliError with WHAT/WHY/FIX + stable error code
**Source:** `src/lib/prompt.ts` L26-31, `src/commands/create.ts` L42-48
**Apply to:** `confirmOverwriteMany` (reuse `ERR_FILE_EXISTS`). Never invent a new error code; reuse the existing one (RESEARCH §Security V7).

### Additive optional field on a locked interface
**Source:** `src/registry/types.ts` L16-19 (`runWizard?`/`generate?`)
**Apply to:** `deployMeta?` on `Template<TOpts>`, and the per-template binding literals (`index.ts` files). Never remove/rename the five locked fields.

### `output.warn` is the always-on critical channel
**Source:** `src/templates/erc20/wizard.ts` L143-144 comment + L146
**Apply to:** the D-03 wizard refactor — emit only `severity==="critical"` warnings via `output.warn` to keep visible behavior byte-identical.

### Golden snapshot via `await expect(x).toMatchFileSnapshot(relpath)`
**Source:** `tests/templates/erc20/generate.spec.ts` L27-29
**Apply to:** `tests/deploy/generate.spec.ts`. MUST `await` (Vitest 4). Fixture paths relative to the spec file.

### Vitest 4 ESM mock-before-import for @clack/prompts
**Source:** `tests/commands/create.compile.spec.ts` L9-34, `tests/prompt.spec.ts` L5-14
**Apply to:** `tests/deploy/warnings.spec.ts` (if it touches wizard) and the extended e2e test. `vi.mock("@clack/prompts", ...)` BEFORE the dynamic `await import(...)`.

### safeReadVersion for provenance / version lines
**Source:** `src/lib/version.ts` L18-50, used in `create.ts` L134-135
**Apply to:** `sections/header.ts` — `safeReadVersion("solc")`, `safeReadVersion("@openzeppelin/contracts")`, and the newly-exported `readOwnVersion()`. Fallback to `"unknown"` string (matches create.ts L134 `?? "unknown"`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/deploy/constructorArgs.ts` | utility | transform | No existing flag→constructor-arg builder; greenfield, but RESEARCH §Constructor-Arg Matrix L256-286 provides the exact verified implementation (fixture-locked) |
| `src/deploy/sections/*.ts` | component | transform | No existing Markdown-section renderer; greenfield `(meta)=>string` composition documented in RESEARCH §Pattern 2 L548-567 |

Both are "no codebase analog" but fully spec-covered by RESEARCH — the planner should treat the RESEARCH reference implementations as the pattern source.

## Metadata

**Analog search scope:** `src/templates/{erc20,erc721,erc1155}/`, `src/commands/`, `src/lib/`, `src/registry/`, `tests/templates/`, `tests/commands/`, `tests/fixtures/`
**Files scanned:** 16 source + test files read in full or targeted ranges
**Pattern extraction date:** 2026-05-29
