/** Phase 6: environment-probe contracts.
 *  Stable from this commit forward — the JSON shape (key/name/found/version/
 *  status/required/purpose) is a public contract for scriptable `smartc doctor`.
 */

/** OK = found and meets minimum; missing = not found; outdated = found but below minimum. */
export type ProbeStatus = "ok" | "missing" | "outdated";

export interface ProbeResult {
  /** Stable machine key (JSON), e.g. "node", "solc", "anchor". Never rename. */
  readonly key: string;
  /** Human display name, e.g. "Node.js". */
  readonly name: string;
  /** Whether the tool was detected. */
  readonly found: boolean;
  /** Detected version string, or null if not found / undetectable. */
  readonly version: string | null;
  /** OK / missing / outdated. */
  readonly status: ProbeStatus;
  /** Required tools gate the exit code (DOCTOR-03). Optional tools never fail it. */
  readonly required: boolean;
  /** What this tool is needed for (shown to the user). */
  readonly purpose: string;
  /** Optional hint: minimum version, install pointer, etc. */
  readonly note?: string;
}
