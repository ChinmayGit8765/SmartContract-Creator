# Phase 4: ERC-721 + ERC-1155 Templates - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 24 new + 5 modified = 29 total
**Analogs found:** 28 / 29 (1 file — `royalty.ts` — is a greenfield pattern documented from RESEARCH)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/templates/erc721/index.ts` | template-plugin barrel | register-side-effect | `src/templates/erc20/index.ts` | exact (1:1 clone) |
| `src/templates/erc721/wizard.ts` | interactive wizard | request-response (TTY) | `src/templates/erc20/wizard.ts` | exact (clone + 2 extra prompts + royalty branch + 3 warnings) |
| `src/templates/erc721/generate.ts` | pure transform | request-response | `src/templates/erc20/generate.ts` | exact (clone + conditional royalty post-process call) |
| `src/templates/erc721/opts.ts` | type contract | data-shape | `src/templates/erc20/opts.ts` | exact (clone + `Erc721RoyaltyOpts` sub-type) |
| `src/templates/erc721/royalty.ts` | string post-process transform | transform | **none — greenfield** | new pattern (4-anchor walker — RESEARCH §Pattern 3) |
| `src/templates/erc721/validators.ts` | input validators | request-response | `src/templates/erc20/validators.ts` | role-match (clone + 3 new validators) |
| `src/templates/erc721/filename.ts` | utility | transform | `src/templates/erc20/filename.ts` | exact (re-export or 1:1 clone) |
| `src/templates/erc721/README.md` | docs | n/a | (none in `src/templates/erc20/`) | no analog — new convention |
| `src/templates/erc1155/index.ts` | template-plugin barrel | register-side-effect | `src/templates/erc20/index.ts` | exact (1:1 clone) |
| `src/templates/erc1155/wizard.ts` | interactive wizard | request-response (TTY) | `src/templates/erc20/wizard.ts` | exact (clone, swap prompt list) |
| `src/templates/erc1155/generate.ts` | pure transform | request-response | `src/templates/erc20/generate.ts` | exact (1:1 clone, swap `erc20.print` → `erc1155.print`) |
| `src/templates/erc1155/opts.ts` | type contract | data-shape | `src/templates/erc20/opts.ts` | exact (clone, swap fields) |
| `src/templates/erc1155/validators.ts` | input validators | request-response | `src/templates/erc20/validators.ts` | role-match (clone `isSolidityIdentifier` + add `isNonEmptyUri`) |
| `src/templates/erc1155/filename.ts` | utility | transform | `src/templates/erc20/filename.ts` | exact (re-export or 1:1 clone) |
| `src/templates/erc1155/README.md` | docs | n/a | (none) | no analog — new convention |
| `tests/templates/erc721/wizard.spec.ts` | unit test | request-response | `tests/templates/erc20/wizard.spec.ts` | exact (clone, extend prompts) |
| `tests/templates/erc721/generate.spec.ts` | unit test (snapshot) | transform | `tests/templates/erc20/generate.spec.ts` | exact (clone, swap fixture paths) |
| `tests/templates/erc721/royalty.spec.ts` | unit test | transform | (no direct analog) | role-match — uses `generate.spec.ts` snapshot + Phase 3 gate pattern |
| `tests/templates/erc721/validators.spec.ts` | unit test | request-response | `tests/templates/erc20/validators.spec.ts` | exact (clone, swap validator imports) |
| `tests/templates/erc1155/wizard.spec.ts` | unit test | request-response | `tests/templates/erc20/wizard.spec.ts` | exact (clone, swap prompts) |
| `tests/templates/erc1155/generate.spec.ts` | unit test (snapshot) | transform | `tests/templates/erc20/generate.spec.ts` | exact (clone) |
| `tests/templates/erc1155/validators.spec.ts` | unit test | request-response | `tests/templates/erc20/validators.spec.ts` | role-match (smaller — 1 validator) |
| `tests/fixtures/erc721/*.sol` | golden fixtures | committed output | `tests/fixtures/erc20/{bare-default,all-flags-on}.sol` | exact (same shape, different surface) |
| `tests/fixtures/erc1155/*.sol` | golden fixtures | committed output | `tests/fixtures/erc20/{bare-default,all-flags-on}.sol` | exact |
| `src/cli.ts` (MOD) | boot wiring | side-effect | `src/cli.ts` (existing) | self (extend existing 4 lines) |
| `src/commands/create.ts` (MOD) | dispatcher | (untouched except 1 copy line) | `src/commands/create.ts` lines 55-62 | self (edit `fix:` copy only) |
| `tests/registry.spec.ts` (MOD) | unit test | self | `tests/registry.spec.ts` lines 88-96 | self (extend ERC-20 case) |
| `tests/compiler/compile.integration.spec.ts` (MOD) | integration test | self | itself (lines 15-35) | self (refactor to `describe.each` + add 5 rows) |
| `tests/commands/create.compile.spec.ts` (MOD) | E2E test | self | itself (lines 64-71, 92-141) | self (add 2 prime helpers + 2 `it()` blocks) |

## Pattern Assignments

### `src/templates/erc721/index.ts` (template-plugin barrel)

**Analog:** `src/templates/erc20/index.ts` — 1:1 clone, four identifiers change.

**Imports + register pattern** (lines 12-39 of analog — clone verbatim, swap "erc20"→"erc721"):
```typescript
import { register, get } from "../../registry/index.js";
import type { Template } from "../../registry/types.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import type { Erc721Opts } from "./opts.js";

export function registerErc721Template(): void {
  if (get("erc721")) return;
  const tpl: Template<Erc721Opts> = {
    id: "erc721",
    name: "ERC-721 NFT",
    chain: "evm",
    status: "alpha",
    description:
      "Non-fungible token (ERC-721) on EVM chains. Opt-in Mintable/Enumerable/Burnable/Pausable + EIP-2981 royalty.",
    runWizard,
    generate,
  };
  register(tpl as unknown as Template);
}
```

**Key notes:**
- Idempotent `if (get("erc721")) return;` guard (CONTEXT D-01)
- `Template<Erc721Opts>` typed binding then `as unknown as Template` cast at register boundary (analog comment lines 33-37 explains variance)
- Description copy locked by CONTEXT § D-01

---

### `src/templates/erc721/wizard.ts` (interactive wizard, 9+2 prompts)

**Analog:** `src/templates/erc20/wizard.ts` — clone the imports + `cancelGuard` helper + access-control conditional verbatim; add prompts 3 (baseUri), 5 (enumerable), 8-9 (royalty pair), and 3 warnings.

**Imports + cancelGuard pattern** (analog lines 11-31 — clone verbatim, swap validator imports):
```typescript
import { text, select, confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_WIZARD_CANCEL } from "../../lib/errors.js";
import {
  isSolidityIdentifier,
  isAsciiSymbol,
  isValidBaseUriOrEmpty,
  isRoyaltyBps,
  isEthAddress,
} from "./validators.js";
import type { Erc721Opts, WizardIo } from "./opts.js";

function cancelGuard<T>(answer: T | symbol, promptName: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${promptName}.`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template erc721' to start over.",
      exitCode: 130,
    });
  }
  return answer as T;
}
```

**Conditional access-control prompt** (analog lines 121-141 — copy VERBATIM per CONTEXT D-10; do NOT extract):
```typescript
let access: false | "ownable" | "roles" = false;
if (mintable || pausable) {
  io.output.explain(
    "Ownable: one address controls Mint/Pause. Simpler but a single key controls the contract. AccessControl: separate roles for MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE. More flexible, more setup. Use AccessControl if you plan to use a multisig or split duties.",
  );
  access = cancelGuard(
    await select<"ownable" | "roles">({
      message: "Access control style:",
      options: [
        { value: "ownable", label: "Ownable — one address controls Mint/Pause" },
        {
          value: "roles",
          label:
            "AccessControl — separate MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE",
        },
      ],
      initialValue: "ownable",
    }),
    "access control",
  );
}
```

**Centralization warning pattern** (analog lines 145-150 — copy verbatim, add 2 NFT-specific variants per RESEARCH §670-694):
```typescript
if (mintable && access === "ownable") {
  io.output.warn(
    "Mintable + Ownable: a single key can mint unlimited NFTs. " +
      "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  );
}
if (royalty.enabled && access === "ownable") {
  io.output.warn(
    "EIP-2981 + Ownable: the contract owner can change the royalty recipient at any time via _setDefaultRoyalty. " +
      "Marketplaces may distrust royalty signals from single-key-controlled contracts.",
  );
}
if (pausable && access === "ownable") {
  io.output.warn(
    "Pausable + Ownable: a single key can halt all NFT transfers. " +
      "Consider AccessControl (multi-role) or a multisig owner.",
  );
}
```

**Royalty opt-in pair (NEW prompts 8/9a/9b — RESEARCH lines 910-926):**
```typescript
const royaltyEnabled = cancelGuard(
  await confirm({ message: "Enable EIP-2981 royalty? (signals royalty to marketplaces)", initialValue: false }),
  "royalty",
);
let royalty: Erc721Opts["royalty"] = { enabled: false, feeNumerator: 0, receiver: "0x0000000000000000000000000000000000000000" };
if (royaltyEnabled) {
  io.output.explain("EIP-2981 expresses royalty as basis points: 250 = 2.5%, 10000 = 100%. Marketplaces voluntarily honor the signal.");
  const feeStr = cancelGuard(
    await text({ message: "Royalty basis points (0-10000)", placeholder: "250", defaultValue: "250", validate: isRoyaltyBps }),
    "royalty basis points",
  );
  const receiver = cancelGuard(
    await text({ message: "Royalty recipient address", placeholder: "0x0000000000000000000000000000000000000000", defaultValue: "0x0000000000000000000000000000000000000000", validate: isEthAddress }),
    "royalty recipient",
  );
  royalty = { enabled: true, feeNumerator: Number(feeStr), receiver };
}
```

**Prompt order:** `name → symbol → baseUri → mintable → enumerable → burnable → pausable → royalty? → (if royalty) bps + receiver → (if mintable||pausable) access` (CONTEXT Discretion + RESEARCH §Wizard Prompt Sequences lines 642-655).

---

### `src/templates/erc721/generate.ts` (pure transform + conditional royalty)

**Analog:** `src/templates/erc20/generate.ts` — clone the function shape, swap `erc20.print` → `erc721.print`, add conditional royalty post-process.

**Core pattern** (RESEARCH §Pattern 2 lines 333-360):
```typescript
import { erc721 } from "@openzeppelin/wizard";
import { contractNameToFilename } from "./filename.js";
import { injectRoyalty } from "./royalty.js";
import type { Erc721Opts, GenerateResult } from "./opts.js";

export function generate(opts: Erc721Opts): GenerateResult {
  const wizardSource = erc721.print({
    name: opts.name,
    symbol: opts.symbol,
    baseUri: opts.baseUri,
    mintable: opts.mintable,
    enumerable: opts.enumerable,
    burnable: opts.burnable,
    pausable: opts.pausable,
    uriStorage: opts.uriStorage,
    access: opts.access,
  });

  const source =
    opts.royalty?.enabled
      ? injectRoyalty(wizardSource, opts.royalty)
      : wizardSource;

  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
```

**Why this shape:**
- Mirrors ERC-20's "map opts 1:1 → call wizard.print → derive filename" structure (analog lines 35-49)
- Pure synchronous transform; no I/O, no throws on happy path
- Conditional royalty is the ONE deviation from ERC-20 generate (CONTEXT D-04..D-06)
- When `opts.royalty?.enabled === false`, output is byte-for-byte identical to wizard.print (CONTEXT D-06)

---

### `src/templates/erc721/royalty.ts` (GREENFIELD — no analog)

**Source:** RESEARCH §Pattern 3 (lines 363-473) — the bracket-counting walker. **There is NO existing analog in the codebase.** This is the one place Phase 4 violates Phase 2 D-02 ("no string templating"), explicitly sanctioned by CONTEXT D-04.

**Four-anchor injection strategy** (copy verbatim from RESEARCH §Pattern 3):
```typescript
// Source: 04-RESEARCH §Wave 0 royalty probe — three injection variants validated.
// CRITICAL: anchor 3 (constructor body) MUST use bracket-counting, NOT regex,
// because the wizard sometimes emits an empty constructor body (`{}`) which a
// non-greedy regex would skip past. See §Pitfalls §1.
import type { Erc721RoyaltyOpts } from "./opts.js";

/** Inserts EIP-2981 royalty into wizard's ERC-721 source.
 *
 *  Four insertions (cap-anchored, idempotent):
 *    1. ERC2981 import — after the LAST `@openzeppelin/contracts/...` import.
 *    2. ERC2981 parent — appended to the `contract <Name> is ...` parent list.
 *    3. _setDefaultRoyalty(receiver, fee) — inserted before the constructor body's
 *       closing brace (bracket-counted; tolerates empty body and ANY constructor
 *       modifier chain).
 *    4. ERC2981 token — appended to the existing `supportsInterface(...) override(...)`
 *       list IF AND ONLY IF such an override exists in the wizard output.
 */
