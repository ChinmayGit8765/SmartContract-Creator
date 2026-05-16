import { Command } from "commander";
import Table from "cli-table3";
import { list } from "../registry/index.js";
import { makeColor } from "../lib/color.js";

export function listTemplatesCommand(): Command {
  const cmd = new Command("list-templates")
    .description("List all registered templates");

  cmd.action(function (this: Command) {
    const opts = this.optsWithGlobals() as { json?: boolean; color?: boolean };
    const templates = list();

    if (opts.json) {
      // Locked JSON shape from Phase 1. Do not change field names.
      const payload = {
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          chain: t.chain,
          status: t.status,
          description: t.description,
        })),
      };
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
      return;
    }

    // Boxed table (default renderer).
    // Commander negates `--no-color` to `opts.color === false`.
    const noColor = opts.color === false;
    const color = makeColor(noColor);
    const table = new Table({
      head: ["ID", "Name", "Chain", "Status", "Description"].map((h) => color.bold(h)),
      wordWrap: true,
      colWidths: [22, 32, 10, 10, 50],
    });
    for (const t of templates) {
      table.push([t.id, t.name, t.chain, t.status, t.description]);
    }
    process.stdout.write(table.toString() + "\n");
  });

  return cmd;
}
