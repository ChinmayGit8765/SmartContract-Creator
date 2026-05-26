import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(process.cwd(), "dist/cli.js");

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

function runCli(args: string[], env: Record<string, string> = {}): RunResult {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env, NO_COLOR: "1" },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
      status: err.status ?? 1,
    };
  }
}

describe("smartc CLI (e2e)", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build"], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
  }, 60_000);

  it("SC-1: --help exposes every command and flag", () => {
    const r = runCli(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("create");
    expect(r.stdout).toContain("list-templates");
    expect(r.stdout).toContain("--newbie");
    expect(r.stdout).toContain("--verbose");
    expect(r.stdout).toContain("--force");
    expect(r.stdout).toContain("--no-color");
    expect(r.stdout).toContain("--json");
    expect(r.stdout).toContain("-V");
  }, 15_000);

  it("SC-2: list-templates shows the registered template(s) in default table", () => {
    const r = runCli(["list-templates"]);
    expect(r.status).toBe(0);
    // Phase 2 retired the foundation-smoke canary; erc20 is the sole registered template.
    expect(r.stdout).toContain("erc20");
    expect(r.stdout).toContain("ERC-20 Token");
  }, 15_000);

  it("SC-2: list-templates --json emits the locked five-field shape", () => {
    const r = runCli(["list-templates", "--json"]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      templates: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(parsed.templates)).toBe(true);
    expect(parsed.templates.length).toBeGreaterThan(0);
    const first = parsed.templates[0]!;
    expect(Object.keys(first).sort()).toEqual([
      "chain",
      "description",
      "id",
      "name",
      "status",
    ]);
  }, 15_000);

  // Phase 2: `smartc create` without --template now refuses with E_USAGE (exit 2)
  // per W3. The three-part Error/Why/Fix block + newbie-channel silence behavior
  // is what SC-3 / SC-5 lock — the literal error code updated to E_USAGE.
  it("SC-3: default mode is terse — create error block only, no newbie channels", () => {
    const r = runCli(["create"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Error:");
    expect(r.stderr).toContain("Why:");
    expect(r.stderr).toContain("Fix:");
    expect(r.stderr).toContain("E_USAGE");
    expect(r.stderr).not.toMatch(/\bsee:/);
    expect(r.stderr).not.toMatch(/\bnext:/);
  }, 15_000);

  it("SC-3: --newbie flag is accepted without breakage", () => {
    const r = runCli(["--newbie", "create"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Error:");
    expect(r.stderr).toContain("E_USAGE");
  }, 15_000);

  it("SC-3: SMARTC_NEWBIE env triggers newbie mode without crash", () => {
    const r = runCli(["create"], { SMARTC_NEWBIE: "1" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("E_USAGE");
  }, 15_000);

  it("SC-3: --newbie flag overrides SMARTC_NEWBIE=0", () => {
    const r = runCli(["--newbie", "create"], { SMARTC_NEWBIE: "0" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("E_USAGE");
  }, 15_000);

  // Filled in tests/cli.sc4.spec.ts — kept here as it.skip placeholder so the spawn suite stays free of @clack-prompts module-level mock hoisting (W5).
  it.skip("SC-4: overwrite prompt + --force (e2e deferred to Plan 02-05; unit coverage in tests/commands/create.spec.ts)", () => {});

  it("SC-5: errors are actionable — what/why/fix labels all present", () => {
    const r = runCli(["create"]);
    expect(r.stderr).toMatch(/Error:.*E_USAGE/s);
    expect(r.stderr).toMatch(/Why:/);
    expect(r.stderr).toMatch(/Fix:/);
  }, 15_000);

  it("--version prints the formatted version line with all pinned segments (UI-16 + SC-5)", () => {
    const r = runCli(["-V"]);
    expect(r.status).toBe(0);
    // Plan 03-03 Task 4 flipped the segment values: Phase 3 installs solc + @oz/contracts
    // at exact pins, so the "not bundled" markers became real version strings.
    // Per-segment toContain rather than an exact regex so a future fourth dep doesn't churn this test.
    const line = r.stdout.trim();
    expect(line).toMatch(/^smartc \d+\.\d+\.\d+ \(.+\)$/);
    expect(line).toContain("solc 0.8.35");
    expect(line).toContain("@openzeppelin/contracts 5.6.1");
    expect(line).toContain("@openzeppelin/wizard 0.10.8");
    // Negative assertions: the Phase 2 "not bundled" sentinels MUST be gone.
    expect(line).not.toContain("solc not bundled");
    expect(line).not.toContain("@openzeppelin/contracts not bundled");
  }, 15_000);

  it("bare invocation highlights 'Get started: smartc create' before help", () => {
    const r = runCli([]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Get started: smartc create");
    const getStartedIdx = r.stdout.indexOf("Get started: smartc create");
    const usageIdx = r.stdout.indexOf("Usage:");
    if (usageIdx >= 0) {
      expect(getStartedIdx).toBeLessThan(usageIdx);
    }
  }, 15_000);

  it("unknown command exits with commander usage error (status 2)", () => {
    const r = runCli(["nope"]);
    expect(r.status).toBe(2);
    const all = (r.stderr + r.stdout).toLowerCase();
    expect(all).toMatch(/unknown command|usage/);
  }, 15_000);

  it("CLI-05: --template is wired on create (option is registered; unknown template -> E_USAGE)", () => {
    const r = runCli(["create", "--template", "foundation-smoke"]);
    // Phase 2 retired the foundation-smoke canary; unknown template -> E_USAGE exit 2.
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("E_USAGE");
    expect(r.stderr).toContain("foundation-smoke");
  }, 15_000);

  it("--no-color suppresses ANSI escape sequences in error output", () => {
    const r = runCli(["--no-color", "create"]);
    expect(r.status).toBe(2);
    expect(r.stderr).not.toMatch(/\x1b\[/);
  }, 15_000);
});
