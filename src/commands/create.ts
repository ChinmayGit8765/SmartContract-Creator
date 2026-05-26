import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, Option } from "commander";
import { CliError, ERR_USAGE } from "../lib/errors.js";
import { makeColor } from "../lib/color.js";
import { makeOutput } from "../lib/output.js";
import { resolveNewbie } from "../lib/env.js";
import { get as getTemplate } from "../registry/index.js";
import { confirmOverwrite } from "../lib/prompt.js";
import { compileVerify } from "../compiler/index.js";
import { safeReadVersion } from "../lib/version.js";

/** Phase 2 dispatcher for `smartc create --template <id>`.
 *
 *  Pipeline: --json refusal (UI-10) -> --template required-flag check (W3) ->
 *  registry lookup -> runWizard -> generate -> [Phase 3 splice point] ->
 *  confirmOverwrite -> fs.writeFile -> result + nextStep footer (UI-05).
 *
 *  Renamed from Phase 1's stub factory. The option surface
 *  (`--template <id>`, `--out <path>`) is locked from Phase 1; only the
 *  `.action()` body changed.
 */
export function createCommand(): Command {
  const cmd = new Command("create")
    .description("Launch the interactive wizard to scaffold a new contract")
    .addOption(new Option("--template <id>", "Skip template picker; use this template directly"))
    .addOption(new Option("--out <path>", "Write generated file to this path (default: ./<name>.sol)"));

  cmd.action(async function (this: Command) {
    const globalOpts = this.optsWithGlobals() as {
      template?: string;
      out?: string;
      newbie?: boolean;
      json?: boolean;
      force?: boolean;
      color?: boolean;
    };

    // UI-10: --json + create is refused early (wizard requires TTY, mode is in Deferred Ideas).
    if (globalOpts.json) {
      throw new CliError({
        code: ERR_USAGE,
        what: "'smartc create' cannot run in --json mode.",
        why: "The wizard requires an interactive TTY, which is incompatible with machine-readable output.",
        fix: "Re-run without --json. Flag-driven non-interactive generation is planned for a future release; track it in .planning/STATE.md.",
        exitCode: 2,
      });
    }

    // Phase 2 requires explicit --template selection. Phase 4 introduces the interactive picker
    // when multiple templates ship; until then, refuse missing --template to avoid a silent
    // default that would mask the future picker decision.
    if (!globalOpts.template) {
      throw new CliError({
        code: ERR_USAGE,
        what: "Missing --template flag.",
        why: "`smartc create` requires --template in Phase 2 (one template ships: erc20). Phase 4 introduces the interactive multi-template picker.",
        fix: "Re-run with `--template erc20`. Run `smartc list-templates` to see available templates.",
        exitCode: 2,
      });
    }

    const noColor = globalOpts.color === false;
    const color = makeColor(noColor);
    const newbie = resolveNewbie({ newbieFlag: globalOpts.newbie });
    const output = makeOutput({ newbie, json: false, color });

    // 1. Resolve template — Phase 2 ships only --template lookup (no interactive picker yet; Phase 4 problem).
    const templateId = globalOpts.template; // Phase 2: required-flag, no silent default.
    const tpl = getTemplate(templateId);
    if (!tpl) {
      throw new CliError({
        code: ERR_USAGE,
        what: `Template '${templateId}' was not found in the registry.`,
        why: "The --template id does not match any registered template.",
        fix: "Run 'smartc list-templates' to see available templates.",
        exitCode: 2,
      });
    }
    if (!tpl.runWizard || !tpl.generate) {
      throw new CliError({
        code: ERR_USAGE,
        what: `Template '${tpl.id}' is not generatable (status: ${tpl.status}).`,
        why: "This template is registered for discoverability but has no generator wired.",
        fix: "Run 'smartc list-templates' to see generatable templates.",
        exitCode: 2,
      });
    }

    // 2. Wizard — runs prompts; throws E_WIZARD_CANCEL on Ctrl+C.
    const opts = await tpl.runWizard({ output });

    // 3. Generate — pure transform, no I/O.
    const { filename, source } = tpl.generate(opts);

    // Phase 3 — compile-verify gate (D-06, D-07, D-10): throws CliError(E_COMPILE_FAILED) on errors; warnings surface via output.warn.
    // Refuse chain="any" templates here — compileVerify only handles concrete chains.
    // Discovery-only templates (status="stub" with chain="any") are filtered out by the
    // !tpl.generate check above; if we reach here with chain="any", the template author
    // erred by shipping a generate() without picking a chain.
    if (tpl.chain !== "evm" && tpl.chain !== "solana") {
      throw new CliError({
        code: ERR_USAGE,
        what: `Template '${tpl.id}' has chain='${tpl.chain}' which is not compile-verifiable.`,
        why: "compile-verify dispatches on chain (evm → solc, solana → anchor build). Templates with chain='any' are discovery-only and must not ship a generate() function.",
        fix: "Report this — the template registration is inconsistent (generate present but chain='any').",
        exitCode: 2,
      });
    }
    const { warnings } = await compileVerify(source, tpl.chain);
    for (const w of warnings) {
      output.warn(w.formattedMessage);
    }
    if (warnings.length > 0 && newbie) {
      output.explain(
        "Warnings don't block deployment but often point at latent bugs. Review each before shipping.",
      );
    }

    // 4. Resolve output path.
    const outPath = globalOpts.out ?? path.resolve(process.cwd(), filename);

    // 5. Overwrite gate (Phase 1 contract — confirmOverwrite respects --force and throws CliError(E_FILE_EXISTS) on refusal).
    if (existsSync(outPath)) {
      await confirmOverwrite(outPath, { force: globalOpts.force });
    }

    // 6. Write.
    await writeFile(outPath, source, "utf8");

    // 7. Surface result + newbie next steps (UI-05 locked copy).
    output.result(`Wrote ${outPath}`);
    const solcVer = safeReadVersion("solc") ?? "unknown";
    const ozVer = safeReadVersion("@openzeppelin/contracts") ?? "unknown";
    output.nextStep(
      `Compile-verified against solc ${solcVer} + @openzeppelin/contracts ${ozVer}.`,
    );
    output.nextStep("Run 'smartc list-templates' to see other templates.");
  });

  return cmd;
}
