# Stack Research

**Domain:** TypeScript/Node CLI tool that scaffolds & compile-verifies single-file smart contracts (Solidity + Solana Anchor), with optional local Ollama LLM augmentation
**Researched:** 2026-05-14
**Confidence:** HIGH (versions verified live against npm registry on research date; toolchain claims verified against official docs / repos)

---

## TL;DR Stack

| Layer | Pick | Version | Confidence |
|---|---|---|---|
| Runtime | Node.js LTS | >= 20.12 | HIGH |
| Language | TypeScript | 6.0.3 | HIGH |
| CLI parsing | `commander` | 14.0.3 | HIGH |
| Interactive wizard | `@clack/prompts` | 1.4.0 | HIGH |
| Solidity compiler (in-process) | `solc` (npm, aka solc-js) | 0.8.35 | HIGH |
| Solidity templates | `@openzeppelin/contracts` | 5.6.1 | HIGH |
| Solana/Anchor compile | shell out to `anchor build` (detect via `which`) | Anchor CLI 1.0.2 | HIGH |
| Local LLM | `ollama` (official JS client) | 0.6.3 | HIGH |
| Subprocess | `execa` | 9.6.1 | HIGH |
| Binary detection | `which` | 7.0.0 | HIGH |
| Schema/validation | `zod` | 4.4.3 | HIGH |
| Terminal colors | `picocolors` | 1.1.1 | HIGH |
| Bundler | `tsup` | 8.5.1 | HIGH |
| Dev runner | `tsx` | 4.21.0 | HIGH |
| Test runner | `vitest` | 4.1.6 | HIGH |

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| **Node.js** | >= 20.12 LTS | Runtime | Node 20 is the active LTS through April 2026; Node 22 LTS started Oct 2025. `@clack/prompts` requires `>=20.12`, `execa` requires `>=20.5`, `ollama` works on 18+. Pin Node 20 as the floor to keep the install base wide without sacrificing modern API surface (built-in `fetch`, `node:test`, stable ESM). |
| **TypeScript** | 6.0.3 | Language | TS 6 is the current major (released April 2026). Use `"module": "NodeNext"`, `"target": "ES2022"`, `"strict": true`. TS 6 keeps `tsc --noEmit` for typecheck while bundling is done by tsup. |
| **commander** | 14.0.3 | CLI argument/subcommand parser | The de-facto standard for Node CLIs — 35M+ weekly downloads, zero dependencies, generics-based typed options/args since v13. We only need ~3 commands (`new`, `add-feature`, maybe `doctor`) — `commander` keeps startup overhead ~18ms vs oclif's 70-100ms. Boring, stable, well-typed. |
| **@clack/prompts** | 1.4.0 | Interactive wizard prompts | Modern (May 2026 release), TS-native, beautifully styled out of the box, ESM, ~4 KB gzip. It's what `create-svelte`, `create-astro`, `create-t3-app`, and `create-vue` all use in 2026. Critical features for our wizard: `intro`/`outro`/`note`/`group()` for stepwise flows, automatic cancel handling, multi-select. Built for exactly this scaffolding wizard use-case. |
| **solc** (npm, aka solc-js) | 0.8.35 | Solidity compiler invoked from Node | The official JS binding for `solc`. Bundled Emscripten WASM build — no native binary, no Docker, works on Win/macOS/Linux. Exposes the Standard JSON I/O interface as `solc.compile(JSON.stringify(input))`. Also supports `solc.loadRemoteVersion(version, cb)` to fetch a specific Solidity version on demand. ~9 MB unpacked, which is the right tradeoff: a bundled compiler means "user types `scc new erc20` and it just works" with no toolchain prerequisites. |
| **@openzeppelin/contracts** | 5.6.1 | Canonical ERC-20 / ERC-721 / ERC-1155 base | OpenZeppelin is THE standard — every reputable EVM project uses it. v5.6.x requires `pragma solidity ^0.8.24`. We don't copy-paste their source; we `import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";` in our generated contract and let `solc` resolve via the npm node_modules. This is also exactly what their own [Wizard](https://wizard.openzeppelin.com) outputs, so users will recognize the pattern. Pin to `^5.6.0` — v6 has NOT been released as of research date. |
| **ollama** (npm) | 0.6.3 | Official Ollama JS client (HTTP) | Official package from the Ollama team at `github.com/ollama/ollama-js`. Wraps the local Ollama daemon's REST API at `http://127.0.0.1:11434`. Supports `generate`, `chat`, `embed`, `list`, `pull`, streaming via `AsyncGenerator`, and `abort`. Avoids hand-rolling HTTP/SSE. Only meaningful dep is `whatwg-fetch` polyfill. Smaller and better-typed than the AI SDK route. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| **execa** | 9.6.1 | Child process wrapper for `anchor build`, `cargo`, etc. | Anywhere we shell out. Cleaner promise API than `node:child_process`, proper stderr handling, cross-platform PATH resolution, supports streaming. Critical for our Anchor compile-verify path. |
| **which** | 7.0.0 | Detect if `anchor`/`cargo`/`rustc`/`ollama` binaries are in PATH | Doctor command + preflight before any `add-feature` (Ollama) or Solana scaffold (Anchor). Last updated May 2026, ESM-native. Prefer over `command-exists` (last updated 2022, abandoned). |
| **zod** | 4.4.3 | Validate wizard answers, Ollama responses, config files | Parse `--from-config <file.json>` non-interactive mode inputs and the wizard's collected answers before template rendering. Also useful for validating shapes returned from Ollama if we ever ask the model for structured patches. |
| **picocolors** | 1.1.1 | Terminal colors (cyan headers, red errors, dim hints) | Always. ~50× smaller than chalk, zero deps, identical API for common cases (`pc.cyan`, `pc.dim`, `pc.bold`). The "newbie vs experienced" verbosity modes both need color discipline; `picocolors` is overhead-free. |
| **ora** | 9.4.0 | Spinner for "Compiling..." / "Querying Ollama..." | When something takes >500ms. `@clack/prompts` has `spinner()` built in — prefer that within wizard flows; use standalone `ora` only outside the wizard (e.g., in a non-interactive `--from-config` run). |
| **fs-extra** | 11.3.5 | File ops (ensureDir, copy, outputFile) | When you write the contract file + DEPLOY.md. Saves boilerplate over `node:fs/promises` for recursive ops. Optional — `node:fs/promises` is fine if we want zero extra deps. |
| **conf** | 15.1.0 | Persistent user config (default Ollama model, verbosity, OZ pin) | For the `scc config` command — stores `~/.config/smartcontract-creator/config.json` cross-platform. Use only if we ship config. |
| **semver** | (bundled via solc) | Compare solc/anchor version strings | Already a transitive of `solc`; use it to enforce minimum Anchor version in the doctor check. |

