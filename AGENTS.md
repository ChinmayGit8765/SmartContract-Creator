# AGENTS.md — smartc

Machine-readable capability + invocation contract for AI coding agents and MCP
servers. Humans: see [README.md](README.md). Full integration guide:
[docs/EMBEDDING.md](docs/EMBEDDING.md).

## What this tool is
`smartc` — a CLI that generates compile-verified smart contracts (ERC-20, ERC-721,
ERC-1155 on EVM; SPL on Solana/Anchor) from a wizard, each with a `DEPLOY.md`.
Generate-and-compile only; it never broadcasts transactions. No cloud services.

## Invocation
Binary: `smartc` (Node 20+). Run via `npx smartc <cmd>` or after `npm i -g smartc`.

| Command | Automatable | Notes |
|---------|-------------|-------|
| `smartc list-templates --json` | yes | → `{ templates: [{id,name,chain,status,description}] }` |
| `smartc doctor --json` | yes | → `{ ok, tools: [{key,name,found,version,status,required,note?}] }`; exit 0/1 |
| `smartc add-feature --ai --file <path> "<desc>" --force` | yes | local Ollama; sandbox-compiles before write; needs daemon |
| `smartc create --template <id> [--out p]` | no (interactive) | TTY wizard; refuses `--json`; drive via pty or accept defaults |

Template ids: `erc20`, `erc721`, `erc1155`, `spl`.

## Contracts (stable)
- Exit codes: `0` ok · `1` runtime error · `2` usage error · `130` cancelled.
- Errors print `Error/Why/Fix` on stderr with a stable `code:` token — parse the
  code, not the prose. Codes: `E_USAGE`, `E_FILE_EXISTS`, `E_COMPILE_FAILED`,
  `E_WIZARD_CANCEL`, `E_AI_UNREACHABLE`, `E_AI_EMPTY`.
- `--json` is supported on `list-templates` and `doctor` only.
- Env: `SMARTC_NEWBIE`, `SMARTC_OLLAMA_MODEL`, `SMARTC_OLLAMA_HOST`/`OLLAMA_HOST`, `NO_COLOR`.

## Agent guidance
- Before `add-feature`, check `doctor --json` for `ollama` and handle
  `E_AI_UNREACHABLE` gracefully.
- `add-feature` output is a **suggestion** — present the diff, never auto-deploy.
- `create` is interactive today; prefer pty-driven prompts or wait for the planned
  flag-driven mode (see [docs/EMBEDDING.md](docs/EMBEDDING.md#driving-create)).
- The published package exposes only the CLI; shell out (the CLI contracts above
  are the API). Forks may import `generate` / `compileVerify` / `generateDeployDoc`
  from `src/` (not semver-stable).

## Repo for code-editing agents
- TypeScript ESM (NodeNext; relative imports use `.js`). Strict TS.
- Build: `npm run build` (tsup → `dist/cli.js`). Test: `npm test` (vitest).
  Typecheck: `npm run typecheck`. Run all three before proposing changes.
- Templates are additive plugins under `src/templates/<id>/`; each subsystem has a
  `README.md` describing its contract. Adding a template touches no existing one.
  See [docs/FORKING.md](docs/FORKING.md).
- Invariants: compile-before-write; errors are `CliError` (three-part block);
  output goes through `src/lib/output.ts` channels; `--json` shapes are public.
