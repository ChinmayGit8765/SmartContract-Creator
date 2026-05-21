// @clack/prompts `validate` callbacks for the ERC-20 wizard.
//
// All three exports satisfy the contract `(v: string | undefined) => string | undefined`:
//   - Return `undefined` when the value is valid.
//   - Return the error message string when invalid.
//
// Regexes are locked from .planning/phases/02-erc-20-canary-template/02-RESEARCH.md
// §Validators (lines ~456-491). Error strings are locked from
// .planning/phases/02-erc-20-canary-template/02-UI-SPEC.md Prompts 1/2/3 tables
// (lines ~84-119) — paste them byte-exact; never paraphrase.

/** Solidity grammar minus `$` for cross-language hygiene (SPL/Anchor pipelines).
 *  See RESEARCH §Validators / Assumption A8.
 */
const SOLIDITY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** ERC-20 practical 1-11 char symbol convention (Assumption A9). ASCII letters/digits only. */
const ASCII_SYMBOL = /^[A-Za-z0-9]{1,11}$/;

/** Non-negative decimal string with no exponent (`0`, `123`, `1.5` — not `1e6`, not `01`, not `-1`). */
const DECIMAL_STRING = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

/** Validates a Solidity contract-name identifier. Locked UI-SPEC copy on failure. */
export function isSolidityIdentifier(v: string | undefined): string | undefined {
  if (!v) return "Contract name is required.";
  if (!SOLIDITY_IDENTIFIER.test(v)) {
    return "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.";
  }
  return undefined;
}

/** Validates an ERC-20 token symbol (1-11 ASCII letters/digits). Locked UI-SPEC copy on failure. */
export function isAsciiSymbol(v: string | undefined): string | undefined {
  if (!v) return "Token symbol is required.";
  if (!ASCII_SYMBOL.test(v)) {
    return "Must be 1-11 ASCII letters/digits, no spaces or punctuation.";
  }
  return undefined;
}

/** Validates a non-negative decimal premint value. Locked UI-SPEC copy on failure. */
export function isNonNegativeDecimal(v: string | undefined): string | undefined {
  if (v === undefined || v === "") {
    return "Initial supply is required (use 0 for no premint).";
  }
  if (!DECIMAL_STRING.test(v)) {
    return "Must be a non-negative decimal number, e.g. 1000000 or 1.5.";
  }
  return undefined;
}
