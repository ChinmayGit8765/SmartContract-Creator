import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Command, Option } from "commander";
import { confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_USAGE, ERR_WIZARD_CANCEL } from "../lib/errors.js";
import { makeColor } from "../lib/color.js";
import { makeOutput } from "../lib/output.js";
import { resolveNewbie } from "../lib/env.js";
import { compileVerify } from "../compiler/index.js";
import {
  isOllamaReachable,
  generateCompletion,
  resolveOllamaHost,
  resolveOllamaModel,
  ollamaUnreachableError,
} from "../ai/ollama.js";
import { buildPatchPrompt, extractSource, type SourceChain } from "../ai/prompt.js";
import { diffLines, diffStat, renderDiff } from "../ai/diff.js";

/** Phase 8 — `smartc add-feature --ai --file X.sol "<description>"`.
 *
 *  Flow (AI-01..06): read file -> check Ollama reachable (AI-05) -> ask the
 *  local model for the full updated file (AI-02/06) -> show a diff preview and
 *  confirm (AI-04) -> sandbox-compile the AI output (AI-03); only write on a
 *  clean compile, otherwise the file is left untouched (rolled back).
 */
export function addFeatureCommand(): Command {
  const cmd = new Command("add-feature")
    .description("Patch a feature into an existing generated contract using a local AI model")
    .argument("<description>", "Plain-English description of the change to make")
    .addOption(new Option("--file <path>", "Path to the contract file to edit"))
    .addOption(new Option("--ai", "Use the local Ollama model to generate the patch"))
    .addOption(
      new Option(
        "--model <name>",
        "Ollama model to use (default: qwen2.5-coder; env: SMARTC_OLLAMA_MODEL)",
      ),
    );

  cmd.action(async function (this: Command, description: string) {
    const opts = this.optsWithGlobals() as {
      file?: string;
      ai?: boolean;
      model?: string;
      newbie?: boolean;
      json?: boolean;
      force?: boolean;
      color?: boolean;
    };

    if (opts.json) {
      throw new CliError({
        code: ERR_USAGE,
        what: "'smartc add-feature' cannot run in --json mode.",
        why: "It shows a diff preview and asks for interactive confirmation, which is incompatible with machine-readable output.",
        fix: "Re-run without --json.",
        exitCode: 2,
      });
    }

    // AI is currently the only add-feature mode; require the explicit opt-in.
    if (!opts.ai) {
      throw new CliError({
        code: ERR_USAGE,
        what: "add-feature requires --ai.",
        why: "The only add-feature mode is the local-AI patch flow (Ollama). A deterministic mode is not offered.",
        fix: 'Re-run with --ai, e.g. `smartc add-feature --ai --file MyToken.sol "add a max supply cap"`.',
        exitCode: 2,
      });
    }

    if (!opts.file) {
      throw new CliError({
        code: ERR_USAGE,
        what: "Missing --file flag.",
        why: "add-feature edits an existing generated contract; it needs the path to that file.",
        fix: 'Re-run with --file <path>, e.g. `smartc add-feature --ai --file MyToken.sol "..."`.',
        exitCode: 2,
      });
    }

    const filePath = path.resolve(process.cwd(), opts.file);
    if (!existsSync(filePath)) {
      throw new CliError({
        code: ERR_USAGE,
        what: `File not found: ${opts.file}`,
        why: "add-feature edits a file that already exists on disk.",
        fix: "Check the path. Generate a contract first with `smartc create --template <id>`.",
        exitCode: 2,
      });
    }

    const ext = path.extname(filePath).toLowerCase();
    const chain: SourceChain | null = ext === ".sol" ? "evm" : ext === ".rs" ? "solana" : null;
    if (!chain) {
      throw new CliError({
        code: ERR_USAGE,
        what: `Unsupported file type: ${ext || "(none)"}`,
        why: "add-feature compile-verifies the result, so it only edits .sol (EVM) or .rs (Solana) files.",
        fix: "Point --file at a generated .sol or .rs contract.",
        exitCode: 2,
      });
    }

    const noColor = opts.color === false;
    const color = makeColor(noColor);
    const newbie = resolveNewbie({ newbieFlag: opts.newbie });
    const output = makeOutput({ newbie, json: false, color });

    const source = await readFile(filePath, "utf8");
    const host = resolveOllamaHost();
    const model = resolveOllamaModel(opts.model);

    // AI-05: fail fast + graceful when the daemon is down.
    if (!(await isOllamaReachable({ host }))) {
      throw ollamaUnreachableError(host);
    }

    output.result(`Asking ${model} to apply: "${description}"...`);
    output.explain("This runs entirely on your machine via the local Ollama daemon — no data leaves your computer.");

    const prompt = buildPatchPrompt({ source, description, chain });
    const raw = await generateCompletion({ host, model, prompt });
    const newSource = extractSource(raw);

    if (newSource.trim() === source.trim()) {
      output.result("The model returned no changes — your file is unchanged.");
      return;
    }

    // AI-04: diff preview.
    const lines = diffLines(source, newSource);
    const stat = diffStat(lines);
    output.result("");
    output.result(color.bold(`Proposed change to ${opts.file} (+${stat.added} / -${stat.removed}):`));
    output.result(renderDiff(lines, color));
    output.result("");

    // AI-04: explicit confirmation (skipped with --force).
    if (!opts.force) {
      const ok = await confirm({
        message: `Apply this change to ${opts.file}? (the result will be compile-checked first)`,
        initialValue: false,
      });
      if (isCancel(ok)) {
        throw new CliError({
          code: ERR_WIZARD_CANCEL,
          what: "add-feature cancelled.",
          why: "You dismissed the confirmation prompt.",
          fix: "Re-run to try again — your file was not modified.",
          exitCode: 130,
        });
      }
      if (!ok) {
        output.result("Aborted — your file was not modified.");
        return;
      }
    }

    // AI-03: sandbox-compile BEFORE writing. On failure the file is left
    // untouched (rolled back) and the compile diagnostics surface.
    const programName = path.basename(filePath).replace(/\.(sol|rs)$/i, "");
    let result;
    try {
      result = await compileVerify(newSource, chain, { programName });
    } catch (err) {
      output.warn(`AI output failed to compile — ${opts.file} was left unchanged (rolled back).`);
      throw err;
    }
    for (const w of result.warnings) output.warn(w.formattedMessage);
    if (result.skipped && result.skipReason) {
      // Solana without anchor: cannot verify. Apply anyway (consistent with SPL-05).
      output.warn(`Could not compile-verify the AI output: ${result.skipReason}`);
    }

    await writeFile(filePath, newSource, "utf8");
    output.result(color.green(`Updated ${opts.file}.`));
    output.nextStep("Review the diff above and run your own tests before deploying — AI output is a suggestion, not an audit.");
  });

  return cmd;
}
