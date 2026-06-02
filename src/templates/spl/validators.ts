// @clack/prompts `validate` callbacks for the SPL token wizard.
// Contract: return undefined when valid, an error string when invalid.
//
// Limits follow Metaplex Token Metadata: name <= 32 chars, symbol <= 10 chars
// (the on-chain DataV2 struct truncates beyond these). Decimals are SPL's u8 but
// 0-9 is the practical, wallet-friendly range (9 is the SOL/USDC convention).

/** Token display name: 1-32 chars, any printable (Metaplex name limit is 32 bytes). */
export function isTokenName(v: string | undefined): string | undefined {
  if (!v || v.trim() === "") return "Token name is required.";
  if (v.length > 32) return "Token name must be 32 characters or fewer (Metaplex limit).";
  return undefined;
}

/** Token symbol: 1-10 ASCII letters/digits (Metaplex symbol limit is 10 bytes). */
const SPL_SYMBOL = /^[A-Za-z0-9]{1,10}$/;
export function isSplSymbol(v: string | undefined): string | undefined {
  if (!v) return "Token symbol is required.";
  if (!SPL_SYMBOL.test(v)) return "Must be 1-10 ASCII letters/digits, no spaces or punctuation.";
  return undefined;
}

/** Decimals: integer 0-9. */
const DECIMALS = /^[0-9]$/;
export function isDecimals(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return "Decimals is required (9 is the common default).";
  if (!DECIMALS.test(v)) return "Must be a whole number from 0 to 9.";
  return undefined;
}

/** Initial supply: a non-negative whole number of tokens (scaled by decimals at mint). */
const WHOLE_NONNEG = /^(?:0|[1-9]\d*)$/;
export function isWholeSupply(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return "Initial supply is required (use 0 for none).";
  if (!WHOLE_NONNEG.test(v)) return "Must be a non-negative whole number, e.g. 1000000.";
  return undefined;
}
