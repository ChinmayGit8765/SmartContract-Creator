// Phase 8 — prompt construction + response extraction for the AI patch flow.

export type SourceChain = "evm" | "solana";

/** Builds the instruction prompt: the model must return the COMPLETE updated
 *  source file and nothing else. We keep it strict so the output is directly
 *  compilable (the sandbox-compile gate is the real safety net — AI-03). */
export function buildPatchPrompt(args: {
  source: string;
  description: string;
  chain: SourceChain;
}): string {
  const lang = args.chain === "evm" ? "Solidity" : "Rust (Anchor / Solana)";
  return [
    `You are editing a ${lang} smart contract source file.`,
    "",
    "Apply ONLY the change requested below. Preserve everything else exactly —",
    "imports, pragma/version, license header, formatting, and unrelated code.",
    "Keep the result compilable. Do not add explanations.",
    "",
    "Return the COMPLETE updated file as a single code block, and nothing else.",
    "",
    `Requested change: ${args.description}`,
    "",
    "Current file:",
    "```",
    args.source,
    "```",
  ].join("\n");
}

/** Extracts source from a model response. If the response contains a fenced code
 *  block, return its contents (the first block); otherwise return the trimmed
 *  text as-is. Strips a leading language tag (```solidity / ```rust). */
export function extractSource(response: string): string {
  const fence = response.match(/```[^\n]*\n([\s\S]*?)```/);
  if (fence && fence[1] !== undefined) return fence[1].replace(/\s+$/, "") + "\n";
  return response.trim() + "\n";
}