### Solidity Template Libraries (pinned imports, NOT runtime deps)

| Library | Version | Purpose | Notes |
|---|---|---|---|
| **@openzeppelin/contracts** | ^5.6.1 | ERC-20, ERC-721, ERC-1155, AccessControl, Ownable | Default. Battle-tested, audited, requires Solidity >= 0.8.24. Pin in generated contract via `^5.6.0`. |
| **solady** (npm) OR `forge install vectorized/solady` | npm 0.1.26 | Gas-optimized alternative (ERC20 + EIP-2612, ERC721, ERC1155) | Optional "advanced/gas-optimized" template variant. The npm package mirrors the github contracts. Mark as experimental in our generator — Solady's own README warns of cutting-edge behavior. Pin a specific commit/version in generated output. |

### Solana / Anchor (external toolchain — NOT bundled)

| Tool | Min Version | Purpose | Detection Strategy |
|---|---|---|---|
| **Rust (rustc + cargo)** | 1.75+ | Required by Anchor 1.0 | `which cargo` and `cargo --version` parse |
| **Solana CLI** | optional with Anchor 1.0 | Pre-1.0 dependency; Anchor 1.0 no longer requires it | Skip detection unless user is on Anchor < 1.0 |
| **Anchor CLI** | 1.0.2 (current) | `anchor build` to compile-verify SPL token program | `which anchor`, then `anchor --version` — parse via `execa` |
| **AVM (Anchor Version Manager)** | — | Recommended install path for Anchor | Don't hard-require AVM; just detect anchor binary. If missing, print install instructions pointing at `https://www.anchor-lang.com/docs/installation` |

