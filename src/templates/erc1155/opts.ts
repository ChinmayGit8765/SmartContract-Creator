// Phase 4 type contracts for the ERC-1155 multi-token template.
// Type-only module — no runtime code. Tasks 2 (wizard) and 2 (generate)
// implement the runtime behavior; this file fixes the public shapes they target.
//
// Per CONTEXT D-08: NO royalty surface in Phase 4 for ERC-1155 — EIP-2981 on
// ERC-1155 is deferred to v2 (REQUIREMENTS.md §v2 ERC1155-V2-01). There is
// therefore no `royalty` field and no `info` plumbing here.
// Per CONTEXT D-09: `uri` carries the literal `{id}` placeholder template
// (e.g. https://example.com/api/token/{id}.json) — clients substitute the
// hex-padded token id at lookup time.
//
// NOTE: there is intentionally NO `updatableUri` field. The wizard default is
// `true` and is passed as a literal in generate.ts (RESEARCH Pitfall 3 — the
// `true` default matches wizard.openzeppelin.com byte-for-byte and is not a
// user-surfaced prompt).

import type { Output } from "../../lib/output.js";
import type { Template } from "../../registry/types.js";

/** Locked option shape returned by the ERC-1155 wizard and consumed by generate().
 *  Mirrors a subset of `@openzeppelin/wizard@0.10.8` ERC1155Options. `access`
 *  excludes "managed" matching the Phase 2 precedent (managed access is out of
 *  v1 scope).
 */
export interface Erc1155Opts {
  readonly name: string;
  readonly uri: string;
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly supply: boolean;
  readonly pausable: boolean;
  readonly access: false | "ownable" | "roles";
}

/** Injected IO surface for the wizard. Tests substitute a fake `Output` to capture warnings/explanations. */
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

/** Concrete ERC-1155 template binding. Narrows the optional `runWizard` / `generate`
 *  fields on `Template<TOpts>` to required (index.ts registers a value of this type).
 */
export interface Erc1155Template extends Template<Erc1155Opts> {
  readonly runWizard: (io: WizardIo) => Promise<Erc1155Opts>;
  readonly generate: (opts: Erc1155Opts) => GenerateResult;
}
