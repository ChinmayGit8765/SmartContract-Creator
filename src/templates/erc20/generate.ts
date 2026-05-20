// Thin pure-function wrapper around `@openzeppelin/wizard@0.10.8` `erc20.print()`.
//
// Per CONTEXT.md D-01 / D-02: no string templating with sentinels — OZ owns the
// Solidity source verbatim. Per CONTEXT.md D-04: returns `{ filename, source }`
// so the dispatcher can `fs.writeFile(filename, source, "utf8")` directly.
//
// Import form chosen per .planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md
// Probe A: naive named import works under NodeNext + type:module
// (`@openzeppelin/wizard@0.10.8` ships a real ESM `erc20` export).
//
// premint mapping per .planning/phases/02-erc-20-canary-template/02-WAVE0-PROBES.md
// Probe B: PASSTHROUGH SAFE — wizard internally suppresses the `_mint(...)`
// constructor line when `premint: "0"`, so we forward `opts.premint` unchanged
// (no `=== "0" ? undefined : opts.premint` remap).
import { erc20 } from "@openzeppelin/wizard";
import { contractNameToFilename } from "./filename.js";
import type { Erc20Opts, GenerateResult } from "./opts.js";

/** Generates an ERC-20 `.sol` source file from `Erc20Opts`.
 *
 *  Pure synchronous transform:
 *    1. Map `Erc20Opts` 1:1 onto wizard's `ERC20Options`. The `ERC20Options`
 *       type is never exposed beyond this module (RESEARCH §Anti-Patterns
 *       line ~386): we deliberately do not pass `info`, so the wizard's default
 *       `{ license: "MIT", securityContact: "" }` applies (matches
 *       wizard.openzeppelin.com byte-for-byte per Assumption A2).
 *    2. Call `erc20.print(mapped)` for the Solidity source string. No
 *       post-processing — D-02 forbids string templating with sentinels.
 *    3. Derive the filename from `opts.name` via `contractNameToFilename`
 *       (D-04 — filename derivation lives in the template).
 *
 *  No throws on the happy path. The dispatcher (Plan 02-04) wraps wizard
 *  failures in CliError; this function does not.
 */
export function generate(opts: Erc20Opts): GenerateResult {
  const source = erc20.print({
    name: opts.name,
    symbol: opts.symbol,
    premint: opts.premint, // PASSTHROUGH SAFE per Probe B
    mintable: opts.mintable,
    burnable: opts.burnable,
    pausable: opts.pausable,
    access: opts.access,
  });
  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