export function injectRoyalty(source: string, opts: Erc721RoyaltyOpts): string {
  if (!opts.enabled) return source;
  let s = source;

  // ANCHOR 1: ERC2981 import (after the LAST OZ import line).
  const lines = s.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import \{[^}]+\} from "@openzeppelin\/contracts\/[^"]+\.sol";$/.test(lines[i])) {
      lastImport = i;
    }
  }
  if (lastImport >= 0) {
    lines.splice(
      lastImport + 1,
      0,
      'import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";',
    );
  }
  s = lines.join("\n");

  // ANCHOR 2: ERC2981 in the contract's `is` list.
  s = s.replace(
    /^(contract\s+\w+\s+is\s+)([^{]+?)(\s*\{)/m,
    (_m, prefix, parents, brace) => `${prefix}${parents.trim()}, ERC2981${brace}`,
  );

  // ANCHOR 3: _setDefaultRoyalty before constructor body's closing brace.
  s = insertAtConstructorBodyEnd(
    s,
    `    _setDefaultRoyalty(${opts.receiver}, ${opts.feeNumerator});\n`,
  );

  // ANCHOR 4: supportsInterface override list (no-op if wizard didn't emit one).
  s = s.replace(
    /(function\s+supportsInterface\(bytes4\s+interfaceId\)\s*[\s\S]*?override\()([^)]+)(\))/m,
    (_m, head, list, close) => `${head}${list.trim()}, ERC2981${close}`,
  );

  return s;
}
```

**Bracket-counting walker (anchor 3 helper — RESEARCH lines 439-472):**
```typescript
/** Walks `source` finding `constructor(...) ... {body}` via bracket counting.
 *  Inserts `insertion` immediately before the body's matching closing brace.
 *  Returns source unchanged if no constructor is found (defensive — never throws).
 */
