// @clack/prompts `validate` callbacks for the ERC-1155 wizard.
//
// Both exports satisfy the contract `(v: string | undefined) => string | undefined`:
//   - Return `undefined` when the value is valid.
//   - Return the error message string when invalid.
//
// `isSolidityIdentifier` is cloned verbatim from src/templates/erc20/validators.ts
// (validators are template-owned, not shared — Phase 2 precedent / RESEARCH).
// `isNonEmptyUri` is new for ERC-1155; error strings are byte-locked from
// .planning/phases/04-erc-721-and-erc-1155-templates/04-RESEARCH.md §Validators
// ERC-1155 (lines 763-768) — paste exactly; never paraphrase.

/** Solidity grammar minus `$` for cross-language hygiene (SPL/Anchor pipelines).
 *  Cloned from erc20/validators.ts.
 */
const SOLIDITY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Validates a Solidity contract-name identifier. Locked copy on failure. */
export function isSolidityIdentifier(v: string | undefined): string | undefined {
  if (!v) return "Contract name is required.";
  if (!SOLIDITY_IDENTIFIER.test(v)) {
    return "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.";
  }
  return undefined;
}

/** Validates the ERC-1155 URI template. Non-empty, no whitespace.
 *  The wizard accepts "" but the prompt requires content (RESEARCH lines 763-768).
 */
export function isNonEmptyUri(v: string | undefined): string | undefined {
  if (!v || v.trim() === "") {
    return "URI template is required (e.g. https://example.com/api/token/{id}.json).";
  }
  if (/\s/.test(v)) return "URI must not contain whitespace.";
  return undefined;
}
