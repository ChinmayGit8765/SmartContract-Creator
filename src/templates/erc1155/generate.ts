// Thin pure-function wrapper around `@openzeppelin/wizard@0.10.8` `erc1155.print()`.
//
// Per CONTEXT D-01 / D-02: no string templating with sentinels — OZ owns the
// Solidity source verbatim. Per CONTEXT D-04: returns `{ filename, source }` so
// the dispatcher can write directly.
//
// Per CONTEXT D-08: NO royalty post-process — EIP-2981 on ERC-1155 is deferred
// to v2. There is deliberately no royalty branch and no `injectRoyalty` import.
//
// Per CONTEXT D-09 + RESEARCH Pitfall 3: `updatableUri: true` is passed as a
// hardcoded literal (the wizard default). It is NOT a user-surfaced prompt; the
// `true` default matches wizard.openzeppelin.com byte-for-byte and adds the
// Ownable + setURI(...) pair even in the bare-default output.
//
// `info` is deliberately NOT passed — the wizard's default
// `{ license: "MIT", securityContact: "" }` applies (matches the committed
// fixtures from plan 04-01 byte-for-byte).
import { erc1155 } from "@openzeppelin/wizard";
import { contractNameToFilename } from "./filename.js";
import type { Erc1155Opts, GenerateResult } from "./opts.js";

/** Generates an ERC-1155 `.sol` source file from `Erc1155Opts`.
 *
 *  Pure synchronous transform: map `Erc1155Opts` 1:1 onto wizard's
 *  `ERC1155Options`, call `erc1155.print(mapped)`, derive the filename. No
 *  post-processing (D-08 — no royalty), no conditional branch.
 */
export function generate(opts: Erc1155Opts): GenerateResult {
  const source = erc1155.print({
    name: opts.name,
    uri: opts.uri,
    mintable: opts.mintable,
    burnable: opts.burnable,
    supply: opts.supply,
    pausable: opts.pausable,
    updatableUri: true, // wizard default; matches wizard.openzeppelin.com (RESEARCH Pitfall 3)
    access: opts.access,
  });
  return {
    filename: contractNameToFilename(opts.name),
    source,
  };
}
