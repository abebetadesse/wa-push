import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { schoolMemberships, teacherReports } from "@/db/schema";
import { resourceStoragePath } from "@/lib/learning-resources";
import { getSession, isPlatformAdmin } from "@/lib/permissions";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found.", { status: 404 });

  const [report] = await db
    .select({
      schoolId: teacherReports.schoolId,
      photoStorageKey: teacherReports.photoStorageKey,
      photoContentType: teacherReports.photoContentType,
    })
    .from(teacherReports)
    .where(eq(teacherReports.id, id))
    .limit(1);

  if (!report) return new Response("Not found.", { status: 404 });

  const session = await getSession();
  if (!session) return new Response("Unauthorized.", { status: 401 });

  let allowed = isPlatformAdmin(session);
  if (!allowed) {
    const [membership] = await db
      .select({ role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(and(
        eq(schoolMemberships.schoolId, report.schoolId),
        eq(schoolMemberships.userId, session.user.id),
      ))
      .limit(1);
    allowed = Boolean(membership);
  }

  if (!allowed) return new Response("Forbidden.", { status: 403 });

  let file: Buffer;
  try {
    file = await readFile(resourceStoragePath(report.schoolId, report.photoStorageKey));
  } catch {
    return new Response("Not found.", { status: 404 });
  }

  return new Response(new Uint8Array(file), {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Type": report.photoContentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
