# Phase 3: Compile-Verify Safety Net - Discussion Log

**Date:** 2026-05-26
**Mode:** `--auto` (autonomous; recommended option auto-elected for every gray area)
**Participant:** Claude (orchestrator) only — user pre-authorized `always elect recommended options`.

## Gray Areas Identified & Auto-Resolved

### 1. Compiler integration approach
- **Question:** Use `solc` npm (in-process JS), shell out to system `solc`, or bundle native `solc` binaries?
- **Options:** (a) `solc` npm in-process [recommended], (b) shell-out to system solc, (c) native binary tarballs.
- **Selected:** (a) `solc` npm in-process — matches COMP-01 wording verbatim, no user-install requirement (satisfies COMP-05), no platform-specific tarball matrix (clean for Phase 9).
- **Captured as:** D-01.

### 2. solc + @openzeppelin/contracts version pinning
- **Question:** Range (`^0.8.0`), latest 0.8.x exact, or follow wizard's runtime version?
- **Options:** (a) Exact pin (latest 0.8.x, latest @oz/contracts v5 stable) [recommended], (b) Range, (c) Match wizard runtime.
- **Selected:** (a) Exact pin — snapshot fixtures stay stable across `npm install` runs; wizard@0.10.8 ships against @oz/contracts v5, researcher locks exact versions.
- **Captured as:** D-02.

### 3. solc compile API
- **Question:** Standard JSON input/output vs legacy single-file `compile()` API?
- **Options:** (a) Standard JSON [recommended], (b) Legacy.
- **Selected:** (a) Standard JSON — supported import callback, structured diagnostics, future-proof against solc bumps.
- **Captured as:** D-03.

### 4. `@openzeppelin/contracts` bundled-import resolution (COMP-05)
- **Question:** How does the import callback find @oz/contracts files when smartc is installed globally?
- **Options:** (a) `require.resolve("@openzeppelin/contracts/package.json")` + path-join [recommended], (b) Walk cwd's node_modules, (c) Embed file contents at build time.
- **Selected:** (a) Resolve-and-join — proven mechanism via Phase 1's `safeReadVersion` dual-strategy resolve; works for globally-installed binaries.
- **Captured as:** D-04.

### 5. Import-resolution caching
- **Question:** Cache resolved imports within a compile call?
- **Options:** (a) Per-compile-call Map [recommended], (b) No cache, (c) Cross-call persistent cache.
- **Selected:** (a) Per-compile-call — avoids 8x re-read of OZ ERC20.sol when transitively imported multiple times.
- **Captured as:** D-05.

### 6. Dispatcher splice location
- **Question:** Where in `create.ts` does compileVerify run?
- **Options:** (a) At the Phase 3 splice marker on line 95 [recommended; pre-locked from Phase 2 D-03], (b) Inside template.generate (no — couples template to compiler), (c) After fs.writeFile (no — defeats the purpose).
- **Selected:** (a) Splice marker location.
- **Captured as:** D-06.

### 7. Pipeline ordering — compile before or after overwrite-prompt?
- **Question:** runWizard → generate → [compileVerify before? or after?] → confirmOverwrite → writeFile.
- **Options:** (a) Before confirmOverwrite [recommended], (b) After confirmOverwrite.
- **Selected:** (a) Before — failed compile means no overwrite question; user sees compile diagnostics and a clean abort.
- **Captured as:** D-07.

### 8. Compile-error UX format
- **Question:** Render solc errors as multi-line WHY in the CliError block, or as a separate diagnostic surface?
- **Options:** (a) Multi-line WHY in CliError, preserve WHAT/WHY/FIX shape [recommended], (b) Separate error surface, (c) Bare solc output.
- **Selected:** (a) Multi-line WHY — preserves Phase 1's locked UX contract; solc's `formattedMessage` is already human-readable.
- **Captured as:** D-08.

