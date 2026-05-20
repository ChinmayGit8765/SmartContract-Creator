import type { Output } from "../lib/output.js";

export type TemplateStatus = "stub" | "alpha" | "stable";
export type TemplateChain = "evm" | "solana" | "any";

/** Locked JSON contract from Phase 1. Five required fields are still locked.
 *  Phase 2 added optional `runWizard` and `generate` (D-03 / D-04 / D-05).
 *  Later phases may ADD optional fields only. NEVER remove or rename these five.
 */
export interface Template<TOpts = unknown> {
  readonly id: string;
  readonly name: string;
  readonly chain: TemplateChain;
  readonly status: TemplateStatus;
  readonly description: string;
  /** Phase 2: optional wizard runner. Per-template wizards return parsed opts. */
  readonly runWizard?: (io: { output: Output }) => Promise<TOpts>;
  /** Phase 2: optional pure generator. Takes opts → returns filename + source. */
  readonly generate?: (opts: TOpts) => { filename: string; source: string };
}
