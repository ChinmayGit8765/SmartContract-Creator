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

/** Derive the .DEPLOY.md path from an already-resolved .sol path (honoring --out).
 *  Swaps a trailing `.sol` (case-insensitive) for `.DEPLOY.md`; appends when there
 *  is no `.sol` suffix. No new path.join — pure suffix swap on the same path the
 *  .sol uses (no traversal surface). */
export function deployDocPath(solPath: string): string {
  return /\.sol$/i.test(solPath)
    ? solPath.replace(/\.sol$/i, ".DEPLOY.md")
    : `${solPath}.DEPLOY.md`;
}
