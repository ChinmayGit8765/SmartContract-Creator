/** Returns true for "1", "true", "yes", "on" (case-insensitive). */
export function parseBoolEnv(v: string | undefined | null): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Resolves the effective "newbie" mode.
 *  Flag wins over env. Env wins over absent flag.
 *  - newbieFlag === true   -> true (flag wins)
 *  - newbieFlag === false  -> false (explicit negation wins over env)
 *  - newbieFlag undefined  -> parseBoolEnv(env.SMARTC_NEWBIE)
 */
export function resolveNewbie(opts: {
  newbieFlag?: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = opts.env ?? process.env;
  if (opts.newbieFlag === true) return true;
  if (opts.newbieFlag === false) return false; // explicit false from commander
  return parseBoolEnv(env.SMARTC_NEWBIE);
}
