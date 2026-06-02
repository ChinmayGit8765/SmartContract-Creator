// Name derivation for the SPL template. Solana/Rust convention is snake_case for
// the program module + crate name, so the output file is `<snake>.rs` (Anchor
// programs live at programs/<name>/src/lib.rs). Pure functions — never throw.

/** Derives a snake_case Rust identifier from any user-supplied token name.
 *  "My Token" -> "my_token"; "3Cool" -> "cool" (leading digits stripped);
 *  symbol-only / empty -> "spl_token". */
export function toSnakeProgramName(name: string): string {
  const parts = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  let base = parts.join("_");
  base = base.replace(/^[0-9_]+/, "");
  if (!base) base = "spl_token";
  return base;
}

/** `<snake>.rs` — the user-facing output filename. */
export function splFilename(name: string): string {
  return `${toSnakeProgramName(name)}.rs`;
}
