/** Compile-verify type contracts. Locked surface for downstream phases.
 *
 *  These interfaces are the seam that lets Phase 7's anchor-build adapter
 *  produce the same `CompileDiagnostic` shape as solc-js — so the dispatcher,
 *  output channels, and CliError block at create.ts can render compile
 *  results chain-agnostically.
 *
 *  Stability rules (mirror src/registry/types.ts:8-9):
 *    - All five symbols (`Severity`, `CompileDiagnostic`, `StandardJsonInput`,
 *      `SolcOutput`) shipped in Phase 3 are locked. Later phases may ADD
 *      optional fields only. NEVER remove or rename existing fields.
 *    - `readonly` discipline is load-bearing: the dispatcher passes these
 *      shapes through `output.warn` and into the CliError WHY block; any
 *      mutation by an upstream phase would be a contract violation.
 */

export type Severity = "error" | "warning";

export interface CompileDiagnostic {
  readonly severity: Severity;
  readonly message: string;
  readonly formattedMessage: string;
  readonly line?: number;
  readonly column?: number;
  readonly file?: string;
}

export interface StandardJsonInput {
  readonly language: "Solidity";
  readonly sources: Record<string, { content: string }>;
  readonly settings: {
    readonly outputSelection: Record<string, Record<string, string[]>>;
    readonly evmVersion?: string;
    readonly optimizer?: { enabled: boolean; runs: number };
  };
}

export interface SolcOutput {
  readonly errors?: Array<{
    severity: "error" | "warning" | "info";
    type: string;
    message: string;
    formattedMessage?: string;
    sourceLocation?: { file: string; start: number; end: number };
    component?: string;
    errorCode?: string;
  }>;
}
