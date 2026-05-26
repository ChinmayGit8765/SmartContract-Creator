/** compileVerify — the Phase 3 compile gate seam.
 *
 *  Phase 3 Plan 01 (this file) ships the SKELETON public entry. The
 *  `chain === "solana"` branch is FINAL (locked per CONTEXT D-06): it
 *  throws CliError(ERR_NOT_IMPLEMENTED) with a Phase 7 pointer, so any
 *  caller hitting it before Phase 7 lands gets a clear, structured
 *  refusal.
 *
 *  The `chain === "evm"` branch is an INTENTIONAL placeholder throw —
 *  NOT a silent return. Plan 02 will replace it with the real solc-js
 *  call (see TODO(03-02) below + RESEARCH §Code Examples lines 666-705
 *  for the full body). The throw forces Plan 02 to consciously remove
 *  this skeleton instead of accidentally shipping a no-op compile gate.
 *
 *  Seam shape (locked, do not break):
 *    compileVerify(source, chain) →
 *      Promise<{ warnings: CompileDiagnostic[] }>  on success
 *      throws CliError(ERR_COMPILE_FAILED)         on any severity:"error"
 *      throws CliError(ERR_NOT_IMPLEMENTED)        for chain === "solana" until Phase 7
 *
 *  Phase 7's anchor-build adapter will plug into this same signature.
 */

import { createRequire } from "node:module";
import {
  CliError,
  ERR_COMPILE_FAILED,
  ERR_NOT_IMPLEMENTED,
} from "../lib/errors.js";
import { safeReadVersion } from "../lib/version.js";
import { makeImportCallback } from "./imports.js";
import type {
  CompileDiagnostic,
  StandardJsonInput,
  SolcOutput,
} from "./types.js";

const require = createRequire(import.meta.url);

// Suppress unused-symbol noise while the skeleton stands; Plan 02 wires these.
void require;
void ERR_COMPILE_FAILED;
void safeReadVersion;
void makeImportCallback;
// Type-only imports satisfy the bundler's `verbatimModuleSyntax`; they're
// load-bearing for Plan 02 to reuse without scavenger-hunting the codebase.
type _SkeletonTypes = StandardJsonInput | SolcOutput;
void (null as unknown as _SkeletonTypes);

export async function compileVerify(
  source: string,
  chain: "evm" | "solana",
): Promise<{ warnings: CompileDiagnostic[] }> {
  // Avoid unused-param noise (source is consumed by Plan 02's solc call).
  void source;

  if (chain === "solana") {
    // CONTEXT D-06 FINAL: Phase 7 will replace this with the anchor-build branch.
    throw new CliError({
      code: ERR_NOT_IMPLEMENTED,
      what: "Solana compile-verify is not implemented yet.",
      why: "SPL templates ship in Phase 7, which adds an anchor-build adapter behind this same compileVerify interface.",
      fix: "Generate an EVM template (`smartc create --template erc20`) until Phase 7 lands.",
      exitCode: 1,
    });
  }

  // TODO(03-02): replace this throw with the solc.compile() body per RESEARCH lines 666-705.
  //   const solc = require("solc") as { ... };
  //   const input: StandardJsonInput = { language: "Solidity", sources: { "Contract.sol": { content: source } }, settings: { evmVersion: "cancun", outputSelection: { "*": { "*": ["abi"] } } } };
  //   const importCallback = makeImportCallback();
  //   const rawOutput = solc.compile(JSON.stringify(input), { import: importCallback });
  //   const output = JSON.parse(rawOutput) as SolcOutput;
  //   ...partition errors/warnings, throw CliError(ERR_COMPILE_FAILED) on any error, return warnings on success.
  //
  // NOTE — Wave 0 probe (scripts/probe-compile.mjs) discovered OZ 5.6.1 requires
  // evmVersion: "cancun" (not "paris" as RESEARCH initially suggested) because
  // utils/Bytes.sol uses the mcopy Cancun-only opcode. Plan 02 MUST pin "cancun".
  throw new CliError({
    code: ERR_NOT_IMPLEMENTED,
    what: "EVM compile-verify body lands in Plan 02.",
    why: "Plan 01 ships the seam skeleton; the solc-js call + diagnostic partitioning ships in Plan 02.",
    fix: "Wait for 03-02-PLAN.md execution before invoking from a test or the dispatcher.",
    exitCode: 1,
  });
}
