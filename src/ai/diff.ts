// Phase 8 — a small line-level diff for the add-feature preview (AI-04).
// LCS-based; no external dependency. Pure functions.

import type { Colors } from "../lib/color.js";

export interface DiffLine {
  readonly kind: " " | "-" | "+";
  readonly text: string;
}

/** Computes a line diff (old -> new) via a longest-common-subsequence table. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: " ", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "-", text: a[i]! });
      i++;
    } else {
      out.push({ kind: "+", text: b[j]! });
      j++;
    }
  }
  while (i < n) out.push({ kind: "-", text: a[i++]! });
  while (j < m) out.push({ kind: "+", text: b[j++]! });
  return out;
}

export interface DiffStat {
  readonly added: number;
  readonly removed: number;
}

export function diffStat(lines: DiffLine[]): DiffStat {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.kind === "+") added++;
    else if (l.kind === "-") removed++;
  }
  return { added, removed };
}

/** Renders a colored unified-style preview, collapsing long runs of unchanged
 *  context to keep the output readable (3 lines of context around each change). */
export function renderDiff(lines: DiffLine[], color: Colors, context = 3): string {
  // Mark which unchanged lines are near a change (kept as context).
  const keep = new Array<boolean>(lines.length).fill(false);
  for (let k = 0; k < lines.length; k++) {
    if (lines[k]!.kind !== " ") {
      for (let d = -context; d <= context; d++) {
        const idx = k + d;
        if (idx >= 0 && idx < lines.length) keep[idx] = true;
      }
    }
  }

  const rendered: string[] = [];
  let skipping = false;
  for (let k = 0; k < lines.length; k++) {
    const l = lines[k]!;
    if (l.kind === " " && !keep[k]) {
      if (!skipping) {
        rendered.push(color.dim("  ⋮"));
        skipping = true;
      }
      continue;
    }
    skipping = false;
    if (l.kind === "+") rendered.push(color.green(`+ ${l.text}`));
    else if (l.kind === "-") rendered.push(color.red(`- ${l.text}`));
    else rendered.push(color.dim(`  ${l.text}`));
  }
  return rendered.join("\n");
}
