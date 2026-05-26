// scripts/probe-compile.mjs — Phase 3 Wave 0 probe.
//
// Purpose: prove that solc@0.8.35 + @openzeppelin/contracts@5.6.1 + a synchronous
// import callback can compile tests/fixtures/erc20/bare-default.sol clean from
// an ARBITRARY cwd. This is the load-bearing assumption for COMP-05 ("imports
// resolve from the tool's bundled dependencies, no user install required") and
// directly addresses STATE.md Phase 3 research flag.
//
// Pitfall 3 lock: the script chdir()'s to a fresh temp directory BEFORE calling
// require.resolve("@openzeppelin/contracts/package.json"), proving that Node's
// module resolution finds OZ via smartc's install root regardless of cwd.
//
// Pitfall 2 lock: standard JSON input pins evmVersion explicitly so bytecode
// targets a deterministic EVM target (solc 0.8.35 would otherwise default to
// osaka). NOTE — OpenZeppelin Contracts 5.6.1 uses the `mcopy` opcode in
// utils/Bytes.sol, which is Cancun-only. The probe initially tried "paris"
// (per RESEARCH §Pitfall 2 recommendation) and got 4 mcopy-not-available
// errors. Bumped to "cancun" — Cancun shipped on mainnet 2024-03-13 and is
// broadly deployed across L1+L2. This is the Wave-0-discovered EVM-target
// floor; plans 02+ inherit this constant.
//
// Pitfall 1 lock: findImports is synchronous; uses readFileSync. solc-js's
// import callback contract requires sync return — async breaks silently.
//
// Source: verbatim from .planning/phases/03-compile-verify-safety-net/03-RESEARCH.md
// §Wave 0 Probe (lines 562-624). One-shot probe, not production code; console.log
// is appropriate here (the lib/output.ts channels don't apply to throwaway scripts).

import { createRequire } from "node:module";
import { mkdtempSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chdir, cwd } from "node:process";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const solc = require("solc");

const startCwd = cwd();
const tmpCwd = mkdtempSync(join(tmpdir(), "smartc-probe-"));
chdir(tmpCwd); // ← critical: prove the resolve works outside the project tree

try {
  let ozPjPath;
  try {
    ozPjPath = require.resolve("@openzeppelin/contracts/package.json");
  } catch (err) {
    console.error("PROBE FAILED — @openzeppelin/contracts not installed:");
    console.error(`  ${err.message}`);
    console.error("  Run `npm install` in the project root before re-running the probe.");
    process.exit(1);
  }
  const ozRoot = dirname(ozPjPath);

  const bareSource = readFileSync(
    join(startCwd, "tests/fixtures/erc20/bare-default.sol"),
    "utf8",
  );

  function findImports(path) {
    if (path.startsWith("@openzeppelin/contracts/")) {
      const sub = path.replace(/^@openzeppelin\/contracts\//, "");
      try {
        return { contents: readFileSync(join(ozRoot, sub), "utf8") };
      } catch (e) {
        return { error: `Could not read ${path}: ${e.message}` };
      }
    }
    return { error: `Unknown import: ${path}` };
  }

  const input = {
    language: "Solidity",
    sources: { "Contract.sol": { content: bareSource } },
    settings: {
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi"] } },
    },
  };

  const start = performance.now();
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const elapsed = performance.now() - start;

  const errors = (output.errors ?? []).filter((e) => e.severity === "error");
  const warnings = (output.errors ?? []).filter((e) => e.severity === "warning");

  console.log(`solc ${solc.version()} (cwd=${tmpCwd})`);
  console.log(
    `  bare-default.sol: errors=${errors.length} warnings=${warnings.length} elapsed=${elapsed.toFixed(0)}ms`,
  );

  if (errors.length > 0) {
    console.error("PROBE FAILED — compile errors:");
    errors.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  console.log("PROBE PASSED");
} finally {
  chdir(startCwd);
}
