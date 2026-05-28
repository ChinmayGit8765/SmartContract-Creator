// Phase 4 ERC-721 type contracts.
//
// Wave 0 (plan 04-01) shipped ONLY `Erc721RoyaltyOpts`, the minimum type the
// royalty post-process (`royalty.ts`) needs. Wave 1 (plan 04-02) extends this
// module with the FULL `Erc721Opts` surface (name/symbol/baseUri/mintable/
// enumerable/burnable/pausable/uriStorage/royalty/access), `WizardIo`,
// `GenerateResult`, and `Erc721Template` — mirroring `src/templates/erc20/opts.ts`.
// See 04-RESEARCH §ERC-721 opts.ts (lines 962-998) + 04-PATTERNS §opts.ts.
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

import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

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

/** Locked option shape returned by the ERC-721 wizard and consumed by `generate()`.
 *  Mirrors a subset of `@openzeppelin/wizard@0.10.8` ERC721Options, plus the
 *  `royalty` sub-object (delivered via the `royalty.ts` post-process, NOT a wizard
 *  key — CONTEXT D-04). `access` excludes "managed" — locked per CONTEXT D-10 spirit
 *  and Phase 2 precedent (managed access is out of v1 scope).
 *
 *  Field stability (CONTEXT §Specifics): `mintable`, `access`, and `royalty.{enabled,
 *  feeNumerator,receiver}` are the input contract for Phase 5's DEPLOY.md generator —
 *  keep these names stable.
 */
export interface Erc721Opts {
  readonly name: string;
  readonly symbol: string;
  /** Token-metadata base URI. May be "" — empty is allowed (CONTEXT D-07). */
  readonly baseUri: string;
  readonly mintable: boolean;
  readonly enumerable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  /** Reserved wizard field — NOT surfaced as a prompt (RESEARCH Open Q3). Always false. */
  readonly uriStorage: boolean;
  /** EIP-2981 royalty. `enabled:false` ⇒ generate.ts skips `injectRoyalty` (D-06).
   *  feeNumerator is 0-10000 (D-07); receiver matches /^0x[0-9a-fA-F]{40}$/ (D-07). */
  readonly royalty: Erc721RoyaltyOpts;
  readonly access: false | "ownable" | "roles";
}

/** Injected IO surface for the wizard. Tests substitute a fake `Output` to capture
 *  warnings/explanations.
 */
export interface WizardIo {
  readonly output: Output;
}

/** Pure return shape of `generate()`. Filename derived from `name` (see filename.ts);
 *  `source` is the literal `.sol` text that will be written to disk.
 */
export interface GenerateResult {
  readonly filename: string;
  readonly source: string;
}

/** Concrete ERC-721 template binding. Narrows the optional `runWizard` / `generate`
 *  fields on `Template<TOpts>` to required (plan 04-04 registers a value of this type).
 */
export interface Erc721Template extends Template<Erc721Opts> {
  readonly runWizard: (io: WizardIo) => Promise<Erc721Opts>;
  readonly generate: (opts: Erc721Opts) => GenerateResult;
}
