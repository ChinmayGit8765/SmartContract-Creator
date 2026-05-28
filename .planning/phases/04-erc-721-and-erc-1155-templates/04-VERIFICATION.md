---
phase: 04-erc-721-and-erc-1155-templates
verified: 2026-05-28T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  note: initial verification — no prior VERIFICATION.md
---

# Phase 4: ERC-721 + ERC-1155 Templates Verification Report

**Phase Goal:** User can scaffold NFT (ERC-721) and multi-token (ERC-1155) contracts through the same wizard, with both compile-verified — validating the plugin model is additive without core changes.
**Verified:** 2026-05-28
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is observably achieved in the codebase. Both new template plugins (ERC-721, ERC-1155) are implemented as substantive, wired plugins reachable through the real CLI entry point (`node dist/cli.js list-templates` shows 3 rows), both compile-verify through the unchanged Phase 3 gate, and the additive-only plugin model held: the only non-template, non-test source change is `src/cli.ts` (+4 lines boot wiring) plus a 2-line E_USAGE copy update in `src/commands/create.ts`. `src/compiler/`, `src/registry/`, `src/lib/`, and `src/templates/erc20/` were NOT touched.

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (Success Criterion)                                                                                                            | Status     | Evidence                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User can generate an ERC-721 with configurable name, symbol, base URI + opt-in Mintable/Enumerable/Burnable/Pausable                | ✓ VERIFIED | `src/templates/erc721/wizard.ts` collects name/symbol/baseUri (L63-99) + 4 confirm prompts (L105-145); `generate.ts` maps all to `erc721.print` (L33-43); E2E `create.compile.spec.ts:177` writes & compiles `contract MyNFT`; `all-flags-on.sol` fixture compiles clean |
| 2   | User can opt in to EIP-2981 royalties with configurable recipient + basis-points value                                              | ✓ VERIFIED | `royalty.ts injectRoyalty` (4-anchor walker, 211 lines, substantive); wizard prompts bps + receiver (L171-189); `generate.ts` conditionally calls `injectRoyalty` (L45-47); `royalty.spec.ts` runs 3 configurable cases (250/500/250 bps) through real solc; committed `all-flags-on-with-royalty.sol` contains `_setDefaultRoyalty(<recipient>, 250)` (L22) |
| 3   | User can generate an ERC-1155 with configurable URI template + opt-in Mintable/Burnable/Supply/Pausable                            | ✓ VERIFIED | `src/templates/erc1155/wizard.ts` collects name/uri (L52-74) + 4 confirm prompts (L80-120); `generate.ts` maps all + `updatableUri:true` literal (L29-38); E2E `create.compile.spec.ts:197` writes & compiles `contract MyMulti`; `all-flags-on.sol` fixture compiles clean |
| 4   | When Mintable or Pausable selected on either template, wizard asks Ownable vs AccessControl                                         | ✓ VERIFIED | erc721 `wizard.ts:196` `if (mintable \|\| pausable)` → access select; erc1155 `wizard.ts:125` identical guard; both offer ownable/roles options; unit-tested in `tests/templates/erc721/wizard.spec.ts` & `erc1155/wizard.spec.ts` (both branches) |
| 5   | All three Solidity templates (ERC-20, ERC-721, ERC-1155) pass compile-verify with their full option matrices                       | ✓ VERIFIED | `tests/compiler/compile.integration.spec.ts` `describe.each(FIXTURES)` runs `compileVerify(source,"evm")` on 7 fixtures (2 erc20 + 3 erc721 + 2 erc1155) via real solc 0.8.35 + OZ 5.6.1; **9 passed** (7 happy + 2 error path). `compileVerify` throws `E_COMPILE_FAILED` on any error (proven by broken.sol test), so clean return = zero errors |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                          | Expected                                          | Status     | Details                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `src/templates/erc721/royalty.ts`                 | EIP-2981 4-anchor injectRoyalty post-process       | ✓ VERIFIED | 211 lines; dual-mode anchor 4 (4a extend / 4b inject); bracket-counting walkers; imported by generate.ts |
| `src/templates/erc721/wizard.ts`                  | 9+2+1 prompt wizard                                | ✓ VERIFIED | 250 lines; full prompt sequence + conditional royalty pair + conditional access + 3 warnings             |
| `src/templates/erc721/generate.ts`                | erc721.print + conditional royalty                 | ✓ VERIFIED | 53 lines; maps all opts; conditional `injectRoyalty` (D-06 opt-out)                                       |
| `src/templates/erc721/index.ts`                   | registerErc721Template barrel                      | ✓ VERIFIED | 38 lines; idempotent register; id=erc721, chain=evm, status=alpha; WIRED into cli.ts                     |
| `src/templates/erc721/opts.ts`/`validators.ts`/`filename.ts` | type surface + 5 validators + filename | ✓ VERIFIED | opts 88L, validators 78L, filename 5L re-export; all imported                                            |
| `src/templates/erc1155/wizard.ts`                 | 7-prompt wizard                                    | ✓ VERIFIED | 176 lines; full prompt sequence + conditional access + 3 warnings (2 conditional + 1 always-on)          |
| `src/templates/erc1155/generate.ts`               | thin erc1155.print wrapper                         | ✓ VERIFIED | 43 lines; maps all opts + `updatableUri:true` literal; no royalty (D-08)                                  |
| `src/templates/erc1155/index.ts`                  | registerErc1155Template barrel                     | ✓ VERIFIED | 40 lines; idempotent; id=erc1155, chain=evm, status=alpha; WIRED into cli.ts                             |
| `src/templates/erc1155/opts.ts`/`validators.ts`/`filename.ts` | type surface + validators + filename | ✓ VERIFIED | opts 54L, validators 36L, filename 6L; all imported                                                     |
| `src/cli.ts`                                      | boot wiring (+4 lines)                             | ✓ VERIFIED | 2 imports (L4-5) + 2 register calls (L12-13); +4/-0 confirmed via git diff                               |
| `src/commands/create.ts`                          | E_USAGE 3-template copy (D-14)                     | ✓ VERIFIED | only `why`/`fix` lines changed; `what`/`code`/`exitCode` unchanged                                        |
| 5 golden fixtures (3 erc721 + 2 erc1155)          | LF-encoded wizard outputs, compile clean           | ✓ VERIFIED | byte counts match SUMMARY (254/2155/2320/519/2309); all compile via integration spec                     |

