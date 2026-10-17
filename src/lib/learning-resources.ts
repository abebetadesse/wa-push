import "server-only";
import { extname, join, resolve } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { schoolMemberships, schools, students } from "@/db/schema";

export const MAX_RESOURCE_BYTES = 100 * 1024 * 1024;

export const RESOURCE_FILE_TYPES: Record<string, { contentType: string; category: string }> = {
  ".pdf": { contentType: "application/pdf", category: "Document" },
  ".txt": { contentType: "text/plain; charset=utf-8", category: "Text" },
  ".md": { contentType: "text/markdown; charset=utf-8", category: "Text" },
  ".html": { contentType: "text/html; charset=utf-8", category: "Web lesson" },
  ".htm": { contentType: "text/html; charset=utf-8", category: "Web lesson" },
  ".xml": { contentType: "application/xml", category: "Structured text" },
  ".csv": { contentType: "text/csv; charset=utf-8", category: "Data" },
  ".rtf": { contentType: "application/rtf", category: "Document" },
  ".doc": { contentType: "application/msword", category: "Document" },
  ".docx": { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", category: "Document" },
  ".ppt": { contentType: "application/vnd.ms-powerpoint", category: "Presentation" },
  ".pptx": { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", category: "Presentation" },
  ".xls": { contentType: "application/vnd.ms-excel", category: "Spreadsheet" },
  ".xlsx": { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", category: "Spreadsheet" },
  ".odt": { contentType: "application/vnd.oasis.opendocument.text", category: "Document" },
  ".odp": { contentType: "application/vnd.oasis.opendocument.presentation", category: "Presentation" },
  ".ods": { contentType: "application/vnd.oasis.opendocument.spreadsheet", category: "Spreadsheet" },
  ".epub": { contentType: "application/epub+zip", category: "eBook" },
  ".zip": { contentType: "application/zip", category: "Archive" },
  ".mbz": { contentType: "application/vnd.moodle.backup", category: "Moodle backup" },
  ".png": { contentType: "image/png", category: "Image" },
  ".jpg": { contentType: "image/jpeg", category: "Image" },
  ".jpeg": { contentType: "image/jpeg", category: "Image" },
  ".webp": { contentType: "image/webp", category: "Image" },
  ".gif": { contentType: "image/gif", category: "Animation" },
  ".svg": { contentType: "image/svg+xml", category: "Animation" },
  ".mp3": { contentType: "audio/mpeg", category: "Audio" },
  ".m4a": { contentType: "audio/mp4", category: "Audio" },
  ".aac": { contentType: "audio/aac", category: "Audio" },
  ".wav": { contentType: "audio/wav", category: "Audio" },
  ".ogg": { contentType: "audio/ogg", category: "Audio" },
  ".flac": { contentType: "audio/flac", category: "Audio" },
  ".mid": { contentType: "audio/midi", category: "Audio" },
  ".midi": { contentType: "audio/midi", category: "Audio" },
  ".mp4": { contentType: "video/mp4", category: "Video" },
  ".m4v": { contentType: "video/mp4", category: "Video" },
  ".mkv": { contentType: "video/x-matroska", category: "Video" },
  ".3gp": { contentType: "video/3gpp", category: "Video" },
  ".webm": { contentType: "video/webm", category: "Video" },
  ".mov": { contentType: "video/quicktime", category: "Video" },
  ".mpeg": { contentType: "video/mpeg", category: "Video" },
  ".mpg": { contentType: "video/mpeg", category: "Video" },
  ".avi": { contentType: "video/x-msvideo", category: "Video" },
  ".json": { contentType: "application/json", category: "Animation" },
};

export function resourceFileType(fileName: string) {
  return RESOURCE_FILE_TYPES[extname(fileName).toLowerCase()] ?? null;
}

export function resourceStorageDirectory(schoolId: string) {
  const configuredPath = process.env.UPLOAD_DIR?.trim();
  const root = configuredPath
    ? resolve(/* turbopackIgnore: true */ configuredPath)
    : join(process.cwd(), "var", "uploads");
  return join(/* turbopackIgnore: true */ root, schoolId);
}

export function resourceStoragePath(schoolId: string, storageKey: string) {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey)) throw new Error("Invalid resource storage key.");
  return join(/* turbopackIgnore: true */ resourceStorageDirectory(schoolId), storageKey);
}

async function canAccessLearningResources(
  schoolId: string,
  userId: string,
  platformAdmin: boolean,
  roles: ("school_admin" | "teacher" | "student")[],
) {
  const [school] = await db
    .select({ status: schools.status })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school || school.status === "suspended") return false;
  if (platformAdmin) return true;

  const [membership] = await db
    .select({ role: schoolMemberships.role })
    .from(schoolMemberships)
    .where(and(
      eq(schoolMemberships.schoolId, schoolId),
      eq(schoolMemberships.userId, userId),
      inArray(schoolMemberships.role, roles),
    ))
    .limit(1);
  if (!membership) return false;
  if (membership.role !== "student") return true;

  const [activeStudent] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(
      eq(students.schoolId, schoolId),
      eq(students.userId, userId),
      eq(students.status, "active"),
    ))
    .limit(1);
  return Boolean(activeStudent);
}

export function canManageLearningResources(schoolId: string, userId: string, platformAdmin: boolean) {
  return canAccessLearningResources(schoolId, userId, platformAdmin, ["school_admin", "teacher"]);
}

export function canViewLearningResources(schoolId: string, userId: string, platformAdmin: boolean) {
  return canAccessLearningResources(schoolId, userId, platformAdmin, ["school_admin", "teacher", "student"]);
}
