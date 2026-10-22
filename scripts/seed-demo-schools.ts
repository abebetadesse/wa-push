/**
 * Creates three demo schools with an academic year, grades, subjects and classes, and one test
 * account for every school role in each. Safe to run again: existing schools, users and records
 * are matched by slug, email or number and updated rather than duplicated.
 *
 * All demo accounts share one password, DEMO_USER_PASSWORD from .env.local. When it is missing a
 * random one is generated and appended there, so it never appears in the terminal or in git.
 *
 * Usage:
 *   npm run db:seed-demo
 *   npm run db:seed-demo -- --allow-remote   (only for a database you mean to fill with demo data)
 */
import { loadEnvConfig } from "@next/env";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { CURRICULUM_SUBJECTS } from "../src/lib/ethiopian-curriculum";
import type { SchoolRoleName } from "../src/lib/roles";

loadEnvConfig(process.cwd());

type Role = SchoolRoleName;

type DemoSchool = {
  name: string;
  slug: string;
  phone: string;
  grades: number[];
};

const ACADEMIC_YEAR = { name: "2026/27", startsOn: "2026-09-11", endsOn: "2027-07-07" };

const SCHOOLS: DemoSchool[] = [
  { name: "Abay Primary School", slug: "abay-primary", phone: "+251 11 000 0101", grades: [1, 2, 3, 4, 5, 6, 7, 8] },
  { name: "Entoto Hill Secondary School", slug: "entoto-hill-secondary", phone: "+251 11 000 0202", grades: [9, 10] },
  { name: "Rift Valley Preparatory School", slug: "rift-valley-preparatory", phone: "+251 22 000 0303", grades: [11, 12] },
];

const PEOPLE: Record<Role, { local: string; first: string; last: string; title: string }[]> = {
  school_admin: [{ local: "admin", first: "Selamawit", last: "Bekele", title: "Principal" }],
  teacher: [{ local: "teacher", first: "Dawit", last: "Haile", title: "Teacher" }],
  student: [{ local: "student", first: "Hanna", last: "Tesfaye", title: "Student" }],
  guardian: [{ local: "guardian", first: "Tesfaye", last: "Girma", title: "Guardian" }],
  inventory_manager: [{ local: "inventory", first: "Mulugeta", last: "Abebe", title: "Store keeper" }],
  hr_manager: [{ local: "hr", first: "Meron", last: "Alemu", title: "HR officer" }],
  librarian: [{ local: "library", first: "Tigist", last: "Mekonnen", title: "Librarian" }],
  lab_technician: [{ local: "lab", first: "Yonas", last: "Desta", title: "Laboratory technician" }],
  workshop_manager: [{ local: "workshop", first: "Bekele", last: "Gemechu", title: "Workshop manager" }],
  community_officer: [{ local: "community", first: "Almaz", last: "Tadesse", title: "Community engagement officer" }],
  pr_officer: [{ local: "pr", first: "Hirut", last: "Wolde", title: "Public relations officer" }],
};

// Prefix of each person's student, teacher or employee number.
const ROLE_CODES: Record<Role, string> = {
  school_admin: "A",
  teacher: "T",
  student: "S",
  guardian: "G",
  inventory_manager: "I",
  hr_manager: "H",
  librarian: "L",
  lab_technician: "B",
  workshop_manager: "W",
  community_officer: "C",
  pr_officer: "P",
};

function emailFor(local: string, slug: string) {
  return `${local}@${slug}.forma.test`;
}

function demoPassword() {
  const existing = process.env.DEMO_USER_PASSWORD;
  if (existing) {
    if (existing.length < 12) throw new Error("DEMO_USER_PASSWORD must be at least 12 characters.");
    return existing;
  }
  const generated = randomBytes(12).toString("base64url");
  appendFileSync(join(process.cwd(), ".env.local"), `\n# Shared password for the demo accounts from scripts/seed-demo-schools.ts\nDEMO_USER_PASSWORD=${generated}\n`);
  console.info("Generated DEMO_USER_PASSWORD and saved it to .env.local.");
  return generated;
}

async function one<T extends RowDataPacket>(connection: Connection, sql: string, values: unknown[]) {
  const [rows] = await connection.query<T[]>(sql, values);
  return rows[0];
}

async function ensureUser(connection: Connection, email: string, name: string, passwordHash: string) {
  const existing = await one(connection, "SELECT id FROM school_auth_users WHERE email = ?", [email]);
  const userId: string = existing?.id ?? randomUUID();
  if (existing) {
    await connection.query("UPDATE school_auth_users SET name = ? WHERE id = ?", [name, userId]);
  } else {
    await connection.query(
      "INSERT INTO school_auth_users (id, name, email, email_verified, role) VALUES (?, ?, ?, true, 'user')",
      [userId, name, email],
    );
  }

  const account = await one(
    connection,
    "SELECT id FROM school_auth_accounts WHERE user_id = ? AND provider_id = 'credential'",
    [userId],
  );
  if (account) {
    await connection.query("UPDATE school_auth_accounts SET password = ? WHERE id = ?", [passwordHash, account.id]);
  } else {
    await connection.query(
      "INSERT INTO school_auth_accounts (id, account_id, provider_id, user_id, password) VALUES (?, ?, 'credential', ?, ?)",
      [randomUUID(), userId, userId, passwordHash],
    );
  }
  return userId;
}

