// Phase 4 — ERC-1155 wizard. Implements the seven prompts (name, uri, mintable,
// burnable, supply, pausable, conditional access), the inline `cancelGuard`
// helper, the newbie-mode preamble + per-prompt explain lines, and three
// post-prompt centralization warnings (2 conditional + 1 always-on).
//
// Per CONTEXT D-10: `cancelGuard` stays INLINE and the conditional access prompt
// is duplicated verbatim from src/templates/erc20/wizard.ts (no shared-module
// extraction). All output flows through `io.output.*` channels — the wizard
// never branches on newbie mode; the Output factory (Phase 1 contract) gates.
//
// Centralization-warning copy is byte-locked from
// .planning/phases/04-erc-721-and-erc-1155-templates/04-RESEARCH.md
// §Non-negotiable centralization warnings ERC-1155 (lines 697-715).

import { text, select, confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_WIZARD_CANCEL } from "../../lib/errors.js";
import { isSolidityIdentifier, isNonEmptyUri } from "./validators.js";
import type { Erc1155Opts, WizardIo } from "./opts.js";

/** Wraps every @clack prompt return value. On cancel (Ctrl+C / ESC) throws
 *  `CliError(E_WIZARD_CANCEL, exitCode:130)` with the prompt name in WHAT.
 */
function cancelGuard<T>(answer: T | symbol, promptName: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${promptName}.`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template erc1155' to start over.",
      exitCode: 130,
    });
  }
  return answer as T;
}

export async function runWizard(io: WizardIo): Promise<Erc1155Opts> {
  // Newbie-mode preamble. Channels are no-ops in non-newbie / json modes; the
  // Output factory decides — wizard does NOT branch.
  io.output.explain(
    "ERC-1155 is the multi-token standard — one contract holds multiple token IDs (fungible OR non-fungible).",
  );
  io.output.reference("EIP-1155", "https://eips.ethereum.org/EIPS/eip-1155");
  io.output.reference(
    "OpenZeppelin ERC1155 docs",
    "https://docs.openzeppelin.com/contracts/5.x/erc1155",
  );

  // Prompt 1 — contract name
  io.output.explain(
    "The on-chain contract name. Letters, digits, underscores; max 64 chars. NOT the URI.",
  );
  const name = cancelGuard(
    await text({
      message: "Contract name (Solidity identifier)",
      placeholder: "MyMulti",
      defaultValue: "MyMulti",
      validate: isSolidityIdentifier,
    }),
    "contract name",
  );

  // Prompt 2 — URI template
  io.output.explain(
    "Metadata template. Use the literal `{id}` placeholder — clients substitute the hex-padded token id at lookup time.",
  );
  const uri = cancelGuard(
    await text({
      message: "URI template (use the literal {id} placeholder)",
      placeholder: "https://example.com/api/token/{id}.json",
      defaultValue: "https://example.com/api/token/{id}.json",
      validate: isNonEmptyUri,
    }),
    "uri",
  );

  // Prompt 3 — mintable
  io.output.explain(
    "Mintable means new token IDs / quantities can be minted post-deploy.",
  );
  const mintable = cancelGuard(
    await confirm({
      message: "Enable Mintable? (an authorized account can mint new token IDs / quantities after deploy)",
      initialValue: false,
    }),
    "mintable",
  );

  // Prompt 4 — burnable
  io.output.explain("Burnable lets each holder destroy their own balances.");
  const burnable = cancelGuard(
    await confirm({
      message: "Enable Burnable? (holders can burn their own balances)",
      initialValue: false,
    }),
    "burnable",
  );

  // Prompt 5 — supply tracking
  io.output.explain(
    "Supply tracking adds totalSupply(id) + totalSupply() so clients can read circulating amounts per id. Costs gas on mint/burn.",
  );
  const supply = cancelGuard(
    await confirm({
      message: "Enable Supply tracking? (adds totalSupply(id) + totalSupply())",
      initialValue: false,
    }),
    "supply",
  );

  // Prompt 6 — pausable
  io.output.explain(
    "Pausable lets an authorized account freeze all transfers.",
  );
  const pausable = cancelGuard(
    await confirm({
      message: "Enable Pausable? (an authorized account can freeze all transfers)",
      initialValue: false,
    }),
    "pausable",
  );

  // Prompt 7 — access control (conditional: only when mintable||pausable).
  // Copy duplicated verbatim from src/templates/erc20/wizard.ts:121-141 per CONTEXT D-10.
  let access: false | "ownable" | "roles" = false;
  if (mintable || pausable) {
    io.output.explain(
      "Ownable: one address controls Mint/Pause. Simpler but a single key controls the contract. AccessControl: separate roles for MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE. More flexible, more setup. Use AccessControl if you plan to use a multisig or split duties.",
    );
    access = cancelGuard(
      await select<"ownable" | "roles">({
        message: "Access control style:",
        options: [
          { value: "ownable", label: "Ownable — one address controls Mint/Pause" },
          {
            value: "roles",
            label:
              "AccessControl — separate MINTER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE",
          },
        ],
        initialValue: "ownable",
      }),
      "access control",
    );
  }

  // Post-prompt centralization warnings (RESEARCH lines 697-715). `output.warn`
  // is the always-on critical channel (fires in default + newbie + --json).
  if (mintable && access === "ownable") {
    io.output.warn(
      "Mintable + Ownable: a single key can mint unlimited quantities of any token id. " +
        "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
    );
  }
  if (pausable && access === "ownable") {
    io.output.warn(
      "Pausable + Ownable: a single key can halt all transfers across every token id. " +
        "Consider AccessControl (multi-role) or a multisig owner.",
    );
  }
  // Always-on: the wizard default `updatableUri:true` includes an owner-controlled
  // setURI in EVERY generated contract, so this warning fires whenever the wizard completes.
  io.output.warn(
    "ERC-1155 default-URI setter is owner-controlled (wizard default `updatableUri:true`). " +
      "The contract owner can change the URI template at any time. Use a multisig owner or freeze ownership before launch if metadata must be immutable.",
  );

  return {
    name,
    uri,
    mintable,
    burnable,
    supply,
    pausable,
    access,
  };
}
