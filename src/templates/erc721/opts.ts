// Phase 4 ERC-721 type contracts — Wave 0 minimal surface.
//
// This file currently exports ONLY `Erc721RoyaltyOpts`, the minimum type the
// royalty post-process (`royalty.ts`) needs. Plan 04-02 (Wave 1) extends this
// module with the full `Erc721Opts` surface (name/symbol/baseUri/mintable/
// enumerable/burnable/pausable/uriStorage/royalty/access), `WizardIo`,
// `GenerateResult`, and `Erc721Template` — mirroring `src/templates/erc20/opts.ts`.
//
// See .planning/phases/04-erc-721-and-erc-1155-templates/04-CONTEXT.md D-04..D-07:
//   - D-04: @openzeppelin/wizard@0.10.8 has NO `royalty` field on ERC721Options;
//           EIP-2981 is injected via the `royalty.ts` post-process.
//   - D-05: royalty is a single targeted insertion (import + parent + ctor call + override).
//   - D-06: royalty is opt-in only, default OFF — when disabled the wizard output is
//           byte-for-byte unchanged.
//   - D-07: feeNumerator is an integer 0-10000 (10000 = 100%, EIP-2981 basis points);
//           receiver matches /^0x[0-9a-fA-F]{40}$/. The runtime validators live in
//           plan 04-02's `validators.ts`; this type only fixes the shape.

/** Royalty (EIP-2981) options collected by the ERC-721 wizard and consumed by
 *  `injectRoyalty()` in `royalty.ts`.
 *
 *  Field-name stability note (CONTEXT §Specifics): these names are the input
 *  contract for Phase 5's DEPLOY.md generator — keep `enabled`, `feeNumerator`,
 *  `receiver` stable.
 */
export interface Erc721RoyaltyOpts {
  /** Opt-in flag. When false, `injectRoyalty` returns its input unchanged (D-06). */
  readonly enabled: boolean;
  /** EIP-2981 basis points: integer 0-10000 (10000 = 100%). Maps to OZ
   *  `_setDefaultRoyalty(address, uint96 feeNumerator)` (denominator 10000). */
  readonly feeNumerator: number;
  /** Royalty recipient address — canonical form `/^0x[0-9a-fA-F]{40}$/`. */
  readonly receiver: string;
}