### Key Link Verification

| From                          | To                          | Via                                   | Status   | Details                                                                                        |
| ----------------------------- | --------------------------- | ------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `src/cli.ts`                  | erc721/erc1155 index        | import + register call in `main()`    | ✓ WIRED  | L4-5 import, L12-13 call `registerErc721Template()` / `registerErc1155Template()`               |
| erc721/erc1155 `index.ts`     | registry                    | `register(tpl)` + `get()` idempotency | ✓ WIRED  | both barrels call `register` from `../../registry/index.js`                                      |
| `generate.ts` (erc721)        | `royalty.ts`                | conditional `injectRoyalty(src,opts)` | ✓ WIRED  | L18 import, L45-47 conditional call gated on `opts.royalty?.enabled`                             |
| `wizard.ts` → `generate.ts`   | `@openzeppelin/wizard`      | `erc721.print` / `erc1155.print`      | ✓ WIRED  | both generate funcs call the namespaced wizard print with full opt mapping                       |
| dispatcher (create)           | both new templates          | `program.parseAsync(["create",...])`  | ✓ WIRED  | E2E tests drive the full pipeline → compile-verify → write to disk for erc721 & erc1155          |
| `list-templates` command      | registry                    | booted registry → 3 rows              | ✓ WIRED  | `node dist/cli.js list-templates` prints erc20 + erc721 + erc1155 (behavioral spot-check below)  |

### Data-Flow Trace (Level 4)

