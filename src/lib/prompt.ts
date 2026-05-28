import { existsSync } from "node:fs";
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

/** Phase 5 (D-08): gate MULTIPLE target paths (the .sol AND its .DEPLOY.md) in one
 *  prompt. Checks all paths up front, prompts ONCE listing only the existing ones,
 *  and throws CliError(E_FILE_EXISTS) on decline/cancel. Returns true if force is
 *  set or none of the paths exist. Reuses the same error code as confirmOverwrite. */
export async function confirmOverwriteMany(
  paths: string[],
  opts: ConfirmOverwriteOpts = {},
): Promise<boolean> {
  if (opts.force) return true;
  const existing = paths.filter((p) => existsSync(p));
  if (existing.length === 0) return true;
  const list = existing.map((p) => `  - ${p}`).join("\n");
  const answer = await confirm({
    message: `These files already exist and will be overwritten:\n${list}\nOverwrite?`,
    initialValue: false,
  });
  if (isCancel(answer) || answer === false) {
    throw new CliError({
      code: ERR_FILE_EXISTS,
      what: `Refused to overwrite ${existing.length} existing file(s):\n${list}`,
      why: "One or more output paths already exist and you chose not to overwrite them.",
      fix: "Re-run with a different --out path, or pass --force to overwrite without prompting.",
    });
  }
  return true;
}