function insertAtConstructorBodyEnd(source: string, insertion: string): string {
  const ctorIdx = source.indexOf("constructor(");
  if (ctorIdx < 0) return source;
  // Walk past the constructor signature's parens.
  let i = ctorIdx + "constructor(".length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") depth--;
    i++;
  }
  // Skip whitespace and any constructor-initializer chain (e.g. `ERC721(...)`).
  while (i < source.length && source[i] !== "{") i++;
  if (i >= source.length) return source;
  const bodyOpen = i;
  // Find matching closing brace (bracket-count from bodyOpen).
  let bd = 1;
  let j = bodyOpen + 1;
  while (j < source.length && bd > 0) {
    if (source[j] === "{") bd++;
    else if (source[j] === "}") bd--;
    j++;
  }
  const bodyClose = j - 1; // index of the matching `}`
  return (
    source.slice(0, bodyClose) +
    (source[bodyClose - 1] === "{" ? "\n" : "") + // open empty `{}` to `{\n`
    insertion +
    source.slice(bodyClose)
  );
}
```

**Pitfall to avoid (RESEARCH §Pitfall 1):** A naïve regex `(constructor\([^)]*\)[\s\S]*?\{)([\s\S]*?)(\n\s*\})` misplaces `_setDefaultRoyalty` into `_baseURI()` when constructor body is `{}`. Bracket-counting is grammar-exact and required.

**Anchor stability table (RESEARCH lines 478-482):**

| Anchor | Wizard output | Stability |
|--------|---------------|-----------|
| 1 — last `@openzeppelin/contracts/...` import | wizard always emits ≥1 OZ import | HIGH |
| 2 — `^contract\s+\w+\s+is\s+...\s*\{` | Solidity grammar invariant | HIGH |
| 3 — bracket-counted constructor body close | tolerates `{}`, modifiers, multi-line | HIGH |
| 4 — `supportsInterface(...) override(...)` | conditional (no-op when wizard omits) | HIGH |

---

### `src/templates/erc721/opts.ts` (type contract)

**Analog:** `src/templates/erc20/opts.ts` lines 1-46 — clone shape; add `Erc721RoyaltyOpts` sub-type per RESEARCH lines 962-998.

**Pattern:**
```typescript
import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

export interface Erc721RoyaltyOpts {
  readonly enabled: boolean;
  readonly feeNumerator: number;   // 0-10000
  readonly receiver: string;        // 0x… 40 hex
}

export interface Erc721Opts {
  readonly name: string;
  readonly symbol: string;
  readonly baseUri: string;         // may be ""
  readonly mintable: boolean;
  readonly enumerable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  readonly uriStorage: boolean;     // not surfaced in wizard; reserved
  readonly royalty: Erc721RoyaltyOpts;
  readonly access: false | "ownable" | "roles";
}

export interface WizardIo {
  readonly output: Output;
}

export interface GenerateResult {
  readonly filename: string;
  readonly source: string;
}

export interface Erc721Template extends Template<Erc721Opts> {
  readonly runWizard: (io: WizardIo) => Promise<Erc721Opts>;
  readonly generate: (opts: Erc721Opts) => GenerateResult;
}
```

**Field stability note (CONTEXT §Specifics):** Field names are the input contract for Phase 5's DEPLOY.md generator — keep `mintable: boolean`, `access: "ownable" | "roles"`, `royalty: { ... }` stable.

---

### `src/templates/erc721/validators.ts` (input validators)

**Analog:** `src/templates/erc20/validators.ts` lines 12-50 — clone regex constants + shape; add 3 new validators per RESEARCH lines 724-756.

**Reused validators (clone or import from erc20):**
```typescript
const SOLIDITY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ASCII_SYMBOL = /^[A-Za-z0-9]{1,11}$/;
// isSolidityIdentifier + isAsciiSymbol bodies copied from erc20/validators.ts:24-39
```

**NEW validators (RESEARCH lines 729-755):**
```typescript
const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export function isEthAddress(v: string | undefined): string | undefined {
  if (!v) return "Recipient address is required.";
  if (!ETH_ADDRESS.test(v)) {
    return "Must be a 42-character hex address starting with 0x.";
  }
  return undefined;
}

export function isRoyaltyBps(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return "Basis points required (0-10000; 250 = 2.5%).";
  if (!/^(?:0|[1-9]\d*)$/.test(v)) return "Must be a non-negative integer.";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10000) {
    return "Must be between 0 and 10000 inclusive (10000 = 100%).";
  }
  return undefined;
}

