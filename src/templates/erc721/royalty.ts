// EIP-2981 royalty post-process for ERC-721 wizard output.
//
// Source: .planning/phases/04-erc-721-and-erc-1155-templates/04-RESEARCH.md
//         §Pattern 3 (lines 363-473) — the four-anchor bracket-counting walker,
//         validated by the Wave 0 probe (RESEARCH §Probe C) against three real
//         wizard outputs (bare, ownable+mintable, all-flags+roles).
//
// THE ONE DEVIATION FROM PHASE 2 D-02 ("no string templating"):
//   @openzeppelin/wizard@0.10.8 has no `royalty` field on ERC721Options
//   (CONTEXT D-04), so EIP-2981 support is delivered as a deterministic,
//   anchor-located post-process on the wizard's printed Solidity. This is the
//   ONLY place Phase 4 modifies wizard output; the rest is byte-for-byte wizard.
//   Each insertion is a single anchor (`string.replace` or a bracket-counting
//   walk) — NOT a `<%= %>`-style template body (CONTEXT D-05).
//
// CRITICAL — anchor 3 (constructor body) MUST use bracket-counting, NOT a regex.
//   The wizard sometimes emits an EMPTY constructor body (`{}`) for bare-default;
//   a non-greedy regex skips past the empty body and misplaces
//   `_setDefaultRoyalty(...)` into the next function (e.g. `_baseURI()`). This is
//   RESEARCH §Pitfall 1. Bracket-counting is grammar-exact and tolerates empty
//   bodies, modifier chains, and multi-line bodies.

import type { Erc721RoyaltyOpts } from "./opts.js";

/** Inserts EIP-2981 royalty into the wizard's ERC-721 Solidity source.
 *
 *  Four insertions (cap-anchored, ordered):
 *    1. ERC2981 import — spliced after the LAST `@openzeppelin/contracts/...`
 *       import line. Anchored to the line-walker, NOT one big regex.
 *    2. ERC2981 parent — appended to the `contract <Name> is <parents>` list,
 *       before the opening `{`.
 *    3. `_setDefaultRoyalty(receiver, feeNumerator);` — inserted before the
 *       constructor body's matching closing brace, located by bracket-counting
 *       (see `insertAtConstructorBodyEnd`). Tolerates an empty body `{}` and ANY
 *       constructor initializer/modifier chain.
 *    4. ERC2981 token — appended to the existing
 *       `function supportsInterface(bytes4 interfaceId) ... override(...)` list
 *       IF AND ONLY IF the wizard emitted such an override (i.e. when
 *       AccessControl/Enumerable/URIStorage are present). When the wizard emits
 *       no override (bare or Ownable-only), ANCHOR 4 IS A NO-OP and ERC2981
 *       provides its own `supportsInterface` via ERC165 inheritance.
 *
 *  Opt-out invariant (CONTEXT D-06): when `opts.enabled === false`, returns the
 *  input `source` unchanged (reference identity). Pure function — no I/O, never
 *  throws on the happy path.
 */
export function injectRoyalty(source: string, opts: Erc721RoyaltyOpts): string {
  if (!opts.enabled) return source;
  let s = source;

  // ANCHOR 1: ERC2981 import (spliced after the LAST OZ import line).
  // Line-walker (NOT one big regex): track the index of the last line matching
  // an `@openzeppelin/contracts/...` import, then splice ours right after it.
  const lines = s.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (
      /^import \{[^}]+\} from "@openzeppelin\/contracts\/[^"]+\.sol";$/.test(
        lines[i] ?? "",
      )
    ) {
      lastImport = i;
    }
  }
  if (lastImport >= 0) {
    lines.splice(
      lastImport + 1,
      0,
      'import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";',
    );
  }
  s = lines.join("\n");

  // ANCHOR 2: ERC2981 in the contract's `is` parent list.
  // `parents.trim()` drops trailing whitespace before appending `, ERC2981`.
  s = s.replace(
    /^(contract\s+\w+\s+is\s+)([^{]+?)(\s*\{)/m,
    (_m, prefix: string, parents: string, brace: string) =>
      `${prefix}${parents.trim()}, ERC2981${brace}`,
  );

  // ANCHOR 3: `_setDefaultRoyalty(...)` before the constructor body's closing
  // brace. Bracket-counting required — regex cannot reliably locate `{}` (empty
  // body). See Pitfall 1 in the file header.
  s = insertAtConstructorBodyEnd(
    s,
    `    _setDefaultRoyalty(${opts.receiver}, ${opts.feeNumerator});\n`,
  );

  // ANCHOR 4: supportsInterface override.
  //
  // Two sub-cases — the wizard either emits a supportsInterface override or it
  // does not, and BOTH require action because adding ERC2981 to the `is` list
  // (anchor 2) introduces a second base that declares `supportsInterface`:
  //
  //   4a. Override PRESENT (AccessControl / Enumerable / URIStorage in the parent
  //       list): append `, ERC2981` to the existing `override(...)` list.
  //   4b. Override ABSENT (bare ERC721, or Ownable-only): ERC721 and ERC2981 BOTH
  //       declare `supportsInterface`, so Solidity requires the derived contract
  //       to override it explicitly. We inject a minimal
  //       `supportsInterface(...) override(ERC721, ERC2981)` before the contract's
  //       closing brace.
  //
  // NOTE: this corrects RESEARCH §Pitfall 4's assumption that ERC2981's own
  // ERC165-inherited supportsInterface is sufficient when no wizard override
  // exists — it is NOT (the ERC721+ERC2981 diamond requires an explicit override,
  // verified via the Phase 3 compile gate). See 04-01-SUMMARY.md Deviations.
  const overrideRe =
    /(function\s+supportsInterface\(bytes4\s+interfaceId\)\s*[\s\S]*?override\()([^)]+)(\))/m;
  if (overrideRe.test(s)) {
    // 4a — extend the existing override list.
    s = s.replace(
      overrideRe,
      (_m, head: string, list: string, close: string) =>
        `${head}${list.trim()}, ERC2981${close}`,
    );
  } else {
    // 4b — inject a minimal supportsInterface override for the ERC721+ERC2981
    // diamond, before the contract body's matching closing brace.
    s = insertAtContractBodyEnd(
      s,
      "\n    function supportsInterface(bytes4 interfaceId)\n" +
        "        public\n" +
        "        view\n" +
        "        override(ERC721, ERC2981)\n" +
        "        returns (bool)\n" +
        "    {\n" +
        "        return super.supportsInterface(interfaceId);\n" +
        "    }\n",
    );
  }

  return s;
}

