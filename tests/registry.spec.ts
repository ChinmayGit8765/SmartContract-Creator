import { beforeEach, describe, expect, it } from "vitest";
import { clear, get, list, register } from "../src/registry/index.js";
import { registerStubTemplates } from "../src/registry/stub.js";
import type { Template } from "../src/registry/types.js";

const tplA: Template = {
  id: "a",
  name: "Template A",
  chain: "evm",
  status: "alpha",
  description: "A",
};

const tplB: Template = {
  id: "b",
  name: "Template B",
  chain: "solana",
  status: "stable",
  description: "B",
};

const tplC: Template = {
  id: "c",
  name: "Template C",
  chain: "any",
  status: "stub",
  description: "C",
};

describe("registry", () => {
  beforeEach(() => {
    clear();
  });

  it("returns empty list and undefined get on an empty registry", () => {
    expect(list()).toEqual([]);
    expect(get("anything")).toBeUndefined();
  });

  it("retrieves a registered template by id", () => {
    register(tplA);
    expect(list()).toHaveLength(1);
    expect(get("a")).toEqual(tplA);
  });

  it("preserves insertion order in list()", () => {
    register(tplA);
    register(tplB);
    register(tplC);
    expect(list()).toEqual([tplA, tplB, tplC]);
  });

  it("throws when registering a duplicate id", () => {
    register(tplA);
    expect(() => register(tplA)).toThrowError(/a/);
  });

  it("locks the five required data keys and forbids new data fields", () => {
    register(tplA);
    const tpl = list()[0]!;
    const required = ["chain", "description", "id", "name", "status"] as const;
    for (const k of required) {
      expect(Object.keys(tpl)).toContain(k);
    }
    const extras = Object.keys(tpl).filter(
      (k) => !required.includes(k as typeof required[number]),
    );
    for (const extra of extras) {
      expect(typeof (tpl as Record<string, unknown>)[extra]).toBe("function");
    }
  });

  it("registers the foundation-smoke stub canary with correct shape", () => {
    registerStubTemplates();
    const canary = get("foundation-smoke");
    expect(canary).toBeDefined();
    expect(canary!.status).toBe("stub");
    expect(canary!.chain).toBe("any");
  });

  it("is idempotent when registerStubTemplates() is called twice", () => {
    registerStubTemplates();
    expect(() => registerStubTemplates()).not.toThrow();
    expect(list()).toHaveLength(1);
  });
});
