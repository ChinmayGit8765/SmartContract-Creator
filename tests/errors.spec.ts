import { describe, it, expect } from "vitest";
import {
  CliError,
  renderError,
  ERR_FILE_EXISTS,
  ERR_NOT_IMPLEMENTED,
  ERR_USAGE,
  ERR_UNKNOWN,
} from "../src/lib/errors.js";
import { makeColor } from "../src/lib/color.js";

const color = makeColor(true); // no-color: assertions stay clean

describe("CliError", () => {
  it("constructor sets all fields including default exitCode of 1", () => {
    const err = new CliError({
      code: ERR_FILE_EXISTS,
      what: "Refused to overwrite foo.sol.",
      why: "The output path already exists.",
      fix: "Re-run with --force.",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CliError);
    expect(err.name).toBe("CliError");
    expect(err.code).toBe("E_FILE_EXISTS");
    expect(err.what).toBe("Refused to overwrite foo.sol.");
    expect(err.why).toBe("The output path already exists.");
    expect(err.fix).toBe("Re-run with --force.");
    expect(err.exitCode).toBe(1);
    expect(err.message).toBe("Refused to overwrite foo.sol.");
  });

  it("honors explicit exitCode override", () => {
    const err = new CliError({
      code: ERR_USAGE,
      what: "Bad usage.",
      why: "Bad flag.",
      fix: "Read --help.",
      exitCode: 2,
    });
    expect(err.exitCode).toBe(2);
  });

  it("exposes stable error code constants", () => {
    expect(ERR_FILE_EXISTS).toBe("E_FILE_EXISTS");
    expect(ERR_NOT_IMPLEMENTED).toBe("E_NOT_IMPLEMENTED");
    expect(ERR_USAGE).toBe("E_USAGE");
    expect(ERR_UNKNOWN).toBe("E_UNKNOWN");
  });
});

describe("renderError", () => {
  it("renders a CliError as a three-part block (Error / Why / Fix)", () => {
    const err = new CliError({
      code: ERR_FILE_EXISTS,
      what: "Refused to overwrite foo.sol.",
      why: "The output path already exists and you chose not to overwrite it.",
      fix: "Re-run with a different --out path, or pass --force.",
    });
    const out = renderError(err, color);
    const lines = out.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Error:.*\(code: E_FILE_EXISTS\)$/);
    expect(lines[0]).toContain("Refused to overwrite foo.sol.");
    expect(lines[1]).toMatch(/^Why:/);
    expect(lines[1]).toContain("output path already exists");
    expect(lines[2]).toMatch(/^Fix:/);
    expect(lines[2]).toContain("--force");
  });

  it("renders a plain Error as a single line with E_UNKNOWN", () => {
    const err = new Error("kaboom");
    const out = renderError(err, color);
    expect(out.includes("\n")).toBe(false);
    expect(out).toMatch(/^Error:/);
    expect(out).toContain("kaboom");
    expect(out).toContain("(code: E_UNKNOWN)");
  });

  it("renders a string throw as a single line", () => {
    const out = renderError("something bad", color);
    expect(out.includes("\n")).toBe(false);
    expect(out).toContain("something bad");
    expect(out).toContain("(code: E_UNKNOWN)");
  });

  it("renders a non-Error non-string value safely", () => {
    const out = renderError(42, color);
    expect(out).toContain("42");
    expect(out).toContain("(code: E_UNKNOWN)");
  });
});
