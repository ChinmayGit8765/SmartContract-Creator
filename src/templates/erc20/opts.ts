// Phase 2 type contracts for the ERC-20 canary template.
// Type-only module — no runtime code. Plans 02-02 (wizard) and 02-03 (generate)
// implement the runtime behavior; this file fixes the public shapes they target.
//
// Wave 0 probe decisions (see .planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md):
//   - Import form: naive `import { erc20 } from "@openzeppelin/wizard"` works (Probe A).
//   - premint: "0" passthrough is safe (Probe B) — no remap needed in generate.ts.

import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

/** Locked option shape returned by the ERC-20 wizard and consumed by generate().
 *  Mirrors a subset of `@openzeppelin/wizard@0.10.8` ERC20Options. `access` excludes
 *  "managed" per Assumption A6 / UI-SPEC Prompt 7 (managed access is out of v1 scope).
 */
export interface Erc20Opts {
  readonly name: string;
  readonly symbol: string;
  readonly premint: string;
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  readonly access: false | "ownable" | "roles";
}

/** Injected IO surface for the wizard. Tests substitute a fake `Output` to capture warnings/explanations.
 */
export interface WizardIo {
  readonly output: Output;
}

/** Pure return shape of `generate()`. Filename derived from `name` (see filename.ts in Plan 02-03);
 *  `source` is the literal `.sol` text that will be written to disk.
 */
export interface GenerateResult {
  readonly filename: string;
  readonly source: string;
}

/** Concrete ERC-20 template binding. Narrows the optional `runWizard` / `generate` fields
 *  on `Template<TOpts>` to required (Plan 02-04 registers a value of this type).
 */
export interface Erc20Template extends Template<Erc20Opts> {
  readonly runWizard: (io: WizardIo) => Promise<Erc20Opts>;
  readonly generate: (opts: Erc20Opts) => GenerateResult;
}
