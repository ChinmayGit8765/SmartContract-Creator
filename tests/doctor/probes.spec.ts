import { describe, expect, it } from "vitest";
import {
  extractVersion,
  runVersion,
  probeNode,
  probeSolc,
  MIN_NODE_MAJOR,
} from "../../src/doctor/probes.js";
import { doctorExitCode } from "../../src/doctor/index.js";
import type { ProbeResult } from "../../src/doctor/types.js";

describe("extractVersion", () => {
  it("pulls a semver out of noisy --version output", () => {
    expect(extractVersion("anchor-cli 0.30.1")).toBe("0.30.1");
    expect(extractVersion("ollama version is 0.1.32")).toBe("0.1.32");
    expect(extractVersion("v22.18.0\n")).toBe("22.18.0");
    expect(extractVersion("solc, the solidity compiler commandline interface\nVersion: 0.8.35+commit.47b9dedd"))
      .toBe("0.8.35+commit.47b9dedd");
  });

  it("falls back to the first non-empty line when no x.y.z is present", () => {
    expect(extractVersion("some-tool stable")).toBe("some-tool stable");
  });

  it("returns null for empty output", () => {
    expect(extractVersion("")).toBeNull();
    expect(extractVersion("   \n  ")).toBeNull();
  });
});

describe("runVersion", () => {
  it("returns null for a command that does not exist (no throw)", async () => {
    const v = await runVersion("smartc-definitely-not-a-real-binary-xyz");
    expect(v).toBeNull();
  });
});

describe("probeNode", () => {
  it("reports ok for the minimum major and above", () => {
    const r = probeNode(`${MIN_NODE_MAJOR}.0.0`);
    expect(r.found).toBe(true);
    expect(r.status).toBe("ok");
    expect(r.required).toBe(true);
    expect(r.note).toBeUndefined();
  });

  it("reports outdated below the minimum major", () => {
    const r = probeNode(`${MIN_NODE_MAJOR - 2}.5.0`);
    expect(r.status).toBe("outdated");
    expect(r.note).toContain(`>=${MIN_NODE_MAJOR}`);
  });
});

describe("probeSolc", () => {
  it("reports ok when a version is resolvable", () => {
    const r = probeSolc("0.8.35");
    expect(r.found).toBe(true);
    expect(r.status).toBe("ok");
    expect(r.required).toBe(true);
  });

  it("reports missing when solc cannot be resolved", () => {
    const r = probeSolc(null);
    expect(r.found).toBe(false);
    expect(r.status).toBe("missing");
    expect(r.note).toBeDefined();
  });
});

describe("doctorExitCode", () => {
  const base = (over: Partial<ProbeResult>): ProbeResult => ({
    key: "x",
    name: "X",
    found: true,
    version: "1.0.0",
    status: "ok",
    required: false,
    purpose: "",
    ...over,
  });

  it("returns 0 when every required tool is ok (optional missing is fine)", () => {
    const results = [
      base({ key: "node", required: true, status: "ok" }),
      base({ key: "solc", required: true, status: "ok" }),
      base({ key: "anchor", required: false, status: "missing" }),
    ];
    expect(doctorExitCode(results)).toBe(0);
  });

  it("returns 1 when a required tool is missing", () => {
    const results = [
      base({ key: "node", required: true, status: "ok" }),
      base({ key: "solc", required: true, status: "missing" }),
    ];
    expect(doctorExitCode(results)).toBe(1);
  });

  it("returns 1 when a required tool is outdated", () => {
    const results = [base({ key: "node", required: true, status: "outdated" })];
    expect(doctorExitCode(results)).toBe(1);
  });
});
