// Phase 7 — Solana compile-verify adapter (COMP-02 / SPL-05).
//
// Solana programs can't be compiled in-process the way solc-js handles Solidity,
// so this shells out to `anchor build` against a scratch Anchor workspace. The
// toolchain is heavy and often absent, so the PRIMARY, well-tested path is
// graceful degradation: when `anchor` isn't found, return `skipped:true` and let
// the dispatcher write the file with a clear warning (SPL-05). When `anchor` IS
// present, the program is built in a temp workspace and a build failure throws
// CliError(E_COMPILE_FAILED) — nothing un-buildable reaches the user's --out path.
//
// Both side-effecting dependencies (anchor detection + the build runner) are
// injectable so the orchestration is unit-testable without the real toolchain.

import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError, ERR_COMPILE_FAILED } from "../lib/errors.js";
import { runVersion } from "../doctor/probes.js";
import type { CompileResult } from "./types.js";

export interface BuildOutcome {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface SolanaVerifyDeps {
  /** Returns the anchor version string, or null when anchor is not installed. */
  detectAnchor?: () => Promise<string | null>;
  /** Runs `anchor build` in the given workspace and resolves with its outcome. */
  runBuild?: (workspaceDir: string) => Promise<BuildOutcome>;
}

const ANCHOR_LANG = "0.30.1";

/** Default build runner — `anchor build` in `cwd`, never rejects (captures code). */
function defaultRunBuild(cwd: string): Promise<BuildOutcome> {
  return new Promise((resolve) => {
    execFile(
      "anchor",
      ["build"],
      { cwd, timeout: 300_000, windowsHide: true, shell: process.platform === "win32" },
      (error, stdout, stderr) => {
        const err = error as (Error & { code?: number }) | null;
        resolve({
          code: err && typeof err.code === "number" ? err.code : err ? 1 : 0,
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
        });
      },
    );
  });
}

/** Scaffolds a minimal Anchor workspace whose Cargo.toml deps match the versions
 *  the generator targets, so the generated lib.rs has a coherent build context. */
async function scaffoldWorkspace(root: string, programName: string, source: string): Promise<void> {
  const progDir = join(root, "programs", programName, "src");
  await mkdir(progDir, { recursive: true });

  const anchorToml = [
    "[toolchain]",
    "",
    "[features]",
    "resolution = true",
    "skip-lint = false",
    "",
    "[programs.localnet]",
    `${programName} = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"`,
    "",
    "[provider]",
    'cluster = "localnet"',
    'wallet = "~/.config/solana/id.json"',
    "",
  ].join("\n");

  const workspaceCargo = [
    "[workspace]",
    'members = ["programs/*"]',
    'resolver = "2"',
    "",
    "[profile.release]",
    "overflow-checks = true",
    "",
  ].join("\n");

  const metadataFeature = source.includes("anchor_spl::metadata") ? ', "metadata"' : "";
  const programCargo = [
    "[package]",
    `name = "${programName}"`,
    'version = "0.1.0"',
    'edition = "2021"',
    "",
    "[lib]",
    'crate-type = ["cdylib", "lib"]',
    `name = "${programName}"`,
    "",
    "[dependencies]",
    `anchor-lang = "${ANCHOR_LANG}"`,
    `anchor-spl = { version = "${ANCHOR_LANG}", features = ["associated_token"${metadataFeature}] }`,
    "",
  ].join("\n");

  await writeFile(join(root, "Anchor.toml"), anchorToml, "utf8");
  await writeFile(join(root, "Cargo.toml"), workspaceCargo, "utf8");
  await writeFile(
    join(root, "programs", programName, "Cargo.toml"),
    programCargo,
    "utf8",
  );
  await writeFile(join(progDir, "lib.rs"), source, "utf8");
}

/** Compile-verify a generated Anchor program. */
export async function compileVerifySolana(
  source: string,
  programName: string,
  deps: SolanaVerifyDeps = {},
): Promise<CompileResult> {
  const detectAnchor = deps.detectAnchor ?? (() => runVersion("anchor"));
  const runBuild = deps.runBuild ?? defaultRunBuild;

  const anchorVersion = await detectAnchor();
  if (!anchorVersion) {
    // SPL-05: skip, do NOT fail — the dispatcher writes the file with a warning.
    return {
      warnings: [],
      skipped: true,
      skipReason:
        "Anchor toolchain not found — the SPL program was written WITHOUT compile-verification. Run 'smartc doctor' and install Anchor (https://www.anchor-lang.com) to verify before deploying.",
    };
  }

  const root = await mkdtemp(join(tmpdir(), "smartc-anchor-"));
  try {
    await scaffoldWorkspace(root, programName, source);
    const outcome = await runBuild(root);
    if (outcome.code !== 0) {
      const detail = (outcome.stderr || outcome.stdout).trim();
      throw new CliError({
        code: ERR_COMPILE_FAILED,
        what: "Generated Anchor program failed to build.",
        why: `${detail}\n\nBuild ran via 'anchor build' (anchor ${anchorVersion}).`,
        fix: "If you didn't edit the generated source, please report this. Otherwise fix the Rust errors above and re-run.",
        exitCode: 1,
      });
    }
    return { warnings: [], skipped: false };
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
}
