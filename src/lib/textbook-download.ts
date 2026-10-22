import "server-only";
import { open, unlink } from "node:fs/promises";
import { UserError } from "@/lib/action-result";
import { MAX_RESOURCE_BYTES } from "@/lib/learning-resources";
import { allowedSourceUrl } from "@/lib/textbook-sources";

const MAX_REDIRECTS = 3;

/**
 * Downloads an official textbook PDF to `filePath` and returns its size. Every hop, redirects
 * included, must stay on an allowed textbook host; the file must start like a PDF and fit the
 * resource size limit. A failed download leaves no file behind.
 */
export async function downloadTextbook(sourceUrl: string, filePath: string) {
  let url = allowedSourceUrl(sourceUrl);
  if (!url) throw new UserError("This textbook's source isn't one of the official hosts Forma downloads from.");

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10 * 60_000) });
    } catch {
      throw new UserError(`${url.hostname} could not be reached. Try again later, or open the source and upload the file.`);
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
    if (declared > MAX_RESOURCE_BYTES) throw new UserError("This textbook is larger than the 100 MB resource limit.");

    const file = await open(filePath, "wx", 0o600);
    let size = 0;
    let head = Buffer.alloc(0);
    try {
      const reader = response.body.getReader();
      for (let read = await reader.read(); !read.done; read = await reader.read()) {
        const chunk = read.value;
        size += chunk.byteLength;
        if (size > MAX_RESOURCE_BYTES) throw new UserError("This textbook is larger than the 100 MB resource limit.");
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
