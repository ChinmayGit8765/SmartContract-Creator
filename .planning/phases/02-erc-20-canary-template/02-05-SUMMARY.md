---
phase: 02-erc-20-canary-template
plan: 05
subsystem: cli, version, e2e
tags: [e2e, version-line, sc-4, ui-16, w5, d-08-override]
requires:
  - "Plan 01-02 — formatVersionLine + safeReadVersion dual-strategy resolve"
  - "Plan 02-01 — @openzeppelin/wizard@0.10.8 pinned install"
  - "Plan 02-04 — in-process create dispatcher (program.parseAsync wires to template.runWizard → generate → confirmOverwrite → fs.writeFile)"
provides:
  - "End-to-end SC-4 (CLI-07 residual) coverage in tests/cli.sc4.spec.ts (--force / accept / decline)"
  - "Three-segment --version line including @openzeppelin/wizard 0.10.8 (UI-16, D-08 discretion override)"
  - "VALIDATION.md CLI-07 row pointing at tests/cli.sc4.spec.ts (W5 — dedicated SC-4 spec file)"
affects:
  - "tests/cli.spec.ts — line ~106 SC-4 placeholder gains a one-line pointer comment; --version regex widened to per-segment toContain"
  - "tests/version.spec.ts — assertion regex widened (option (b) — per-segment toContain over an exact-shape regex)"
tech-stack:
  added: []
  patterns:
    - "Vitest 4 ESM mock pattern (vi.mock + dynamic SUT import) — reused verbatim from Plan 01-02 / Plan 02-04 in tests/cli.sc4.spec.ts"
    - "Per-segment toContain over exact regex for the --version assertion (resilient against future dep additions)"
key-files:
  created:
    - "tests/cli.sc4.spec.ts (3 in-process e2e cases + captureStdout helper + primeHappyPathMocks helper)"
    - ".planning/phases/02-erc-20-canary-template/02-05-SUMMARY.md (this file)"
  modified:
    - "src/lib/version.ts (third ternary block + return shape; wizard segment ships)"
    - "tests/version.spec.ts (one new safeReadVersion case + widened formatVersionLine block; +1 wizard-segment assertion)"
    - "tests/cli.spec.ts (one-line pointer comment above the SC-4 it.skip placeholder; --version regex widened to per-segment toContain; SC-4 placeholder body unchanged)"
    - ".planning/phases/02-erc-20-canary-template/02-VALIDATION.md (CLI-07 row's automated command + file-exists + notes columns)"
decisions:
  - "D-08 override exercised: per CONTEXT D-08 the default was 'leave formatVersionLine untouched'; this plan documents and ships UI-16 (wizard segment) using the discretion D-08 explicitly grants. The version line is now three-segment."
  - "Per-segment toContain over exact regex: Plan's <action> noted option (a) widen regex vs (b) per-segment toContain. Picked (b) for both tests/version.spec.ts AND tests/cli.spec.ts so future dep additions (Phase 3 swaps solc + @openzeppelin/contracts to real versions) won't churn either assertion."
  - "ROADMAP.md was NOT modified by this plan: the orchestrator's post-Wave-2 docs commit (59b483f) had already populated the five-plan list and the 'Plans: 5 plans in 4 waves' line. The Task 3 verifier confirmed the file already satisfies the contract — no need to re-touch."
metrics:
  duration: "~5 minutes (1779776760 → 1779777065)"
  completed: "2026-05-26"
  files_changed: 5
  commits: 4
  tests_added: 5
  tests_total_before: 132
  tests_total_after: 137
---

# Phase 2 Plan 05: SC-4 e2e fill-in + UI-16 version-line + ROADMAP/VALIDATION finalization — Summary

Closed out Phase 2 by exercising SC-4 (CLI-07 residual) end-to-end through the
in-process dispatcher in a new dedicated spec file, shipping the optional UI-16
`@openzeppelin/wizard` version-line segment under documented D-08 discretion
override, and finalizing VALIDATION.md's CLI-07 row to point at the new spec.

## `node dist/cli.js --version` output

```
smartc 0.1.0 (solc not bundled, @openzeppelin/contracts not bundled, @openzeppelin/wizard 0.10.8)
```

The Phase 1 dual-strategy `safeReadVersion` did the heavy lifting — wizard's
`package.json` is exports-map-unrestricted, so Strategy 1 (direct
`<pkg>/package.json` resolve) succeeds on the first attempt. Solc and
`@openzeppelin/contracts` continue to surface as `not bundled` (Phase 3 will
swap those in once installed). The line is honest about what's loaded.

