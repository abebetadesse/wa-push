// Where official textbooks may be fetched from, and how a source is checked. No server-only imports:
// scripts/sync-textbook-catalog.ts uses this too.
import { createHash } from "node:crypto";

// Official publishers only: the Oromia Education Bureau's site (grades 1–8) and the Ministry of
// Education's e-learning portal (grades 9–12). TEXTBOOK_SOURCE_HOSTS replaces the list.
const DEFAULT_SOURCE_HOSTS = ["213.55.101.25", "elearn.moe.gov.et"];

export function textbookSourceHosts() {
  const configured = process.env.TEXTBOOK_SOURCE_HOSTS?.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return configured?.length ? configured : DEFAULT_SOURCE_HOSTS;
}

/** The URL when it is http(s) on an allowed textbook host, else null. */
export function allowedSourceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return textbookSourceHosts().includes(url.hostname.toLowerCase()) ? url : null;
}

export function sourceUrlHash(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

export type SourceCheck = { status: "ok" | "missing" | "unreachable"; sizeBytes: number | null };

/** Asks the source for the file's headers only; nothing is downloaded. */
export async function checkTextbookSource(url: string): Promise<SourceCheck> {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return { status: "missing", sizeBytes: null };
    const length = Number(response.headers.get("content-length"));
    return { status: "ok", sizeBytes: Number.isSafeInteger(length) && length > 0 ? length : null };
  } catch {
    return { status: "unreachable", sizeBytes: null };
  }
}
