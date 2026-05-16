import { describe, it, expect, beforeEach } from "vitest";
import { makeOutput } from "../src/lib/output.js";
import { makeColor } from "../src/lib/color.js";

/** Minimal WritableStream stand-in capturing every chunk. */
class MemoryStream {
  chunks: string[] = [];
  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }
  joined(): string {
    return this.chunks.join("");
  }
}

const color = makeColor(true); // no-color, clean assertions

let out: MemoryStream;
let err: MemoryStream;

beforeEach(() => {
  out = new MemoryStream();
  err = new MemoryStream();
});

describe("makeOutput — default mode (newbie=false, json=false)", () => {
  it("result writes to stdout with a trailing newline", () => {
    const o = makeOutput({
      newbie: false,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.result("hello");
    expect(out.chunks).toEqual(["hello\n"]);
    expect(err.chunks).toEqual([]);
  });

  it("result preserves an existing trailing newline (no double-newline)", () => {
    const o = makeOutput({
      newbie: false,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.result("hello\n");
    expect(out.chunks).toEqual(["hello\n"]);
  });

  it("warn writes to stderr with 'warn:' prefix — ALWAYS, regardless of verbosity", () => {
    const o = makeOutput({
      newbie: false,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.warn("watch out");
    expect(out.chunks).toEqual([]);
    expect(err.joined()).toMatch(/^warn:\s+watch out\n$/);
  });

  it("error writes to stderr", () => {
    const o = makeOutput({
      newbie: false,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.error("boom");
    expect(out.chunks).toEqual([]);
    expect(err.joined()).toBe("boom\n");
  });

  it("explain / reference / nextStep are NO-OPs (zero writes) in non-newbie mode", () => {
    const o = makeOutput({
      newbie: false,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.explain("why this matters");
    o.reference("EIP-20", "https://eips.ethereum.org/EIPS/eip-20");
    o.nextStep("compile your contract");
    expect(out.chunks).toEqual([]);
    expect(err.chunks).toEqual([]);
  });
});

describe("makeOutput — newbie mode (newbie=true, json=false)", () => {
  it("explain writes to stdout", () => {
    const o = makeOutput({
      newbie: true,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.explain("why this matters");
    expect(out.joined()).toBe("why this matters\n");
    expect(err.chunks).toEqual([]);
  });

  it("reference writes to stdout with label and url", () => {
    const o = makeOutput({
      newbie: true,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.reference("EIP-20", "https://eips.ethereum.org/EIPS/eip-20");
    expect(out.joined()).toContain("EIP-20");
    expect(out.joined()).toContain("https://eips.ethereum.org/EIPS/eip-20");
    expect(out.joined()).toContain("see:");
  });

  it("nextStep writes to stdout", () => {
    const o = makeOutput({
      newbie: true,
      json: false,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.nextStep("compile your contract");
    expect(out.joined()).toContain("compile your contract");
    expect(out.joined()).toContain("next:");
  });
});

describe("makeOutput — json mode silences newbie channels", () => {
  it("newbie=true, json=true: explain/reference/nextStep are NO-OPs", () => {
    const o = makeOutput({
      newbie: true,
      json: true,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.explain("why");
    o.reference("EIP-20", "https://example.com");
    o.nextStep("compile");
    expect(out.chunks).toEqual([]);
    expect(err.chunks).toEqual([]);
  });

  it("newbie=false, json=true: same — newbie channels still silent", () => {
    const o = makeOutput({
      newbie: false,
      json: true,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.explain("why");
    o.reference("EIP-20", "https://example.com");
    o.nextStep("compile");
    expect(out.chunks).toEqual([]);
    expect(err.chunks).toEqual([]);
  });

  it("result still works in json mode (byte-passthrough)", () => {
    const o = makeOutput({
      newbie: false,
      json: true,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.result('{"ok":true}');
    expect(out.joined()).toBe('{"ok":true}\n');
  });

  it("warn and error still go to stderr in json mode", () => {
    const o = makeOutput({
      newbie: false,
      json: true,
      color,
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    o.warn("a warning");
    o.error("an error");
    expect(out.chunks).toEqual([]);
    expect(err.joined()).toContain("a warning");
    expect(err.joined()).toContain("an error");
  });
});
