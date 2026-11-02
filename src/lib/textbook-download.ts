import "server-only";
import { randomUUID } from "node:crypto";
import { copyFile, link, mkdir, open, rename, stat, statfs, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { UserError } from "@/lib/action-result";
import { resourceStorageDirectory, resourceStoragePath } from "@/lib/learning-resources";
import { allowedSourceUrl, uploadedSourceKey } from "@/lib/textbook-sources";

const MAX_REDIRECTS = 3;

/**
 * Catalog downloads stream to disk on the server, so they may be larger than an upload from a
 * browser; some 2023 grade 11–12 textbooks are 120–175 MB.
 */
export const MAX_TEXTBOOK_BYTES = 250 * 1024 * 1024;

/** New downloads stop when the disk has less free space than this, so the apps keep room to run. */
const MIN_FREE_BYTES = 1024 * 1024 * 1024;

/**
 * Where catalog files are kept (beside the schools' folders): platform administrators' uploads,
 * and one shared copy of each downloaded book, named by its catalog entry id.
 */
export const CATALOG_STORAGE_ID = "textbook-catalog";

export function catalogUploadPath(storageKey: string) {
  return resourceStoragePath(CATALOG_STORAGE_ID, storageKey);
}

const STORAGE_FULL = "The server's storage is full, so no more textbooks can be downloaded. Ask the platform administrator to free space.";

function isStorageFull(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "ENOSPC" || code === "EDQUOT";
}

async function requireFreeSpace(directory: string, needed: number) {
  try {
    const space = await statfs(directory);
    if (space.bavail * space.bsize < needed + MIN_FREE_BYTES) throw new UserError(STORAGE_FULL);
  } catch (error) {
    if (error instanceof UserError) throw error;
    // statfs is unavailable on some systems; the write itself still fails cleanly when space runs out.
  }
}

/**
 * Gives a school its copy of a catalog book at `filePath` and returns the size. Each book is
 * stored once on the server: the shared copy is downloaded (or uploaded) the first time, and every
 * school's copy is a hard link to it, which takes no extra space. Where links are not possible the
 * file is copied.
 */
export async function provideCatalogFile(entry: { id: string; sourceUrl: string }, filePath: string) {
  const uploadedKey = uploadedSourceKey(entry.sourceUrl);
  const shared = catalogUploadPath(uploadedKey ?? entry.id);
  if (!uploadedKey) {
    const existing = await stat(shared).catch(() => null);
    if (!existing?.size) {
      await mkdir(resourceStorageDirectory(CATALOG_STORAGE_ID), { recursive: true, mode: 0o700 });
      // Downloaded under a temporary name and renamed when complete, so a half-finished download
      // is never shared.
      const partial = catalogUploadPath(randomUUID());
      await downloadTextbook(entry.sourceUrl, partial);
      await rename(partial, shared);
    }
  }
  try {
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    await link(shared, filePath).catch(async (error: unknown) => {
      if ((error as { code?: string }).code === "ENOENT") throw error;
      await requireFreeSpace(dirname(filePath), (await stat(shared)).size);
      await copyFile(shared, filePath);
    });
  } catch (error) {
    if (error instanceof UserError) throw error;
    if (isStorageFull(error)) throw new UserError(STORAGE_FULL);
    if ((error as { code?: string }).code === "ENOENT") throw new UserError("The stored copy of this textbook is missing. Ask the platform administrator to upload it again.");
    throw error;
  }
  return (await stat(filePath)).size;
}

/**
 * Downloads an official textbook PDF to `filePath` and returns its size. Every hop, redirects
 * included, must stay on an allowed textbook host; the file must start like a PDF and fit the
 * catalog size limit. A failed download leaves no file behind.
 */
export async function downloadTextbook(sourceUrl: string, filePath: string) {
  let url = allowedSourceUrl(sourceUrl);
  if (!url) throw new UserError("This textbook's source isn't one of the official hosts Forma downloads from.");

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Response | undefined;
    // Google Drive drops some connections when several books are fetched in a row: retry those.
    for (let attempt = 1; !response; attempt += 1) {
      try {
        response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15 * 60_000) });
      } catch {
        if (attempt >= 3) throw new UserError(`${url.hostname} could not be reached. Try again later, or open the source and upload the file.`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
      }
    }

    if (response.status >= 300 && response.status < 400) {
      const next = allowedSourceUrl(new URL(response.headers.get("location") ?? "", url).href);
      if (!next) throw new UserError("The source redirected to a site Forma doesn't download from.");
      url = next;
      continue;
    }
    if (!response.ok || !response.body) {
      throw new UserError(`The source answered ${response.status}; the textbook may have moved.`);
    }
    const declared = Number(response.headers.get("content-length"));
    if (declared > MAX_TEXTBOOK_BYTES) throw new UserError("This textbook is larger than the 250 MB limit.");
    await requireFreeSpace(dirname(filePath), declared || MAX_TEXTBOOK_BYTES);

    const file = await open(filePath, "wx", 0o600);
    let size = 0;
    let head = Buffer.alloc(0);
    try {
      const reader = response.body.getReader();
      for (let read = await reader.read(); !read.done; read = await reader.read()) {
        const chunk = read.value;
        size += chunk.byteLength;
        if (size > MAX_TEXTBOOK_BYTES) throw new UserError("This textbook is larger than the 250 MB limit.");
        if (head.length < 5) head = Buffer.concat([head, chunk]).subarray(0, 5);
        await file.write(chunk);
      }
      if (head.toString("latin1") !== "%PDF-") throw new UserError("The source didn't return a PDF.");
    } catch (error) {
      await file.close();
      await unlink(filePath).catch(() => {});
      if (error instanceof UserError) throw error;
      if (isStorageFull(error)) throw new UserError(STORAGE_FULL);
      throw new UserError("The download was interrupted. Try again.");
    }
    await file.close();
    return size;
  }
  throw new UserError("The source redirected too many times.");
}
