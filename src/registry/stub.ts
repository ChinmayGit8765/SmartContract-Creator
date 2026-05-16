import { register, get } from "./index.js";
import type { Template } from "./types.js";

const FOUNDATION_SMOKE: Template = {
  id: "foundation-smoke",
  name: "Foundation Smoke Test (stub)",
  chain: "any",
  status: "stub",
  description: "Phase 1 canary entry — exercises registry, list-templates table, and JSON output. Not generatable.",
};

/** Registers the Phase 1 canary template.
 *  Idempotent: safe to call multiple times (no-op if already registered).
 *  This guard lets tests import the module repeatedly.
 */
export function registerStubTemplates(): void {
  if (!get(FOUNDATION_SMOKE.id)) {
    register(FOUNDATION_SMOKE);
  }
}