export function isValidBaseUriOrEmpty(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return undefined;
  if (/\s/.test(v)) return "Base URI must not contain whitespace.";
  return undefined;
}
```

**Pattern:** All exports satisfy `(v: string | undefined) => string | undefined` (analog convention lines 3-5). Return `undefined` on valid, error string on invalid.

---

### `src/templates/erc1155/index.ts` (template-plugin barrel)

**Analog:** `src/templates/erc20/index.ts` — 1:1 clone, swap 4 identifiers.

**Pattern** (same shape as erc721/index.ts above):
```typescript
import { register, get } from "../../registry/index.js";
import type { Template } from "../../registry/types.js";
import { runWizard } from "./wizard.js";
import { generate } from "./generate.js";
import type { Erc1155Opts } from "./opts.js";

export function registerErc1155Template(): void {
  if (get("erc1155")) return;
  const tpl: Template<Erc1155Opts> = {
    id: "erc1155",
    name: "ERC-1155 Multi-Token",
    chain: "evm",
    status: "alpha",
    description:
      "Multi-token (ERC-1155) on EVM chains. Opt-in Mintable/Burnable/Supply/Pausable.",
    runWizard,
    generate,
  };
  register(tpl as unknown as Template);
}
```

---

### `src/templates/erc1155/wizard.ts` (interactive wizard, 7+1 prompts)

**Analog:** `src/templates/erc20/wizard.ts` — clone imports + `cancelGuard` + access-control conditional + warnings. Swap prompts: drop symbol/premint; add uri, supply.

**Prompt order:** `name → uri → mintable → burnable → supply → pausable → (if mintable||pausable) access` (CONTEXT Discretion + RESEARCH lines 660-667).

**Centralization warnings** (RESEARCH lines 697-715 — copy verbatim):
```typescript
if (mintable && access === "ownable") {
  io.output.warn(
    "Mintable + Ownable: a single key can mint unlimited quantities of any token id. " +
      "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
  );
}
if (pausable && access === "ownable") {
  io.output.warn(
    "Pausable + Ownable: a single key can halt all transfers across every token id. " +
      "Consider AccessControl (multi-role) or a multisig owner.",
  );
}
// Always-on warning (wizard default updatableUri:true makes URI mutable by owner).
io.output.warn(
  "ERC-1155 default-URI setter is owner-controlled (wizard default `updatableUri:true`). " +
    "The contract owner can change the URI template at any time. Use a multisig owner or freeze ownership before launch if metadata must be immutable.",
);
```

**Cancel guard:** Same `cancelGuard` helper inline (analog lines 20-31) — `'smartc create --template erc1155'` in the fix line.

---

### `src/templates/erc1155/generate.ts` (pure transform — no post-process)

**Analog:** `src/templates/erc20/generate.ts` lines 35-49 — 1:1 clone, swap `erc20.print` → `erc1155.print`, swap opts fields. **No royalty branch** (CONTEXT D-08).

**Pattern** (RESEARCH §Pattern 4 lines 494-515):
```typescript
import { erc1155 } from "@openzeppelin/wizard";
import { contractNameToFilename } from "./filename.js";
import type { Erc1155Opts, GenerateResult } from "./opts.js";

export function generate(opts: Erc1155Opts): GenerateResult {
  const source = erc1155.print({
    name: opts.name,
    uri: opts.uri,
    mintable: opts.mintable,
    burnable: opts.burnable,
    supply: opts.supply,
    pausable: opts.pausable,
    updatableUri: true, // wizard default; matches wizard.openzeppelin.com
    access: opts.access,
  });
  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
```

---

### `src/templates/erc1155/opts.ts` (type contract)

**Analog:** `src/templates/erc20/opts.ts` — clone shape; swap fields (drop `symbol`/`premint`, add `uri`/`supply`).

**Pattern** (RESEARCH lines 1006-1022):
```typescript
import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

export interface Erc1155Opts {
  readonly name: string;
  readonly uri: string;
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly supply: boolean;
  readonly pausable: boolean;
  readonly access: false | "ownable" | "roles";
}

export interface WizardIo { readonly output: Output; }
export interface GenerateResult { readonly filename: string; readonly source: string; }
export interface Erc1155Template extends Template<Erc1155Opts> {
  readonly runWizard: (io: WizardIo) => Promise<Erc1155Opts>;
  readonly generate: (opts: Erc1155Opts) => GenerateResult;
}
```

---

### `src/templates/erc1155/validators.ts` (input validators)

**Analog:** `src/templates/erc20/validators.ts` — clone `isSolidityIdentifier`; add `isNonEmptyUri` per RESEARCH lines 763-768.

**Pattern:**
```typescript
const SOLIDITY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
// isSolidityIdentifier body cloned from erc20/validators.ts:24-30

export function isNonEmptyUri(v: string | undefined): string | undefined {
  if (!v || v.trim() === "") return "URI template is required (e.g. https://example.com/api/token/{id}.json).";
  if (/\s/.test(v)) return "URI must not contain whitespace.";
  return undefined;
}
```

---

### `src/templates/{erc721,erc1155}/filename.ts` (utility)

**Analog:** `src/templates/erc20/filename.ts` lines 21-34 — exact 1:1 clone OR a 1-line re-export (RESEARCH Open Question 2 recommends re-export).

**Pattern (re-export option — recommended):**
```typescript
export { contractNameToFilename } from "../erc20/filename.js";
```

**Pattern (clone option):**
```typescript
export function contractNameToFilename(contractName: string): string {
  const parts = contractName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  let base = parts.join("");
  base = base.replace(/^[0-9]+/, "");
  if (!base) base = "Token";
  return `${base}.sol`;
}
```

Planner picks; RESEARCH A5 + Open Question 2 recommend re-export (filename is pure utility, not the duplicate-don't-extract rule's target).

---

### `tests/templates/erc721/wizard.spec.ts` (mocked @clack/prompts)

**Analog:** `tests/templates/erc20/wizard.spec.ts` — clone entirely. Same mock pattern, `makeMockOutput`, `beforeEach` resets.

**Mock pattern** (analog lines 1-42 — copy verbatim, swap SUT import to `erc721`):
```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Output } from "../../../src/lib/output.js";

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

