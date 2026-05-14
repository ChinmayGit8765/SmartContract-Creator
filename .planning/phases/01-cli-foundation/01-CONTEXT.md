# Phase 1: CLI Foundation - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Installable CLI shell with command surface, wizard runner, and verbosity modes. Phase 1 delivers the scaffold every later phase plugs into — help/discovery, verbosity toggles, overwrite/force behavior, and error messaging — without shipping any actual template logic.

Out of scope (later phases): template generation (Phase 2+), compile-verify (Phase 3), DEPLOY.md (Phase 5), doctor (Phase 6), AI add-feature (Phase 8), packaging/distribution (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Command surface & naming
- **Foundation commands only.** Phase 1 wires `--help`, `--version`, and `list-templates`. No stubs for `create`, `doctor`, or `add-feature` — those are introduced by their owning phases.
- **Hybrid subcommand style.** `smartc create` opens the wizard with a template picker; `smartc create --template <id>` skips the picker. (Wired but not implemented in Phase 1 — design contract only.)
- **Bare `smartc` shows help with a highlighted "Get started: smartc create" line** at the top of the output. Not a silent help dump; not a wizard auto-launch.
- **Global flags** (work on every command): `--newbie` / `--verbose`, `--force`, `--no-color`, `--json`.
- **`smartc --version` prints CLI version + bundled `solc` version + bundled `@openzeppelin/contracts` version** on one line, e.g. `smartc 0.1.0 (solc 0.8.x, @openzeppelin/contracts 5.x)`. This satisfies Phase 3 success criterion 5 (pinned versions visible user-facing) without waiting for `doctor`.

### Verbosity modes
- **`--newbie` adds four things** on top of default output:
  1. Why-this-question-matters explanations on wizard prompts
  2. Risk/safety callouts (centralization warnings, footguns, irreversibility notes)
  3. Pointers to docs / EIPs / OpenZeppelin references
  4. Next-step guidance after generation ("open the file, read DEPLOY.md, deploy to testnet first")
- **Tone: formal / manual-style.** Reads like a manpage entry — precise, technical, no second-person warmth. ("Mintable: the owner address may invoke `mint()` to increase total supply post-deployment.")
- **Toggled via flag OR env var.** `--newbie` per invocation; `SMARTC_NEWBIE=1` as a persistent default. Flag overrides env var.
- **Default (terse) mode spontaneously surfaces critical warnings only** — centralization risks (e.g., Ownable + Mintable) appear even without `--newbie`. All other explanation is gated.

### Help & list-templates output
- **`--help` uses the CLI framework's standard default output.** No custom banner, no examples section in Phase 1 — whatever the chosen framework produces out of the box.
- **`list-templates` default renderer is a boxed table** (cli-table3-style borders). `--json` and `--no-color` switch the rendering.
- **Stub state in Phase 1:** a single canary entry (e.g., `foundation-smoke (stub)`) so the registry plumbing, table renderer, and JSON shape are exercised end-to-end without overpromising functionality.
- **`--json` schema is stable from Phase 1.** Locked shape: `{ "templates": [{ "id", "name", "chain", "status", "description" }] }`. Later phases must add fields without breaking this contract.

### Errors & overwrite behavior
- **Three-part error block:** every error renders as three labeled lines — WHAT went wrong, WHY, WHAT TO DO. Predictable layout, scannable, satisfies the "actionable + next step" success criterion.
- **Overwrite prompt:** `File <path> exists. Overwrite? [y/N]` — y/N with default **no** (blank Enter = no overwrite).
- **`--force` skips ALL confirmation prompts**, not just the overwrite one. Single flag for CI/automation ergonomics; same flag will suppress later-phase prompts (compile warnings, centralization confirms) when those land.

### Claude's Discretion
- **Binary name** — default to `smartc` per ROADMAP.md / PROJECT.md unless implementation surfaces a conflict; revisit if so.
- **CLI framework choice** (commander vs yargs vs oclif vs clipanion). Pick whichever best supports: hybrid subcommands, global flags, stable `--help` rendering, JSON output, and Node ESM.
- **Exit code convention.** Granular vs POSIX is open; pick what's idiomatic for the chosen framework and document the chosen scheme.
- **Short flag conventions** (`-h`, `-v`, `-f`, etc.). Use framework defaults; avoid `-v` ambiguity (verbose vs version) by making `--version` long-only if needed.
- **Error codes** (e.g., `E_FILE_EXISTS`). Open whether to ship stable codes in Phase 1 or stay free-form; if codes are added, they must be stable from introduction.
- **Exact wording of the "Get started: smartc create" highlight** on bare invocation.

</decisions>

<specifics>
## Specific Ideas

- **Three-part error block (WHAT / WHY / WHAT TO DO)** is a load-bearing shape for the whole product — every later phase's user-facing error must follow this layout.
- **`SMARTC_NEWBIE=1`** as the env var name for persistent newbie mode (matches the binary name convention).
- **`--version` carrying bundled `solc` + `@openzeppelin/contracts` versions** is intentional cross-phase plumbing — Phase 3 needs this surface, and putting it in Phase 1 means no retrofit later.
- **Single canary entry in `list-templates`** is intentional honesty — it exercises the registry/renderer/JSON path without telling users "ERC-20 is available" before Phase 2 lands.
- **Formal/manual-style tone** for `--newbie` — explicit choice against conversational warmth. Audience is developers, not end-users.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-cli-foundation*
*Context gathered: 2026-05-15*
