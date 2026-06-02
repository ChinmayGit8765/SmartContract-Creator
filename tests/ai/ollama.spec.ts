import { describe, it, expect, vi } from "vitest";
import {
  resolveOllamaHost,
  resolveOllamaModel,
  isOllamaReachable,
  generateCompletion,
  DEFAULT_OLLAMA_MODEL,
} from "../../src/ai/ollama.js";

function fakeResponse(init: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    json: async () => init.json ?? {},
    text: async () => init.text ?? "",
  } as unknown as Response;
}

describe("resolveOllamaHost", () => {
  it("defaults to 127.0.0.1:11434 with scheme", () => {
    expect(resolveOllamaHost({})).toBe("http://127.0.0.1:11434");
  });
  it("honors SMARTC_OLLAMA_HOST over OLLAMA_HOST and adds scheme", () => {
    expect(resolveOllamaHost({ SMARTC_OLLAMA_HOST: "1.2.3.4:9999", OLLAMA_HOST: "x" })).toBe(
      "http://1.2.3.4:9999",
    );
  });
  it("keeps an explicit scheme and trims trailing slashes", () => {
    expect(resolveOllamaHost({ OLLAMA_HOST: "https://h:443/" })).toBe("https://h:443");
  });
});

describe("resolveOllamaModel", () => {
  it("flag > env > default", () => {
    expect(resolveOllamaModel("codellama", {})).toBe("codellama");
    expect(resolveOllamaModel(undefined, { SMARTC_OLLAMA_MODEL: "llama3.1" })).toBe("llama3.1");
    expect(resolveOllamaModel(undefined, {})).toBe(DEFAULT_OLLAMA_MODEL);
  });
});

describe("isOllamaReachable", () => {
  it("true when /api/tags answers ok", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ ok: true }));
    expect(await isOllamaReachable({ host: "http://h", fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(true);
  });
  it("false when fetch rejects (daemon down)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await isOllamaReachable({ host: "http://h", fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(false);
  });
});

describe("generateCompletion", () => {
  it("returns the model response text", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ ok: true, json: { response: "  hello  " } }));
    const out = await generateCompletion({
      host: "http://h",
      model: "m",
      prompt: "p",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toBe("hello");
  });

  it("throws E_AI_UNREACHABLE on network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      generateCompletion({ host: "http://h", model: "m", prompt: "p", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: "E_AI_UNREACHABLE" });
  });

  it("throws E_AI_UNREACHABLE with a pull hint on 404 (model missing)", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ ok: false, status: 404, text: "model not found" }));
    await expect(
      generateCompletion({ host: "http://h", model: "ghost", prompt: "p", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: "E_AI_UNREACHABLE", fix: expect.stringContaining("ollama pull ghost") });
  });

  it("throws E_AI_EMPTY when the model returns nothing", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ ok: true, json: { response: "   " } }));
    await expect(
      generateCompletion({ host: "http://h", model: "m", prompt: "p", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: "E_AI_EMPTY" });
  });
});
