import { confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_FILE_EXISTS } from "./errors.js";

export interface ConfirmOverwriteOpts {
  /** If true, skip prompt and return true. For --force. */
  force?: boolean;
}

/** Asks `File <path> exists. Overwrite? [y/N]` with default NO.
 *  Returns true if user said yes OR if force is set.
 *  Throws CliError(E_FILE_EXISTS) if user said no or canceled (Ctrl+C).
 *
 *  Phase 1: no command actually calls this in production; Plan 04 verifies
 *  in tests. Plans from Phase 2 wire it into the real `create` flow.
 */
export async function confirmOverwrite(
  path: string,
  opts: ConfirmOverwriteOpts = {},
): Promise<boolean> {
  if (opts.force) return true;
  const answer = await confirm({
    message: `File ${path} exists. Overwrite?`,
    initialValue: false,
  });
  if (isCancel(answer) || answer === false) {
    throw new CliError({
      code: ERR_FILE_EXISTS,
      what: `Refused to overwrite ${path}.`,
      why: "The output path already exists and you chose not to overwrite it.",
      fix: "Re-run with a different --out path, or pass --force to overwrite without prompting.",
    });
  }
  return true;
}
