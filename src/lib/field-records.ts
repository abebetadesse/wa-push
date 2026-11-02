import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { schools, staffMembers, students, teachers } from "@/db/schema";
import type { FieldEntity } from "@/lib/custom-fields";

export type EntityRecord = { id: string; schoolId: string; number: string; name: string; gender: string | null; status: string };

/** The records data fields can be filled in for, at the given schools. */
export async function entityRecords(entity: FieldEntity, schoolIds: string[]): Promise<EntityRecord[]> {
  if (schoolIds.length === 0) return [];
  if (entity === "school") {
    const rows = await db.select({ id: schools.id, name: schools.name, code: schools.schoolCode, slug: schools.slug, status: schools.status })
      .from(schools).where(inArray(schools.id, schoolIds)).orderBy(asc(schools.name));
    return rows.map((row) => ({ id: row.id, schoolId: row.id, number: row.code ?? row.slug, name: row.name, gender: null, status: row.status }));
  }
  if (entity === "student") {
    const rows = await db.select({ id: students.id, schoolId: students.schoolId, number: students.studentNumber, first: students.firstName, last: students.lastName, gender: students.gender, status: students.status })
      .from(students).where(inArray(students.schoolId, schoolIds)).orderBy(asc(students.lastName), asc(students.firstName));
    return rows.map((row) => ({ id: row.id, schoolId: row.schoolId, number: row.number, name: `${row.first} ${row.last}`, gender: row.gender, status: row.status }));
  }
  if (entity === "teacher") {
    const rows = await db.select({ id: teachers.id, schoolId: teachers.schoolId, number: teachers.teacherNumber, first: teachers.firstName, last: teachers.lastName, gender: teachers.gender, status: teachers.status })
      .from(teachers).where(inArray(teachers.schoolId, schoolIds)).orderBy(asc(teachers.lastName), asc(teachers.firstName));
    return rows.map((row) => ({ id: row.id, schoolId: row.schoolId, number: row.number, name: `${row.first} ${row.last}`, gender: row.gender, status: row.status }));
  }
  const rows = await db.select({ id: staffMembers.id, schoolId: staffMembers.schoolId, number: staffMembers.employeeNumber, first: staffMembers.firstName, last: staffMembers.lastName, status: staffMembers.status })
    .from(staffMembers).where(inArray(staffMembers.schoolId, schoolIds)).orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName));
  return rows.map((row) => ({ id: row.id, schoolId: row.schoolId, number: row.number, name: `${row.first} ${row.last}`, gender: null, status: row.status }));
}

/** The school a record belongs to, or null when it is not one of `entity`. */
export async function recordSchool(entity: FieldEntity, entityId: string): Promise<string | null> {
  if (entity === "school") {
    const [row] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, entityId)).limit(1);
    return row?.id ?? null;
  }
  const table = entity === "student" ? students : entity === "teacher" ? teachers : staffMembers;
  const [row] = await db.select({ schoolId: table.schoolId }).from(table).where(eq(table.id, entityId)).limit(1);
  return row?.schoolId ?? null;
}

/** Finds a record at a school by its number (student number, teacher number, employee number or school code). */
export async function findRecordByNumber(entity: FieldEntity, schoolId: string, number: string) {
  if (entity === "student") {
    const [row] = await db.select({ id: students.id }).from(students).where(and(eq(students.schoolId, schoolId), eq(students.studentNumber, number))).limit(1);
    return row?.id ?? null;
  }
  if (entity === "teacher") {
    const [row] = await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.schoolId, schoolId), eq(teachers.teacherNumber, number))).limit(1);
    return row?.id ?? null;
  }
  if (entity === "staff") {
    const [row] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.schoolId, schoolId), eq(staffMembers.employeeNumber, number))).limit(1);
    return row?.id ?? null;
  }
  return schoolId;
}

export const RECORD_NUMBER_COLUMN: Record<FieldEntity, string> = {
  school: "school_code",
  student: "student_number",
  teacher: "teacher_number",
  staff: "employee_number",
};
