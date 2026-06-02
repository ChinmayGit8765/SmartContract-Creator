// Phase 8 — local Ollama HTTP client (AI-02 / AI-05 / AI-06).
//
// Talks to a local Ollama daemon over HTTP. No cloud, no API keys (PROJECT
// constraint). `fetchImpl` is injectable so the client is unit-testable without
// a running daemon. Network failures collapse to CliError(E_AI_UNREACHABLE) with
// a pointer to `smartc doctor` + the Ollama install docs (graceful — AI-05).

import { CliError, ERR_AI_UNREACHABLE, ERR_AI_EMPTY } from "../lib/errors.js";

/** Documented default model (AI-06). Override with --model or SMARTC_OLLAMA_MODEL.
 *  qwen2.5-coder is a strong, widely-available open code model; pull it with
 *  `ollama pull qwen2.5-coder`. */
export const DEFAULT_OLLAMA_MODEL = "qwen2.5-coder";

type FetchImpl = typeof fetch;

/** Resolve the Ollama base URL. Honors SMARTC_OLLAMA_HOST then OLLAMA_HOST
 *  (Ollama's own env var); defaults to 127.0.0.1:11434. Adds http:// if the
 *  value has no scheme. */
export function resolveOllamaHost(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.SMARTC_OLLAMA_HOST || env.OLLAMA_HOST || "127.0.0.1:11434").trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/** Resolve the model: flag > SMARTC_OLLAMA_MODEL env > documented default. */
export function resolveOllamaModel(
  flag: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (flag && flag.trim()) return flag.trim();
  const fromEnv = env.SMARTC_OLLAMA_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_OLLAMA_MODEL;
}

export interface OllamaClientOpts {
  host?: string;
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
}

function withTimeout(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

/** GET /api/tags — true when the daemon answers, false on any error. Never throws. */
export async function isOllamaReachable(opts: OllamaClientOpts = {}): Promise<boolean> {
  const host = opts.host ?? resolveOllamaHost();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const { signal, cancel } = withTimeout(opts.timeoutMs ?? 3000);
  try {
    const res = await fetchImpl(`${host}/api/tags`, { signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    cancel();
  }
}

/** The canonical "Ollama is down" error (AI-05) — points at doctor + install. */
export function ollamaUnreachableError(host: string, detail = "not responding"): CliError {
  return new CliError({
    code: ERR_AI_UNREACHABLE,
    what: `Could not reach the Ollama daemon at ${host}.`,
    why: `The local AI provider is unavailable (${detail}). add-feature needs a running Ollama daemon — no cloud API is used.`,
    fix: "Run 'smartc doctor' to check Ollama, start it with 'ollama serve', or install it from https://ollama.com. Override the host with SMARTC_OLLAMA_HOST.",
    exitCode: 1,
  });
}

const unreachable = ollamaUnreachableError;

export interface GenerateArgs extends OllamaClientOpts {
  model: string;
  prompt: string;
}

/** POST /api/generate (stream:false). Returns the model's completion text.
 *  Throws E_AI_UNREACHABLE on network failure / non-OK status, E_AI_EMPTY when
 *  the model returns nothing. */
export async function generateCompletion(args: GenerateArgs): Promise<string> {
  const host = args.host ?? resolveOllamaHost();
  const fetchImpl = args.fetchImpl ?? fetch;
  const { signal, cancel } = withTimeout(args.timeoutMs ?? 120_000);
  let res: Response;
  try {
    res = await fetchImpl(`${host}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: args.model, prompt: args.prompt, stream: false }),
      signal,
    });
  } catch (err) {
    throw unreachable(host, err instanceof Error ? err.message : "network error");
  } finally {
    cancel();
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new CliError({
        code: ERR_AI_UNREACHABLE,
        what: `Ollama model '${args.model}' is not available.`,
        why: `The daemon responded 404 (${body.slice(0, 200)}). The model isn't pulled.`,
        fix: `Pull it with 'ollama pull ${args.model}', or pick another with --model <name>.`,
        exitCode: 1,
      });
    }
    throw unreachable(host, `HTTP ${res.status}`);
  }

  const data = (await res.json().catch(() => ({}))) as { response?: string };
  const text = (data.response ?? "").trim();
  if (!text) {
    throw new CliError({
      code: ERR_AI_EMPTY,
      what: "The AI model returned an empty response.",
      why: "Ollama answered but produced no content for this prompt.",
      fix: "Try again, rephrase the feature description, or use a different --model.",
      exitCode: 1,
    });
  }
  return text;
}
