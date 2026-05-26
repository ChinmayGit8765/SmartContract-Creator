# src/compiler — Solidity compile-verify gate

## Overview

In-process Solidity compile gate for `smartc create`. Throws `CliError(E_COMPILE_FAILED)` on any solc-emitted error (file is **never** written to disk), surfaces warnings via `output.warn` without blocking the write, and resolves `@openzeppelin/contracts/*` imports from smartc's bundled deps so users never need a local OZ install.

Covers Phase 3 requirements: **COMP-01** (in-process solc compile), **COMP-03** (compile fail → diagnostics → no file), **COMP-04** (warnings surface but do not block), **COMP-05** (bundled-deps import resolution; cwd-independent). COMP-02 (Solana SPL via `anchor build`) is the same seam, implemented in Phase 7.

## Architecture

- [`./index.ts`](./index.ts) — owns `compileVerify(source, chain)`. Builds the standard JSON input, calls `solc.compile`, partitions diagnostics, throws `CliError(E_COMPILE_FAILED)` on errors or returns `{ warnings }` on success.
- [`./imports.ts`](./imports.ts) — owns `makeImportCallback()`. Resolves `@openzeppelin/contracts/*` paths against smartc's bundled OZ install (NOT the user's cwd), maintains a per-call closure cache, enforces the path-traversal guard.
- [`./types.ts`](./types.ts) — owns `CompileDiagnostic`, `StandardJsonInput`, `SolcOutput`, `Severity`. Seam shape for Phase 7's `anchor build` adapter — anchor diagnostics get normalized into the same `CompileDiagnostic` shape so the dispatcher renders chain-agnostic.

Public seam (locked from Plan 02 forward, never break):

```typescript
export async function compileVerify(
  source: string,
  chain: "evm" | "solana",
): Promise<{ warnings: CompileDiagnostic[] }>;
// throws CliError(E_COMPILE_FAILED) on any severity:"error" diagnostic
// throws CliError(E_NOT_IMPLEMENTED) for chain === "solana" until Phase 7
```

## Why solc-js + Standard JSON

solc-js is the official Ethereum Foundation distribution: pure-JS (emscripten-compiled libsolc), MIT-licensed, no native binary, no system-`solc` requirement. Pinning `solc@0.8.35` lets us guarantee reproducible compiles across operating systems without asking the user to install anything (COMP-05).

Standard JSON input (vs. CLI flags or older `compile()` shapes) is the documented programmatic interface and the one solc-js promises to keep stable across patch versions. See RESEARCH §Standard Stack lines 99-128 for the verified provenance audit.

## Why we pin evmVersion: "cancun"

`solc 0.8.30+` shifted its default `evmVersion` across minor releases (prague → osaka). Without an explicit pin, bytecode targets drift silently with every solc bump. Hardhat and Foundry both pin too — same idea.

**Wave 0 discovered** that `@openzeppelin/contracts@5.6.1` uses the `mcopy` opcode in `utils/Bytes.sol`, which is **Cancun-only**. RESEARCH §Pitfall 2 originally suggested `"paris"`, but the probe (`scripts/probe-compile.mjs`) produced 4 mcopy-not-available errors with `"paris"`. Bumped to `"cancun"`, probe passed immediately. Cancun shipped on Ethereum mainnet 2024-03-13 and is broadly deployed across L1+L2 — safe floor.