## Three SC-4 cases in `tests/cli.sc4.spec.ts`

All three exercise the FULL program tree via `program.parseAsync(...)` against
the registered `erc20` template — same wizard prompts, same dispatcher pipeline,
same `confirmOverwrite` gate, same `fs.writeFile` — only the `@clack/prompts`
module is swapped for `vi.fn()`s.

1. **`SC-4: --force overwrites an existing file without prompting`** — pre-creates
   stale content at `outPath`, runs `create --template erc20 --out <stale> --force`,
   asserts the file is overwritten with fresh `contract MyToken` source, asserts
   `confirmMock` was called exactly **3 times** (the three wizard confirms for
   mintable/burnable/pausable; none with a message matching `/overwrite/i`).
2. **`SC-4: without --force, the overwrite prompt fires and user can accept (overwrites)`** —
   primes a 4th `confirm.mockResolvedValueOnce(true)`, runs the dispatcher,
   asserts overwrite happened AND `confirmMock` was called **4 times** with the
   4th call's `message` matching `/overwrite/i`.
3. **`SC-4: without --force, the overwrite prompt fires and user can decline (E_FILE_EXISTS)`** —
   primes a 4th `confirm.mockResolvedValueOnce(false)`, asserts `parseAsync`
   rejects with `{ code: "E_FILE_EXISTS" }` AND the stale content is **unchanged**
   (no partial write), and `confirmMock` was called exactly 4 times.

Result: `Test Files  1 passed (1)  Tests  3 passed (3)  Duration  ~1.07s`.

## ROADMAP.md plans-list diff (before → after)

**No diff for this plan.** The plans-list was finalized in an earlier commit
(`59b483f docs(phase-02): update tracking after wave 2 (02-04 complete)`).
The Task 3 verifier `node -e "..."` snippet confirmed all five plan filenames
present and no `02-01: TBD` placeholder — no further edits required.

For reference, the current `Phase 2 — Plans:` block reads:

```markdown
**Plans**: 5 plans in 4 waves

Plans:
- [x] 02-01-PLAN.md — Wave 0: spike (@openzeppelin/wizard probes), Template generic widening, error-code constants, opts.ts type contracts, spec skeletons
- [x] 02-02-PLAN.md — Wave 1 (parallel with 02-03): validators, filename derivation, generate() wrapper + golden snapshot fixtures
- [x] 02-03-PLAN.md — Wave 1 (parallel with 02-02): wizard.ts (seven-prompt sequence, cancelGuard, centralization warning)
- [x] 02-04-PLAN.md — Wave 2: registerErc20Template factory, dispatcher .action() body, canary retirement, in-process command spec
- [ ] 02-05-PLAN.md — Wave 3: SC-4 e2e fill-in, version-line @openzeppelin/wizard segment (UI-16), ROADMAP finalization
```

The orchestrator will flip `02-05-PLAN.md` from `[ ]` to `[x]` after verifier sign-off.

## VALIDATION.md CLI-07 row diff (before → after)

**Before:**

```markdown
| TBD | 02-?? | ? | CLI-07 (residual) | T-FS-01 (out-path traversal — accepted in §Security Domain) | overwrite prompt fires; `--force` skips | e2e (in-process dispatcher recommended) | `npx vitest run tests/cli.spec.ts -t "SC-4"` | ✅ skip→fill | ⬜ pending |
```

**After:**

```markdown
| TBD | 02-05 | 3 | CLI-07 (residual) | T-FS-01 (out-path traversal — accepted in §Security Domain) | overwrite prompt fires; `--force` skips | e2e (in-process dispatcher recommended) | `npx vitest run tests/cli.sc4.spec.ts` | ✅ tests/cli.sc4.spec.ts | ⬜ pending — moved to dedicated file per W5 (revision pass 1); keeps the @clack-prompts module-level mock out of the spawn suite |
```

Changes:
- Plan column: `02-??` → `02-05`
- Wave column: `?` → `3`
- Automated command: `tests/cli.spec.ts -t "SC-4"` → `tests/cli.sc4.spec.ts`
- File-exists column: `skip→fill` → `tests/cli.sc4.spec.ts`
- Notes/status column: appended the W5 rationale callout

## D-08 discretion override note

CONTEXT D-08 reads:

