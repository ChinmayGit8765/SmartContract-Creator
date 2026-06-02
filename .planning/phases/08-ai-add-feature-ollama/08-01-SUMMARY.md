---
phase: 08-ai-add-feature-ollama
plan: 01
subsystem: ai + commands/add-feature
tags: [ai, ollama, add-feature, sandbox-compile, diff, graceful-degradation]

requires:
  - phase: 03-compile-verify-safety-net
    provides: compileVerify (the sandbox-compile gate for AI output)
  - phase: 06-doctor-and-environment-probe
    provides: doctor reports ollama; add-feature points users there on failure
  - phase: 07-spl-token-solana-anchor
    provides: CompileResult.skipped pattern (solana AI output applied-with-warning)
provides:
  - src/ai/ (ollama client, prompt builder, line diff)
  - `smartc add-feature --ai --file X "<desc>"` command
affects: [09]

tech-stack:
  added: []
  patterns:
    - "Local Ollama over HTTP via global fetch; fetchImpl injectable for tests"
    - "Sandbox-compile-before-write = rollback: the file is only overwritten after compileVerify succeeds"
    - "LCS line diff + collapsed-context preview, no external dependency"

key-files:
  created:
    - src/ai/ollama.ts
    - src/ai/prompt.ts
    - src/ai/diff.ts
    - src/ai/README.md
    - src/commands/add-feature.ts
    - tests/ai/ollama.spec.ts
    - tests/ai/prompt-diff.spec.ts
    - tests/commands/add-feature.spec.ts
  modified:
    - src/program.ts (addCommand)
    - src/lib/errors.ts (E_AI_UNREACHABLE, E_AI_EMPTY)
    - tests/cli.spec.ts (help lists add-feature)

key-decisions:
  - "No cloud: local Ollama only (PROJECT constraint). Default model qwen2.5-coder, overridable via --model / SMARTC_OLLAMA_MODEL; host via SMARTC_OLLAMA_HOST / OLLAMA_HOST"
  - "Rollback = never-write-on-failure: sandbox compileVerify runs after confirm, before writeFile; a compile error rethrows (diagnostics surface) and the file is untouched (AI-03)"
  - "Confirm is the apply gate (AI-04); --force skips it. --json is refused (interactive + diff are human-facing)"
  - "Solana AI output without anchor: compile-verify skipped -> applied with a warning (consistent with SPL-05) rather than blocked"
  - "Default model is a documented constant, not benchmarked — the Phase 8 research flag (benchmark a default) is deferred; any code-tuned Ollama model works and it's overridable"

patterns-established:
  - "AI flow = read -> reachability(AI-05) -> generate(AI-02/06) -> diff+confirm(AI-04) -> sandbox-compile(AI-03) -> write"

requirements-completed: [AI-01, AI-02, AI-03, AI-04, AI-05, AI-06]

duration: 70min
completed: 2026-06-01
---

# Phase 8 Plan 01: AI add-feature (Ollama) Summary

**`smartc add-feature --ai --file X.sol "<desc>"` asks a local Ollama model for the full updated file, shows a colored diff, confirms, then sandbox-compiles the result and writes only on a clean compile — a non-compiling suggestion leaves the file untouched. Unreachable daemon fails gracefully toward `smartc doctor` + ollama.com.**

## Performance
- **Duration:** ~70 min
- **Files:** 8 created, 3 modified
- **Tests:** 23 new (ollama client, prompt/diff, command E2E); full suite 374 passed, 1 skipped.

## Accomplishments
- Local Ollama HTTP client (AI-02) with injectable fetch; resolves host + model from flags/env with a documented default (AI-06).
- add-feature command: diff preview + confirm (AI-04), sandbox-compile-before-write with rollback on failure (AI-03), graceful unreachable handling (AI-05). Verified live that an unreachable host returns E_AI_UNREACHABLE exit 1.
- LCS line-diff preview with collapsed context, no external dependency.
- `smartc --help` now lists `add-feature`.

## Deviations from Plan
- Default-model benchmarking (the Phase 8 research flag) deferred: no Ollama daemon in this environment to benchmark against. Chose `qwen2.5-coder` as a documented, overridable default.

## Issues Encountered
None. The live generate path is exercised in tests via a mocked ollama module (real solc still verifies the AI output); a real daemon is needed to run it end-to-end.

## User Setup Required
Install Ollama (https://ollama.com) and `ollama pull qwen2.5-coder` (or pass `--model`). `smartc doctor` reports whether Ollama is present.

## Next Phase Readiness
- Phase 9 (Distribution): the README/quickstart should document add-feature + the Ollama prerequisite; CI runs without a daemon (the flow is mock-tested).

---
*Phase: 08-ai-add-feature-ollama*
*Completed: 2026-06-01*
