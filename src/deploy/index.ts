// Deploy-doc assembler. `generateDeployDoc(meta, { now? })` is a pure synchronous
// transform returning { filename, content } (mirroring generate()'s return shape).
// The dispatcher writes `content` to the path derived by `deployDocPath(solPath)`.
//
// Determinism: the optional `now` is threaded to the header section so golden
// snapshots are stable (default new Date()).

import { sectionsFor } from "./sections/index.js";
import type { DeployMeta } from "./types.js";

export interface GenerateDeployDocResult {
  readonly filename: string;
  readonly content: string;
}

export function generateDeployDoc(
  meta: DeployMeta,
  opts: { now?: Date } = {},
): GenerateDeployDocResult {
  const sections = sectionsFor(meta.chain, opts.now);
  const content = sections.map((render) => render(meta)).join("\n\n");
  return { filename: `${meta.contractName}.DEPLOY.md`, content };
}

/** Derive the .DEPLOY.md path from an already-resolved source path (honoring --out).
 *  Swaps a trailing source extension (`.sol` EVM / `.rs` Solana, case-insensitive)
 *  for `.DEPLOY.md`; appends when there is no recognized suffix. No new path.join —
 *  pure suffix swap on the same path the source file uses (no traversal surface). */
export function deployDocPath(sourcePath: string): string {
  return /\.(sol|rs)$/i.test(sourcePath)
    ? sourcePath.replace(/\.(sol|rs)$/i, ".DEPLOY.md")
    : `${sourcePath}.DEPLOY.md`;
}
