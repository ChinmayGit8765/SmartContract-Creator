import { Command } from "commander";
import { formatVersionLine } from "./lib/version.js";
import { makeColor } from "./lib/color.js";
import { listTemplatesCommand } from "./commands/list-templates.js";
import { createCommand } from "./commands/create.js";

/** Builds the smartc commander program tree.
 *  Returns the unparsed Command — caller controls parseAsync / exitOverride.
 */
export function buildProgram(): Command {
  const program = new Command()
    .name("smartc")
    .description("Generate compile-verified smart contracts from a wizard.")
    .version(formatVersionLine(), "-V, --version", "output version info")
    .option("--newbie", "Show explanatory output (env: SMARTC_NEWBIE=1)")
    .option("--verbose", "Alias for --newbie")
    .option("--force", "Skip ALL confirmation prompts (for CI/automation)")
    .option("--no-color", "Disable ANSI color output")
    .option("--json", "Emit JSON instead of human-readable output")
    .showHelpAfterError("(run 'smartc --help' for usage)")
    .configureHelp({ showGlobalOptions: true });

  // Bare `smartc` — print "Get started" highlight then standard help.
  // Commander negates `--no-color` to `opts.color === false`.
  program.action(function (this: Command) {
    const opts = this.opts() as { color?: boolean };
    const noColor = opts.color === false;
    const color = makeColor(noColor);
    process.stdout.write(color.bold("Get started: smartc create") + "\n\n");
    this.outputHelp();
  });

  program.addCommand(createCommand());
  program.addCommand(listTemplatesCommand());

  return program;
}