> `formatVersionLine` is not modified in Phase 2. It auto-detects @openzeppelin/wizard
> *only if* we choose to surface it in the banner. Default: leave it untouched.
> Phase 3 will swap in the contracts version. (Open: whether to also surface the
> wizard version — defer to planner's judgment.)

UI-SPEC UI-16 then explicitly recommended shipping the wizard segment in Phase 2.
The plan's `discretion_exercised` frontmatter documents the intentional override:
the default was "leave untouched"; UI-16's recommendation + the planner's
discretion (granted by D-08 itself) routed this plan toward "ship it." The
override is recorded in three places now: plan frontmatter, this SUMMARY, and
the code comment block atop `formatVersionLine` (`src/lib/version.ts`).

## Phase 2 done-checklist (each ERC20-01..05 + ROADMAP SC-1..4 mapped to test command)

| Requirement | Behavior under test | Test command |
|-------------|---------------------|--------------|
| **ERC20-01** | User can generate an ERC-20 with their own name, symbol, and initial supply (pass through unchanged to wizard SDK) | `npx vitest run tests/templates/erc20/generate.spec.ts -t "bare default"` |
| **ERC20-02** | `mintable=true` adds `mint()` + access-control parent | `npx vitest run tests/templates/erc20/generate.spec.ts -t "mintable"` |
| **ERC20-03** | `burnable=true` adds `ERC20Burnable` parent | `npx vitest run tests/templates/erc20/generate.spec.ts -t "burnable"` |
| **ERC20-04** | `pausable=true` adds `ERC20Pausable` + `pause`/`unpause` | `npx vitest run tests/templates/erc20/generate.spec.ts -t "pausable"` |
| **ERC20-05** | mintable\|pausable → Ownable vs AccessControl prompt; selection routes correctly | `npx vitest run tests/templates/erc20/wizard.spec.ts -t "access"` |
| **ROADMAP SC-1** | User can generate an ERC-20 with their own name, symbol, supply | `npx vitest run tests/templates/erc20/generate.spec.ts -t "bare default"` + `npx vitest run tests/commands/create.spec.ts -t "happy path"` |
| **ROADMAP SC-2** | User can opt in to Mintable/Burnable/Pausable independently | `npx vitest run tests/templates/erc20/generate.spec.ts` (per-flag axes) |
| **ROADMAP SC-3** | When Mintable or Pausable is selected, user is asked Ownable vs AccessControl | `npx vitest run tests/templates/erc20/wizard.spec.ts -t "access"` |
| **ROADMAP SC-4** | Generated `.sol` matches OpenZeppelin Wizard output byte-for-byte | `npx vitest run tests/templates/erc20/generate.spec.ts -t "snapshot"` (golden fixtures `tests/fixtures/erc20/bare-default.sol` + `all-flags-on.sol`) |
| **CLI-07 (residual)** | Overwrite prompt fires; `--force` skips; decline → E_FILE_EXISTS | `npx vitest run tests/cli.sc4.spec.ts` ← **this plan** |
| **UI-16** | `--version` includes `@openzeppelin/wizard <ver>` segment | `npx vitest run tests/version.spec.ts -t "@openzeppelin/wizard segment"` ← **this plan** |
| **W5** | tests/cli.spec.ts spawn suite stays free of module-top @clack-prompts mock | `node -e "if (require('fs').readFileSync('tests/cli.spec.ts','utf8').includes('vi.mock(\"@clack/prompts\"')) process.exit(1)"` ← **this plan** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Widened the `--version` regex in `tests/cli.spec.ts`**

- **Found during:** Task 1 GREEN phase, when extending `formatVersionLine` to
  emit the third wizard segment.
- **Issue:** `tests/cli.spec.ts` line ~122-124 had an exact-match regex
  `/^smartc \d+\.\d+\.\d+ \(solc not bundled, @openzeppelin\/contracts not bundled\)\$/`
  that asserted the Phase 1 two-segment shape. With the wizard segment added,
  that regex would fail and the full suite would not be green.
- **Fix:** Replaced the exact regex with per-segment `toContain` assertions —
  same approach the plan recommended for `tests/version.spec.ts` (option (b)).
  All three segments (solc not bundled, @openzeppelin/contracts not bundled,
  @openzeppelin/wizard 0.10.8) are asserted by `toContain`, plus a shape regex
  `/^smartc \d+\.\d+\.\d+ \(.+\)\$/` confirms the `smartc <ver> (...)` envelope.
  The Wikipedia of the file was unchanged otherwise — no `vi.mock` block added,
  per W5 hard constraint.
- **Files modified:** `tests/cli.spec.ts`
- **Commit:** `b5222e7` (bundled with the `src/lib/version.ts` change since both
  ship the same UI-16 feature)
- **Justification:** `tests/cli.spec.ts` is listed in the plan's `files_modified`
  array — the edit was scoped to the single `--version` test, leaves the spawn
  suite otherwise untouched, and the verifier check `if(t.includes('vi.mock("@clack/prompts"'))`
  confirmed no module-top mock block was introduced.

**2. [Rule 3 — Tooling] Rephrased pointer comment to avoid tripping the
verifier's substring check**

- **Found during:** Task 2 verify (final node -e snippet).
- **Issue:** The first draft of the pointer comment in `tests/cli.spec.ts`
  literally contained `vi.mock("@clack/prompts"` (as English prose describing
  what the W5 move avoids), which trips the verifier's coarse substring guard
  `if(t.includes('vi.mock("@clack/prompts"'))`.
- **Fix:** Rephrased the comment to use `@clack-prompts module-level mock`
  (hyphenated, no parenthesized arg) so it conveys the same meaning without
  embedding the literal substring the verifier guards against.
- **Files modified:** `tests/cli.spec.ts` (the same pointer-comment line)
- **Commit:** `d58d159`
- **Justification:** the verifier's substring match is intentionally coarse so
  it catches any new mock block; the prose comment can carry the same meaning
  without colliding with that guard.

### Architectural changes

None — Rule 4 not exercised.

### Auth gates

None.

### Known Stubs

None — this plan adds only new tests + a one-line source edit + a docs edit.
No stubbed UI surface, no hardcoded empty fixtures, no placeholder strings.

## Threat Flags

None — no new attack surface introduced. Plan additions:
- Test code in `tests/` runs only under `npx vitest`, not in the shipped binary.
- The `--version` line gains a public npm version string (`@openzeppelin/wizard 0.10.8`)
  — disclosure was already accepted in the plan's threat register (T-02-12,
  disposition: `accept` — intentional disclosure for debugging snapshot drift).

