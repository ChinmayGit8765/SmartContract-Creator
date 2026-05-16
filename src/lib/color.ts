import pc from "picocolors";

export interface Colors {
  red: (s: string) => string;
  yellow: (s: string) => string;
  cyan: (s: string) => string;
  green: (s: string) => string;
  dim: (s: string) => string;
  bold: (s: string) => string;
}

/** Returns a color API. If `noColorFlag` is true, all functions are identity.
 *  Otherwise respects picocolors' detection (which honors NO_COLOR, isatty, etc.).
 */
export function makeColor(noColorFlag: boolean): Colors {
  const enabled = !noColorFlag && pc.isColorSupported;
  const c = pc.createColors(enabled);
  return {
    red: (s: string) => c.red(s),
    yellow: (s: string) => c.yellow(s),
    cyan: (s: string) => c.cyan(s),
    green: (s: string) => c.green(s),
    dim: (s: string) => c.dim(s),
    bold: (s: string) => c.bold(s),
  };
}
