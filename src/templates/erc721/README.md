# ERC-721 NFT template

Non-fungible token (ERC-721) plugin for EVM chains. Wraps
`@openzeppelin/wizard@0.10.8` `erc721.print()` and adds an EIP-2981 royalty
post-process. Registered via `registerErc721Template()` (id `erc721`, chain
`evm`, status `alpha`).

## Wizard prompts

Order: `name → symbol → baseUri → mintable → enumerable → burnable → pausable →
royalty → (if royalty) bps + receiver → (if mintable||pausable) access`.

| # | Prompt | Type | Validator |
|---|--------|------|-----------|
| 1 | Contract name (Solidity identifier) | text | `isSolidityIdentifier` |
| 2 | Token symbol (1-11 ASCII letters/digits) | text | `isAsciiSymbol` |
| 3 | Base URI for token metadata (optional) | text | `isValidBaseUriOrEmpty` (empty allowed) |
| 4 | Enable Mintable? | confirm | — |
| 5 | Enable Enumerable? | confirm | — |
| 6 | Enable Burnable? | confirm | — |
| 7 | Enable Pausable? | confirm | — |
| 8 | Enable EIP-2981 royalty? | confirm | — |
| 9a | Royalty basis points (0-10000) | text (if royalty) | `isRoyaltyBps` |
| 9b | Royalty recipient address | text (if royalty) | `isEthAddress` |
| 10 | Access control style (ownable / roles) | select (if mintable\|\|pausable) | — |

Three always-on `output.warn` centralization warnings fire post-prompt under
Mintable+Ownable, Royalty+Ownable, and Pausable+Ownable.

## Opts → `erc721.print()` mapping

`Erc721Opts` fields map 1:1 onto wizard `ERC721Options` keys: `name`, `symbol`,
`baseUri`, `mintable`, `enumerable`, `burnable`, `pausable`, `uriStorage`,
`access`. `royalty` is NOT a wizard key — it is applied via the post-process
below (CONTEXT D-04). `uriStorage` is always `false` (reserved; not surfaced —
RESEARCH Open Q3). `info` is never passed, so wizard defaults
`{ license: "MIT", securityContact: "" }` apply.

## Royalty post-process

When `opts.royalty.enabled === true`, `generate()` pipes the wizard source
through `injectRoyalty()` (`royalty.ts`, plan 04-01 — see RESEARCH §Pattern 3).
Four anchors: (1) `ERC2981` import after the last OZ import, (2) `ERC2981`
appended to the contract `is` list, (3) `_setDefaultRoyalty(receiver, fee)`
inserted before the constructor body's closing brace, and (4) the
`supportsInterface` override list. Anchor 3 uses a **bracket-counting walker**,
not a regex — a regex skips past an empty constructor body `{}` and misplaces the
royalty call. When `opts.royalty.enabled === false`, `injectRoyalty` is not
called and the output is byte-for-byte identical to `erc721.print(...)` (D-06).

## Deviations from wizard defaults

None — `uriStorage:false` is suppressed; everything else is pass-through. The
royalty injection is the one Phase 4 deviation from the Phase 2 "no string
templating" rule, sanctioned by CONTEXT D-04.

## Filename derivation

Reuses `contractNameToFilename` from `../erc20/filename.js` via re-export (the
utility is pure; the duplicate-don't-extract rule targets prompt code, not
utility libraries — RESEARCH A5).
