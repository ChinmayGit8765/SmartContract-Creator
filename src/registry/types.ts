export type TemplateStatus = "stub" | "alpha" | "stable";
export type TemplateChain = "evm" | "solana" | "any";

/** Locked JSON contract from Phase 1.
 *  Later phases may ADD optional fields. NEVER remove or rename these five.
 */
export interface Template {
  readonly id: string;
  readonly name: string;
  readonly chain: TemplateChain;
  readonly status: TemplateStatus;
  readonly description: string;
}