**Compile-verify strategy for Solana:** We never ship a Rust toolchain. We *generate* a single `lib.rs` from a template + the user's wizard answers, then `execa('anchor', ['build', ...], { cwd: tempDir })` after writing a minimal wrapping `Anchor.toml` + `Cargo.toml` to a temp dir. On `ENOENT` for `anchor`, fall back to "skipped compile-verify, here's how to install Anchor" rather than failing hard.

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| **tsx** 4.21.0 | Dev runner — `tsx src/cli.ts` for local testing | Fastest TS execution today (esbuild-powered); zero config |
| **tsup** 8.5.1 | Bundle to `dist/cli.js` for npm publish | One-file bundle keeps install fast; emits ESM + types. Config: `entry: ['src/cli.ts'], format: ['esm'], target: 'node20', shims: true, banner: { js: '#!/usr/bin/env node' }` |
| **vitest** 4.1.6 | Test runner | ESM-native, TS-aware, fast watch mode. Use for unit tests on the template engine + integration tests that actually invoke `solc.compile()` on golden-file expected output. |
| **eslint** 10.3.0 + **@typescript-eslint** | Lint | Optional but recommended; flat config (`eslint.config.js`) since v9 |
| **prettier** 3.8.3 | Format | Optional; enforce via lint-staged or just CI |
| **changesets** | Versioning / changelog | Optional for solo project, but trivial to add later for npm releases |

### `package.json` Skeleton

```json
{
  "name": "smartcontract-creator",
  "version": "0.1.0",
  "type": "module",
  "bin": { "scc": "./dist/cli.js" },
  "engines": { "node": ">=20.12" },
  "files": ["dist", "templates"],
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint ."
  }
}
```

---

## Installation

```bash
# Core (runtime deps)
npm install commander @clack/prompts solc @openzeppelin/contracts ollama execa which zod picocolors

# Optional (only if needed)
npm install fs-extra conf ora

# Dev dependencies
npm install -D typescript@^6 tsx tsup vitest @types/node eslint prettier
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| **commander** | `oclif` | If the CLI grows to 20+ commands with plugins (Heroku-style). Adds 70-100ms startup; overkill for our 3-command scope. |
| **commander** | `citty` (UnJS) | If we wanted a more modern declarative API and were already in the UnJS ecosystem (Nitro, Nuxt). Younger, smaller community, fine choice but commander is the safer default. |
| **commander** | `yargs` | If we needed advanced shell completion generation. Verbose, type-safety has caveats. |
| **@clack/prompts** | `@inquirer/prompts` v8 | If we need niche prompt types (autocomplete, search, scale picker). Inquirer's plugin ecosystem is deeper. For our 5-7 question wizard, Clack wins on UX and brevity. |
| **@clack/prompts** | `enquirer` | If we needed a battle-tested, mature library (used by ESLint, webpack, Hardhat, pnpm). Solid choice but visually behind Clack in 2026. |
| **@clack/prompts** | `ink` (React-for-CLI) | If we wanted a stateful, persistent TUI dashboard. Massive overkill for a one-shot wizard. |
| **solc (npm)** | Subprocess to native `solc` binary | If we wanted faster compile times for huge contracts. Single-file ERC contracts compile in <1s via solc-js — not worth the install-time pain of requiring a native binary. |
| **solc (npm)** | Spawn `hardhat compile` / `foundryup` + `forge build` | If we were scaffolding *projects* not *files*. Wrong shape for our single-file output. |
| **OpenZeppelin** | Solady | When the user wants gas-optimized variants and accepts the "experimental" warning. Expose as a flag (`--template oz` default, `--template solady`). |
| **OpenZeppelin** | Solmate (transmissions11) | Mostly superseded by Solady. Still cited in older codebases. Skip. |
| **ollama (npm)** | Vercel AI SDK + `ai-sdk-ollama` | If we wanted to easily swap providers (Anthropic, OpenAI, etc.). Our spec is local-only, so direct ollama client is leaner. |
| **ollama (npm)** | Raw `fetch` to `http://localhost:11434/api/generate` | If we wanted zero deps. Reasonable, but we lose typed responses and streaming helpers. Not worth ~100 KB savings. |
| **execa** | `node:child_process` | If we wanted zero deps. `execa` is worth the ~10KB for ergonomics and cross-platform Windows behavior. |
| **which** | `command-exists` | `command-exists` was last updated June 2022 and is effectively abandoned. `which` is the modern, maintained choice. |
| **picocolors** | `chalk` 5.x | If we needed chalk's chainable API (`chalk.bold.cyan.underline`). For our simple usage, picocolors is 50× smaller and identical in practice. |
| **zod** | `valibot` / `arktype` | If bundle size mattered (it doesn't — we're a CLI). Zod 4 fixed v3's bundle bloat anyway. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `solc-js` (npm package literally named `solc-js`) | The npm package is `solc`, not `solc-js`. "solc-js" refers to the *project* (the JS bindings repo, now at `argotorg/solc-js`). Installing `solc-js` from npm gets you a stale 2017-era unrelated package. | `npm install solc` |
| `truffle` | Officially sunset by ConsenSys in 2023. | OpenZeppelin imports + solc directly; or Hardhat/Foundry if you ever scaffold projects. |
| `@coral-xyz/anchor` | Anchor 1.0 (April 2026) renamed the TS package to `@anchor-lang/core`. The old package is frozen at pre-1.0. | `@anchor-lang/core` (only if/when you need to *interact* with deployed programs — not needed for compile-verify scaffolding, where we just shell out to `anchor build`). |
| `prompts` (terkelg/prompts) | Last published October 2023, no longer actively maintained, several open security advisories. Was great in 2020-2022. | `@clack/prompts` |
| `inquirer` v8 (monolithic) | Old monolithic CJS package. Inquirer is now `@inquirer/prompts` (v8.4+, modular ESM). | If you must use Inquirer at all, use `@inquirer/prompts`. Otherwise `@clack/prompts`. |
| `command-exists` | Unmaintained since 2022. | `which` (v7) |
| `chalk` (for our use case) | We don't need its rich chainable API and we'd 50× the dep size for "color one word red." | `picocolors` |
| `figlet` ASCII-art banners | Adds startup latency and screen noise. "Newbie mode" should explain things in words, not banners. | `@clack/prompts` `intro()` with a one-line title |
| Bundling Rust/Solana toolchain in npm package | Hundreds of MB; impossible to distribute via npm cleanly; users will rebel. | Detect `anchor`/`cargo` via `which`; print install instructions if missing. |
| Trying to compile Anchor (Rust) from Node directly | There is no in-process Rust compiler for Node. WASM cross-compile of `cargo` is not viable. | Always shell out to `anchor build` via `execa`. |
| Calling cloud LLM APIs (OpenAI/Anthropic) in v1 | Spec says local-only, no API keys. Adds key management, billing, rate limits, online dependency. | `ollama` against local daemon. |
| Hand-rolling SSE/streaming HTTP to Ollama | Ollama's API uses chunked NDJSON, not standard SSE. Easy to get wrong. | Official `ollama` npm client's `AsyncGenerator`. |

