import { beforeEach, describe, expect, it } from "vitest";
import { clear, get, list, register } from "../src/registry/index.js";
import { registerStubTemplates } from "../src/registry/stub.js";
import { registerErc20Template } from "../src/templates/erc20/index.js";
import { registerErc721Template } from "../src/templates/erc721/index.js";
import { registerErc1155Template } from "../src/templates/erc1155/index.js";
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

  it("registers the ERC-20 template with id='erc20', status='alpha', and runWizard/generate as functions", () => {
    registerErc20Template();
    expect(list()).toHaveLength(1);
    const tpl = list()[0]!;
    expect(tpl.id).toBe("erc20");
    expect(tpl.status).toBe("alpha");
    expect(typeof (tpl as Record<string, unknown>).runWizard).toBe("function");
    expect(typeof (tpl as Record<string, unknown>).generate).toBe("function");
  });

  // CONTEXT D-15: the registry throws on duplicate id, so registering all three
  // Phase 4 EVM templates sequentially asserts the no-collision contract.
  it("registers all three Phase 4 templates without collision and exposes runWizard/generate", () => {
    registerErc20Template();
    registerErc721Template();
    registerErc1155Template();
    expect(list()).toHaveLength(3);
    for (const id of ["erc20", "erc721", "erc1155"]) {
      const tpl = get(id)!;
      expect(tpl.id).toBe(id);
      expect(tpl.chain).toBe("evm");
      expect(typeof (tpl as Record<string, unknown>).runWizard).toBe("function");
      expect(typeof (tpl as Record<string, unknown>).generate).toBe("function");
    }
  });

  it("is idempotent when registerErc721Template() is called twice", () => {
    registerErc721Template();
    expect(() => registerErc721Template()).not.toThrow();
    expect(list()).toHaveLength(1);
  });
});
