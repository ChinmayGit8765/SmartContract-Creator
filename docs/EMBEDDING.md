# Embedding smartc (scripts, LLMs, and MCP agents)

`smartc` is a CLI with **stable, documented machine contracts** so it can be
driven by shell scripts, other tools, LLM tool-callers, and MCP agents. This page
is the integration reference. A condensed machine-readable version lives in
[../AGENTS.md](../AGENTS.md) and [../llms.txt](../llms.txt).

## What's automation-friendly today

| Capability | Non-interactive? | How |
|------------|------------------|-----|
| List templates | ✅ | `smartc list-templates --json` |
| Probe toolchain | ✅ | `smartc doctor --json` (exit 0/1) |
| AI patch an existing file | ✅ | `smartc add-feature --ai --file F "desc" --force` (needs Ollama) |
| Generate a new contract | ⚠️ interactive | `smartc create` runs a TTY wizard; see [Driving `create`](#driving-create) |

> **Honest limitation:** `create` runs an interactive wizard and **refuses
> `--json`**. A flag-driven non-interactive `create` is planned but not shipped.
> Until then, agents either drive the wizard through a pseudo-terminal or use the
> scriptable commands above. Everything else is fully automatable.

## Stable contracts

### Exit codes
| Code | Meaning |
|------|---------|
| `0` | Success (or `doctor` with required tools present) |
| `1` | Runtime error (compile failure, AI unreachable, `doctor` missing a required tool) |
| `2` | Usage error (bad/missing flag, unknown template, file not found) |
| `130` | Cancelled (Ctrl+C / dismissed prompt) |

### Error format (human mode, on stderr)
```
Error: <what>   (code: <STABLE_CODE>)
Why:   <why>
Fix:   <fix>
```
Stable `code` values include `E_USAGE`, `E_FILE_EXISTS`, `E_COMPILE_FAILED`,
`E_WIZARD_CANCEL`, `E_AI_UNREACHABLE`, `E_AI_EMPTY`. Parse the `code:` token, not
the prose.

### `list-templates --json`
```json
{
  "templates": [
    { "id": "erc20",   "name": "ERC-20 Token",       "chain": "evm",    "status": "alpha", "description": "..." },
    { "id": "erc721",  "name": "ERC-721 NFT",        "chain": "evm",    "status": "alpha", "description": "..." },
    { "id": "erc1155", "name": "ERC-1155 Multi-Token","chain": "evm",   "status": "alpha", "description": "..." },
    { "id": "spl",     "name": "SPL Token",          "chain": "solana", "status": "alpha", "description": "..." }
  ]
}
```
Each template object always has exactly these five fields.

### `doctor --json`
```json
{
  "ok": true,
  "tools": [
    { "key": "node",            "name": "Node.js",        "found": true,  "version": "20.x", "status": "ok",      "required": true },
    { "key": "solc",            "name": "solc (bundled)", "found": true,  "version": "0.8.35","status": "ok",      "required": true },
    { "key": "anchor",          "name": "anchor",         "found": false, "version": null,    "status": "missing", "required": false, "note": "..." },
    { "key": "cargo-build-sbf", "name": "cargo-build-sbf","found": false, "version": null,    "status": "missing", "required": false, "note": "..." },
    { "key": "ollama",          "name": "ollama",         "found": false, "version": null,    "status": "missing", "required": false, "note": "..." }
  ]
}
```
`ok` mirrors the exit code (`true` ⇔ exit 0). `status` ∈ `ok | missing | outdated`.
Optional tools never flip `ok` to false. Keys are stable.

## Environment variables

| Var | Effect |
|-----|--------|
| `SMARTC_NEWBIE=1` | Verbose/explanatory output (same as `--newbie`). |
| `SMARTC_OLLAMA_MODEL` | Default model for `add-feature` (default `qwen2.5-coder`). |
| `SMARTC_OLLAMA_HOST` / `OLLAMA_HOST` | Ollama daemon URL (default `http://127.0.0.1:11434`). |
| `NO_COLOR` | Disable ANSI color (also `--no-color`). |

## Shell / script examples

```sh
# Gate a CI job on the toolchain:
smartc doctor || { echo "toolchain not ready"; exit 1; }

# Enumerate templates programmatically:
smartc list-templates --json | jq -r '.templates[].id'

# AI-patch a file unattended (requires a running Ollama):
SMARTC_OLLAMA_MODEL=qwen2.5-coder \
  smartc add-feature --ai --file MyToken.sol "add ERC20Votes" --force
```

## Driving `create`

`create` needs a TTY. To automate it today, feed answers through a pseudo-terminal
(e.g. `node-pty`, Python `pexpect`, or `expect`). The prompt order per template is
documented in [HOWTO.md](HOWTO.md#each-template-end-to-end) and each template's
`src/templates/<id>/README.md`. Defaults are sensible, so an agent can often
accept defaults and only override what it needs.

If you control a fork, the cleanest path is to add a flag-driven mode to
`src/commands/create.ts` (the wizard returns a plain `opts` object; bypass it with
flags and call `generate()` + `compileVerify()` directly). See [FORKING.md](FORKING.md).

## Using smartc from an LLM tool-caller

Expose these as tools, parsing JSON where available:
- `smartc_list_templates()` → run `smartc list-templates --json`, return `.templates`.
- `smartc_doctor()` → run `smartc doctor --json`, return the object; surface `ok`.
- `smartc_add_feature(file, description, model?)` → run
  `smartc add-feature --ai --file <file> "<description>" --force` (verify Ollama
  via `doctor` first; handle `E_AI_UNREACHABLE`).

Always read the exit code and, on non-zero, the `code:` token from stderr. Treat
`add-feature` output as a suggestion to be reviewed, never auto-deployed.

## Wrapping smartc as an MCP server

A minimal Model Context Protocol server can expose smartc's scriptable surface.
Sketch (Node, `@modelcontextprotocol/sdk`):

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const server = new Server({ name: "smartc", version: "0.1.0" }, { capabilities: { tools: {} } });

// list-templates -> structured tool result
async function listTemplates() {
  const { stdout } = await run("smartc", ["list-templates", "--json"]);
  return JSON.parse(stdout).templates;          // [{id,name,chain,status,description}]
}

// doctor -> structured tool result (never throws on exit 1; inspect .ok)
async function doctor() {
  try {
    const { stdout } = await run("smartc", ["doctor", "--json"]);
    return JSON.parse(stdout);
  } catch (e) {                                  // exit 1 still prints JSON to stdout
    return JSON.parse((e as { stdout: string }).stdout);
  }
}

// Register these as MCP tools (input schemas omitted for brevity), plus an
// add_feature tool that shells out with --force and reports the exit code.
```

Register `list_templates`, `doctor`, and `add_feature` as tools. Skip `create`
until a non-interactive mode exists (or implement the pty drive described above).
Point the agent at [AGENTS.md](../AGENTS.md) for a compact capability description.

## No stable JS/library API (yet)

The published npm package ships only the `smartc` binary; there is no exported
programmatic API. Integrations should shell out to the CLI (the contracts above
are the API). Forks can `import` directly from `src/` (e.g. `generate`,
`compileVerify`, `generateDeployDoc`) — those signatures are documented in the
per-module READMEs but are not a semver-stable public surface.
