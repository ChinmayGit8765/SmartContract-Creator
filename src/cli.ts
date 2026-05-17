// Entry. Boots stub registry, builds program, dispatches, handles errors.
import { buildProgram } from "./program.js";
import { registerStubTemplates } from "./registry/stub.js";
import { CliError, renderError } from "./lib/errors.js";
import { makeColor } from "./lib/color.js";
import { resolveNewbie } from "./lib/env.js";

async function main(): Promise<void> {
  registerStubTemplates();
  const program = buildProgram();

  try {
    await program.exitOverride().parseAsync(process.argv);
  } catch (err: unknown) {
    const anyErr = err as { code?: string; exitCode?: number };
    if (anyErr && typeof anyErr.code === "string" && anyErr.code.startsWith("commander.")) {
      // --help / --version: commander already wrote output, propagate its exit code (0).
      if (
        anyErr.code === "commander.help" ||
        anyErr.code === "commander.helpDisplayed" ||
        anyErr.code === "commander.version"
      ) {
        process.exit(anyErr.exitCode ?? 0);
      }
      // Usage errors (unknown command, excess/missing args, unknown option):
      // exit 2 per Unix convention. Commander 14 defaults these to 1.
      process.exit(2);
    }

    // Real error — render the three-part block.
    // Commander negates `--no-color` to `opts.color === false`.
    const globalOpts = program.opts() as { color?: boolean; newbie?: boolean };
    const noColor = globalOpts.color === false;
    const color = makeColor(noColor);
    const newbie = resolveNewbie({ newbieFlag: globalOpts.newbie });
    const rendered = renderError(err, color);
    process.stderr.write(rendered + "\n");

    if (newbie && !(err instanceof CliError)) {
      process.stderr.write(color.dim(`(unexpected error — please report at the project issue tracker)\n`));
    }

    const exitCode = err instanceof CliError ? err.exitCode : 1;
    process.exit(exitCode);
  }
}

// SIGINT (Ctrl+C) -> exit 130 per Unix convention.
process.on("SIGINT", () => process.exit(130));

void main();