---

## Stack Patterns by Variant

**If contract type = EVM (ERC-20 / ERC-721 / ERC-1155):**
- Generate single `.sol` file importing `@openzeppelin/contracts` (or `solady` if flagged)
- Compile-verify in-process via `solc.compile()` with Standard JSON input
- Resolve imports through a callback that reads from `node_modules/@openzeppelin/contracts`
- No subprocess, no external toolchain required

**If contract type = Solana SPL token (Anchor):**
- Generate single `lib.rs` from template + a minimal `Cargo.toml` and `Anchor.toml` in a temp dir
- Detect `anchor` binary via `which('anchor')`
- If present: `execa('anchor', ['build'])` in temp dir; parse stderr for errors; surface IDL path on success
- If missing: skip compile-verify, print copy-pasteable install instructions, still emit the `lib.rs` + `DEPLOY.md`

**If `add-feature` (Ollama) is invoked:**
- Detect `ollama` daemon via `fetch('http://127.0.0.1:11434/api/version')` with short timeout
- If daemon down: print "Start Ollama with `ollama serve` and ensure model `<x>` is pulled"
- Pass the existing generated file + user's natural-language feature description as a system+user prompt
- Stream response back through `@clack/prompts` `note()` updates or a simple write-buffer
- After patch is applied, re-run compile-verify; if it fails, offer to revert

**If "newbie mode":**
- After every wizard step, render a `note()` with a 1-2 sentence explanation of what the choice means
- After file generation, append extra commentary to DEPLOY.md (gas estimates, common gotchas, mainnet vs testnet)

**If "experienced mode":**
- Skip explanatory notes
- Use single-line prompts (`text()` with no `placeholder`)
- DEPLOY.md emits terse "deploy: `forge create ...`" one-liners only

