/** Import-callback factory for solc-js standard-JSON compilation.
 *
 *  Phase 3 Plan 01 (this file) ships the SKELETON: createRequire bridge,
 *  cache + ozRoot closure, type contract for the callback. The body
 *  returns `{ error: "Plan 02 not yet implemented" }` for every input
 *  so Plan 02 has a clean insertion point and tests fail loudly until
 *  the real resolver lands.
 *
 *  Pitfall 1 lock: the returned callback is SYNCHRONOUS (returns
 *  `{ contents } | { error }`, never a Promise). solc-js's import
 *  callback contract is sync — async return values break silently.
 *
 *  Pitfall 3 lock: the resolver uses
 *  `require.resolve("@openzeppelin/contracts/package.json")` (Phase 1's
 *  proven dual-strategy pattern from src/lib/version.ts:18-50) so OZ
 *  resolves from smartc's install root regardless of user cwd.
 *
 *  CONTEXT D-05 lock: cache is per-CALL, not module-level. New
 *  `compileVerify(...)` call → new `makeImportCallback()` invocation →
 *  new cache. No cross-call leakage in tests.
 *
 *  Plan 02 fills the body per the TODO insertion point below; see
 *  03-PATTERNS.md §src/compiler/imports.ts lines 79-133 + RESEARCH
 *  §Pattern 2 lines 274-325 for the full resolver + traversal-guard.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const require = createRequire(import.meta.url);

export function makeImportCallback(): (path: string) => { contents: string } | { error: string } {
  // Resolved once per compile call — the OZ package root won't change mid-call.
  let ozRoot: string | null = null;
  const cache = new Map<string, { contents: string }>();

  // Suppress unused-symbol noise while the skeleton stands; Plan 02 wires these.
  void ozRoot;
  void cache;
  void readFileSync;
  void dirname;
  void join;
  void normalize;
  void require;

  return function importCallback(_path: string): { contents: string } | { error: string } {
    // TODO(03-02): Replace this skeleton body with the full resolver.
    //   1. Cache hit? return it.
    //   2. _path.startsWith("@openzeppelin/contracts/") ?
    //        a. Resolve ozRoot via require.resolve("@openzeppelin/contracts/package.json")
    //           on first call; cache to local `ozRoot` (CONTEXT D-04 + D-05).
    //        b. fullPath = normalize(join(ozRoot, subpath));
    //           if (!fullPath.startsWith(normalize(ozRoot))) → return
    //           { error: "Path traversal blocked: <path>" }; (T-03-03 mitigation).
    //        c. readFileSync(fullPath, "utf8") → cache → return { contents }.
    //   3. Unknown prefix → return { error: "Unknown import: <path>" }.
    // See 03-PATTERNS.md §src/compiler/imports.ts lines 79-133 for the full pattern.
    return { error: "Plan 02 not yet implemented" };
  };
}
