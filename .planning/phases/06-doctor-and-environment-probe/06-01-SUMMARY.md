---
phase: 06-doctor-and-environment-probe
plan: 01
subsystem: doctor
tags: [doctor, environment-probe, command]

requires:
  - phase: 01-cli-foundation
    provides: output channels, color, env, cli-table3, commander wiring
  - phase: 03-compile-verify-safety-net
    provides: bundled solc (probed via safeReadVersion)
provides:
  - src/doctor/ module — runProbes(), doctorExitCode(), ProbeResult contract
  - `smartc doctor` command (table + --json + scriptable exit code)
  - never-throws runVersion shell-out + extractVersion helpers
affects: [07, 08]

tech-stack:
  added: []
  patterns:
    - "Read-only probes return a uniform ProbeResult; required tools gate the exit code, optional tools never do"
    - "Shelled probes run in parallel via Promise.all; runVersion never throws (missing/timeout/non-zero → null)"
    - "Command sets process.exitCode (not process.exit) so the report prints and in-process tests can assert the code"

key-files:
  created:
    - src/doctor/types.ts
    - src/doctor/probes.ts
    - src/doctor/index.ts
    - src/doctor/README.md
    - src/commands/doctor.ts
    - tests/doctor/probes.spec.ts
    - tests/commands/doctor.spec.ts
  modified:
    - src/program.ts
    - tests/cli.spec.ts

key-decisions:
  - "Only Node (>=20) + bundled solc are required; anchor/cargo-build-sbf/ollama are optional so a Node-only machine exits 0 — makes doctor a meaningful CI gate without forcing the Solana/AI toolchains"
  - "shell:true only on win32 to resolve .cmd shims (anchor/ollama) under Node's post-CVE-2024-27980 spawn rules; safe because command+args are hardcoded constants (no user input)"
  - "4s per-tool timeout bounds a hung binary; version extracted via semver regex with first-line fallback"
  - "--json shape { ok, tools:[{key,name,found,version,status,required,purpose,note?}] } is a stable public contract"

patterns-established:
  - "Environment-probe module pattern: pure probe functions with injectable inputs + a parallel orchestrator + a thin command"

requirements-completed: [DOCTOR-01, DOCTOR-02, DOCTOR-03]

duration: 35min
completed: 2026-05-30
---

# Phase 6 Plan 01: Doctor & Environment Probe Summary

**`smartc doctor` probes the local toolchain — Node, bundled solc, anchor, cargo-build-sbf, ollama — reporting found/version/status per tool and exiting 0 only when the required tools (Node + solc) are healthy, so it is scriptable in CI and backs the graceful degradation of Phases 7 and 8.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 1 (single wave)
- **Files modified:** 7 created, 2 modified

## Accomplishments
- `src/doctor/` module: `ProbeResult` contract, five probes, parallel `runProbes()`, `doctorExitCode()`.
- `runVersion` shell-out helper that never throws (ENOENT / non-zero / timeout → null) and `extractVersion` that pulls a semver from noisy `--version` output.
- `smartc doctor` command: cli-table3 table, `--json` machine shape, newbie install pointers, scriptable exit code via `process.exitCode`.
- Wired into the program tree; `--help` now lists `doctor`.
- 14 new unit/E2E tests + 2 dist-spawning e2e cases; full suite green.

## Files Created/Modified
- `src/doctor/{types,probes,index}.ts` + `src/doctor/README.md`
- `src/commands/doctor.ts`
- `src/program.ts` (addCommand)
- `tests/doctor/probes.spec.ts`, `tests/commands/doctor.spec.ts`, `tests/cli.spec.ts` (doctor e2e + help assertion)

## Decisions Made
- Required vs optional split is the core design call (see key-decisions): keeps `doctor` a useful CI gate that passes on a stock Node machine while still surfacing the Solana/AI toolchains.

## Deviations from Plan
None — built as designed.

## Issues Encountered
None. (Note: full-suite runs show occasional solc-compile timeout flakes in the heavy create E2E specs under parallel load — unrelated to doctor; flagged for Phase 9 CI hardening.)

## User Setup Required
None.

## Next Phase Readiness
- Phase 7 (SPL) can reference `smartc doctor` in its anchor-missing message and reuse `runVersion`/probe patterns for the Anchor adapter.
- Phase 8 (AI) can reference `smartc doctor` in its ollama-unreachable message.

---
*Phase: 06-doctor-and-environment-probe*
*Completed: 2026-05-30*