| Artifact                         | Data Variable     | Source                                | Produces Real Data | Status      |
| -------------------------------- | ----------------- | ------------------------------------- | ------------------ | ----------- |
| erc721 `generate.ts` `source`    | wizard print → royalty | `erc721.print(map(opts))` + injectRoyalty | Yes — real OZ wizard output, real royalty injection | ✓ FLOWING |
| erc1155 `generate.ts` `source`   | wizard print      | `erc1155.print(map(opts))`            | Yes — real OZ wizard output                          | ✓ FLOWING |
| `all-flags-on-with-royalty.sol`  | committed fixture | injectRoyalty pipeline                | Yes — contains ERC2981 import, _setDefaultRoyalty(recipient,250), merged supportsInterface override | ✓ FLOWING |
| `list-templates` table           | registry `list()` | booted register calls                 | Yes — 3 live rows in built CLI                        | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior                                | Command                              | Result                                          | Status |
| --------------------------------------- | ------------------------------------ | ----------------------------------------------- | ------ |
| Built CLI lists 3 templates             | `npm run build && node dist/cli.js list-templates` | 3 rows: erc20, erc721, erc1155 (all evm/alpha)  | ✓ PASS |
| Typecheck clean                         | `npm run typecheck`                  | tsc --noEmit, 0 errors                          | ✓ PASS |
| Build clean                             | `npm run build`                      | tsup ESM build success, dist/cli.js 39.30 KB    | ✓ PASS |
| Full suite green                        | `npx vitest run`                     | 250 passed, 1 skipped (251), 26 files           | ✓ PASS |
| SC-5 compile-integration (7 fixtures)   | `npx vitest run tests/compiler/compile.integration.spec.ts` | 9 passed                              | ✓ PASS |
| 3-template no-collision registry        | `npx vitest run tests/registry.spec.ts` | 10 passed                                    | ✓ PASS |
| ERC-721 / ERC-1155 E2E compile-verify   | `npx vitest run tests/commands/create.compile.spec.ts` | 5 passed                              | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan      | Description                                              | Status      | Evidence                                                              |
| ----------- | ---------------- | ------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| ERC721-01   | 04-02 / 04-01    | name/symbol/base URI                                    | ✓ SATISFIED | wizard L63-99; bare-default fixture; E2E writes `contract MyNFT`      |
| ERC721-02   | 04-02            | Mintable/Enumerable/Burnable                            | ✓ SATISFIED | wizard L105-133; generate maps; all-flags-on fixture compiles         |
| ERC721-03   | 04-01 / 04-02    | EIP-2981 royalties (configurable recipient + bps)       | ✓ SATISFIED | royalty.ts + royalty.spec.ts (3 configurable cases); with-royalty fixture |
| ERC721-04   | 04-02            | Pausable                                                | ✓ SATISFIED | wizard L139-145; all-flags-on fixture compiles                        |
| ERC721-05   | 04-02            | conditional Ownable vs AccessControl                    | ✓ SATISFIED | wizard L196 guard; both branches unit-tested                          |
| ERC1155-01  | 04-03 / 04-01    | configurable URI template                               | ✓ SATISFIED | wizard L66-74; bare-default fixture; E2E writes `contract MyMulti`    |
| ERC1155-02  | 04-03            | Mintable/Burnable                                       | ✓ SATISFIED | wizard L80-96; generate maps; all-flags-on fixture compiles           |
| ERC1155-03  | 04-03            | Supply tracking                                         | ✓ SATISFIED | wizard L102-108; per-flag assertion; all-flags-on fixture compiles    |
| ERC1155-04  | 04-03            | Pausable                                                | ✓ SATISFIED | wizard L114-120; all-flags-on fixture compiles                        |
| ERC1155-05  | 04-03            | conditional Ownable vs AccessControl                    | ✓ SATISFIED | wizard L125 guard; both branches unit-tested                          |

All 10 Phase 4 requirements (ERC721-01..05, ERC1155-01..05) satisfied. No orphaned requirements — all IDs in REQUIREMENTS.md Phase 4 mapping are claimed by plan frontmatter.

### Additive-Only Model Verification (D-12)

Confirmed via `git diff --stat 488a8f3^ HEAD -- <protected dirs>` over the full Phase 4 commit range (including docs commits):

