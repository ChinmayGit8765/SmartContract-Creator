# AI add-feature (local Ollama)

Backs `smartc add-feature --ai --file X.sol "<description>"` (Phase 8): patch a
feature into an existing generated contract using a **local** Ollama model. No
cloud, no API keys (PROJECT constraint).

## Public surface

| Export | File | Purpose |
|--------|------|---------|
| `isOllamaReachable(opts)` | `ollama.ts` | GET `/api/tags`; never throws (false on any error). |
| `generateCompletion({model, prompt, ...})` | `ollama.ts` | POST `/api/generate` (stream:false); returns the completion or throws `E_AI_UNREACHABLE`/`E_AI_EMPTY`. |
| `resolveOllamaHost(env)` / `resolveOllamaModel(flag, env)` | `ollama.ts` | Host/model resolution (env + default). |
| `DEFAULT_OLLAMA_MODEL` | `ollama.ts` | Documented default (`qwen2.5-coder`). |
| `buildPatchPrompt({source, description, chain})` | `prompt.ts` | The instruction prompt (return the COMPLETE updated file). |
| `extractSource(response)` | `prompt.ts` | Pulls source out of a fenced code block. |
| `diffLines` / `diffStat` / `renderDiff` | `diff.ts` | LCS line diff + colored preview (no external dep). |

## Flow (AI-01..06)

1. Read the target file; infer chain from extension (`.sol`→evm, `.rs`→solana).
2. **AI-05** — `isOllamaReachable`; if down, throw `E_AI_UNREACHABLE` pointing at
   `smartc doctor` + https://ollama.com.
3. **AI-02/06** — `generateCompletion` against the local daemon with the resolved
   model (`--model` > `SMARTC_OLLAMA_MODEL` > default).
4. **AI-04** — render a diff preview and ask for confirmation (`--force` skips).
5. **AI-03** — `compileVerify` the AI output in-process BEFORE writing. On compile
   failure the file is left untouched (rolled back) and the diagnostics surface.
   For Solana without Anchor, verification is skipped (consistent with SPL-05) and
   the change is applied with a warning.
6. Write the new content in place.

## Configuration

| Setting | Source | Default |
|---------|--------|---------|
| Model | `--model` flag → `SMARTC_OLLAMA_MODEL` env | `qwen2.5-coder` |
| Host | `SMARTC_OLLAMA_HOST` → `OLLAMA_HOST` env | `http://127.0.0.1:11434` |

Pull the default model with `ollama pull qwen2.5-coder`. Any chat/instruct model
works — code-tuned models (qwen2.5-coder, codellama, deepseek-coder) do best.

## Design notes

- `fetchImpl` is injectable on the client functions, so the HTTP layer is
  unit-tested without a running daemon.
- The sandbox-compile gate is the real safety net — the model is told to return a
  compilable full file, but `compileVerify` is what guarantees nothing
  un-compilable is written.
- AI output is a **suggestion, not an audit**: the command's closing next-step
  reminds the user to review + test before deploying.