## Self-Check: PASSED

**Created files:**
- `FOUND: tests/cli.sc4.spec.ts`
- `FOUND: .planning/phases/02-erc-20-canary-template/02-05-SUMMARY.md` (this file)

**Commits:**
- `FOUND: 44778dc` test(02-05): widen formatVersionLine spec to assert @openzeppelin/wizard segment (UI-16)
- `FOUND: b5222e7` feat(02-05): append @openzeppelin/wizard segment to --version line (UI-16, D-08 override)
- `FOUND: d58d159` test(02-05): add tests/cli.sc4.spec.ts with three SC-4 in-process e2e cases (W5)
- `FOUND: 373c09a` docs(02-05): point VALIDATION.md CLI-07 row at tests/cli.sc4.spec.ts (W5)

**Final verification:**
- `npx vitest run` → 15 test files, 136 passed, 1 skipped (137 total), green.
- `npm run build` → clean (no errors, dist/cli.js 17.59 KB).
- `node dist/cli.js --version` → `smartc 0.1.0 (solc not bundled, @openzeppelin/contracts not bundled, @openzeppelin/wizard 0.10.8)`.

## TDD Gate Compliance

| Task | TDD? | RED commit | GREEN commit | Notes |
|------|------|-----------|--------------|-------|
| 1. UI-16 wizard segment | yes | `44778dc test(02-05): widen formatVersionLine spec to assert @openzeppelin/wizard segment` | `b5222e7 feat(02-05): append @openzeppelin/wizard segment to --version line` | RED commit confirmed failing (1 new wizard-segment assertion red); GREEN commit makes it pass. |
| 2. SC-4 e2e file | yes (per plan frontmatter) | `d58d159 test(02-05): add tests/cli.sc4.spec.ts with three SC-4 in-process e2e cases` | (same commit) | No separate GREEN commit because the SUT (in-process dispatcher) was already wired in Plan 02-04. This plan's deliverable is the *test file itself* exercising existing behavior — a coverage-fill, not a feature-add. Per the MVP+TDD gate's behavior-adding-task predicate, this task has no `<behavior>` block adding production behavior (it adds test behavior), so the gate doesn't fire. The plan's W5 directive is that the file *exists* and exercises CLI-07, which is satisfied. |
| 3. ROADMAP/VALIDATION finalization | no (auto, docs-only) | n/a | `373c09a docs(02-05): point VALIDATION.md CLI-07 row at tests/cli.sc4.spec.ts` | Docs-only edit. |
