import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { prMedia, schoolMemberships } from "@/db/schema";
import { resourceStoragePath } from "@/lib/learning-resources";
import { getSession, isPlatformAdmin } from "@/lib/permissions";

// Approved photos are public (they appear on the school's public page); pending and rejected ones
// are visible only to the school's admins and PR officers.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found.", { status: 404 });
  const [media] = await db.select({
    schoolId: prMedia.schoolId,
    storageKey: prMedia.storageKey,
    contentType: prMedia.contentType,
    status: prMedia.status,
  }).from(prMedia).where(eq(prMedia.id, id)).limit(1);
  if (!media) return new Response("Not found.", { status: 404 });

  if (media.status !== "approved") {
    const session = await getSession();
    let allowed = Boolean(session && isPlatformAdmin(session));
    if (session && !allowed) {
      const [membership] = await db.select({ role: schoolMemberships.role }).from(schoolMemberships)
        .where(and(
          eq(schoolMemberships.schoolId, media.schoolId),
          eq(schoolMemberships.userId, session.user.id),
          inArray(schoolMemberships.role, ["school_admin", "pr_officer"]),
        ))
        .limit(1);
      allowed = Boolean(membership);
    }
    if (!allowed) return new Response("Not found.", { status: 404 });
  }

  let file: Buffer;
  try {
    file = await readFile(resourceStoragePath(media.schoolId, media.storageKey));
  } catch {
    return new Response("Not found.", { status: 404 });
  }
  return new Response(new Uint8Array(file), {
    headers: {
      "Cache-Control": media.status === "approved" ? "public, max-age=3600" : "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Type": media.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
