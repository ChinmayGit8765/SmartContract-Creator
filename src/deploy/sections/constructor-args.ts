// Constructor Arguments reference (D-04 section 8). A table of each arg's
// name/type/exampleValue, or a no-arg note.

import type { DeployMeta } from "../types.js";

export function constructorArgsSection(meta: DeployMeta): string {
  const lines: string[] = ["## Constructor Arguments", ""];
  if (meta.constructorArgs.length === 0) {
    lines.push("This contract has a no-argument constructor.");
    return lines.join("\n");
  }
  lines.push(
    "| # | Name | Type | Example value |",
    "| - | ---- | ---- | ------------- |",
  );
  meta.constructorArgs.forEach((a, i) => {
    lines.push(`| ${i + 1} | \`${a.name}\` | \`${a.type}\` | \`${a.exampleValue}\` |`);
  });
  lines.push(
    "",
    "Replace each `<YOUR_WALLET_ADDRESS>` placeholder with the real address before deploying. These values are baked in at deploy time and cannot be changed without redeploying.",
  );
  return lines.join("\n");
}
