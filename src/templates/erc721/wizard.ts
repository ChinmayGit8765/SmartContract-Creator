// Phase 4 — ERC-721 NFT wizard. Implements the 9 base prompts + 2 conditional
// royalty prompts + 1 conditional access prompt, the inline `cancelGuard` helper,
// three centralization warnings (Mintable+Ownable, Royalty+Ownable, Pausable+Ownable),
// and the newbie-mode preamble + per-prompt explain lines.
//
// Cloned from src/templates/erc20/wizard.ts. Per CONTEXT D-10, `cancelGuard` and the
// conditional access-control prompt are DUPLICATED inline (not extracted) — duplication
// is the additive-model test; the inline pattern stays even with erc721 + erc1155 as
// new consumers.
//
// Prompt order (CONTEXT Discretion + RESEARCH §Wizard Prompt Sequences):
//   name → symbol → baseUri → mintable → enumerable → burnable → pausable →
//   royalty-confirm → (if royalty) bps + receiver → (if mintable||pausable) access.
//
// All output flows through `io.output.*` channels — the wizard never branches on
// newbie mode; the Output factory (Phase 1 contract) handles gating.

import { text, select, confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_WIZARD_CANCEL } from "../../lib/errors.js";
import {
  isSolidityIdentifier,
  isAsciiSymbol,
  isValidBaseUriOrEmpty,
  isRoyaltyBps,
  isEthAddress,
} from "./validators.js";
import type { Erc721Opts, WizardIo } from "./opts.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Wraps every @clack prompt return value. On cancel (Ctrl+C / ESC) throws
 *  `CliError(E_WIZARD_CANCEL, exitCode:130)` with the prompt name in WHAT.
 */
