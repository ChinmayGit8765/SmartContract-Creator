import { Command } from "commander";
import Table from "cli-table3";
import { makeColor } from "../lib/color.js";
import { makeOutput } from "../lib/output.js";
import { resolveNewbie } from "../lib/env.js";
import { runProbes, doctorExitCode } from "../doctor/index.js";
import type { ProbeResult, ProbeStatus } from "../doctor/index.js";

/** Phase 6: `smartc doctor` — probes the toolchain and reports each tool's
 *  found/version/status, then sets the process exit code (0 = ready, 1 = a
 *  required tool is missing/outdated) so it is scriptable in CI (DOCTOR-03).
 */
export function doctorCommand(): Command {
  const cmd = new Command("doctor").description(
    "Probe the local toolchain (Node, solc, anchor, cargo-build-sbf, ollama)",
  );

  cmd.action(async function (this: Command) {
    const opts = this.optsWithGlobals() as {
      json?: boolean;
      color?: boolean;
      newbie?: boolean;
    };
    const noColor = opts.color === false;
    const color = makeColor(noColor);
    const results = await runProbes();
    const exitCode = doctorExitCode(results);

    if (opts.json) {
      // Stable machine shape — scriptable consumers depend on these keys.
      const payload = {
        ok: exitCode === 0,
        tools: results.map((r) => ({
          key: r.key,
          name: r.name,
          found: r.found,
          version: r.version,
          status: r.status,
          required: r.required,
          purpose: r.purpose,
          ...(r.note ? { note: r.note } : {}),
        })),
      };
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
      process.exitCode = exitCode;
      return;
    }

    const statusCell = (r: ProbeResult): string => {
      const label = labelFor(r.status);
      if (r.status === "ok") return color.green(label);
      if (r.status === "outdated") return color.yellow(label);
      // missing: red if it actually matters (required), dim otherwise.
      return r.required ? color.red(label) : color.dim(label);
    };

    const table = new Table({
      head: ["Tool", "Found", "Version", "Status", "Purpose"].map((h) => color.bold(h)),
      wordWrap: true,
      colWidths: [18, 7, 18, 12, 42],
    });
    for (const r of results) {
      table.push([
        r.name,
        r.found ? "yes" : "no",
        r.version ?? "-",
        statusCell(r),
        r.purpose,
      ]);
    }
    process.stdout.write(table.toString() + "\n");

    // Summary line — always visible.
    const output = makeOutput({ newbie: resolveNewbie({ newbieFlag: opts.newbie }), json: false, color });
    if (exitCode === 0) {
      output.result(color.green("All required tools are ready."));
    } else {
      output.result(
        color.red("Some required tools are missing or outdated — see the Status column above."),
      );
    }

    // Newbie: surface install pointers for any tool with a note.
    for (const r of results) {
      if (r.note) output.explain(`${r.name}: ${r.note}`);
    }

    process.exitCode = exitCode;
  });

  return cmd;
}

function labelFor(status: ProbeStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "outdated":
      return "outdated";
    case "missing":
      return "missing";
  }
}