/** Returns the id of the row matching `where`, inserting `insert` first when there is none. */
async function upsertId(connection: Connection, table: string, where: Record<string, unknown>, insert: Record<string, unknown>) {
  const keys = Object.keys(where);
  const found = await one(
    connection,
    `SELECT id FROM \`${table}\` WHERE ${keys.map((key) => `\`${key}\` = ?`).join(" AND ")}`,
    keys.map((key) => where[key]),
  );
  if (found) return found.id as string;

  const row = { id: randomUUID(), ...where, ...insert };
  const columns = Object.keys(row);
  await connection.query(
    `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    columns.map((column) => row[column as keyof typeof row]),
  );
  return row.id;
}

async function seedSchool(connection: Connection, school: DemoSchool, passwordHash: string) {
  const schoolId = await upsertId(connection, "school_schools", { slug: school.slug }, {
    name: school.name,
    email: emailFor("office", school.slug),
    phone: school.phone,
    country: "Ethiopia",
    timezone: "Africa/Addis_Ababa",
    status: "active",
  });

  // A school that already has a current year keeps it; otherwise this year becomes current.
  const current = await one(connection, "SELECT id FROM school_academic_years WHERE school_id = ? AND is_current = true", [schoolId]);
  const yearId = await upsertId(connection, "school_academic_years", { school_id: schoolId, name: ACADEMIC_YEAR.name }, {
    starts_on: ACADEMIC_YEAR.startsOn,
    ends_on: ACADEMIC_YEAR.endsOn,
    is_current: !current,
  });

  const classroomIds: string[] = [];
  for (const grade of school.grades) {
    const gradeId = await upsertId(connection, "school_grade_levels", { school_id: schoolId, name: `Grade ${grade}` }, { sort_order: grade });
    classroomIds.push(await upsertId(connection, "school_classrooms", { academic_year_id: yearId, name: `Grade ${grade} - Section A` }, {
      school_id: schoolId,
      grade_level_id: gradeId,
      capacity: 45,
    }));
  }

  for (const subject of CURRICULUM_SUBJECTS) {
    const [from, to] = subject.grades;
    if (!school.grades.some((grade) => grade >= from && grade <= to)) continue;
    await upsertId(connection, "school_subjects", { school_id: schoolId, name: subject.name }, {
      code: subject.code,
      department: subject.department,
    });
  }

  const accounts: string[] = [];
  for (const [role, people] of Object.entries(PEOPLE) as [Role, (typeof PEOPLE)[Role]][]) {
    for (const [index, person] of people.entries()) {
      const email = emailFor(person.local, school.slug);
      const userId = await ensureUser(connection, email, `${person.first} ${person.last}`, passwordHash);
      await connection.query(
        `INSERT INTO school_memberships (id, school_id, user_id, role) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [randomUUID(), schoolId, userId, role],
      );
      accounts.push(`${role.padEnd(18)} ${email}`);

      const number = `${school.slug.slice(0, 3).toUpperCase()}-${ROLE_CODES[role]}${String(index + 1).padStart(3, "0")}`;
      const profile = { first_name: person.first, last_name: person.last, email, user_id: userId };
      if (role === "teacher") {
        await upsertId(connection, "school_teachers", { school_id: schoolId, teacher_number: number }, { ...profile, specialization: "Mathematics" });
      } else if (role === "student") {
        const studentId = await upsertId(connection, "school_students", { school_id: schoolId, student_number: number }, profile);
        await upsertId(connection, "school_enrollments", { student_id: studentId, academic_year_id: yearId }, {
          school_id: schoolId,
          classroom_id: classroomIds[0],
        });
      } else if (role !== "guardian") {
        await upsertId(connection, "school_staff_members", { school_id: schoolId, employee_number: number }, { ...profile, job_title: person.title, hired_on: "2024-09-01" });
      }
    }
  }

  return accounts;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const host = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
    throw new Error(`DATABASE_URL points at ${host}. Pass --allow-remote only if that database should get demo schools and accounts.`);
  }

  const { hashPassword } = await import("better-auth/crypto");
  const { default: mysql } = await import("mysql2/promise");
  const passwordHash = await hashPassword(demoPassword());
  const connection = await mysql.createConnection(databaseUrl);

  try {
    for (const school of SCHOOLS) {
      await connection.beginTransaction();
      try {
        const accounts = await seedSchool(connection, school, passwordHash);
        await connection.commit();
        console.info(`\n✓ ${school.name} (/${school.slug})\n  ${accounts.join("\n  ")}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    console.info("\nEvery account above signs in with DEMO_USER_PASSWORD from .env.local.");
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(`seed-demo-schools failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