/** Walks `source` finding the `contract <Name> is ... { ... }` declaration via
 *  bracket counting and inserts `insertion` immediately before the contract
 *  body's matching closing brace. Used by anchor 4b to add a missing
 *  `supportsInterface` override. Returns source unchanged if no `contract`
 *  declaration is found (defensive — never throws).
 */
function insertAtContractBodyEnd(source: string, insertion: string): string {
  const m = /contract\s+\w+\s+is\s+[^{]+\{/.exec(source);
  if (!m) return source;
  const bodyOpen = m.index + m[0].length - 1; // index of the opening `{`
  let bd = 1;
  let j = bodyOpen + 1;
  while (j < source.length && bd > 0) {
    if (source[j] === "{") bd++;
    else if (source[j] === "}") bd--;
    j++;
  }
  const bodyClose = j - 1; // index of the contract's matching `}`
  return source.slice(0, bodyClose) + insertion + source.slice(bodyClose);
}

/** Walks `source` finding `constructor(...) ... {body}` via bracket counting and
 *  inserts `insertion` immediately before the body's matching closing brace.
 *
 *  Algorithm (grammar-exact, tolerant of empty `{}`, modifier chains, and
 *  multi-line bodies):
 *    1. Locate `constructor(`; bail (return source unchanged) if absent.
 *    2. Depth-count `(`/`)` from just past `constructor(` to skip the signature
 *       parens.
 *    3. Skip forward to the first `{` (the body open) — this passes over any
 *       constructor-initializer chain such as `ERC721(...) Ownable(...)`.
 *    4. Depth-count `{`/`}` from `bodyOpen + 1` until depth returns to 0; the
 *       matching close brace is at `j - 1`.
 *    5. Insert before the close. When the body was empty (`{}`), prefix a newline
 *       so the result reads `{\n    <insertion>}` instead of `{<insertion>}`.
 *
 *  Defensive: returns `source` unchanged if no constructor is found — never throws.
 */
function insertAtConstructorBodyEnd(source: string, insertion: string): string {
  const ctorIdx = source.indexOf("constructor(");
  if (ctorIdx < 0) return source;

  // Walk past the constructor signature's parens.
  let i = ctorIdx + "constructor(".length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") depth--;
    i++;
  }

  // Skip whitespace and any constructor-initializer chain (e.g. `ERC721(...)`)
  // to the first `{` (the body open).
  while (i < source.length && source[i] !== "{") i++;
  if (i >= source.length) return source;
  const bodyOpen = i;

  // Find the matching closing brace (bracket-count from bodyOpen).
  let bd = 1;
  let j = bodyOpen + 1;
  while (j < source.length && bd > 0) {
    if (source[j] === "{") bd++;
    else if (source[j] === "}") bd--;
    j++;
  }
  const bodyClose = j - 1; // index of the matching `}`

  // Insert with a leading newline when the body was empty (`{}`) so the output
  // stays readable across both empty and non-empty constructor bodies.
  return (
    source.slice(0, bodyClose) +
    (source[bodyClose - 1] === "{" ? "\n" : "") +
    insertion +
    source.slice(bodyClose)
  );
}