function cancelGuard<T>(answer: T | symbol, promptName: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${promptName}.`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template erc721' to start over.",
      exitCode: 130,
    });
  }
  return answer as T;
}

export async function runWizard(io: WizardIo): Promise<Erc721Opts> {
  // Newbie-mode preamble. Channels are no-ops in non-newbie / json modes; the
  // Output factory decides — wizard does NOT branch.
  io.output.explain(
    "ERC-721 is the non-fungible-token (NFT) standard on Ethereum and EVM chains. This wizard asks for the basics, then a few optional features.",
  );
  io.output.reference("EIP-721 spec", "https://eips.ethereum.org/EIPS/eip-721");
  io.output.reference(
    "OpenZeppelin ERC721 docs",
    "https://docs.openzeppelin.com/contracts/5.x/erc721",
  );

  // Prompt 1 — contract name
  io.output.explain(
    "The on-chain contract name. Letters, digits, underscores; must start with a letter or underscore. Max 64 chars.",
  );
  const name = cancelGuard(
    await text({
      message: "Contract name (Solidity identifier)",
      placeholder: "MyNFT",
      defaultValue: "MyNFT",
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
      placeholder: "MNFT",
      defaultValue: "MNFT",
      validate: isAsciiSymbol,
    }),
    "token symbol",
  );

  // Prompt 3 — base URI (optional)
  io.output.explain(
    "Token metadata lives here. The wizard emits _baseURI() → <base>/<id> resolution. Leave blank if you'll use tokenURI overrides.",
  );
  const baseUri = cancelGuard(
    await text({
      message: "Base URI for token metadata (optional)",
      placeholder: "https://example.com/api/token/",
      defaultValue: "",
      validate: isValidBaseUriOrEmpty,
    }),
    "base URI",
  );

  // Prompt 4 — mintable
  io.output.explain(
    "Mintable means new NFTs can be minted post-deploy. Required for most launch patterns.",
  );
  const mintable = cancelGuard(
    await confirm({
      message: "Enable Mintable? (an authorized account can mint new NFTs after deploy)",
      initialValue: false,
    }),
    "mintable",
  );

  // Prompt 5 — enumerable
  io.output.explain(
    "Enumerable adds totalSupply() + tokenByIndex() + tokenOfOwnerByIndex(). Useful for marketplaces; costs gas on every transfer.",
  );
  const enumerable = cancelGuard(
    await confirm({
      message: "Enable Enumerable? (on-chain totalSupply + token enumeration)",
      initialValue: false,
    }),
    "enumerable",
  );

  // Prompt 6 — burnable
  io.output.explain("Burnable lets each holder destroy their own NFTs.");
  const burnable = cancelGuard(
    await confirm({
      message: "Enable Burnable? (holders can burn their own NFTs)",
      initialValue: false,
    }),
    "burnable",
  );

  // Prompt 7 — pausable
  io.output.explain(
    "Pausable lets an authorized account freeze all transfers in emergencies. Adds centralization risk.",
  );
  const pausable = cancelGuard(
    await confirm({
      message: "Enable Pausable? (an authorized account can freeze all transfers)",
      initialValue: false,
    }),
    "pausable",
  );

  // Prompt 8 — royalty opt-in (EIP-2981)
  io.output.explain(
    "Adds the EIP-2981 royalty signal. Marketplaces voluntarily pay royalty on secondary sales. Note: the standard is voluntary — not all marketplaces honor it.",
  );
  const royaltyEnabled = cancelGuard(
    await confirm({
      message: "Enable EIP-2981 royalty? (signals royalty to marketplaces)",
      initialValue: false,
    }),
    "royalty",
  );

  // Prompts 9a/9b — royalty pair (conditional on the opt-in). The all-zero
  // sentinel for the disabled branch is type completeness only — receiver is
  // unused when enabled is false (generate.ts skips injectRoyalty entirely).
  let royalty: Erc721Opts["royalty"] = {
    enabled: false,
    feeNumerator: 0,
    receiver: ZERO_ADDRESS,
  };
  if (royaltyEnabled) {
    io.output.explain(
      "EIP-2981 expresses royalty as basis points: 250 = 2.5%, 10000 = 100%. Marketplaces voluntarily honor the signal.",
    );
    const feeStr = cancelGuard(
      await text({
        message: "Royalty basis points (0-10000)",
        placeholder: "250",
        defaultValue: "250",
        validate: isRoyaltyBps,
      }),
      "royalty basis points",
    );
    const receiver = cancelGuard(
      await text({
        message: "Royalty recipient address",
        placeholder: ZERO_ADDRESS,
        defaultValue: ZERO_ADDRESS,
        validate: isEthAddress,
      }),
      "royalty recipient",
    );
    royalty = { enabled: true, feeNumerator: Number(feeStr), receiver };
  }

  // Conditional access-control prompt (fires only when mintable||pausable).
  // Copied VERBATIM from src/templates/erc20/wizard.ts:121-141 per CONTEXT D-10 —
  // do NOT extract to a helper module.
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

  // Post-prompt centralization warnings (RESEARCH lines 670-694). `output.warn` is
  // the always-on critical channel (fires in default + newbie + --json). Byte-locked.
  if (mintable && access === "ownable") {
    io.output.warn(
      "Mintable + Ownable: a single key can mint unlimited NFTs. " +
        "Consider AccessControl (multi-role) or transferring ownership to a multisig before deploy.",
    );
  }
  if (royalty.enabled && access === "ownable") {
    io.output.warn(
      "EIP-2981 + Ownable: the contract owner can change the royalty recipient at any time via _setDefaultRoyalty. " +
        "Marketplaces may distrust royalty signals from single-key-controlled contracts.",
    );
  }
  if (pausable && access === "ownable") {
    io.output.warn(
      "Pausable + Ownable: a single key can halt all NFT transfers. " +
        "Consider AccessControl (multi-role) or a multisig owner.",
    );
  }

  return {
    name,
    symbol,
    baseUri,
    mintable,
    enumerable,
    burnable,
    pausable,
    uriStorage: false, // reserved; not surfaced (RESEARCH Open Q3)
    royalty,
    access,
  };
}