### 9. Error code + exit code
- **Question:** Reuse `E_USAGE` (exit 2) or new `E_COMPILE_FAILED` (exit 1)?
- **Options:** (a) New `E_COMPILE_FAILED`, exit 1 [recommended], (b) Reuse `E_USAGE` exit 2.
- **Selected:** (a) New stable code, exit 1 — compile failure is a runtime error, not a usage error.
- **Captured as:** D-09.

### 10. Warnings handling (COMP-04)
- **Question:** Surface, suppress, or escalate solc warnings?
- **Options:** (a) Surface via `output.warn`, never block [recommended], (b) Escalate to error, (c) Suppress.
- **Selected:** (a) Surface, never block — exactly COMP-04 wording. Newbie mode gets an extra `output.explain` framing.
- **Captured as:** D-10.

### 11. Version-line visibility (COMP-05 / SC-5)
- **Question:** Show solc + @oz/contracts versions where?
- **Options:** (a) `--version` line (already auto-wired via Phase 1's `safeReadVersion`) [recommended], (b) `smartc doctor` (Phase 6), (c) Boot banner.
- **Selected:** (a) `--version` — zero code change in `version.ts`; Plan 01's `npm install` IS the deliverable.
- **Captured as:** D-11.

### 12. Post-write footer copy
- **Question:** Keep the Phase 2 "Phase 3 will add automatic compile-verify…" footer or update?
- **Options:** (a) Update to confirm compile-verify happened, naming the pinned versions [recommended], (b) Keep Phase 2 wording.
- **Selected:** (a) Update — accuracy matters; UI-SPEC/planner finalizes wording.
- **Captured as:** D-12.

### 13. Test layering
- **Question:** One integration test, or unit + integration + e2e layers?
- **Options:** (a) Three layers: mocked unit, real-solc integration, in-process e2e [recommended], (b) One layer.
- **Selected:** (a) Three layers — unit tests stay fast; integration catches OpenZeppelin drift; e2e proves dispatcher integration.
- **Captured as:** D-13.

### 14. Broken-fixture for failure testing
- **Question:** Use intentionally-broken Solidity as a fixture for failure tests?
- **Options:** (a) Yes, static `tests/fixtures/broken.sol` [recommended], (b) Generate broken source dynamically per test.
- **Selected:** (a) Static fixture — stable, audit-able, reusable across Phase 4+ tests.
- **Captured as:** D-14.

### 15. "No file written on failure" assertion strength
- **Question:** Mock vs real filesystem check?
- **Options:** (a) Real tmpdir + `existsSync` assertion [recommended], (b) Mock fs.writeFile.
- **Selected:** (a) Real filesystem — the load-bearing safety guarantee is filesystem behavior, not test-double behavior.
- **Captured as:** D-15.

## Scope Creep Encountered: none

The phase boundary is well-defined by COMP-01..COMP-05 + the four SC-1..SC-5 success criteria. No tangential ideas surfaced during the auto-analysis pass.

## Deferred Ideas Captured

See CONTEXT.md `<deferred>` block:
1. Cross-run compile cache (v2)
2. Multi-EVM-target compile (defer until a template needs it)
3. CI multi-solc-version matrix (v2)
4. Bytecode-size / gas display
5. Severity tiering for warnings
6. Compile-verify badge in DEPLOY.md (Phase 5's problem)
7. Anchor build adapter (Phase 7's problem)

## Claude's Discretion Items

See CONTEXT.md `<decisions>` block's "Claude's Discretion" subsection:
1. Exact pinned solc + @oz/contracts versions — researcher picks at planning time.
2. Compiler output selection (`["abi"]` minimum) — researcher picks based on assertions needed.
3. `CompileDiagnostic` type shape — orchestrator locked at `{ severity, message, formattedMessage, line?, column?, file? }`.
4. Spinner/banner text during compile — planner finalizes (default: terse, no spinner if compile <500ms).
5. `src/compiler/README.md` — recommend yes (planner judges value).

---

*Phase: 03-compile-verify-safety-net*
*Auto-mode authorized by user in session: "always elect recommended options".*
