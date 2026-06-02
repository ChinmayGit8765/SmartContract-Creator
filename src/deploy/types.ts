// Phase 5 — normalized deploy-doc type contract.
// Type-only module — no runtime code. The deploy generator reads a DeployMeta
// (the chain-agnostic descriptor each template's deployMeta() produces) and never
// touches a template's bespoke Opts shape (CONTEXT D-01/D-02).
//
// Shapes copied verbatim from .planning/phases/05-deploy-md-generation/05-RESEARCH.md
// §DeployMeta Design. All fields readonly. The `flags` keys mirror the Opts field
// names (mintable/burnable/pausable/access) so the opts→meta mapping is mechanical.

export type DeployChain = "evm" | "solana";
export type DeployStandard = "erc20" | "erc721" | "erc1155" | "spl";
export type AccessMode = "ownable" | "roles" | "none";

/** One constructor parameter, in declaration order, with an example value the
 *  user can copy-paste. Order MUST match the generated .sol constructor exactly. */
export interface ConstructorArg {
  readonly name: string; // e.g. "recipient", "defaultAdmin", "initialOwner"
  readonly type: string; // ABI type for cast abi-encode: "address", "uint256", "string"
  readonly exampleValue: string; // a placeholder like "<YOUR_WALLET_ADDRESS>" — never a real secret
}

/** Normalized flag set. Keys align 1:1 with Opts field names (CONTEXT Discretion).
 *  Optional keys are template-specific; the warning + section renderers read them
 *  defensively (absent === false / not applicable). */
export interface DeployFlags {
  readonly mintable: boolean;
  readonly burnable: boolean;
  readonly pausable: boolean;
  readonly access: AccessMode; // normalized from `false | "ownable" | "roles"`
  // template-specific (present only on the relevant standard):
  readonly enumerable?: boolean; // erc721
  readonly royalty?: boolean; // erc721 (derived from royalty.enabled)
  readonly supply?: boolean; // erc1155
  readonly updatableUri?: boolean; // erc1155 (always true — owner-controlled setURI)
  readonly premintNonZero?: boolean; // erc20 (premint !== "0" — drives `recipient` ctor arg)
  // spl (Solana) — authority footguns + metadata (Phase 7):
  readonly mintAuthorityRetained?: boolean; // spl (true when the deployer keeps mint authority)
  readonly freezeAuthorityRetained?: boolean; // spl (true when the deployer can freeze accounts)
  readonly metadata?: boolean; // spl (Metaplex Token Metadata enabled)
}

export type WarningSeverity = "critical" | "info";

export interface CentralizationWarning {
  readonly id: string; // stable key for tests, e.g. "mintable-ownable"
  readonly severity: WarningSeverity;
  readonly title: string; // short heading
  readonly body: string; // the locked warning prose (BYTE-IDENTICAL to wizard output)
}

export interface DeployMeta {
  readonly contractName: string; // user's raw name (e.g. "MyToken") — used in commands
  readonly chain: DeployChain;
  readonly standard: DeployStandard;
  readonly constructorArgs: readonly ConstructorArg[];
  readonly flags: DeployFlags;
  readonly warnings: readonly CentralizationWarning[];
}
