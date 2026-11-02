import "server-only";
import { readFileSync, statSync } from "node:fs";

// The registration rules the super administrator sets in the portal (a small JSON file shared by the
// combined deployment). Without it, which is the case when this app runs on its own, people may not
// register themselves: accounts come from school administrators.
let cached: { mtime: number; selfRegistration: boolean } | null = null;

export function selfRegistrationOpen(): boolean {
  const file = process.env.PORTAL_POLICY_FILE;
  if (!file) return false;
  try {
    const mtime = statSync(file).mtimeMs;
    if (cached?.mtime === mtime) return cached.selfRegistration;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { selfRegistration?: unknown };
    cached = { mtime, selfRegistration: parsed.selfRegistration !== false };
    return cached.selfRegistration;
  } catch {
    // No policy file yet: the combined deployment's default is open, approval required.
    return true;
  }
}
