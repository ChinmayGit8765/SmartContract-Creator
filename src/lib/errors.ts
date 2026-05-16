import type { Colors } from "./color.js";

export const ERR_FILE_EXISTS = "E_FILE_EXISTS" as const;
export const ERR_NOT_IMPLEMENTED = "E_NOT_IMPLEMENTED" as const;
export const ERR_USAGE = "E_USAGE" as const;
export const ERR_UNKNOWN = "E_UNKNOWN" as const;

export interface CliErrorInit {
  code: string;
  what: string;
  why: string;
  fix: string;
  exitCode?: number; // default 1
}

export class CliError extends Error {
  readonly code: string;
  readonly what: string;
  readonly why: string;
  readonly fix: string;
  readonly exitCode: number;
  constructor(init: CliErrorInit) {
    super(init.what);
    this.name = "CliError";
    this.code = init.code;
    this.what = init.what;
    this.why = init.why;
    this.fix = init.fix;
    this.exitCode = init.exitCode ?? 1;
  }
}

/** Renders a CliError (or any Error) as a three-part block:
 *    Error: <what>     (code: <code>)
 *    Why:   <why>
 *    Fix:   <fix>
 *  Non-CliError throws collapse to a single line "Error: <message>"
 *  with code E_UNKNOWN, no why/fix.
 */
export function renderError(err: unknown, color: Colors): string {
  if (err instanceof CliError) {
    const head = `${color.red("Error:")} ${err.what} ${color.dim(`(code: ${err.code})`)}`;
    const why = `${color.yellow("Why:  ")} ${err.why}`;
    const fix = `${color.cyan("Fix:  ")} ${err.fix}`;
    return `${head}\n${why}\n${fix}`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `${color.red("Error:")} ${msg} ${color.dim(`(code: ${ERR_UNKNOWN})`)}`;
}
