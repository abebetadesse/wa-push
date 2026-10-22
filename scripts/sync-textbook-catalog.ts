/**
 * Fills the platform's textbook catalog (school_textbook_catalog) from official sources, then checks
 * every entry with a HEAD request. Nothing is downloaded: schools fetch a book into their library
 * from the Textbooks page when they want it.
 *
 *   - Oromia Education Bureau (213.55.101.25): its grade pages are read for links to the new-
 *     curriculum student textbooks, in Afaan Oromo, Amharic and English.
 *   - Ministry of Education e-learning portal (elearn.moe.gov.et): grade 9–12 books found through
 *     web search. The portal did not answer from the development machine when this was
 *     written, so most entries point at the book's page rather than the PDF.
 *
 * Safe to run again: entries are matched by URL and updated.
 *
 *   npx tsx scripts/sync-textbook-catalog.ts [--allow-remote]
 */
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { curriculumSubject } from "../src/lib/ethiopian-curriculum";
import { checkTextbookSource, sourceUrlHash } from "../src/lib/textbook-sources";

loadEnvConfig(process.cwd());

type Entry = {
  grade: number;
  subjectName: string;
  language: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  directDownload: boolean;
};

const BBO_ORIGIN = "http://213.55.101.25";
const BBO_PUBLISHER = "Oromia Education Bureau (Biiroo Barnoota Oromiyaa)";
const MOE_PUBLISHER = "Ministry of Education, FDRE";

// File-name patterns on the bureau's site → subject and language of instruction. The Amharic-medium
// books sit under an /am/ folder.
const BBO_RULES: { pattern: RegExp; subject: string; language: string }[] = [
  { pattern: /English/i, subject: "English", language: "English" },
  { pattern: /Afaan_Amaahara?_/i, subject: "Amharic", language: "Amharic (second language)" },
  { pattern: /AMARIC_G/i, subject: "Amharic", language: "Amharic" },
  { pattern: /Afan_Oromo/i, subject: "Afan Oromo", language: "Afaan Oromo" },
  { pattern: /HERREGA/i, subject: "Mathematics", language: "Afaan Oromo" },
  { pattern: /Maths_Grade/i, subject: "Mathematics", language: "Amharic" },
  { pattern: /FJQ_/i, subject: "Health and Physical Education", language: "Afaan Oromo" },
  { pattern: /የጤናና/, subject: "Health and Physical Education", language: "Amharic" },
  { pattern: /Og-Aartiiwwan/i, subject: "Performing and Visual Arts", language: "Afaan Oromo" },
  { pattern: /ሥነ_ጠጥበብ|PVA_Amharic/i, subject: "Performing and Visual Arts", language: "Amharic" },
  { pattern: /Saayinsii_Naannoo/i, subject: "Environmental Science", language: "Afaan Oromo" },
  { pattern: /የአከባቢ_ሳይንስ/, subject: "Environmental Science", language: "Amharic" },
];

const MOE_ENTRIES: Entry[] = [
  { grade: 9, subjectName: "Biology", language: "English", title: "Biology Student Textbook Grade 9", publisher: MOE_PUBLISHER, sourceUrl: "https://elearn.moe.gov.et/resource-view/5587/2", directDownload: false },
  { grade: 9, subjectName: "History", language: "English", title: "History Student Textbook Grade 9", publisher: MOE_PUBLISHER, sourceUrl: "https://elearn.moe.gov.et/resource-view/5609/2", directDownload: false },
  { grade: 10, subjectName: "English", language: "English", title: "English Student Textbook Grade 10", publisher: MOE_PUBLISHER, sourceUrl: "https://elearn.moe.gov.et/storage/Text%20book%20new/English/16.%20English%20Grade%2010%20Student%20Textnook%20Final%20version-July-9.pdf", directDownload: true },
  { grade: 11, subjectName: "Physics", language: "English", title: "Physics Student Textbook Grade 11", publisher: MOE_PUBLISHER, sourceUrl: "https://elearn.moe.gov.et/resource-view/5637/2", directDownload: false },
  { grade: 11, subjectName: "English", language: "English", title: "English Student Textbook Grade 11", publisher: MOE_PUBLISHER, sourceUrl: "https://elearn.moe.gov.et/resource-view/5642/2", directDownload: false },
];