const { runWizard } = await import("../../../src/templates/erc721/wizard.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
const selectMock = clack.select as unknown as ReturnType<typeof vi.fn>;
const confirmMock = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

function makeMockOutput(): Output {
  return {
    result: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    explain: vi.fn(),
    reference: vi.fn(),
    nextStep: vi.fn(),
  };
}

beforeEach(() => {
  textMock.mockReset();
  selectMock.mockReset();
  confirmMock.mockReset();
  isCancelMock.mockReset();
  isCancelMock.mockReturnValue(false);
});
```

**Happy-path test shape** (analog lines 44-67 — clone, add ERC-721 priming for 3 text prompts + 5 confirm prompts):
```typescript
it("happy path — no flags set — returns Erc721Opts with access:false and skips access prompt", async () => {
  textMock.mockResolvedValueOnce("MyNFT");
  textMock.mockResolvedValueOnce("MNFT");
  textMock.mockResolvedValueOnce(""); // baseUri (empty)
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // enumerable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // pausable
  confirmMock.mockResolvedValueOnce(false); // royalty
  // ... assertion shape per analog lines 56-66
});
```

**Cancel-at-each-prompt shape** (analog lines 222-335 — clone the 7-block pattern, extend to 11 prompts).

---

### `tests/templates/erc721/generate.spec.ts` (real wizard + golden snapshots)

**Analog:** `tests/templates/erc20/generate.spec.ts` lines 1-43 — clone exactly. Real `generate()`, `toMatchFileSnapshot()` against committed fixtures.

**Golden snapshot pattern** (analog lines 16-42 — copy, swap fixture paths):
```typescript
import { describe, it, expect } from "vitest";
import { generate } from "../../../src/templates/erc721/generate.js";

describe("erc721 generate — golden snapshots", () => {
  it("bare default matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyNFT",
      symbol: "MNFT",
      baseUri: "",
      mintable: false,
      enumerable: false,
      burnable: false,
      pausable: false,
      uriStorage: false,
      royalty: { enabled: false, feeNumerator: 0, receiver: "0x0000000000000000000000000000000000000000" },
      access: false,
    });
    // toMatchFileSnapshot is async — MUST await per Vitest 4.
    await expect(source).toMatchFileSnapshot("../../fixtures/erc721/bare-default.sol");
  });

  it("all-flags-on matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyNFT", symbol: "MNFT", baseUri: "https://example.com/api/token/",
      mintable: true, enumerable: true, burnable: true, pausable: true, uriStorage: false,
      royalty: { enabled: false, feeNumerator: 0, receiver: "0x0000000000000000000000000000000000000000" },
      access: "roles",
    });
    await expect(source).toMatchFileSnapshot("../../fixtures/erc721/all-flags-on.sol");
  });

  it("all-flags-on-with-royalty matches committed snapshot", async () => {
    const { source } = generate({
      name: "MyNFT", symbol: "MNFT", baseUri: "https://example.com/api/token/",
      mintable: true, enumerable: true, burnable: true, pausable: true, uriStorage: false,
      royalty: { enabled: true, feeNumerator: 250, receiver: "0x0000000000000000000000000000000000000000" },
      access: "roles",
    });
    await expect(source).toMatchFileSnapshot("../../fixtures/erc721/all-flags-on-with-royalty.sol");
  });
});
```

**Per-flag assertion pattern** (analog lines 45-134 — clone the shape, swap flag list to NFT-specific: enumerable/uriStorage/burnable/mintable+ownable/mintable+roles/pausable+roles).

**Critical:** `await expect(...).toMatchFileSnapshot(...)` — async per Vitest 4 (analog line 27 comment).

---

### `tests/templates/erc721/royalty.spec.ts` (NEW — no direct analog)

**Source pattern:** Hybrid — uses `tests/templates/erc20/generate.spec.ts` snapshot shape + `tests/compiler/compile.integration.spec.ts` real-solc `compileVerify` shape.

**Three test cases** (CONTEXT D-17 + RESEARCH §Probe C lines 796-800):
1. Bare ERC-721 + royalty 250 bps → 4 anchors fire (anchor 4 no-ops); result compiles.
2. Ownable + mintable + royalty 500 bps → 3 anchors fire (anchor 4 no-ops); result compiles.
3. All-flags + roles + royalty 250 bps → all 4 anchors fire; result compiles.

**Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { erc721 } from "@openzeppelin/wizard";
import { injectRoyalty } from "../../../src/templates/erc721/royalty.js";
import { compileVerify } from "../../../src/compiler/index.js";

describe("injectRoyalty — 4-anchor post-process", () => {
  it("bare ERC-721 + royalty: anchor 4 no-ops; result compiles", async () => {
    const wizardSrc = erc721.print({ name: "T", symbol: "T" });
    const injected = injectRoyalty(wizardSrc, {
      enabled: true, feeNumerator: 250, receiver: "0x" + "0".repeat(40),
    });
    expect(injected).toContain('import {ERC2981}');
    expect(injected).toMatch(/contract\s+\w+\s+is\s+[^{]+ERC2981/);
    expect(injected).toMatch(/_setDefaultRoyalty\(0x0+,\s*250\);/);
    // compileVerify routes through Phase 3 gate — proves shape is valid Solidity.
    const result = await compileVerify(injected, "evm");
    expect(Array.isArray(result.warnings)).toBe(true);
  });
  // ... 2 more test cases per CONTEXT D-17
});
```

**Why no analog:** No existing test pipes a transform through the compile gate. Closest shape is `tests/compiler/compile.integration.spec.ts` lines 23-35.

---

