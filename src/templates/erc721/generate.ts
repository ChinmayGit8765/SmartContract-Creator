// Thin pure-function wrapper around `@openzeppelin/wizard@0.10.8` `erc721.print()`,
// plus the ONE Phase 4 deviation from Phase 2 D-02: a conditional EIP-2981 royalty
// post-process.
//
// Per CONTEXT D-04: @openzeppelin/wizard@0.10.8 has no `royalty` field on
// ERC721Options, so royalty support is delivered as the `injectRoyalty` post-process
// from plan 04-01 (`royalty.ts`).
// Per CONTEXT D-05: the royalty insertion is a single targeted transform on the
// wizard's printed Solidity (import + parent + ctor call + supportsInterface override).
// Per CONTEXT D-06: when `opts.royalty.enabled === false`, `injectRoyalty` is NOT
// called and the output is byte-for-byte identical to `erc721.print(...)`.
//
// Like erc20/generate.ts, we deliberately do NOT pass `info`, so the wizard's default
// `{ license: "MIT", securityContact: "" }` applies (matches wizard.openzeppelin.com
// byte-for-byte). `uriStorage` is always false (reserved; not surfaced in the wizard).
import { erc721 } from "@openzeppelin/wizard";
import { contractNameToFilename } from "./filename.js";
import { injectRoyalty } from "./royalty.js";
import type { Erc721Opts, GenerateResult } from "./opts.js";

/** Generates an ERC-721 `.sol` source file from `Erc721Opts`.
 *
 *  Pure synchronous transform:
 *    1. Map `Erc721Opts` 1:1 onto wizard's `ERC721Options` and call `erc721.print`.
 *    2. If `opts.royalty?.enabled`, pipe the wizard source through `injectRoyalty`
 *       (plan 04-01); otherwise return the wizard source unchanged (D-06).
 *    3. Derive the filename from `opts.name` via `contractNameToFilename`.
 *
 *  No throws on the happy path. The dispatcher (plan 04-04) wraps wizard failures in
 *  CliError; this function does not.
 */
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

  const source = opts.royalty?.enabled
    ? injectRoyalty(wizardSource, opts.royalty)
    : wizardSource;

  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
