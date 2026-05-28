# ERC-1155 Multi-Token Template

Generates an OpenZeppelin ERC-1155 contract from an interactive wizard. One
contract holds multiple token IDs (fungible or non-fungible). No royalty in
Phase 4 — EIP-2981 on ERC-1155 is deferred to v2
(`REQUIREMENTS.md` §v2 `ERC1155-V2-01`).

## Wizard prompts (in order)

| # | Prompt | Type | Default | Notes |
|---|--------|------|---------|-------|
| 1 | Contract name (Solidity identifier) | text | `MyMulti` | `isSolidityIdentifier` — letters/digits/underscores, max 64 chars |
| 2 | URI template (use the literal `{id}` placeholder) | text | `https://example.com/api/token/{id}.json` | `isNonEmptyUri` — non-empty, no whitespace |
| 3 | Enable Mintable? | confirm | `false` | mint new token IDs / quantities post-deploy |
| 4 | Enable Burnable? | confirm | `false` | holders burn their own balances |
| 5 | Enable Supply tracking? | confirm | `false` | adds `totalSupply(id)` + `totalSupply()` |
| 6 | Enable Pausable? | confirm | `false` | freeze all transfers |
| 7 | Access control style | select (`ownable`/`roles`) | `ownable` | **conditional** — only when mintable OR pausable |

## `Erc1155Opts` → `erc1155.print()` mapping

| `Erc1155Opts` field | `erc1155.print` key | Notes |
|---------------------|---------------------|-------|
| `name` | `name` | |
| `uri` | `uri` | the `{id}` placeholder is opaque to the contract |
| `mintable` | `mintable` | |
| `burnable` | `burnable` | |
| `supply` | `supply` | |
| `pausable` | `pausable` | |
| (none) | `updatableUri` | hardcoded literal `true` in `generate.ts` — NOT a prompt |
| `access` | `access` | `false` / `"ownable"` / `"roles"` |

`generate(opts)` is a thin wrapper: `erc1155.print(...)` → `{ filename, source }`.
No post-process, no royalty branch (CONTEXT D-08).

## `updatableUri: true` rationale

The wizard default is `updatableUri: true` (RESEARCH Pitfall 3) — it matches
wizard.openzeppelin.com byte-for-byte. Consequently even the **bare-default**
output includes `Ownable` + an owner-controlled `setURI(...)`, because a settable
URI needs an authority. This is why three centralization warnings fire:

1. (conditional) Mintable + Ownable — single key can mint any token id.
2. (conditional) Pausable + Ownable — single key can halt all transfers.
3. (always-on) the owner can change the URI template at any time.

## Filename derivation

Reuses `contractNameToFilename` from the ERC-20 template via a re-export in
`filename.ts` (the algorithm is template-agnostic — RESEARCH A5).
