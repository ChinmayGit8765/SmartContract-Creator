// Derives a Solidity-friendly `.sol` filename from a user-supplied contract name.
//
// Algorithm derived from .planning/phases/02-erc-20-canary-template/02-RESEARCH.md
// §Filename Derivation (lines ~512-527, with one corrected split per below):
//   1. Split on /[^A-Za-z0-9]+/ to break on spaces, hyphens, dots, underscores,
//      and other non-letter/non-digit characters. Underscore IS treated as a
//      word boundary here even though Solidity grammar allows it inside
//      identifiers — RESEARCH's test table requires `my_token -> MyToken.sol`
//      (PascalCase the segments), which is incompatible with the verbatim
//      `[^A-Za-z0-9_]+` regex in RESEARCH (that regex preserves the underscore
//      and would yield `My_token.sol`). The test-case table is the locked
//      contract; the split character class is widened to satisfy it.
//   2. PascalCase each non-empty segment (uppercase first char + rest unchanged).
//   3. Strip leading digits (Solidity identifiers cannot start with a digit).
//   4. Fall back to "Token" when the result is empty (e.g., whitespace-only or
//      all-symbol input that survived the wizard validator).
//   5. Suffix `.sol`.
//
// Pure function — no I/O, never throws. Analog: src/lib/env.ts.

/** Derives a `<PascalCase>.sol` filename from any user-supplied contract name.
 *  Defensive on empty / whitespace / symbol-only input: returns `"Token.sol"`.
 *  Never throws.
 */
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
