import type { DeployMeta } from "../../types.js";

/** Reads a generated-source constant value (decimals/symbol/supply) from the
 *  SPL meta's constructorArgs, with a fallback. */
export function argVal(meta: DeployMeta, name: string, fallback: string): string {
  return meta.constructorArgs.find((a) => a.name === name)?.exampleValue ?? fallback;
}
