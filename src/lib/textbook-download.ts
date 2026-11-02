import "server-only";
import { copyFile, open, stat, unlink } from "node:fs/promises";
import { UserError } from "@/lib/action-result";
import { resourceStoragePath } from "@/lib/learning-resources";
import { allowedSourceUrl, uploadedSourceKey } from "@/lib/textbook-sources";

const MAX_REDIRECTS = 3;

/**
 * Catalog downloads stream to disk on the server, so they may be larger than an upload from a
 * browser; some 2023 grade 11–12 textbooks are 120–175 MB.
 */
export const MAX_TEXTBOOK_BYTES = 250 * 1024 * 1024;

/** Where platform administrators' catalog uploads are kept (beside the schools' folders). */
export const CATALOG_STORAGE_ID = "textbook-catalog";

export function catalogUploadPath(storageKey: string) {
  return resourceStoragePath(CATALOG_STORAGE_ID, storageKey);
}

/**
 * Downloads an official textbook PDF to `filePath` and returns its size. Every hop, redirects
 * included, must stay on an allowed textbook host; the file must start like a PDF and fit the
 * catalog size limit. A catalog file uploaded to Forma is copied instead. A failed download leaves
 * no file behind.
 */
export async function downloadTextbook(sourceUrl: string, filePath: string) {
  const uploadedKey = uploadedSourceKey(sourceUrl);
  if (uploadedKey) {
    try {
      await copyFile(catalogUploadPath(uploadedKey), filePath);
    } catch {
      throw new UserError("The uploaded copy of this textbook is missing. Ask the platform administrator to upload it again.");
    }
    return (await stat(filePath)).size;
  }

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
      throw new UserError("The download was interrupted. Try again.");
    }
    await file.close();
    return size;
  }
  throw new UserError("The source redirected too many times.");
}