The constant lives in [`./index.ts`](./index.ts) as `EVM_VERSION = "cancun" as const`. If OZ bumps to use newer opcodes (Prague's `EIP-7702`, etc.) we revisit this.

## Why the import callback is synchronous

solc-js's import-callback contract is **synchronous**. Return type: `{ contents: string } | { error: string }` — never a `Promise`. Returning a Promise breaks silently: solc-js gets `[object Promise]` back, can't parse it, reports `"File not found"` for every OZ import, and you get a wall of misleading errors. See RESEARCH §Pitfall 1 lines 428-436.

`makeImportCallback()` enforces this via the type signature: there's no `async` keyword in the source, no `await` calls, every branch returns a plain object literal.

## Why cwd-independence matters

A user running `smartc create` from any directory (their home, a temp dir, a deep project subtree) must hit smartc's bundled `@openzeppelin/contracts`, not the user's local copy (which may not exist) or — worse — random `@openzeppelin/contracts` in some sibling directory.

The resolver uses Node's [`require.resolve("@openzeppelin/contracts/package.json")`](./imports.ts) (the same dual-strategy proved in `src/lib/version.ts:1-50`) which walks smartc's install root, not `process.cwd()`. The Wave 0 canary [`scripts/probe-compile.mjs`](../../scripts/probe-compile.mjs) explicitly `chdir`'s to a temp dir before resolving — that's the cwd-independence regression check.

The path-traversal guard at [`./imports.ts`](./imports.ts) line 71-74 — `normalize(join(ozRoot, sub)).startsWith(normalize(ozRoot) + path.sep)` — refuses `@openzeppelin/contracts/../../etc/passwd`-style payloads with a clear `"Path traversal blocked: <path>"` error. Threat T-03-03 mitigation.

## Test fixtures

- `tests/fixtures/erc20/bare-default.sol` + `all-flags-on.sol` — Phase 2 goldens. Real OZ + real solc must compile these clean across every solc/OZ bump. The OZ-version drift canary lives in [`tests/compiler/compile.integration.spec.ts`](../../tests/compiler/compile.integration.spec.ts).
- `tests/fixtures/broken.sol` (D-14 deliberate-fail) — `uint256 x = ;` triggers ParserError. Used by `compile.integration.spec.ts` and the E2E D-15 test in `tests/commands/create.compile-fail.spec.ts` to prove the error path is wired end-to-end.
- `tests/fixtures/warns-no-error.sol` (Pitfall 6) — unused-local trigger. Verifies warnings flow through `output.warn` without throwing. If a future solc release stops emitting unused-local warnings, swap the body to a deprecated-feature trigger (e.g., `assert(false)` in a pure function) per RESEARCH §Pitfall 6.

## Bumping pinned versions

When solc or @openzeppelin/contracts ships a new version worth picking up:

1. **Update `package.json`** — exact pins (no `^`). Example: `"solc": "0.8.36"` or `"@openzeppelin/contracts": "5.7.0"`.
2. **Re-run the probe**: `node scripts/probe-compile.mjs`. Confirm `PROBE PASSED` and `errors=0`. If the new OZ release uses an opcode beyond the current `EVM_VERSION` floor (currently `"cancun"`), the probe will fail — bump `EVM_VERSION` in [`./index.ts`](./index.ts) accordingly.
3. **Run the integration tests**: `npx vitest run tests/compiler/compile.integration.spec.ts`. The Phase 2 goldens (`bare-default.sol` + `all-flags-on.sol`) must still compile clean — they ARE the OZ-drift canary.
4. **Update `tests/version.spec.ts`** — the exact-pin assertions (`expect(line).toContain("solc 0.8.36")` etc.) must mirror `package.json`.
5. **Update `tests/cli.spec.ts`** — the `--version` e2e mirrors the same pin strings.
6. **Commit**: `chore(03): bump solc to 0.8.36 + refresh version assertions` (or similar). Drift = deliberate, never accidental.

## Phase forward-looking notes

- **Phase 4** (ERC-721/1155) reuses this gate without modification — the resolver's `@openzeppelin/contracts/` prefix covers all OZ namespaces (token/ERC721/, token/ERC1155/, access/, security/, etc.). The new templates' `chain: "evm"` dispatches into the same `compileVerify` branch.
- **Phase 7** (SPL/Solana) plugs into the `chain === "solana"` branch in `./index.ts`. The Plan 01 skeleton's locked throw — `CliError(E_NOT_IMPLEMENTED)` with a Phase 7 pointer — is the load-bearing seam: Phase 7 replaces the body with an `anchor build` adapter that returns `CompileDiagnostic[]` shaped identically to the EVM branch.
- **Phase 8** (AI add-feature / patch sandbox) reuses the same gate for sandbox-verifying AI-patched source. Same error code (`E_COMPILE_FAILED`), same render shape — the AI flow's rollback-on-fail uses this exception to decide whether to write the patched file.
