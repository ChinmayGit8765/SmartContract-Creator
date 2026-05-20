# Phase 2 Wave 0 Probes — Recorded Outcomes

Two RESEARCH §Assumptions (A1 import-form, A7 premint-"0") were marked LOW-confidence
and gated as Wave 0 probes. Both ran against `@openzeppelin/wizard@0.10.8` (exact pin,
installed via `npm install @openzeppelin/wizard@0.10.8 --save-exact`). Decisions
recorded below are the source-of-truth Plans 02-03 cite when writing their imports
and `generate.ts` premint mapping rule.

---

## Probe A — Import Form (RESEARCH §Pattern 1 / Assumption A1 / Pitfall 1)

**Command:**

```
node --input-type=module -e "import { erc20 } from '@openzeppelin/wizard'; console.log(typeof erc20.print);"
```

**Literal stdout:**

```
function
```

**Decision: NAIVE form works.**

Use the named-import form directly:

```ts
import { erc20 } from "@openzeppelin/wizard";
```

The defensive default-destructure pattern (`import wizard from "@openzeppelin/wizard"; const { erc20 } = wizard;`) is NOT required. `@openzeppelin/wizard@0.10.8` exposes `erc20` as a true named ESM export resolvable under NodeNext module resolution from a `type:module` project. Plans 02-03 should use the naive form and document this above the import in `src/templates/erc20/opts.ts` (or wherever the wizard is first imported).

---

## Probe B — `premint: "0"` Behavior (RESEARCH §Pitfall 5 / Assumption A7)

**Command:**

```
node --input-type=module -e "import { erc20 } from '@openzeppelin/wizard'; console.log(erc20.print({ name:'X', symbol:'X', premint:'0' }));"
```

**Literal stdout:**

```
// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract X is ERC20, ERC20Permit {
    constructor() ERC20("X", "X") ERC20Permit("X") {}
}
```

**Decision: PASSTHROUGH SAFE.**

`@openzeppelin/wizard@0.10.8` emits NO `_mint(...)` line in the constructor when `premint: "0"` is passed — the zero case is already filtered internally. Plans 02-03 may pass the user's `premint` string through unchanged to `erc20.print(...)`; NO remap of `"0"` → `undefined` is required in `generate.ts`.

This removes the only behavioral branch the planner flagged for the premint flow. The validator (`isNonNegativeDecimal`) is the only thing standing between user input and the wizard for premint values.

---

## Cross-references

- Plan 02-02 — consume Decision A when writing the wizard import; consume Decision B when shaping the wizard's premint prompt default.
- Plan 02-03 — consume Decision A when writing the generate.ts import; consume Decision B in the body of generate.ts (no special-case for "0").
- RESEARCH.md §Pattern 1 (import form) and §Pitfall 5 (premint zero) — this file is the recorded resolution of those two LOW-confidence assumptions.

*Recorded 2026-05-21 during Plan 02-01 Task 1 execution.*
