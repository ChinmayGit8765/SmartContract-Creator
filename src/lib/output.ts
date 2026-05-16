import type { Colors } from "./color.js";

export interface Output {
  /** Default-mode visible. Goes to stdout. */
  result(text: string): void;
  /** Always visible regardless of verbosity. Goes to stderr. Critical warnings. */
  warn(text: string): void;
  /** Always visible. Goes to stderr. For errors (CliError block, etc.). */
  error(text: string): void;
  /** Newbie-only: why-this-question-matters explanations. Goes to stdout. */
  explain(text: string): void;
  /** Newbie-only: docs / EIP / OpenZeppelin pointers. Goes to stdout. */
  reference(label: string, url: string): void;
  /** Newbie-only: post-action next-step guidance. Goes to stdout. */
  nextStep(text: string): void;
}

export interface MakeOutputOpts {
  newbie: boolean;
  json: boolean;
  color: Colors;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

/** Builds an Output. In json mode, explain/reference/nextStep are NO-OPs
 *  (machine consumers shouldn't get human prose interleaved); warn/error
 *  still go to stderr as plain text; result is the caller's responsibility
 *  to format as JSON before passing in (output.result is byte-passthrough).
 */
export function makeOutput(opts: MakeOutputOpts): Output {
  const out = opts.stdout ?? process.stdout;
  const err = opts.stderr ?? process.stderr;
  const c = opts.color;
  const writeOut = (s: string): void => {
    out.write(s.endsWith("\n") ? s : s + "\n");
  };
  const writeErr = (s: string): void => {
    err.write(s.endsWith("\n") ? s : s + "\n");
  };

  const noopOne = (_t: string): void => {
    /* json or non-newbie mode silences newbie channels */
  };
  const noopTwo = (_label: string, _url: string): void => {
    /* json or non-newbie mode silences newbie channels */
  };

  return {
    result: writeOut,
    warn: (t: string) => writeErr(`${c.yellow("warn:")} ${t}`),
    error: writeErr,
    explain: opts.newbie && !opts.json ? (t: string) => writeOut(c.dim(t)) : noopOne,
    reference:
      opts.newbie && !opts.json
        ? (label: string, url: string) =>
            writeOut(`  ${c.cyan("see:")} ${label} ${c.dim(`(${url})`)}`)
        : noopTwo,
    nextStep:
      opts.newbie && !opts.json
        ? (t: string) => writeOut(`  ${c.green("next:")} ${t}`)
        : noopOne,
  };
}
