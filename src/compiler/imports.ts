/** Import-callback factory for solc-js standard-JSON compilation.
 *
 *  Resolver: Strategy 1 dual-pattern inherited from src/lib/version.ts:1-50.
 *    `require.resolve("@openzeppelin/contracts/package.json")` returns smartc's
 *    install-root copy of OZ regardless of user cwd (Pitfall 3 lock — proven
 *    by scripts/probe-compile.mjs).
 *
 *  Pitfall 1 lock: the returned callback is SYNCHRONOUS (returns
 *  `{ contents } | { error }`, never a Promise). solc-js's import-callback
 *  contract is sync; an async return value breaks silently.
 *
 *  CONTEXT D-05 lock: the cache is per-CALL, NOT module-level. Each
 *  `makeImportCallback()` invocation creates a fresh `Map` + fresh `ozRoot`
 *  — no cross-call leakage in tests, no stale state across compileVerify
 *  invocations.
 *
 *  T-03-03 mitigation: every resolved path is `normalize`d and prefix-checked
 *  against `normalize(ozRoot) + path.sep`. Adversarial inputs like
 *  `@openzeppelin/contracts/../../etc/passwd` resolve to a path outside
 *  ozRoot and are refused with a `"Path traversal blocked"` error string.
 *  The + sep guard means `/tmp/oz-root` does NOT match `/tmp/oz-rootEXTRA`.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";

const require = createRequire(import.meta.url);

const OZ_PREFIX = "@openzeppelin/contracts/";

export function makeImportCallback(): (
  path: string,
) => { contents: string } | { error: string } {
  // Resolved lazily on first OZ hit; ozRoot won't change mid-call.
  let ozRoot: string | null = null;
  const cache = new Map<string, { contents: string }>();

  function resolveOzRoot(): string {
    if (ozRoot !== null) return ozRoot;
    try {
      const pjPath = require.resolve("@openzeppelin/contracts/package.json");
      ozRoot = dirname(pjPath);
      return ozRoot;
    } catch (err) {
      throw new Error(
        `@openzeppelin/contracts not installed (${(err as Error).message})`,
      );
    }
  }

  return function importCallback(
    path: string,
  ): { contents: string } | { error: string } {
    // Cache lookup first — preserves reference-equality for repeat imports
    // within a single compileVerify call (locked by the "caches" unit test).
    const cached = cache.get(path);
    if (cached !== undefined) return cached;

    if (!path.startsWith(OZ_PREFIX)) {
      return { error: `Unknown import: ${path}` };
    }

    let root: string;
    try {
      root = resolveOzRoot();
    } catch (err) {
      return { error: (err as Error).message };
    }

    const sub = path.slice(OZ_PREFIX.length);
    const normRoot = normalize(root);
    const fullPath = normalize(join(root, sub));

    // Path-traversal guard (T-03-03). Append the OS separator before prefix
    // check so e.g. `/tmp/oz-root` does NOT prefix-match `/tmp/oz-rootEXTRA`.
    if (fullPath !== normRoot && !fullPath.startsWith(normRoot + sep)) {
      return { error: `Path traversal blocked: ${path}` };
    }

    try {
      const contents = readFileSync(fullPath, "utf8");
      const entry = { contents };
      cache.set(path, entry);
      return entry;
    } catch (err) {
      return {
        error: `Could not read ${path}: ${(err as Error).message}`,
      };
    }
  };
}
