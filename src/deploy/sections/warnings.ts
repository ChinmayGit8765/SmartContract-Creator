// Centralization-warnings section (DEPLOY-06). Renders meta.warnings (the
// single-source set computed in deployMeta via centralizationWarnings — do NOT
// recompute here). Critical first, then info.

import type { DeployMeta } from "../types.js";

export function warningsSection(meta: DeployMeta): string {
  const lines: string[] = ["## ⚠ Centralization Warnings", ""];
  if (meta.warnings.length === 0) {
    lines.push("No centralization warnings for this option combination.");
    return lines.join("\n");
  }
  const critical = meta.warnings.filter((w) => w.severity === "critical");
  const info = meta.warnings.filter((w) => w.severity === "info");
  for (const w of [...critical, ...info]) {
    const tag = w.severity === "critical" ? "**CRITICAL**" : "_info_";
    lines.push(`### ${w.title} (${tag})`, "", w.body, "");
  }
  return lines.join("\n").trimEnd();
}
