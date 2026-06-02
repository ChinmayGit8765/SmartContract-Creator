import { describe, it, expect } from "vitest";
import { generateDeployDoc, deployDocPath } from "../../src/deploy/index.js";
import { deployMetaSpl } from "../../src/templates/spl/deployMeta.js";
import type { SplOpts } from "../../src/templates/spl/opts.js";

const NOW = new Date("2026-06-01T00:00:00Z");
const base: SplOpts = {
  name: "My Token",
  symbol: "MYTKN",
  decimals: 9,
  supply: "1000000",
  mintAuthority: "revoke",
  freezeAuthority: "none",
  metadata: false,
};

function doc(opts: Partial<SplOpts> = {}): string {
  return generateDeployDoc(deployMetaSpl({ ...base, ...opts }), { now: NOW }).content;
}

describe("solana DEPLOY.md sections (DEPLOY-05)", () => {
  it("includes both deploy paths covering devnet AND mainnet-beta", () => {
    const md = doc();
    expect(md).toContain("## Deploy via spl-token CLI");
    expect(md).toContain("## Deploy via Anchor");
    expect(md).toContain("spl-token create-token");
    expect(md).toContain("anchor deploy");
    expect(md).toContain("api.devnet.solana.com");
    expect(md).toContain("api.mainnet-beta.solana.com");
    expect(md).toContain("mainnet"); // anchor deploy mainnet variant
  });

  it("header + token-parameters + Solscan sections render", () => {
    const md = doc();
    expect(md).toContain("# Deploy: My Token");
    expect(md).toContain("Solana SPL (Anchor");
    expect(md).toContain("## Token Parameters");
    expect(md).toContain("## View on Solscan");
    expect(md).toContain("solscan.io/token");
  });

  it("echoes the chosen decimals + supply in the spl-token commands", () => {
    const md = doc({ decimals: 6, supply: "500" });
    expect(md).toContain("spl-token create-token --decimals 6");
    expect(md).toContain("spl-token mint <MINT_ADDRESS> 500");
  });

  it("revoke mint authority -> includes the authorize --disable step", () => {
    expect(doc({ mintAuthority: "revoke" })).toContain("spl-token authorize <MINT_ADDRESS> mint --disable");
  });

  it("keep mint authority -> NO authorize --disable, and surfaces the retained warning", () => {
    const md = doc({ mintAuthority: "deployer" });
    expect(md).not.toContain("mint --disable");
    expect(md).toContain("Mint authority retained");
  });

  it("freeze authority deployer -> create-token uses --enable-freeze", () => {
    expect(doc({ freezeAuthority: "deployer" })).toContain("--enable-freeze");
  });

  it("deployDocPath swaps a .rs source path for .DEPLOY.md", () => {
    expect(deployDocPath("/x/my_token.rs")).toBe("/x/my_token.DEPLOY.md");
    expect(deployDocPath("/x/MyToken.sol")).toBe("/x/MyToken.DEPLOY.md");
  });
});
