import type { Template } from "./types.js";

// Insertion-order Map gives deterministic list() output.
const store = new Map<string, Template>();

/** Registers a template. Throws if id is already registered (no silent overwrites). */
export function register(tpl: Template): void {
  if (store.has(tpl.id)) {
    throw new Error(`Template id already registered: ${tpl.id}`);
  }
  store.set(tpl.id, tpl);
}

/** Returns all templates in registration order. */
export function list(): Template[] {
  return [...store.values()];
}

/** Returns a template by id, or undefined. */
export function get(id: string): Template | undefined {
  return store.get(id);
}

/** Clears the registry. For test isolation ONLY — production code never calls this. */
export function clear(): void {
  store.clear();
}
