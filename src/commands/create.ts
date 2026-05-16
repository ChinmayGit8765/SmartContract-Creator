import { Command, Option } from "commander";
import { CliError, ERR_NOT_IMPLEMENTED } from "../lib/errors.js";

/** Phase 1 stub for `smartc create [--template <id>]`.
 *  Registered so --help discovers it (satisfies CLI-03 / CLI-05).
 *  Action throws E_NOT_IMPLEMENTED — Phase 2 replaces with the real wizard.
 */
export function createCommandStub(): Command {
  const cmd = new Command("create")
    .description("Launch the interactive wizard to scaffold a new contract")
    .addOption(new Option("--template <id>", "Skip template picker; use this template directly"))
    .addOption(new Option("--out <path>", "Write generated file to this path (default: ./<name>.sol)"));

  cmd.action(() => {
    throw new CliError({
      code: ERR_NOT_IMPLEMENTED,
      what: "The 'create' command is not yet implemented in Phase 1.",
      why: "Phase 1 ships the CLI foundation (help, list-templates, verbosity). Template generation lands in Phase 2 (ERC-20 canary template).",
      fix: "Track progress at .planning/ROADMAP.md. For now, run 'smartc list-templates' to see what is registered.",
    });
  });

  return cmd;
}
