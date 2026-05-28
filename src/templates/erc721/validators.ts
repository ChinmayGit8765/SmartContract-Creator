// @clack/prompts `validate` callbacks for the ERC-721 wizard.
//
// All exports satisfy the contract `(v: string | undefined) => string | undefined`:
//   - Return `undefined` when the value is valid.
//   - Return the error message string when invalid.
//
// `SOLIDITY_IDENTIFIER` / `ASCII_SYMBOL` + `isSolidityIdentifier` / `isAsciiSymbol`
// are CLONED verbatim from src/templates/erc20/validators.ts:15-39 — validators are
// template-owned (CONTEXT D-10 spirit + RESEARCH A5: the duplicate-don't-extract
// rule targets prompt code; a small validator clone is acceptable here).
//
// The three NEW validators (`isEthAddress`, `isRoyaltyBps`, `isValidBaseUriOrEmpty`)
// and their byte-locked error copy are from
// .planning/phases/04-erc-721-and-erc-1155-templates/04-RESEARCH.md §Validators
// (lines 729-755). Paste error strings byte-exact; never paraphrase.

/** Solidity grammar minus `$` for cross-language hygiene (SPL/Anchor pipelines). */
const SOLIDITY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Practical 1-11 char symbol convention. ASCII letters/digits only. */
const ASCII_SYMBOL = /^[A-Za-z0-9]{1,11}$/;

/** Canonical EVM address: `0x` + exactly 40 hex digits (case-insensitive). */
const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Validates a Solidity contract-name identifier. Locked copy on failure. */
export function isSolidityIdentifier(v: string | undefined): string | undefined {
  if (!v) return "Contract name is required.";
  if (!SOLIDITY_IDENTIFIER.test(v)) {
    return "Must start with a letter or underscore, contain only letters/digits/underscores, max 64 chars.";
  }
  return undefined;
}

/** Validates an ERC token symbol (1-11 ASCII letters/digits). Locked copy on failure. */
export function isAsciiSymbol(v: string | undefined): string | undefined {
  if (!v) return "Token symbol is required.";
  if (!ASCII_SYMBOL.test(v)) {
    return "Must be 1-11 ASCII letters/digits, no spaces or punctuation.";
  }
  return undefined;
}

/** Validates an EIP-2981 royalty recipient address. Locked copy on failure
 *  (RESEARCH lines 729-735). */
export function isEthAddress(v: string | undefined): string | undefined {
  if (!v) return "Recipient address is required.";
  if (!ETH_ADDRESS.test(v)) {
    return "Must be a 42-character hex address starting with 0x.";
  }
  return undefined;
}

/** Validates EIP-2981 royalty basis points: a non-negative integer 0-10000 inclusive
 *  (10000 = 100%). Rejects leading zeros, minus signs, and out-of-range values.
 *  Locked copy on failure (RESEARCH lines 738-748). */
export function isRoyaltyBps(v: string | undefined): string | undefined {
  if (v === undefined || v === "") {
    return "Basis points required (0-10000; 250 = 2.5%).";
  }
  if (!/^(?:0|[1-9]\d*)$/.test(v)) {
    return "Must be a non-negative integer.";
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10000) {
    return "Must be between 0 and 10000 inclusive (10000 = 100%).";
  }
  return undefined;
}

/** Validates an OPTIONAL base URI: empty/undefined is allowed (CONTEXT D-07 — empty
 *  baseUri uses tokenURI overrides). Any whitespace is rejected. Locked copy on
 *  failure (RESEARCH lines 751-755). */
export function isValidBaseUriOrEmpty(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return undefined;
  if (/\s/.test(v)) return "Base URI must not contain whitespace.";
  return undefined;
}