### `tests/templates/erc721/validators.spec.ts` (validator boundary tests)

**Analog:** `tests/templates/erc20/validators.spec.ts` — clone the boundary-table shape per validator.

**Boundary test pattern** (analog `describe("isSolidityIdentifier", ...)` lines 13-66 — clone for each new validator):
```typescript
describe("isEthAddress", () => {
  it("rejects empty / undefined with locked required message", () => {
    expect(isEthAddress(undefined)).toBe("Recipient address is required.");
    expect(isEthAddress("")).toBe("Recipient address is required.");
  });
  it("accepts canonical 0x... 40-hex addresses", () => {
    expect(isEthAddress("0x" + "0".repeat(40))).toBeUndefined();
    expect(isEthAddress("0x" + "f".repeat(40))).toBeUndefined();
  });
  it("rejects wrong length / wrong prefix / non-hex", () => {
    expect(isEthAddress("0x" + "0".repeat(39))).toBeDefined();
    expect(isEthAddress("0X" + "0".repeat(40))).toBeDefined(); // wrong case prefix
    expect(isEthAddress("0x" + "g".repeat(40))).toBeDefined(); // non-hex
  });
});

describe("isRoyaltyBps", () => {
  it("accepts 0 (boundary)", () => { expect(isRoyaltyBps("0")).toBeUndefined(); });
  it("accepts 10000 (boundary)", () => { expect(isRoyaltyBps("10000")).toBeUndefined(); });
  it("rejects 10001", () => { expect(isRoyaltyBps("10001")).toBeDefined(); });
  it("rejects '-1'", () => { expect(isRoyaltyBps("-1")).toBeDefined(); });
  it("rejects '01' (leading zero)", () => { expect(isRoyaltyBps("01")).toBeDefined(); });
  // ... same shape as isNonNegativeDecimal analog
});
```

---

### `tests/templates/erc1155/*.spec.ts` (mirror erc721 specs)

**Same analogs as erc721:** clone `tests/templates/erc20/{wizard,generate,validators}.spec.ts`. Swap SUT imports + opts shape. No royalty spec (CONTEXT D-08).

**Differences from erc721 specs:**
- 7 prompts instead of 11 → fewer cancel cases (analog lines 222-335 pattern)
- 2 snapshots (`bare-default.sol`, `all-flags-on.sol`) — no `all-flags-on-with-royalty.sol`
- Only 1 new validator to test (`isNonEmptyUri`) — small spec

---

### `tests/fixtures/erc721/*.sol` + `tests/fixtures/erc1155/*.sol` (committed wizard outputs)

**Analog:** `tests/fixtures/erc20/{bare-default,all-flags-on}.sol` — same shape (`// SPDX-License-Identifier: MIT` header → pragma → imports → contract).

**Generation method** (RESEARCH §Wave 0 Gaps lines 1193-1197): Generate via `erc721.print(...)` / `erc1155.print(...)` Wave 0 probe, commit as-emitted (LF-encoded), let `toMatchFileSnapshot()` validate per-PR.

**Header convention from analog** (`bare-default.sol` lines 1-3):
```solidity
// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;
```

**Royalty-injected fixture** (`tests/fixtures/erc721/all-flags-on-with-royalty.sol`): all-flags-on piped through `injectRoyalty({enabled:true, feeNumerator:250, receiver:"0x0000…"})` — must include `import {ERC2981}` + `ERC2981` in `is` list + `_setDefaultRoyalty(...)` in constructor body + `ERC2981` in `supportsInterface` override list.

---

### `src/cli.ts` (MODIFY — 4 lines added)

**Analog (self):** Lines 1-9 of existing `src/cli.ts`.

**Current state (lines 2-9):**
```typescript
import { buildProgram } from "./program.js";
import { registerErc20Template } from "./templates/erc20/index.js";
// ...
async function main(): Promise<void> {
  registerErc20Template();
  const program = buildProgram();
```

**Target state:**
```typescript
import { buildProgram } from "./program.js";
import { registerErc20Template } from "./templates/erc20/index.js";
import { registerErc721Template } from "./templates/erc721/index.js";
import { registerErc1155Template } from "./templates/erc1155/index.js";
// ...
async function main(): Promise<void> {
  registerErc20Template();
  registerErc721Template();
  registerErc1155Template();
  const program = buildProgram();
```

**Pattern:** Two new imports + two new boot calls. Order doesn't matter (registry rejects duplicate ids at boot per CONTEXT D-15).

---

### `src/commands/create.ts` (MODIFY — E_USAGE copy ONLY)

**Analog (self):** Lines 54-62 of existing `src/commands/create.ts` — only the `fix:` line copy changes.

**Current (lines 56-60):**
```typescript
what: "Missing --template flag.",
why: "`smartc create` requires --template in Phase 2 (one template ships: erc20). Phase 4 introduces the interactive multi-template picker.",
fix: "Re-run with `--template erc20`. Run `smartc list-templates` to see available templates.",
exitCode: 2,
```

**Target (CONTEXT D-14):**
```typescript
what: "Missing --template flag.",
why: "`smartc create` requires --template. Three templates ship in Phase 4: erc20, erc721, erc1155. The interactive multi-template picker is deferred.",
fix: "Re-run with `--template <erc20|erc721|erc1155>`. Run `smartc list-templates` to see available templates.",
exitCode: 2,
```

**Critical:** NO other changes to `src/commands/create.ts` per CONTEXT D-12. The compile-verify call at line 111 is untouched.

---

### `tests/registry.spec.ts` (MODIFY — extend ERC-20 test to 3-template case)

**Analog (self):** Lines 88-96 (the existing `registerErc20Template` test).

**Pattern (extend or add new `it()`):**
```typescript
it("registers all three Phase 4 templates without collision and exposes runWizard/generate", () => {
  registerErc20Template();
  registerErc721Template();
  registerErc1155Template();
  expect(list()).toHaveLength(3);
  for (const id of ["erc20", "erc721", "erc1155"]) {
    const tpl = get(id)!;
    expect(tpl.id).toBe(id);
    expect(tpl.chain).toBe("evm");
    expect(typeof (tpl as Record<string, unknown>).runWizard).toBe("function");
    expect(typeof (tpl as Record<string, unknown>).generate).toBe("function");
  }
});

it("calling registerErc721Template() twice does not throw (idempotent)", () => {
  registerErc721Template();
  expect(() => registerErc721Template()).not.toThrow();
  expect(list()).toHaveLength(1);
});
```

