import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { UserError } from "@/lib/action-result";

// A school's public page lives at /<slug> (https://service.echat.et/school/<slug> in production), next
// to the app's own pages, so a slug may not be the name of one of them.
export const RESERVED_SLUGS = new Set([
  "academic-setup", "accept-invite", "analytics", "api", "applications", "assessments", "attendance", "certificates",
  "community", "curriculum", "dashboard", "data-fields", "discussions", "facilities", "favicon.ico", "forgot-password",
  "hr", "inventory", "lab", "lessons", "library", "login", "logout", "my-learning", "my-progress", "no-access",
  "organization", "pr", "privileges", "register", "reports", "reset-password", "resources", "setup-school",
  "students", "studio", "teachers", "team", "templates", "textbooks", "timetable", "verify", "workshop", "admin",
  "school", "schools", "static", "public", "_next",
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

// Ge'ez (Ethiopic) syllables in Latin letters, so "ገነት" gives "genet". The Unicode block is laid out
// in rows of eight: one consonant, then its vowel orders (ä u i a e ə o, and wa).
const ETHIOPIC_ROWS: Record<number, string> = {
  0x1200: "h", 0x1208: "l", 0x1210: "h", 0x1218: "m", 0x1220: "s", 0x1228: "r", 0x1230: "s", 0x1238: "sh",
  0x1240: "q", 0x1248: "qw", 0x1250: "q", 0x1260: "b", 0x1268: "v", 0x1270: "t", 0x1278: "ch", 0x1280: "h",
  0x1288: "hw", 0x1290: "n", 0x1298: "ny", 0x12a0: "", 0x12a8: "k", 0x12b0: "kw", 0x12b8: "kh", 0x12c8: "w",
  0x12d0: "", 0x12d8: "z", 0x12e0: "zh", 0x12e8: "y", 0x12f0: "d", 0x12f8: "d", 0x1300: "j", 0x1308: "g",
  0x1310: "gw", 0x1318: "g", 0x1320: "t", 0x1328: "ch", 0x1330: "p", 0x1338: "ts", 0x1340: "ts", 0x1348: "f",
  0x1350: "p",
};
const ETHIOPIC_VOWELS = ["e", "u", "i", "a", "e", "", "o", "wa"];

const isSyllable = (char: string | undefined) => {
  const code = char?.codePointAt(0) ?? 0;
  return code >= 0x1200 && code <= 0x135a;
};

export function transliterate(text: string) {
  const chars = [...text];
  let out = "";
  chars.forEach((char, index) => {
    const code = char.codePointAt(0)!;
    if (!isSyllable(char)) {
      out += code >= 0x1360 && code <= 0x137f ? " " : char;
      return;
    }
    const row = code - ((code - 0x1200) % 8);
    const consonant = ETHIOPIC_ROWS[row];
    if (consonant === undefined) return;
    const order = (code - 0x1200) % 8;
    if (consonant === "" && order === 0) {
      // A vowel carrier's first order opens a word with "a" (አቡነ → abune).
      out += "a";
    } else if (order !== 5) {
      out += `${consonant}${ETHIOPIC_VOWELS[order]}`;
    } else if (consonant === "") {
      // A vowel carrier (አ, ዐ) in its sixth order is a plain "e" (እውቀት → ewket).
      out += "e";
    } else {
      // A sixth-order syllable that opens a word before another consonant is voiced with a short i
      // (ህብር → hibr, ቅድመ → qidme); after a vowel or at a word's end it is bare (ገነት → genet).
      const opensWord = !isSyllable(chars[index - 1]);
      out += opensWord && isSyllable(chars[index + 1]) ? `${consonant}i` : consonant;
    }
  });
  return out;
}

/** "Abune Gorgorios No. 3" → "abune-gorgorios-no-3"; "ገነት ቅድመ አንደኛ" → "genet-qidme-andenya". */
export function slugify(name: string) {
  return transliterate(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}

export function checkSlug(slug: string) {
  if (!SLUG_PATTERN.test(slug)) throw new UserError("Use 1–80 lowercase letters, numbers and hyphens for the public address, for example genet-preschool.");
  if (RESERVED_SLUGS.has(slug)) throw new UserError(`“${slug}” is the name of one of the app's pages. Choose another public address.`);
  return slug;
}

async function slugTaken(slug: string, exceptSchoolId?: string) {
  const [row] = await db.select({ id: schools.id }).from(schools)
    .where(exceptSchoolId ? and(eq(schools.slug, slug), ne(schools.id, exceptSchoolId)) : eq(schools.slug, slug)).limit(1);
  return Boolean(row);
}

/**
 * A free slug for a new school: the requested one (which must be free), else the name's slug, adding
 * -2, -3… when it is already used, else "school-xxxxxxxx".
 */
export async function chooseSlug(name: string, requested?: string | null) {
  if (requested) {
    checkSlug(requested);
    if (await slugTaken(requested)) throw new UserError(`The public address /${requested} is already used by another school.`);
    return requested;
  }
  const base = slugify(name);
  if (base && !RESERVED_SLUGS.has(base)) {
    for (let suffix = 1; suffix < 50; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base.slice(0, 76)}-${suffix}`;
      if (!(await slugTaken(candidate))) return candidate;
    }
  }
  return `school-${randomUUID().slice(0, 8)}`;
}

export async function ensureSlugFree(slug: string, schoolId: string) {
  checkSlug(slug);
  if (await slugTaken(slug, schoolId)) throw new UserError(`The public address /${slug} is already used by another school.`);
  return slug;
}