---

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `@openzeppelin/contracts@^5.6` | `solc@^0.8.24` | OZ 5.6.x bumped minimum pragma to 0.8.24. Don't generate `pragma solidity ^0.8.20` with OZ 5.6 imports — it will fail to compile. |
| `solc@0.8.35` | Solidity language `0.8.35` | The npm `solc` package's *version* IS the Solidity version it bundles. `solc.loadRemoteVersion('0.8.24', cb)` to switch on demand if user pins an older pragma. |
| `@clack/prompts@1.4.0` | Node `>=20.12` | Enforces via `engines`. If we want Node 18 support we'd need to downgrade Clack — not recommended; Node 18 reaches EOL April 2025 (already past). |
| `execa@9` | Node `^18.19 \|\| >=20.5`, **ESM only** | v9 dropped CJS. Our CLI is ESM (`"type": "module"`), so this is fine. |
| `ollama@0.6.3` | Ollama daemon `>=0.1.40` | Older daemons may not support `/api/web_search` etc., but `chat`/`generate` work back to early daemon versions. |
| `commander@14` | Node `>=20` | Major bump that dropped Node 18. |
| `Anchor CLI 1.0.x` | Solana CLI optional, Rust `>=1.75` | Anchor 1.0 removed the hard Solana CLI dependency for core commands. AVM (`avm install 1.0.2; avm use 1.0.2`) is the recommended install path. |
| `solady@0.1.26` (npm) | Solidity `^0.8.24` | Optional advanced template. Pin exact version in generated imports — Solady changes APIs between minor versions. |
| `typescript@6` | `@types/node@^22` | Use `"moduleResolution": "NodeNext"` for proper ESM resolution of dual-CJS/ESM packages. |

---

## Compile-Toolchain Detection Strategy

This is the load-bearing piece. The CLI must gracefully handle: solc bundled (always present), Anchor missing, Ollama daemon down.

### Solidity (always available)
- `solc` is a runtime npm dep — bundled with our CLI install.
- No detection needed. `import solc from 'solc'` and call `solc.compile(JSON.stringify(input))`.
- For pragmas that don't match the bundled compiler, fall through to `solc.loadRemoteVersion(targetVersion, cb)` — but warn the user this is slower (network fetch).

### Anchor (detect at runtime)
```ts
import which from 'which';
import { execa } from 'execa';

async function detectAnchor(): Promise<{ ok: true; version: string; path: string } | { ok: false; reason: string }> {
  try {
    const path = await which('anchor');
    const { stdout } = await execa('anchor', ['--version'], { timeout: 5000 });
    // "anchor-cli 1.0.2"
    const version = stdout.split(/\s+/)[1];
    return { ok: true, version, path };
  } catch (e: any) {
    if (e.code === 'ENOENT' || e?.message?.includes('not found')) {
      return { ok: false, reason: 'anchor not in PATH' };
    }
    return { ok: false, reason: e?.message ?? 'unknown' };
  }
}
```
Pattern is identical for `cargo`, `rustc`, `solana` (latter only needed if Anchor < 1.0).

### Ollama daemon (detect by health check, not binary)
```ts
async function detectOllama(host = 'http://127.0.0.1:11434'): Promise<{ ok: boolean; version?: string; models?: string[] }> {
  try {
    const v = await fetch(`${host}/api/version`, { signal: AbortSignal.timeout(2000) });
    if (!v.ok) return { ok: false };
    const { version } = await v.json();
    // Optionally list models so we can offer the user a picker
    const m = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(2000) }).then(r => r.json());
    return { ok: true, version, models: m.models?.map((x: any) => x.name) ?? [] };
  } catch {
    return { ok: false };
  }
}
```
Do this BEFORE invoking the `ollama` npm client, so we can show a friendly message instead of a stack trace if the daemon isn't running.

### `scc doctor` command
Run all three detectors and print a table. Pure UX — no side effects. This is the single most useful thing newbies will run when something breaks.

---

## Sources

### Verified live (HIGH confidence)
- `npm view solc version` → 0.8.35 (2026-04-29)
- `npm view @openzeppelin/contracts version` → 5.6.1 (2026-02-27)
- `npm view ollama version` → 0.6.3 (2026-02-20)
- `npm view @clack/prompts version` → 1.4.0 (2026-05-12), `engines.node >= 20.12`
- `npm view commander version` → 14.0.3 (2026-05-12)
- `npm view typescript version` → 6.0.3 (2026-04-16)
- `npm view tsx version` → 4.21.0 (2025-11-30)
- `npm view tsup version` → 8.5.1 (2025-11-12)
- `npm view execa version` → 9.6.1 (2025-11-29), `engines.node ^18.19 || >=20.5`
- `npm view which version` → 7.0.0 (2026-05-08)
- `npm view zod version` → 4.4.3 (2026-05-04)
- `npm view picocolors version` → 1.1.1 (2024-10-16)
- `npm view ora version` → 9.4.0 (2026-04-22)
- `npm view fs-extra version` → 11.3.5 (2026-05-06)
- `npm view conf version` → 15.1.0 (2026-02-04)
- `npm view vitest version` → 4.1.6 (2026-05-11)
- `npm view eslint version` → 10.3.0 (2026-05-01)
- `npm view prettier version` → 3.8.3 (2026-04-15)
- `npm view solady version` → 0.1.26 (2025-08-25)
- `npm view @anchor-lang/core version` → 1.0.2 (2026-05-02)
- `npm view @anchor-lang/cli version` → 1.0.2 (2026-05-02)
- `npm view inquirer version` → 13.4.3, `npm view @inquirer/prompts version` → 8.4.3 (2026-05-10)
- `npm view prompts version` → 2.4.2 (2023-10-21, **abandoned**)
- `npm view command-exists version` → 1.2.9 (2022-06-13, **abandoned**)