async function fetchText(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

function hrefs(html: string) {
  return [...html.matchAll(/href="([^"]+)"/gi)].map((match) => match[1].replaceAll("&amp;", "&"));
}

async function bureauEntries() {
  const entries = new Map<string, Entry>();
  for (let grade = 1; grade <= 8; grade += 1) {
    const indexPath = `/index.php/text-books/grade-${grade}`;
    const html = await fetchText(BBO_ORIGIN + indexPath);
    // Some grades list their books on a sub-page of the grade page.
    const subPages = [...new Set(hrefs(html).filter((href) => href.startsWith(`${indexPath}/`)))];
    const pages = [html, ...(await Promise.all(subPages.map((path) => fetchText(BBO_ORIGIN + path))))];

    for (const href of pages.flatMap(hrefs)) {
      if (!href.toLowerCase().endsWith(".pdf") || !href.includes("/new_book/")) continue;
      const fileName = decodeURIComponent(href.split("/").pop() ?? "");
      const bookGrade = Number(href.match(/\/(?:grade|g)(\d+)\//)?.[1]);
      const rule = BBO_RULES.find(({ pattern }) => pattern.test(fileName));
      if (!rule || !bookGrade) {
        console.warn(`  skipped ${href}: subject not recognised`);
        continue;
      }
      const sourceUrl = new URL(href, BBO_ORIGIN).href;
      entries.set(sourceUrl, {
        grade: bookGrade,
        subjectName: rule.subject,
        language: rule.language,
        title: `Grade ${bookGrade} ${rule.subject} Student Textbook (${rule.language})`,
        publisher: BBO_PUBLISHER,
        sourceUrl,
        directDownload: true,
      });
    }
  }
  return [...entries.values()];
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const host = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
    throw new Error(`DATABASE_URL points at ${host}. Pass --allow-remote to fill that database's catalog.`);
  }

  console.info("Reading the Oromia Education Bureau's textbook pages…");
  const entries = [...(await bureauEntries()), ...MOE_ENTRIES];
  for (const entry of entries) {
    if (!curriculumSubject(entry.subjectName)) throw new Error(`Unknown subject ${entry.subjectName}`);
  }

  const { default: mysql } = await import("mysql2/promise");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    for (const entry of entries) {
      await connection.query(
        `INSERT INTO school_textbook_catalog
           (id, grade, subject_name, language, title, publisher, source_url, source_url_hash, direct_download)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE grade = VALUES(grade), subject_name = VALUES(subject_name), language = VALUES(language),
           title = VALUES(title), publisher = VALUES(publisher), direct_download = VALUES(direct_download)`,
        [randomUUID(), entry.grade, entry.subjectName, entry.language, entry.title, entry.publisher, entry.sourceUrl, sourceUrlHash(entry.sourceUrl), entry.directDownload],
      );
    }

    console.info(`Checking ${entries.length} sources (headers only)…`);
    const tally: Record<string, number> = {};
    for (const entry of entries) {
      const check = await checkTextbookSource(entry.sourceUrl);
      tally[check.status] = (tally[check.status] ?? 0) + 1;
      await connection.query(
        "UPDATE school_textbook_catalog SET check_status = ?, size_bytes = COALESCE(?, size_bytes), checked_at = NOW() WHERE source_url_hash = ?",
        [check.status, check.sizeBytes, sourceUrlHash(entry.sourceUrl)],
      );
    }
    console.info(`✓ ${entries.length} catalog entries: ${Object.entries(tally).map(([status, count]) => `${count} ${status}`).join(", ")}`);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(`sync-textbook-catalog failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
