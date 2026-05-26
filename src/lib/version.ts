import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/** Reads a dependency's version from its installed package.json.
 *  Returns null if the package is not installed (Phase 1 case for solc / @oz/contracts).
 *
 *  Tries two strategies because modern packages often use `exports` maps that
 *  hide `./package.json` (e.g. commander@14):
 *    1. Direct resolve of `<pkg>/package.json` (works for packages w/o exports
 *       restriction).
 *    2. Resolve the package entry, then walk up the filesystem looking for the
 *       nearest `package.json` whose `name` matches.
 */
export function safeReadVersion(pkgName: string): string | null {
  // Strategy 1: direct package.json subpath.
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    /* fall through */
  }
  // Strategy 2: resolve entry, walk up.
  try {
    const entry = require.resolve(pkgName);
    let dir = dirname(entry);
    for (let i = 0; i < 10; i++) {
      try {
        const candidate = join(dir, "package.json");
        const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
          name?: string;
          version?: string;
        };
        if (pkg.name === pkgName && pkg.version) return pkg.version;
      } catch {
        /* keep walking */
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* package not installed at all */
  }
  return null;
}

/** Reads OUR OWN version from the nearest package.json. */
function readOwnVersion(): string {
  // Walk up from this file to find our package.json (name === "smartc").
  // From src/lib/version.ts in dev, that's two levels up; from dist/cli.js in
  // prod, it's one level up. Try a few levels to be safe.
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 5; i++) {
    try {
      const candidate = join(dir, "package.json");
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === "smartc" && pkg.version) return pkg.version;
    } catch {
      /* keep walking */
    }
    dir = dirname(dir);
  }
  return "0.0.0";
}

/** Formats the --version line.
 *  Phase 1: "smartc 0.1.0 (solc not bundled, @openzeppelin/contracts not bundled)"
 *  Phase 2 (UI-16, D-08 override): adds a third "@openzeppelin/wizard <ver>" segment
 *  now that Plan 01 installed the package. The dual-strategy safeReadVersion (Phase 1)
 *  resolves the version with no further plumbing.
 *  Phase 3 will swap solc + @openzeppelin/contracts to real versions automatically.
 */
export function formatVersionLine(): string {
  const ownVer = readOwnVersion();
  const solc = safeReadVersion("solc");
  const oz = safeReadVersion("@openzeppelin/contracts");
  const wiz = safeReadVersion("@openzeppelin/wizard");
  const solcStr = solc ? `solc ${solc}` : "solc not bundled";
  const ozStr = oz ? `@openzeppelin/contracts ${oz}` : "@openzeppelin/contracts not bundled";
  const wizStr = wiz ? `@openzeppelin/wizard ${wiz}` : "@openzeppelin/wizard not bundled";
  return `smartc ${ownVer} (${solcStr}, ${ozStr}, ${wizStr})`;
}
