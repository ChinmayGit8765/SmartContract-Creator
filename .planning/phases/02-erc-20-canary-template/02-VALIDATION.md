---
phase: 2
slug: erc-20-canary-template
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.6 (installed in Phase 1) |
| **Config file** | none committed; vitest auto-detects (`passWithNoTests: true` set via CLI flag from Phase 1) |
| **Quick run command** | `npx vitest run tests/templates/erc20` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1s quick / ~5–10s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/templates/erc20`
- **After every plan wave:** Run `npx vitest run` (full suite incl. e2e + build)
- **Before `/gsd:verify-work`:** Full suite must be green; both committed `.sol` snapshots present and matching
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

Per-task IDs land once the planner produces PLAN.md(s). The skeleton below maps requirements to test types and Wave 0 dependencies derived from RESEARCH.md §Validation Architecture; the planner fills in concrete task IDs and may add finer-grained entries.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 02-?? | ? | ERC20-01 | — | name/symbol/supply pass through unchanged to wizard SDK | unit + snapshot | `npx vitest run tests/templates/erc20/generate.spec.ts -t "bare default"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | ERC20-02 | — | mintable=true adds `mint()` + access-control parent | unit (per-flag assertion) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "mintable"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | ERC20-03 | — | burnable=true adds `ERC20Burnable` parent | unit (per-flag assertion) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "burnable"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | ERC20-04 | — | pausable=true adds `ERC20Pausable` + `pause/unpause` | unit (per-flag assertion) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "pausable"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | ERC20-05 | — | mintable\|\|pausable → Ownable vs AccessControl prompt; selection routes correctly | unit (wizard.spec.ts w/ mocked `@clack/prompts`) + per-flag (generate.spec.ts) | `npx vitest run tests/templates/erc20/wizard.spec.ts -t "access"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | ROADMAP SC-4 | — | matches OpenZeppelin Wizard output byte-for-byte | snapshot (toMatchFileSnapshot) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "snapshot"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | CLI-07 (residual) | T-FS-01 (out-path traversal — accepted in §Security Domain) | overwrite prompt fires; `--force` skips | e2e (in-process dispatcher recommended) | `npx vitest run tests/cli.spec.ts -t "SC-4"` | ✅ skip→fill | ⬜ pending |
| TBD | 02-?? | ? | Wizard cancel | — | Ctrl+C mid-wizard → `CliError(E_WIZARD_CANCEL)` exit 130 | unit (wizard.spec.ts) | `npx vitest run tests/templates/erc20/wizard.spec.ts -t "cancel"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | Centralization warn | — | Mintable+Ownable triggers `output.warn` (always-on, even non-newbie) | unit (wizard.spec.ts) | `npx vitest run tests/templates/erc20/wizard.spec.ts -t "centralization"` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | Filename derivation | — | `"My Token"` → `MyToken.sol`; empty-sanitize falls back to `Token.sol`; `--out` overrides | unit | `npx vitest run tests/templates/erc20/filename.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | Validators | V5 Input Validation | name/symbol/supply regex rejects malformed input before reaching wizard SDK | unit | `npx vitest run tests/templates/erc20/validators.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | 02-?? | ? | Canary retirement | — | `registry.list()` returns exactly one entry (`erc20`); no `foundation-smoke` | unit (list-templates / registry spec) | `npx vitest run tests/cli.spec.ts -t "list-templates"` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/templates/erc20/wizard.spec.ts` — stubs for ERC20-05, wizard cancel, centralization warn
- [ ] `tests/templates/erc20/generate.spec.ts` — stubs for ERC20-01..04 + ROADMAP SC-4 snapshots
- [ ] `tests/templates/erc20/filename.spec.ts` — stubs for filename-derivation cases
- [ ] `tests/templates/erc20/validators.spec.ts` — stubs for validator regex cases
- [ ] `tests/fixtures/erc20/bare-default.sol` — committed golden snapshot (D-09)
- [ ] `tests/fixtures/erc20/all-flags-on.sol` — committed golden snapshot (D-09)
- [ ] `tests/cli.spec.ts` line 106 (`it.skip` SC-4 placeholder) — unskip and fill via in-process dispatcher
- [ ] Wave 0 spike — verify `import { erc20 } from "@openzeppelin/wizard"` named-import works under NodeNext ESM; if not, use default-then-destructure (RESEARCH.md Pattern 1)
- [ ] Wave 0 spike — verify `premint: "0"` behavior (skips block vs emits no-op `_mint`); map internal `"0"` → `undefined` if needed (RESEARCH.md Pitfall 5)

*No new framework install needed — vitest 4 already in Phase 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-platform CRLF/LF parity for snapshot fixtures | ROADMAP SC-4 | `.gitattributes eol=lf` + Vitest 4 PR #3164 should cover, but POSIX-shell verification is the only way to confirm a Windows-authored snapshot reads identically on Linux/macOS | After Phase 2 wraps, run `npx vitest run tests/templates/erc20` on at least one Linux env (e.g., GitHub Actions `ubuntu-latest`) and confirm zero EOL diffs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills task IDs)

**Approval:** pending