**Import additions to test file:**
```typescript
import { registerErc721Template } from "../src/templates/erc721/index.js";
import { registerErc1155Template } from "../src/templates/erc1155/index.js";
```

---

### `tests/compiler/compile.integration.spec.ts` (MODIFY — add 5 fixture rows)

**Analog (self):** Current shape lines 15-35 (3 hardcoded `it()` blocks).

**Refactor pattern** (RESEARCH lines 1027-1055 — convert to `describe.each`):
```typescript
const FIXTURES: Array<{label: string; path: string}> = [
  { label: "erc20 bare-default",            path: "../fixtures/erc20/bare-default.sol" },
  { label: "erc20 all-flags-on",             path: "../fixtures/erc20/all-flags-on.sol" },
  // Phase 4 — NEW:
  { label: "erc721 bare-default",            path: "../fixtures/erc721/bare-default.sol" },
  { label: "erc721 all-flags-on",            path: "../fixtures/erc721/all-flags-on.sol" },
  { label: "erc721 all-flags-on-with-royalty", path: "../fixtures/erc721/all-flags-on-with-royalty.sol" },
  { label: "erc1155 bare-default",           path: "../fixtures/erc1155/bare-default.sol" },
  { label: "erc1155 all-flags-on",           path: "../fixtures/erc1155/all-flags-on.sol" },
];

describe.each(FIXTURES)("compileVerify — $label fixture", ({ path }) => {
  it("compiles clean (zero errors)", async () => {
    const source = readFileSync(join(__dirname, path), "utf8");
    const result = await compileVerify(source, "evm");
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
```

**Keep the two error-path `it()` blocks** (lines 37-66 — broken.sol + warns-no-error.sol) unchanged. Only the parametrized happy-path block extends.

---

### `tests/commands/create.compile.spec.ts` (MODIFY — add 2 happy-path E2E cases)

**Analog (self):** Lines 64-71 (`primeHappyPathMocks`) + lines 111-140 (happy-path `it()`).

**Add 2 prime helpers** (RESEARCH lines 1064-1082):
```typescript
function primeErc721HappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyNFT");                          // name
  textMock.mockResolvedValueOnce("MNFT");                            // symbol
  textMock.mockResolvedValueOnce(""); // baseUri (empty)
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // enumerable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // pausable
  confirmMock.mockResolvedValueOnce(false); // royalty
}

function primeErc1155HappyPathMocks(): void {
  textMock.mockResolvedValueOnce("MyMulti");                                 // name
  textMock.mockResolvedValueOnce("https://example.com/api/token/{id}.json"); // uri
  confirmMock.mockResolvedValueOnce(false); // mintable
  confirmMock.mockResolvedValueOnce(false); // burnable
  confirmMock.mockResolvedValueOnce(false); // supply
  confirmMock.mockResolvedValueOnce(false); // pausable
}
```

**Add 2 `it()` blocks paralleling the existing ERC-20 happy-path test** (lines 111-140):
- Prime mocks via the new helper
- Call `program.parseAsync(["create", "--template", "erc721", ...])`
- Assert `existsSync(outPath)` + `written.includes("contract MyNFT")` + footer copy
- Same `captureStdio` wrapper (analog lines 41-62)
- Same `beforeEach` registers all 3 templates: extend lines 96-97 to `registerErc20/721/1155Template()` calls

---

## Shared Patterns

### Pattern S1: Cancel guard (locked CliError shape)

**Source:** `src/templates/erc20/wizard.ts` lines 20-31
**Apply to:** `src/templates/erc721/wizard.ts`, `src/templates/erc1155/wizard.ts`

```typescript
function cancelGuard<T>(answer: T | symbol, promptName: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${promptName}.`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template <id>' to start over.",  // swap <id> per template
      exitCode: 130,
    });
  }
  return answer as T;
}
```

**Notes:** Inline per template (UI-SPEC Components Inventory — `cancelGuard` stays INLINE until a third consumer; even with Phase 4's two new templates, no extraction per CONTEXT D-10).

---

### Pattern S2: Conditional access-control select prompt (DUPLICATE per CONTEXT D-10)

**Source:** `src/templates/erc20/wizard.ts` lines 121-141
**Apply to:** `src/templates/erc721/wizard.ts` (after pausable + royalty prompts), `src/templates/erc1155/wizard.ts` (after pausable)

Full code in §Pattern Assignments above (`src/templates/erc721/wizard.ts` section). **CRITICAL:** Per CONTEXT D-10, do NOT extract to a shared module — duplication is the additive-model test.

---

### Pattern S3: Vitest 4 ESM mock pattern for @clack/prompts

**Source:** `tests/templates/erc20/wizard.spec.ts` lines 1-23
**Apply to:** All new `tests/templates/<id>/wizard.spec.ts`, `tests/commands/create.compile.spec.ts`

```typescript
// Mock BEFORE importing the SUT.
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

const { runWizard } = await import("../../../src/templates/<id>/wizard.js");
const clack = await import("@clack/prompts");

