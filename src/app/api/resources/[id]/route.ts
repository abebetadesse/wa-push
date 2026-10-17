import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { learningResources } from "@/db/schema";
import { canViewLearningResources, resourceStoragePath } from "@/lib/learning-resources";
import { getSession, isPlatformAdmin } from "@/lib/permissions";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Sign in to access this resource.", { status: 401 });
  const { id } = await context.params;
  const [resource] = await db
    .select({
      schoolId: learningResources.schoolId,
      fileName: learningResources.fileName,
      storageKey: learningResources.storageKey,
      contentType: learningResources.contentType,
    })
    .from(learningResources)
    .where(eq(learningResources.id, id))
    .limit(1);
  if (!resource || !(await canViewLearningResources(resource.schoolId, session.user.id, isPlatformAdmin(session)))) {
    return new Response("Resource not found.", { status: 404 });
  }

  const filePath = resourceStoragePath(resource.schoolId, resource.storageKey);
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Response("Resource file not found.", { status: 404 });
    }
    throw error;
  }
  if (!fileStats.isFile()) return new Response("Resource file not found.", { status: 404 });

  const range = request.headers.get("range");
  let start = 0;
  let end = fileStats.size - 1;
  let status = 200;
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${fileStats.size}` } });
    }
    if (!match[1]) {
      const suffixLength = Number(match[2]);
      start = Math.max(fileStats.size - suffixLength, 0);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), end);
    }
    if (start >= fileStats.size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${fileStats.size}` } });
    }
    status = 206;
  }

  const encodedFileName = encodeURIComponent(resource.fileName)
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  const safeInlineTypes = /^(?:image\/(?:png|jpeg|gif|webp)|audio\/|video\/|application\/pdf)/.test(resource.contentType);
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `${safeInlineTypes ? "inline" : "attachment"}; filename="resource"; filename*=UTF-8''${encodedFileName}`,
    "Content-Length": String(end - start + 1),
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Type": resource.contentType,
    "X-Content-Type-Options": "nosniff",
  });
  if (status === 206) headers.set("Content-Range", `bytes ${start}-${end}/${fileStats.size}`);

  const stream = createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers });
}
