// Where official textbooks may be fetched from, and how a source is checked. No server-only imports:
// scripts/sync-textbook-catalog.ts uses this too.
import { createHash } from "node:crypto";

// Official publishers, plus one mirror: the Oromia Education Bureau's site (grades 1–8), the Ministry
// of Education's e-learning portals (grades 7–12), and Google Drive, which serves the Ministry's 2023
// grade 9–12 textbooks from a university library's copy (the portal does not answer outside Ethiopia).
// Every download must still be a PDF. TEXTBOOK_SOURCE_HOSTS replaces the list.
const DEFAULT_SOURCE_HOSTS = ["213.55.101.25", "elearn.moe.gov.et", "learn-english.moe.gov.et", "drive.usercontent.google.com"];

/** Catalog entries uploaded by a platform administrator are stored by Forma and use this scheme. */
export const UPLOADED_SOURCE_PREFIX = "upload:";

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

/** The storage key of a catalog file uploaded to Forma, else null. */
export function uploadedSourceKey(value: string) {
  const key = value.startsWith(UPLOADED_SOURCE_PREFIX) ? value.slice(UPLOADED_SOURCE_PREFIX.length) : "";
  return /^[0-9a-f-]{36}$/i.test(key) ? key : null;
}

/** Whether a school can copy this entry into its library with one click. */
export function canDownloadSource(entry: { sourceUrl: string; directDownload: boolean }) {
  return Boolean(uploadedSourceKey(entry.sourceUrl)) || (entry.directDownload && Boolean(allowedSourceUrl(entry.sourceUrl)));
}

export function sourceUrlHash(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

export type SourceCheck = { status: "ok" | "missing" | "unreachable"; sizeBytes: number | null };

/**
 * Asks the source for the file's first bytes only (some hosts refuse HEAD) and reads the full size
 * from the reply. Nothing more is downloaded.
 */
export async function checkTextbookSource(url: string): Promise<SourceCheck> {
  try {
    const response = await fetch(url, { headers: { Range: "bytes=0-4" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return { status: "missing", sizeBytes: null };
    const head = Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString("latin1");
    if (head !== "%PDF-") return { status: "missing", sizeBytes: null };
    const total = Number(response.headers.get("content-range")?.split("/")[1] ?? response.headers.get("content-length"));
    return { status: "ok", sizeBytes: Number.isSafeInteger(total) && total > 5 ? total : null };
  } catch {
    return { status: "unreachable", sizeBytes: null };
  }
}