| Path                              | Phase 4 disposition                              |
| --------------------------------- | ------------------------------------------------ |
| `src/compiler/`                   | **NOT TOUCHED** (zero diff entries)              |
| `src/registry/`                   | **NOT TOUCHED** (zero diff entries)              |
| `src/lib/`                        | **NOT TOUCHED** (zero diff entries)              |
| `src/templates/erc20/`            | **NOT TOUCHED** (zero diff entries)              |
| `src/program.ts`                  | **NOT TOUCHED**                                  |
| `src/commands/list-templates.ts`  | **NOT TOUCHED**                                  |
| `src/cli.ts`                      | MODIFIED — +4 / -0 (2 imports + 2 register calls) |
| `src/commands/create.ts`          | MODIFIED — E_USAGE `why`/`fix` copy only (D-14)  |
| `src/templates/erc721/`           | NEW (plugin)                                     |
| `src/templates/erc1155/`          | NEW (plugin)                                     |
| `tests/*`                         | additive — new specs + 4 cross-cutting extended  |

The only non-template, non-test source change is exactly as documented: `src/cli.ts` +4 lines + the create.ts E_USAGE copy. **Additive-only model HELD.** This is the central validation the phase set out to prove.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/templates/erc721/royalty.ts` | 38-41 | Stale docstring claims "ANCHOR 4 IS A NO-OP" (contradicts the implemented dual-mode) | ℹ️ Info | Cosmetic only — the actual code (L90-131) and inline comment (L104-107) correctly implement & document anchor 4b. Does not affect behavior; all 3 royalty cases compile clean. |

No debt markers (TBD/FIXME/XXX) in any modified source or test files. No stubs, no empty implementations, no orphaned artifacts.

### Documented Deviations (Accepted)

1. **Anchor 4 dual-mode (4b injection)** — RESEARCH §Pitfall 4 incorrectly claimed anchor 4 always no-ops; executor corrected it to inject `supportsInterface(...) override(ERC721, ERC2981)` when none exists. All 3 royalty cases compile clean (verified in royalty.spec.ts + the committed with-royalty fixture). **Accepted.**
2. **Wave 1 transient cross-plan typecheck errors** — 04-02's index.ts referenced wizard/generate added mid-task; resolved once both plugins landed. Final `npm run typecheck` is clean (verified). **Accepted.**
3. **registry.spec.ts has 10 live tests** — executor added an optional erc721 idempotency test (plan permitted). Verified at registry.spec.ts:116. **Accepted.**

### Disconfirmation Pass (Confirmation Bias Counter)

- **Partial-requirement check:** SC-5's compile test asserts `Array.isArray(result.warnings)` rather than `errors.length === 0`. Verified this is sound — `compileVerify` throws `E_COMPILE_FAILED` on any compile error (proven by the broken.sol error-path test in the same file), so a clean (non-throwing) return is equivalent to zero errors. Not a gap.
- **Misleading-test check:** generate.spec snapshots could mask drift if run with `-u`. Verified the suite runs `vitest run` (no `-u`), and `git status tests/fixtures/` is clean after runs (per 04-03 SUMMARY) — true byte-for-byte matches.
- **Uncovered-error-path check:** The `1 skipped` test is the pre-existing `cli.spec.ts:111` overwrite-e2e placeholder (deferred to a cross-platform hardening phase; unit coverage exists in `create.sc4.spec.ts`). It pre-dates Phase 4 and is not a regression — Phase 4 actually reduced the skip count (2→1) by flipping the registry stub live.

### Human Verification Required

None. All success criteria are verified programmatically (compile-verify is exercised by automated real-solc integration + E2E tests; the user-facing `list-templates` surface was confirmed behaviorally via the built CLI).

### Gaps Summary

No gaps. All 5 success criteria verified, all 10 requirements satisfied, additive-only model confirmed, full suite green (250 passed / 1 pre-existing skip), build + typecheck clean, built CLI shows 3 templates. The phase goal — scaffolding NFT (ERC-721) and multi-token (ERC-1155) contracts through the same wizard with both compile-verified, while keeping the plugin model additive without core changes — is achieved in the codebase.

---

_Verified: 2026-05-28_
_Verifier: Claude (gsd-verifier)_
