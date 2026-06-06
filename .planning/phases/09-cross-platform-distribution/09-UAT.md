---
status: complete
phase: milestone-v1 (phases 5-9)
source:
  - 05-deploy-md-generation/*-SUMMARY.md
  - 06-doctor-and-environment-probe/06-01-SUMMARY.md
  - 07-spl-token-solana-anchor/07-01-SUMMARY.md
  - 08-ai-add-feature-ollama/08-01-SUMMARY.md
  - 09-cross-platform-distribution/09-01-SUMMARY.md
started: 2026-06-03T00:00:00Z
updated: 2026-06-03T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. smartc doctor — toolchain probe
expected: `smartc doctor` shows the 5-tool table; Node + solc OK; "All required tools are ready."; exit 0. `smartc doctor --json` emits `{ ok, tools:[...] }`.
result: pass

### 2. create ERC-20 — compile-verified .sol + DEPLOY.md
expected: `smartc create --template erc20` walks the wizard, compile-verifies, and writes BOTH `<Name>.sol` and `<Name>.DEPLOY.md`. The DEPLOY.md has Hardhat / Foundry / Remix sections + an Etherscan verify snippet + a safety checklist. Choosing Mintable + Ownable adds a "single key can mint unlimited tokens" warning (in the wizard output and the DEPLOY.md).
result: pass
note: User ran mintable+pausable+AccessControl(roles). Both MyToken.sol + MyToken.DEPLOY.md written; compile-verified. No critical centralization warning (correct — roles, not Ownable). solc "error-keyword" pass-through warnings from OZ ECDSA shown (COMP-04, harmless).

### 3. create ERC-721 / ERC-1155 — both EVM templates work
expected: `smartc create --template erc721` and `--template erc1155` each produce a compile-verified `.sol` + matching `.DEPLOY.md`. ERC-721 offers EIP-2981 royalty; ERC-1155 offers supply tracking.
result: pass
note: Both wrote .sol + .DEPLOY.md, compile-verified. ERC-721 royalty prompt present; ERC-1155 fired the always-on owner-controlled-URI critical warning (DEPLOY-06).

### 4. create SPL (Solana) — Anchor program + graceful skip
expected: `smartc create --template spl` asks name/symbol/decimals/supply + EXPLICIT mint-authority and freeze-authority choices (no default) + Metaplex opt-in, then writes `<name>.rs` (Anchor program) + a Solana `DEPLOY.md` (spl-token CLI + Anchor commands for devnet AND mainnet-beta). With no Anchor installed it WARNS that compile-verify was skipped but still writes the file.
result: pass
note: Revoke/None/Metaplex-yes run wrote my_token.rs + my_token.DEPLOY.md; "Anchor toolchain not found ... WITHOUT compile-verification ... run smartc doctor" warning fired (SPL-05).

### 5. add-feature (AI) — graceful when Ollama is down
expected: `smartc add-feature --ai --file MyToken.sol "add X"` with no Ollama running fails gracefully: `E_AI_UNREACHABLE`, a message pointing to `smartc doctor` + https://ollama.com, exit 1, file untouched.
result: pass
note: Driven by Claude (no Ollama). E_AI_UNREACHABLE + doctor/ollama.com message, exit 1, target .sol UNCHANGED.

### 6. add-feature (AI) — diff + confirm + sandbox-compile rollback
expected: With Ollama running, add-feature shows a diff preview, asks to confirm, then sandbox-compiles the result and writes ONLY if it compiles. A non-compiling suggestion is rolled back (file unchanged) with `E_COMPILE_FAILED`. (If you don't have Ollama, reply "skip".)
result: pass
note: Driven by Claude against a seeded fake Ollama. Valid patch -> diff shown -> applied (exit 0). BREAKME patch -> "rolled back" warn + E_COMPILE_FAILED (exit 1), file UNCHANGED.

### 7. Distribution — global install + public docs
expected: `npm install -g smartc` (or `npm link` from source) puts `smartc` on PATH so `smartc --help` works. README has install instructions, a quickstart, example output for all 4 templates, and a license. `docs/HOWTO.md`, `docs/FORKING.md`, `docs/EMBEDDING.md`, `AGENTS.md`, `llms.txt`, and `LICENSE` all exist. CI workflow runs on Windows/macOS/Linux.
result: pass
note: All 8 files present; README has Install/Quickstart/Templates&examples/License + all 4 template names; package.json license MIT + bin.smartc; CI matrix = ubuntu/windows/macos; smartc@0.1.0 linked globally.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none — all 7 tests passed]
