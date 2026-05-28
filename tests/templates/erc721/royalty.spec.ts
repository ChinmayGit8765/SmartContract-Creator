// Unit test for the EIP-2981 royalty post-process (CONTEXT D-17).
//
// This spec mocks NOTHING. It runs the REAL @openzeppelin/wizard@0.10.8
// `erc721.print` to produce source, pipes it through the real `injectRoyalty`
// transform, and validates the result through the REAL Phase 3 compile gate
// (`compileVerify(source, "evm")` → real solc 0.8.35 + real @openzeppelin/
// contracts@5.6.1, evmVersion: "cancun"). This is the "Wave 0 royalty probe in
// test form" — three injection scenarios + the opt-out invariant.
//
// Scenarios (RESEARCH §Probe C lines 796-800):
//   1. bare ERC-721 + royalty 250    → anchors 1,2,3 fire; anchor 4b injects a
//                                       supportsInterface(ERC721, ERC2981) override; compiles.
//   2. ownable+mintable + royalty 500 → anchors 1,2,3 fire; anchor 4b injects the override; compiles.
//   3. all-flags+roles + royalty 250 → all 4 anchors fire (4a extends the existing override); compiles.
//   4. opts.enabled === false        → output is byte-for-byte unchanged (D-06).
//
// NOTE: cases 1 & 2 assert the injected override (anchor 4b). This corrects
// RESEARCH §Pitfall 4's claim that anchor 4 "no-ops correctly" and the result
// compiles for bare/Ownable-only — it does NOT: ERC721 and ERC2981 both declare
// `supportsInterface`, so Solidity requires an explicit override. See
// 04-01-SUMMARY.md Deviations.

import { describe, it, expect } from "vitest";
import { erc721 } from "@openzeppelin/wizard";
import { injectRoyalty } from "../../../src/templates/erc721/royalty.js";
import { compileVerify } from "../../../src/compiler/index.js";

const ZERO_ADDR = "0x" + "0".repeat(40);

describe("injectRoyalty — 4-anchor post-process", () => {
  it("bare ERC-721 + royalty 250: anchors 1-3 fire, anchor 4b injects the override; result compiles", async () => {
    const wizardSrc = erc721.print({ name: "T", symbol: "T" });
    const injected = injectRoyalty(wizardSrc, {
      enabled: true,
      feeNumerator: 250,
      receiver: ZERO_ADDR,
    });

    // Anchor 1 — ERC2981 import.
    expect(injected).toContain(
      'import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";',
    );
    // Anchor 2 — ERC2981 appended to the contract's `is` parent list.
    expect(injected).toMatch(/contract\s+\w+\s+is\s+[^{]+ERC2981/);
    // Anchor 3 — _setDefaultRoyalty landed inside the (empty `{}`) ctor body.
    expect(injected).toContain(
      `_setDefaultRoyalty(${ZERO_ADDR}, 250);`,
    );
    // Anchor 4b — bare wizard output has NO supportsInterface override, so the
    // ERC721+ERC2981 diamond requires one to be injected with override(ERC721, ERC2981).
    expect(injected).toMatch(/override\(ERC721,\s*ERC2981\)/);

    // Phase 3 gate — proves the injected source is valid Solidity.
    const result = await compileVerify(injected, "evm");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("ownable + mintable + royalty 500: anchors 1-3 fire after the Ownable init, anchor 4b injects the override; result compiles", async () => {
    const wizardSrc = erc721.print({
      name: "T",
      symbol: "T",
      mintable: true,
      access: "ownable",
    });
    const injected = injectRoyalty(wizardSrc, {
      enabled: true,
      feeNumerator: 500,
      receiver: ZERO_ADDR,
    });

    expect(injected).toContain(
      'import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";',
    );
    expect(injected).toMatch(/contract\s+\w+\s+is\s+[^{]+ERC2981/);
    expect(injected).toContain(`_setDefaultRoyalty(${ZERO_ADDR}, 500);`);
    // Ownable-only wizard output emits no supportsInterface override → anchor 4b
    // injects the override(ERC721, ERC2981) form.
    expect(injected).toMatch(/override\(ERC721,\s*ERC2981\)/);

    const result = await compileVerify(injected, "evm");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("all-flags + roles + royalty 250: all 4 anchors fire (ERC2981 in `is` + supportsInterface override); result compiles", async () => {
    const wizardSrc = erc721.print({
      name: "T",
      symbol: "T",
      baseUri: "https://x/",
      mintable: true,
      enumerable: true,
      burnable: true,
      pausable: true,
      uriStorage: false,
      access: "roles",
    });
    const injected = injectRoyalty(wizardSrc, {
      enabled: true,
      feeNumerator: 250,
      receiver: ZERO_ADDR,
    });

    expect(injected).toContain(
      'import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";',
    );
    // Anchor 2 — ERC2981 in the parent list.
    expect(injected).toMatch(/contract\s+\w+\s+is\s+[^{]+ERC2981/);
    // Anchor 3 — _setDefaultRoyalty in the ctor body.
    expect(injected).toContain(`_setDefaultRoyalty(${ZERO_ADDR}, 250);`);
    // Anchor 4 — ERC2981 appended to the supportsInterface override list.
    expect(injected).toMatch(/override\([^)]*ERC2981[^)]*\)/);

    const result = await compileVerify(injected, "evm");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("opts.enabled === false: returns the input source byte-for-byte unchanged (D-06)", () => {
    const wizardSrc = erc721.print({
      name: "T",
      symbol: "T",
      mintable: true,
      access: "ownable",
    });
    const result = injectRoyalty(wizardSrc, {
      enabled: false,
      feeNumerator: 0,
      receiver: ZERO_ADDR,
    });
    // Opt-out invariant — strict identity. Not compiled (covered by the
    // erc721/erc1155 integration suite in plan 04-04).
    expect(result).toBe(wizardSrc);
  });
});
