import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { safeReadVersion } from "../lib/version.js";
import type { ProbeResult } from "./types.js";

const execFileAsync = promisify(execFile);

/** Minimum Node major version. Mirrors package.json `engines.node` (">=20"). */
export const MIN_NODE_MAJOR = 20;

/** Extracts a semver-ish version from arbitrary `--version` output.
 *  Falls back to the first non-empty line when no x.y.z is present.
 */
export function extractVersion(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const m = text.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/);
  if (m) return m[0];
  const firstLine = text.split(/\r?\n/)[0]?.trim();
  return firstLine && firstLine.length > 0 ? firstLine : null;
}

/** Runs `<command> <args>` and returns its trimmed stdout/stderr, or null if
 *  the command is missing, errors, or times out. Never throws.
 *
 *  `command`/`args` are hardcoded constants (no user input) so `shell:true` on
 *  Windows — required to resolve `.cmd` shims like anchor/ollama under Node's
 *  post-CVE-2024-27980 spawn rules — introduces no injection surface.
 */
export async function runVersion(
  command: string,
  args: string[] = ["--version"],
): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 4000,
      windowsHide: true,
      shell: process.platform === "win32",
    });
    const out = (stdout || stderr || "").toString();
    return extractVersion(out);
  } catch {
    return null;
  }
}

/** Node.js — always present (we're running on it). Required; gates exit code. */
export function probeNode(version: string = process.versions.node): ProbeResult {
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  const ok = Number.isFinite(major) && major >= MIN_NODE_MAJOR;
  return {
    key: "node",
    name: "Node.js",
    found: true,
    version,
    status: ok ? "ok" : "outdated",
    required: true,
    purpose: "Runs the CLI itself.",
    note: ok ? undefined : `needs >=${MIN_NODE_MAJOR}`,
  };
}

/** Bundled solc — shipped as a dependency, so present in any real install.
 *  Required; a missing solc means a broken install (it powers EVM compile-verify).
 */
export function probeSolc(version: string | null = safeReadVersion("solc")): ProbeResult {
  const found = version !== null;
  return {
    key: "solc",
    name: "solc (bundled)",
    found,
    version,
    status: found ? "ok" : "missing",
    required: true,
    purpose: "EVM compile-verify. Bundled — no user install needed.",
    note: found ? undefined : "reinstall smartc — bundled dependency missing",
  };
}

/** Anchor CLI — optional; needed for Solana SPL compile-verify (Phase 7). */
export async function probeAnchor(): Promise<ProbeResult> {
  const version = await runVersion("anchor");
  const found = version !== null;
  return {
    key: "anchor",
    name: "anchor",
    found,
    version,
    status: found ? "ok" : "missing",
    required: false,
    purpose: "Solana SPL compile-verify (optional).",
    note: found ? undefined : "install from https://www.anchor-lang.com to compile-verify SPL",
  };
}

/** cargo-build-sbf — optional; the Solana BPF toolchain (ships with the Solana CLI). */
export async function probeCargoBuildSbf(): Promise<ProbeResult> {
  const version = await runVersion("cargo-build-sbf");
  const found = version !== null;
  return {
    key: "cargo-build-sbf",
    name: "cargo-build-sbf",
    found,
    version,
    status: found ? "ok" : "missing",
    required: false,
    purpose: "Solana BPF build toolchain (optional).",
    note: found ? undefined : "ships with the Solana CLI — https://solana.com",
  };
}

/** Ollama — optional; powers the local-AI add-feature flow (Phase 8). */
export async function probeOllama(): Promise<ProbeResult> {
  const version = await runVersion("ollama");
  const found = version !== null;
  return {
    key: "ollama",
    name: "ollama",
    found,
    version,
    status: found ? "ok" : "missing",
    required: false,
    purpose: "Local AI for add-feature (optional, Phase 8).",
    note: found ? undefined : "install from https://ollama.com to use AI add-feature",
  };
}
