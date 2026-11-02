import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldDefinitions, fieldFiles, students } from "@/db/schema";
import { mayViewField } from "@/lib/field-data";
import { resourceStoragePath } from "@/lib/learning-resources";
import { getPrivilegeResolver, getSession, requireSchoolRole } from "@/lib/permissions";

// Files uploaded into data fields: visible to whoever may view the field at that school, and to a
// student for their own record.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found.", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Sign in to open this file.", { status: 401 });
  const [file] = await db.select().from(fieldFiles).where(eq(fieldFiles.id, id)).limit(1);
  if (!file) return new Response("Not found.", { status: 404 });
  const [field] = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, file.fieldId)).limit(1);
  if (!field) return new Response("Not found.", { status: 404 });

  let allowed = false;
  try {
    const access = await requireSchoolRole(file.schoolId);
    allowed = mayViewField(field, access.roles, await getPrivilegeResolver(), file.schoolId, access.role === "platform_admin");
  } catch {
    allowed = false;
  }
  if (!allowed && field.entity === "student") {
    const [own] = await db.select({ userId: students.userId }).from(students).where(eq(students.id, file.entityId)).limit(1);
    allowed = own?.userId === session.user.id;
  }
  if (!allowed) return new Response("Not found.", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(resourceStoragePath(file.schoolId, file.storageKey));
  } catch {
    return new Response("The file is missing from storage.", { status: 410 });
  }
  const inline = /^(image\/(png|jpeg|webp|gif)|application\/pdf|video\/|audio\/)/.test(file.contentType);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
