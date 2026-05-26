/** compileVerify — the Phase 3 compile gate seam.
 *
 *  Phase 3 Plan 02 (this file) ships the FULL public entry. The
 *  `chain === "solana"` branch is FINAL (locked per CONTEXT D-06): it
 *  throws CliError(ERR_NOT_IMPLEMENTED) with a Phase 7 pointer.
 *
 *  The `chain === "evm"` branch wraps solc-js's standard-JSON compile:
 *    1. Build StandardJsonInput with the locked settings (Pitfall 2:
 *       evmVersion="cancun" — Wave 0 probe discovered OZ 5.6.1 uses the
 *       Cancun-only `mcopy` opcode in utils/Bytes.sol; "paris" produces
 *       4 compile errors and is NOT viable).
 *    2. Invoke solc.compile with a fresh makeImportCallback() (per-call
 *       cache per CONTEXT D-05).
 *    3. Partition diagnostics: severity "error" → errors; "warning" or
 *       "info" → warnings (RESEARCH §Pattern 3 line 379 collapse-info).
 *    4. Normalize formattedMessage CRLF→LF (Pitfall 5).
 *    5. If any errors → throw CliError(ERR_COMPILE_FAILED) with a
 *       multi-line WHY (formattedMessages joined + version tail line).
 *    6. Otherwise return { warnings }.
 *
 *  Seam shape (locked, do not break):
 *    compileVerify(source, chain) →
 *      Promise<{ warnings: CompileDiagnostic[] }>  on success
 *      throws CliError(ERR_COMPILE_FAILED)         on any severity:"error"
 *      throws CliError(ERR_NOT_IMPLEMENTED)        for chain === "solana" until Phase 7
 *
 *  Phase 7's anchor-build adapter will plug into this same signature.
 */

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

// Wave-0-discovered EVM target floor. OZ 5.6.1 utils/Bytes.sol uses `mcopy`
// (Cancun-only). "paris" fails with 4 mcopy-not-available errors. Cancun
// shipped on mainnet 2024-03-13 and is broadly deployed across L1+L2.
const EVM_VERSION = "cancun" as const;

interface SolcModule {
  compile(
    input: string,
    opts: {
      import: (p: string) => { contents: string } | { error: string };
    },
  ): string;
  version(): string;
}

// Top-level dynamic ESM import — Vitest's vi.mock("solc") intercepts this
// reliably (createRequire(import.meta.url) bypasses Vitest's module loader).
// solc-js is CJS, so the default export holds the API surface (Pitfall 4).
async function loadSolc(): Promise<SolcModule> {
  const mod = (await import("solc")) as unknown as {
    default?: SolcModule;
  } & SolcModule;
  // In production Node ESM-interop, default holds the CJS exports; under
  // Vitest's mock, default is the mocked object literal.
  return mod.default ?? mod;
}

function normalizeDiagnostic(e: {
  severity: string;
  message: string;
  formattedMessage?: string;
  sourceLocation?: { file: string; start: number; end: number };
}): CompileDiagnostic {
  // Pitfall 5: solc-js occasionally emits \r\n on Windows builds; normalize so
  // the terminal renders one logical line per logical line.
  const formattedMessage = (e.formattedMessage ?? e.message).replace(
    /\r\n/g,
    "\n",
  );
  // Partition by severity. Solc emits "error" | "warning" | "info"; collapse
  // "info" into "warning" (RESEARCH §Pattern 3 line 379) so the caller only
  // ever sees the closed union of {"error","warning"} on `CompileDiagnostic`.
  const severity: "error" | "warning" =
    e.severity === "error" ? "error" : "warning";
  return {
    severity,
    message: e.message,
    formattedMessage,
    file: e.sourceLocation?.file,
  };
}

export async function compileVerify(
  source: string,
  chain: "evm" | "solana",
): Promise<{ warnings: CompileDiagnostic[] }> {
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

  // chain === "evm"
  const solc = await loadSolc();

  const input: StandardJsonInput = {
    language: "Solidity",
    sources: { "Contract.sol": { content: source } },
    settings: {
      evmVersion: EVM_VERSION,
      outputSelection: { "*": { "*": ["abi"] } },
    },
  };

  // Fresh callback per call → fresh cache (CONTEXT D-05). No cross-call leakage.
  const importCallback = makeImportCallback();
  const rawOutput = solc.compile(JSON.stringify(input), {
    import: importCallback,
  });
  const output = JSON.parse(rawOutput) as SolcOutput;

  const errors: CompileDiagnostic[] = [];
  const warnings: CompileDiagnostic[] = [];
  for (const e of output.errors ?? []) {
    const d = normalizeDiagnostic(e);
    if (d.severity === "error") {
      errors.push(d);
    } else {
      warnings.push(d);
    }
  }

  if (errors.length > 0) {
    const solcVer = safeReadVersion("solc") ?? "unknown";
    const ozVer = safeReadVersion("@openzeppelin/contracts") ?? "unknown";
    // D-08: multi-line WHY — verbatim solc formattedMessages joined with a
    // blank line, then the version tail so bug reports name exact deps.
    const formatted = errors
      .map((e) => e.formattedMessage)
      .join("\n\n");
    throw new CliError({
      code: ERR_COMPILE_FAILED,
      what: "Generated source failed to compile.",
      why: `${formatted}\n\nCompile errors come from solc ${solcVer} against @openzeppelin/contracts ${ozVer}.`,
      fix: "If you didn't edit the wizard output, please report this — the template + pinned solc+OpenZeppelin should always produce compilable source.",
      exitCode: 1,
    });
  }

  return { warnings };
}
