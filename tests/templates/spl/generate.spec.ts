import { describe, it, expect } from "vitest";
import { generate } from "../../../src/templates/spl/generate.js";
import { deployMetaSpl } from "../../../src/templates/spl/deployMeta.js";
import type { SplOpts } from "../../../src/templates/spl/opts.js";

const base: SplOpts = {
  name: "My Token",
  symbol: "MYTKN",
  decimals: 9,
  supply: "1000000",
  mintAuthority: "revoke",
  freezeAuthority: "none",
  metadata: false,
};

describe("spl generate — filename + program name", () => {
  it("derives a snake_case .rs filename from the token name", () => {
    expect(generate({ ...base, name: "My Token" }).filename).toBe("my_token.rs");
    expect(generate({ ...base, name: "Cool-NFT Coin" }).filename).toBe("cool_nft_coin.rs");
    expect(generate({ ...base, name: "$$$" }).filename).toBe("spl_token.rs");
  });

  it("emits the program module + declare_id + token constants", () => {
    const { source } = generate({ ...base, name: "My Token", decimals: 6, supply: "500" });
    expect(source).toContain("pub mod my_token {");
    expect(source).toContain("declare_id!(");
    expect(source).toContain('const TOKEN_SYMBOL: &str = "MYTKN";');
    expect(source).toContain("const TOKEN_DECIMALS: u8 = 6;");
    expect(source).toContain("const INITIAL_SUPPLY: u64 = 500;");
    expect(source).toContain("mint_to(cpi_ctx, amount)?;");
  });
});

describe("spl generate — authority options", () => {
  it("revoke mint authority -> set_authority block + AuthorityType import", () => {
    const { source } = generate({ ...base, mintAuthority: "revoke" });
    expect(source).toContain("set_authority");
    expect(source).toContain("AuthorityType::MintTokens");
  });

  it("keep mint authority (deployer) -> no set_authority block", () => {
    const { source } = generate({ ...base, mintAuthority: "deployer" });
    expect(source).not.toContain("set_authority");
    expect(source).not.toContain("AuthorityType");
  });

  it("freeze authority deployer -> mint::freeze_authority constraint present", () => {
    const { source } = generate({ ...base, freezeAuthority: "deployer" });
    expect(source).toContain("mint::freeze_authority = payer.key()");
  });

  it("freeze authority none -> no freeze_authority constraint", () => {
    const { source } = generate({ ...base, freezeAuthority: "none" });
    expect(source).not.toContain("freeze_authority");
  });
});

describe("spl generate — metadata option", () => {
  it("metadata on -> Metaplex imports, CPI, and the metadata account", () => {
    const { source } = generate({ ...base, metadata: true });
    expect(source).toContain("anchor_spl::metadata");
    expect(source).toContain("create_metadata_accounts_v3");
    expect(source).toContain("pub token_metadata_program: Program<'info, Metadata>");
    expect(source).toContain("const TOKEN_URI:");
  });

  it("metadata off -> no Metaplex code", () => {
    const { source } = generate({ ...base, metadata: false });
    expect(source).not.toContain("anchor_spl::metadata");
    expect(source).not.toContain("create_metadata_accounts_v3");
    expect(source).not.toContain("TOKEN_URI");
  });
});

describe("spl deployMeta", () => {
  it("maps opts to a solana/spl DeployMeta with authority flags + warnings", () => {
    const meta = deployMetaSpl({ ...base, mintAuthority: "deployer", freezeAuthority: "deployer" });
    expect(meta.chain).toBe("solana");
    expect(meta.standard).toBe("spl");
    expect(meta.flags.mintAuthorityRetained).toBe(true);
    expect(meta.flags.freezeAuthorityRetained).toBe(true);
    const ids = meta.warnings.map((w) => w.id);
    expect(ids).toContain("spl-mint-authority-retained");
    expect(ids).toContain("spl-freeze-authority-retained");
  });

  it("revoked authorities -> no authority warnings; ctor args carry the chosen values", () => {
    const meta = deployMetaSpl({ ...base, mintAuthority: "revoke", freezeAuthority: "none", decimals: 6, supply: "42" });
    expect(meta.warnings.map((w) => w.id)).not.toContain("spl-mint-authority-retained");
    const byName = Object.fromEntries(meta.constructorArgs.map((a) => [a.name, a.exampleValue]));
    expect(byName.TOKEN_DECIMALS).toBe("6");
    expect(byName.INITIAL_SUPPLY).toBe("42");
    expect(byName.TOKEN_SYMBOL).toBe("MYTKN");
  });
});
