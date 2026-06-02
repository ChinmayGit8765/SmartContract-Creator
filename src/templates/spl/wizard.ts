// Phase 7 — SPL token (Solana / Anchor) wizard.
//
// Prompt order: name -> symbol -> decimals -> supply -> mint authority ->
// freeze authority -> metadata. The two authority prompts are EXPLICIT choices
// with no default (SPL-02 / SPL-03): "null" is the safer, immutable option and is
// listed first, but the user must actively pick.
//
// cancelGuard is duplicated inline per the project's additive-model convention
// (each template owns its wizard; no shared extraction). Critical centralization
// warnings are sourced from the single-source centralizationWarnings().

import { text, select, confirm, isCancel } from "@clack/prompts";
import { CliError, ERR_WIZARD_CANCEL } from "../../lib/errors.js";
import { centralizationWarnings } from "../../deploy/warnings.js";
import { isTokenName, isSplSymbol, isDecimals, isWholeSupply } from "./validators.js";
import type { DeployFlags } from "../../deploy/types.js";
import type {
  SplOpts,
  WizardIo,
  MintAuthorityChoice,
  FreezeAuthorityChoice,
} from "./opts.js";

function cancelGuard<T>(answer: T | symbol, promptName: string): T {
  if (isCancel(answer)) {
    throw new CliError({
      code: ERR_WIZARD_CANCEL,
      what: `Wizard cancelled at: ${promptName}.`,
      why: "You pressed Ctrl+C or otherwise dismissed the prompt.",
      fix: "Re-run 'smartc create --template spl' to start over.",
      exitCode: 130,
    });
  }
  return answer as T;
}

export async function runWizard(io: WizardIo): Promise<SplOpts> {
  io.output.explain(
    "SPL is the fungible-token standard on Solana. This wizard scaffolds an Anchor program that creates the mint and mints your initial supply.",
  );
  io.output.reference("Solana SPL Token docs", "https://spl.solana.com/token");
  io.output.reference("Anchor book", "https://www.anchor-lang.com");

  io.output.explain("The token's display name. Up to 32 characters (Metaplex limit).");
  const name = cancelGuard(
    await text({
      message: "Token name",
      placeholder: "My Token",
      defaultValue: "My Token",
      validate: isTokenName,
    }),
    "token name",
  );

  io.output.explain("Wallets display this ticker. Up to 10 ASCII letters/digits.");
  const symbol = cancelGuard(
    await text({
      message: "Token symbol (1-10 ASCII letters/digits)",
      placeholder: "MYTKN",
      defaultValue: "MYTKN",
      validate: isSplSymbol,
    }),
    "token symbol",
  );

  io.output.explain(
    "Decimals set the smallest divisible unit. 9 is the Solana convention (SOL itself uses 9); USDC uses 6. 0 makes whole-number-only tokens.",
  );
  const decimalsStr = cancelGuard(
    await text({
      message: "Decimals (0-9)",
      placeholder: "9",
      defaultValue: "9",
      validate: isDecimals,
    }),
    "decimals",
  );

  io.output.explain(
    "Initial supply in whole tokens, minted to the deployer at initialize time. The program scales it by the decimals you chose.",
  );
  const supply = cancelGuard(
    await text({
      message: "Initial supply (whole tokens, e.g. 1000000)",
      placeholder: "1000000",
      defaultValue: "1000000",
      validate: isWholeSupply,
    }),
    "initial supply",
  );

  // SPL-02 — mint authority: EXPLICIT, no default (null listed first = safer).
  io.output.explain(
    "Mint authority controls whether more tokens can ever be created. Revoke it for a fixed, trustless supply; keep it (deployer) if you need to mint more later.",
  );
  const mintAuthority = cancelGuard(
    await select<MintAuthorityChoice>({
      message: "Mint authority:",
      options: [
        { value: "revoke", label: "Revoke (null) — fixed supply, no one can ever mint more" },
        { value: "deployer", label: "Keep (deployer) — you can mint more later (mutable supply)" },
      ],
    }),
    "mint authority",
  );

  // SPL-03 — freeze authority: EXPLICIT, no default (null listed first = safer).
  io.output.explain(
    "Freeze authority can freeze any holder's token account, blocking their transfers. Choose null for a freeze-proof token; it cannot be added back later.",
  );
  const freezeAuthority = cancelGuard(
    await select<FreezeAuthorityChoice>({
      message: "Freeze authority:",
      options: [
        { value: "none", label: "None (null) — accounts can never be frozen" },
        { value: "deployer", label: "Keep (deployer) — you can freeze holder accounts" },
      ],
    }),
    "freeze authority",
  );

  io.output.explain(
    "Metaplex Token Metadata lets wallets show your token's name, symbol, and image. Requires the Metaplex program (present on devnet + mainnet-beta).",
  );
  const metadata = cancelGuard(
    await confirm({
      message: "Add Metaplex metadata? (name/symbol/image shown in wallets)",
      initialValue: true,
    }),
    "metadata",
  );

  // Post-prompt critical warnings — single-source (byte-identical to DEPLOY.md).
  const warnFlags: DeployFlags = {
    mintable: mintAuthority === "deployer",
    burnable: false,
    pausable: false,
    access: "none",
    mintAuthorityRetained: mintAuthority === "deployer",
    freezeAuthorityRetained: freezeAuthority === "deployer",
    metadata,
  };
  for (const w of centralizationWarnings({ standard: "spl", flags: warnFlags })) {
    if (w.severity === "critical") io.output.warn(w.body);
  }

  return {
    name,
    symbol,
    decimals: Number.parseInt(decimalsStr, 10),
    supply,
    mintAuthority,
    freezeAuthority,
    metadata,
  };
}