const textMock = clack.text as unknown as ReturnType<typeof vi.fn>;
// ...
```

**Critical:** Dynamic `await import()` of the SUT — top-level `import` would resolve before the mock factory.

---

### Pattern S4: Output factory mock (`makeMockOutput`)

**Source:** `tests/templates/erc20/wizard.spec.ts` lines 25-34
**Apply to:** All new wizard.spec.ts files

```typescript
function makeMockOutput(): Output {
  return {
    result: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    explain: vi.fn(),
    reference: vi.fn(),
    nextStep: vi.fn(),
  };
}
```

**Used to assert:** `output.warn` was called with locked centralization copy; `output.explain` / `output.reference` fired in newbie preamble.

---

### Pattern S5: Golden snapshot with `toMatchFileSnapshot()` (await required)

**Source:** `tests/templates/erc20/generate.spec.ts` lines 17-42
**Apply to:** All new `tests/templates/<id>/generate.spec.ts`

```typescript
await expect(source).toMatchFileSnapshot("../../fixtures/<id>/<name>.sol");
```

**Critical:** `toMatchFileSnapshot` is async in Vitest 4 — MUST `await expect(...)` (analog line 27 comment + RESEARCH Pitfall 2). Path is relative to the spec file.

---

### Pattern S6: Real-solc integration test (Phase 3 `compileVerify` gate)

**Source:** `tests/compiler/compile.integration.spec.ts` lines 23-35
**Apply to:** `tests/templates/erc721/royalty.spec.ts`, extended `tests/compiler/compile.integration.spec.ts`

```typescript
const source = readFileSync(FIXTURE_PATH, "utf8");
const result = await compileVerify(source, "evm");
expect(Array.isArray(result.warnings)).toBe(true);
```

**No `vi.mock`.** Routes through real solc 0.8.35 + real `@openzeppelin/contracts@5.6.1` import callback + `evmVersion: "cancun"`. Catches OZ-version drift.

---

### Pattern S7: E2E captureStdio + program.parseAsync

**Source:** `tests/commands/create.compile.spec.ts` lines 41-62 (`captureStdio`) + 111-140 (happy-path)
**Apply to:** Extended `tests/commands/create.compile.spec.ts` (new ERC-721/1155 it blocks)

```typescript
const program = buildProgram();
const captured = await captureStdio(async () => {
  await program
    .exitOverride()
    .parseAsync(["create", "--template", "erc721", "--newbie", "--out", outPath], { from: "user" });
});
expect(existsSync(outPath)).toBe(true);
expect(captured).toContain(`Wrote ${outPath}`);
expect(captured).toContain("Compile-verified against solc");
```

**Notes:** `exitOverride()` prevents `process.exit`; `from: "user"` skips argv[0..1] parsing. Tempdir created in `beforeEach` per analog lines 95-104.

---

### Pattern S8: SPDX + pragma fixture header (matches wizard output)

**Source:** `tests/fixtures/erc20/bare-default.sol` lines 1-3
**Apply to:** All new `tests/fixtures/{erc721,erc1155}/*.sol`

```solidity
// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;
```

**Notes:** Wizard emits this header verbatim. Fixtures must match byte-for-byte (LF-encoded).

---

### Pattern S9: Validator return contract

**Source:** `src/templates/erc20/validators.ts` lines 3-6
**Apply to:** `src/templates/{erc721,erc1155}/validators.ts`

```typescript
// Contract: (v: string | undefined) => string | undefined
// - undefined when valid
// - error message string when invalid
```

All new validators (`isEthAddress`, `isRoyaltyBps`, `isValidBaseUriOrEmpty`, `isNonEmptyUri`) satisfy this signature.

---

### Pattern S10: Stable error codes (no new codes in Phase 4)

**Source:** `src/lib/errors.ts` lines 3-11
**Apply to:** All Phase 4 code

```typescript
ERR_FILE_EXISTS    = "E_FILE_EXISTS"
ERR_USAGE          = "E_USAGE"
ERR_WIZARD_CANCEL  = "E_WIZARD_CANCEL"
ERR_INVALID_INPUT  = "E_INVALID_INPUT"   // exists per Phase 2 — no edit needed
ERR_COMPILE_FAILED = "E_COMPILE_FAILED"
```

**Phase 4 uses:** `ERR_WIZARD_CANCEL` (cancelGuard), `ERR_USAGE` (template-not-found / E_USAGE copy), `ERR_INVALID_INPUT` (validator failures bubbled up — but validators return strings, not throws; reserved for future). NO new codes.

---

## No Analog Found

| File | Role | Data Flow | Reason | Pattern source |
|------|------|-----------|--------|----------------|
| `src/templates/erc721/royalty.ts` | string post-process transform | transform | No existing post-process transform in codebase | RESEARCH §Pattern 3 (4-anchor bracket-counting walker), Wave 0 probe-validated against 3 wizard outputs |
| `src/templates/{erc721,erc1155}/README.md` | per-template docs | n/a | No README inside `src/templates/erc20/` (new convention per CONTEXT Discretion) | CONTEXT Discretion + RESEARCH §Project Structure |

**For `royalty.ts`:** Planner uses RESEARCH §Pattern 3 (lines 363-473) verbatim. Bracket-counting walker is required (NOT regex) for anchor 3 — see RESEARCH §Pitfall 1.

**For READMEs:** New convention; one short page per template explaining the wizard prompt set, the opts mapping, the royalty post-process (ERC-721 only), and any deviations from wizard defaults (CONTEXT Discretion). No existing analog — planner drafts fresh.

## Metadata

**Analog search scope:**
- `src/templates/erc20/**` (6 files — full read)
- `src/cli.ts` (full read — boot wiring)
- `src/commands/create.ts` (full read — E_USAGE copy target)
- `src/registry/types.ts` (full read — Template interface)
- `src/lib/errors.ts` (Grep for stable error codes)
- `tests/templates/erc20/**` (full read of wizard/generate/validators specs)
- `tests/fixtures/erc20/*.sol` (full read of both fixtures)
- `tests/registry.spec.ts` (full read)
- `tests/compiler/compile.integration.spec.ts` (full read)
- `tests/commands/create.compile.spec.ts` (full read)

**Files scanned:** 17

**Match summary:**
- Files with exact analog: 24
- Files with role-match analog: 3 (validators, royalty.spec.ts, README — partial role match)
- Files with no analog: 2 (`royalty.ts` — use RESEARCH §Pattern 3; READMEs — new convention)

**Key patterns identified:**
- All template plugins follow the 4-file shape: `index.ts` (barrel + register) + `wizard.ts` (@clack/prompts sequence) + `generate.ts` (wizard.print wrapper) + `opts.ts` (type contract)
- All wizards follow the inline `cancelGuard` helper + `output.explain`/`reference`/`warn` flow
- Conditional access-control prompt is DUPLICATED per template (CONTEXT D-10 — additive-model test)
- All tests follow Vitest 4 ESM dynamic-import-after-mock pattern
- Golden snapshots use `await expect(source).toMatchFileSnapshot(...)` (async in Vitest 4)
- Integration tests use real solc (no `vi.mock`) routed through `compileVerify(source, "evm")`
- The royalty post-process is the ONE greenfield pattern — bracket-counting walker per RESEARCH §Pattern 3

**Pattern extraction date:** 2026-05-28
