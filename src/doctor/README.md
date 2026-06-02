# Environment probe (`smartc doctor`)

Detects the local toolchain so users know what works before they hit a phase
that needs it. Backs the `smartc doctor` command (Phase 6).

## Public surface

| Export | File | Purpose |
|--------|------|---------|
| `runProbes()` | `index.ts` | Runs every probe; returns `ProbeResult[]` in a stable order (required tools first). The three shelled tools probe in parallel. |
| `doctorExitCode(results)` | `index.ts` | DOCTOR-03: `0` iff every **required** tool is `ok`, else `1`. Optional tools never fail the exit code. |
| `ProbeResult` / `ProbeStatus` | `types.ts` | The per-tool record + status union. |
| `extractVersion` / `runVersion` | `probes.ts` | Version parsing + a never-throws shell-out helper. |
| `probeNode` / `probeSolc` / `probeAnchor` / `probeCargoBuildSbf` / `probeOllama` | `probes.ts` | Individual probes (injectable inputs for testing). |

## Probed tools

| Tool | Required | Detection | Needed for |
|------|----------|-----------|------------|
| Node.js | yes | `process.versions.node` vs `MIN_NODE_MAJOR` (20, mirrors `engines`) | running the CLI |
| solc (bundled) | yes | `safeReadVersion("solc")` | EVM compile-verify (bundled — no user install) |
| anchor | no | `anchor --version` | Solana SPL compile-verify (Phase 7) |
| cargo-build-sbf | no | `cargo-build-sbf --version` | Solana BPF build (Phase 7) |
| ollama | no | `ollama --version` | local-AI add-feature (Phase 8) |

## Locked design decisions

- **Only Node + bundled solc are required.** The Solana/Ollama tools are optional
  so the core EVM flow degrades gracefully — a fresh machine with just Node
  exits `0`. This is what makes `smartc doctor` a meaningful CI gate.
- **`runVersion` never throws.** Missing binary, non-zero exit, or timeout all
  collapse to `null`. A 4s timeout bounds a hung tool.
- **`shell:true` only on Windows.** Required to resolve `.cmd` shims (anchor,
  ollama) under Node's post-CVE-2024-27980 spawn rules. Safe here because the
  command and args are hardcoded constants — no user input reaches the shell.
- **The exit code is set via `process.exitCode`, not `process.exit()`** — a
  non-zero result is a normal outcome (not a thrown `CliError`), so the full
  report still prints and in-process tests can read the code.
- **The `--json` shape is a public contract** (`{ ok, tools: [{ key, name,
  found, version, status, required, purpose, note? }] }`). Keys are stable.

## Consumed by later phases

Phase 7 (SPL) points users at `smartc doctor` when `anchor` is missing, and
Phase 8 (AI) points at it when `ollama` is unreachable — the graceful-degradation
messages reference this command as the single place to check the toolchain.
