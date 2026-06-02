import type { ProbeResult } from "./types.js";
import {
  probeNode,
  probeSolc,
  probeAnchor,
  probeCargoBuildSbf,
  probeOllama,
} from "./probes.js";

export type { ProbeResult, ProbeStatus } from "./types.js";

/** Runs every environment probe (DOCTOR-01).
 *  Node + solc resolve synchronously; the three shelled tools probe in parallel.
 *  Order is stable and user-facing: required tools first, then optional.
 */
export async function runProbes(): Promise<ProbeResult[]> {
  const [anchor, sbf, ollama] = await Promise.all([
    probeAnchor(),
    probeCargoBuildSbf(),
    probeOllama(),
  ]);
  return [probeNode(), probeSolc(), anchor, sbf, ollama];
}

/** DOCTOR-03: exit 0 iff every REQUIRED tool is "ok"; 1 otherwise.
 *  Optional tools (anchor / cargo-build-sbf / ollama) never fail the exit code —
 *  the core EVM flow degrades gracefully without them.
 */
export function doctorExitCode(results: ProbeResult[]): number {
  const required = results.filter((r) => r.required);
  return required.every((r) => r.status === "ok") ? 0 : 1;
}
