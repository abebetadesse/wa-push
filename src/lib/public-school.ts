import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";

/** The school whose public page is /<slug>, unless it is suspended. */
export async function loadPublicSchool(slug: string) {
  const normalized = decodeURIComponent(slug).toLowerCase();
  if (!/^[a-z0-9-]{1,100}$/.test(normalized)) return null;
  const [school] = await db.select().from(schools).where(and(eq(schools.slug, normalized), ne(schools.status, "suspended"))).limit(1);
  return school ?? null;
}
