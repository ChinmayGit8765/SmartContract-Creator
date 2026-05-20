// Phase 2 — ERC-20 wizard. Implements the seven UI-SPEC-locked prompts,
// the inline `cancelGuard` helper, the Mintable+Ownable centralization warning,
// and the newbie-mode preamble + per-prompt explain lines.
//
// Per UI-SPEC Components Inventory: `cancelGuard` stays INLINE in Phase 2.
// Phase 4 (when ERC-721 lands as the second consumer) will hoist to src/lib/wizard.ts.
//
// All output flows through `io.output.*` channels — wizard never branches on
// newbie mode; the Output factory (Phase 1 contract) handles gating.

import { text, select, confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_WIZARD_CANCEL } from "../../lib/errors.js";
import { isSolidityIdentifier, isAsciiSymbol, isNonNegativeDecimal } from "./validators.js";
import type { Erc20Opts, WizardIo } from "./opts.js";

/** Wraps every @clack prompt return value. On cancel (Ctrl+C / ESC) throws
 *  `CliError(E_WIZARD_CANCEL, exitCode:130)` with the prompt name in WHAT.
 *  Locked WHAT/WHY/FIX per UI-SPEC §E_WIZARD_CANCEL.
 */
function cancelGuard<T>(answer: T | symbol, promptName: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${promptName}.`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template erc20' to start over.",
      exitCode: 130,
    });
  }
  return answer as T;
}

export async function runWizard(io: WizardIo): Promise<Erc20Opts> {
  // Newbie-mode preamble (UI-SPEC §Pre-flight). Channels are no-ops in non-newbie /
  // json modes; the Output factory decides — wizard does NOT branch.
  io.output.explain(
    "ERC-20 is the fungible-token standard on Ethereum and EVM chains. This wizard asks for the basics, then a few optional features.",
  );
  io.output.reference("EIP-20 spec", "https://eips.ethereum.org/EIPS/eip-20");
  io.output.reference("OpenZeppelin ERC20 docs", "https://docs.openzeppelin.com/contracts/5.x/erc20");

  // Prompt 1 — contract name
  io.output.explain(
    "The on-chain contract name. Letters, digits, underscores; must start with a letter or underscore. Max 64 chars.",
  );
  const name = cancelGuard(
    await text({
      message: "Contract name (Solidity identifier)",
      placeholder: "MyToken",
      defaultValue: "MyToken",
      validate: isSolidityIdentifier,
    }),
    "contract name",
  );

  // Prompt 2 — token symbol
  io.output.explain(
    "Wallets display this. 3-5 chars is conventional; the spec allows up to 11.",
  );
  const symbol = cancelGuard(
    await text({
      message: "Token symbol (1-11 ASCII letters/digits)",
      placeholder: "MTK",
      defaultValue: "MTK",
      validate: isAsciiSymbol,
    }),
    "token symbol",
  );

  // Prompt 3 — initial supply (premint)
  io.output.explain(
    "Minted to the deployer at deploy time. The wizard scales this by the token's decimals (default 18) — type the human-readable count, not the wei amount.",
  );
  const premint = cancelGuard(
    await text({
      message: "Initial supply (human-readable, e.g. 1000000 or 1.5)",
      placeholder: "1000000",
      defaultValue: "1000000",
      validate: isNonNegativeDecimal,
    }),
    "initial supply",
  );

  // Prompt 4 — mintable
  io.output.explain(
    "Mintable means the supply is NOT fixed — an authorized account can mint more tokens later. Leave off for a hard-capped token.",
  );
  const mintable = cancelGuard(
    await confirm({
      message: "Enable Mintable? (an authorized account can mint more tokens after deploy)",
      initialValue: false,
    }),
    "mintable",
  );

  // Prompt 5 — burnable
  io.output.explain(
    "Burnable lets any holder destroy their own tokens (e.g., for deflationary models). It does NOT let an owner burn other people's tokens.",
  );
  const burnable = cancelGuard(
    await confirm({
      message: "Enable Burnable? (holders can burn their own tokens)",
      initialValue: false,
    }),
    "burnable",
  );

  // Prompt 6 — pausable
  io.output.explain(
    "Pausable lets an authorized account freeze transfers in emergencies. Adds centralization risk — a single key can halt your token.",
  );
  const pausable = cancelGuard(
    await confirm({
      message: "Enable Pausable? (an authorized account can freeze all transfers)",
      initialValue: false,
    }),
    "pausable",
  );

  // Prompt 7 — access control (conditional: only when mintable||pausable)
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

  // Post-prompt centralization warning (UI-02 / UI-14). `output.warn` is the
  // always-on critical channel (fires in default + newbie + --json).
  if (mintable && access === "ownable") {
    io.output.warn(
      "Mintable + Ownable: a single key can mint unlimited tokens. " +
        "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
    );
  }

  return {
    name,
    symbol,
    premint,
    mintable,
    burnable,
    pausable,
    access,
  };
}