### Official documentation
- [solc (npm) — Solidity Compiler](https://www.npmjs.com/package/solc) — Standard JSON I/O, `loadRemoteVersion` API
- [Solidity — Using the Compiler (Standard JSON)](https://docs.soliditylang.org/en/latest/using-the-compiler.html)
- [OpenZeppelin Contracts 5.x Docs](https://docs.openzeppelin.com/contracts/5.x/) — import pattern, wizard reference
- [OpenZeppelin Contracts Releases](https://github.com/OpenZeppelin/openzeppelin-contracts/releases) — v5.6.1 latest, min pragma 0.8.24
- [Anchor releases](https://github.com/solana-foundation/anchor/releases) — v1.0.2 stable, v1.0.0 first stable major April 2026
- [Anchor 1.0 announcement (Solana Devs on X)](https://x.com/solana_devs/status/2039837963840803283) — `@anchor-lang/core` rename, no Solana CLI dependency, LiteSVM default
- [Anchor Installation Docs](https://www.anchor-lang.com/docs/installation)
- [ollama-js on GitHub](https://github.com/ollama/ollama-js) — chat/generate/embed/list, streaming via AsyncGenerator, default host 127.0.0.1:11434
- [Solady on GitHub](https://github.com/Vectorized/solady) — `forge install vectorized/solady` or `npm install solady`, ERC20/721/1155 implementations, "experimental" warning
- [Solana Program Library](https://github.com/solana-program) — SPL token Rust source

### WebSearch (MEDIUM confidence — verified against multiple sources)
- [PkgPulse: Ink vs @clack/prompts vs Enquirer 2026](https://www.pkgpulse.com/guides/ink-vs-clack-vs-enquirer-interactive-cli-nodejs-2026) — Clack as 2026 default
- [DEV: Complete Guide to Building Developer CLI Tools in 2026](https://dev.to/chengyixu/the-complete-guide-to-building-developer-cli-tools-in-2026-a96) — commander still recommended
- [hackers.pub: Building CLI apps with TypeScript in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) — commander v14 first-class TS
- [DEV: @clack/prompts: The Modern Alternative to Inquirer.js](https://dev.to/chengyixu/clackprompts-the-modern-alternative-to-inquirerjs-1ohb)

---

## Open Questions / Gaps

1. **solc-js maintainer transfer:** The repo moved from `ethereum/solc-js` to `argotorg/solc-js` at some point. Web sources don't explicitly explain the transfer. The npm package `solc` itself is still actively published (0.8.35, April 2026) — that's what matters. LOW concern, but worth a glance before pinning. → Flag for phase-specific research if it ever blocks anything.
2. **Bundled `solc` package size (~9 MB unpacked):** Inflates npm install. Acceptable tradeoff for "it just works," but if startup latency for the CLI process becomes an issue, consider lazy-loading `solc` only when an EVM template is selected.
3. **Anchor 1.0 churn:** Anchor 1.0 is only a month old (April 2026). Expect minor breaking changes in 1.0.x → 1.1.x. Don't pin too tight in any generated `Cargo.toml` — let the user's installed AVM dictate.
4. **Ollama model availability:** We can't predict what models the user has pulled. Default suggestion `qwen2.5-coder:7b` or `llama3.1:8b` — but only confirm via `/api/tags` at runtime; let the user pick from their actually-pulled list.
5. **Windows path handling for `anchor build`:** Anchor on Windows is historically rocky. Real test on Windows is non-negotiable before claiming Windows support. Right now claim "macOS/Linux first-class, Windows best-effort" until proven.

---

*Stack research for: SmartContract Creator — TypeScript CLI scaffolding ERC + SPL token contracts with optional local Ollama augmentation*
*Researched: 2026-05-14*
