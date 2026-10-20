"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { academicYears, activityEvents, classrooms, enrollments, students } from "@/db/schema";
import { requireSchoolRole } from "@/lib/permissions";
import { isDuplicateEntry } from "@/lib/db-errors";

export type StudentActionState = { error?: string; success?: string };
type StudentStatus = "active" | "inactive" | "graduated" | "transferred";

function isStudentStatus(value: string): value is StudentStatus {
  return ["active", "inactive", "graduated", "transferred"].includes(value);
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function registerStudent(
  _previous: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const studentNumber = String(formData.get("studentNumber") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();

  if (!schoolId || studentNumber.length < 1 || studentNumber.length > 80) {
    return { error: "Enter a valid student number and school." };
  }
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    return { error: "First and last names are required and must be 100 characters or fewer." };
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { error: "Enter a valid email address." };
  }
  if (dateOfBirth && !isDate(dateOfBirth)) {
    return { error: "Enter a valid date of birth." };
  }

  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const studentId = randomUUID();
  const [classroom] = classroomId
    ? await db
      .select({ id: classrooms.id, academicYearId: classrooms.academicYearId })
      .from(classrooms)
      .innerJoin(academicYears, and(
        eq(classrooms.academicYearId, academicYears.id),
        eq(academicYears.isCurrent, true),
      ))
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, schoolId)))
      .limit(1)
    : [];
  if (classroomId && !classroom) return { error: "Select a classroom in this school’s current academic year." };

  try {
    await db.transaction(async (tx) => {
      await tx.insert(students).values({
        id: studentId,
        schoolId,
        studentNumber,
        firstName,
        lastName,
        email: email || null,
        dateOfBirth: dateOfBirth || null,
      });
      if (classroom) {
        await tx.insert(enrollments).values({
          id: randomUUID(),
          schoolId,
          studentId,
          classroomId: classroom.id,
          academicYearId: classroom.academicYearId,
        });
      }
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Registered student ${firstName} ${lastName}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "That student number is already in use at this school." };
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/students");
  return { success: `${firstName} ${lastName} was registered.` };
}

export async function changeStudentStatus(formData: FormData): Promise<void> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!schoolId || !studentId || !isStudentStatus(status)) {
    throw new Error("Invalid student status request.");
  }
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [student] = await db
    .select({ firstName: students.firstName, lastName: students.lastName })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)))
    .limit(1);
  if (!student) throw new Error("Student not found in this school.");

  await db.transaction(async (tx) => {
    await tx
      .update(students)
      .set({ status })
      .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Updated ${student.firstName} ${student.lastName} status to ${status}`,
    });
  });
  revalidatePath("/");
  revalidatePath("/students");
}

export async function updateStudent(
  _previous: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const studentNumber = String(formData.get("studentNumber") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();

  if (!schoolId || !studentId || studentNumber.length < 1 || studentNumber.length > 80) {
    return { error: "Enter a valid student number." };
  }
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    return { error: "First and last names are required and must be 100 characters or fewer." };
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { error: "Enter a valid email address." };
  }
  if (dateOfBirth && !isDate(dateOfBirth)) return { error: "Enter a valid date of birth." };
  if (!isStudentStatus(status)) return { error: "Select a valid student status." };

  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)))
    .limit(1);
  if (!student) return { error: "Student not found in this school." };

  const [currentYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true)))
    .limit(1);
  if (classroomId && !currentYear) return { error: "Set a current academic year before enrolling students." };
  const [classroom] = classroomId && currentYear
    ? await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.schoolId, schoolId),
        eq(classrooms.academicYearId, currentYear.id),
      ))
      .limit(1)
    : [];
  if (classroomId && !classroom) return { error: "Select a classroom in this school’s current academic year." };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(students)
        .set({
          studentNumber,
          firstName,
          lastName,
          email: email || null,
          dateOfBirth: dateOfBirth || null,
          status,
        })
        .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)));
      if (currentYear) {
        const [enrollment] = await tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.studentId, studentId), eq(enrollments.academicYearId, currentYear.id)))
          .limit(1)
          .for("update");
        if (classroom && enrollment) {
          await tx.update(enrollments)
            .set({ classroomId: classroom.id, status: "enrolled" })
            .where(eq(enrollments.id, enrollment.id));
        } else if (classroom) {
          await tx.insert(enrollments).values({
            id: randomUUID(),
            schoolId,
            studentId,
            classroomId: classroom.id,
            academicYearId: currentYear.id,
          });
        } else if (enrollment) {
          // Keep the enrollment row for history; withdrawn students drop out of class rosters.
          await tx.update(enrollments).set({ status: "withdrawn" }).where(eq(enrollments.id, enrollment.id));
        }
      }
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Updated student record for ${firstName} ${lastName}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "That student number is already in use at this school." };
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { success: "Student record saved." };
}

export type BulkImportActionState = {
  error?: string;
  success?: string;
  imported?: number;
  skipped?: number;
  details?: string[];
};

export async function bulkImportStudents(
  _previous: BulkImportActionState,
  formData: FormData,
): Promise<BulkImportActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const rawCsv = String(formData.get("csvContent") ?? "").trim();
  const defaultClassroomId = String(formData.get("defaultClassroomId") ?? "").trim();

  if (!schoolId) return { error: "Select a school." };
  if (!rawCsv) return { error: "Please provide CSV content or upload a CSV file." };

  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);

  const [currentYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true)))
    .limit(1);

  const classroomRows = currentYear
    ? await db
        .select({ id: classrooms.id, name: classrooms.name })
        .from(classrooms)
        .where(and(eq(classrooms.schoolId, schoolId), eq(classrooms.academicYearId, currentYear.id)))
    : [];

  const classroomMap = new Map<string, string>();
  for (const c of classroomRows) {
    classroomMap.set(c.name.trim().toLowerCase(), c.id);
  }

  const lines = rawCsv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { error: "The provided CSV is empty." };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parsedRows = lines.map(parseLine);
  let startIndex = 0;
  const firstRowStr = parsedRows[0].join(" ").toLowerCase();
  if (
    firstRowStr.includes("student") ||
    firstRowStr.includes("name") ||
    firstRowStr.includes("number") ||
    firstRowStr.includes("first")
  ) {
    startIndex = 1;
  }

  let imported = 0;
  let skipped = 0;
  const details: string[] = [];

  for (let i = startIndex; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    const rowNum = i + 1;
    const studentNumber = row[0]?.trim() ?? "";
    const firstName = row[1]?.trim() ?? "";
    const lastName = row[2]?.trim() ?? "";
    const email = row[3]?.trim().toLowerCase() ?? "";
    const dateOfBirth = row[4]?.trim() ?? "";
    const className = row[5]?.trim() ?? "";

    if (!studentNumber || !firstName || !lastName) {
      skipped++;
      details.push(`Row ${rowNum}: Skipped - missing required fields (student number, first name, or last name).`);
      continue;
    }

    if (studentNumber.length > 80) {
      skipped++;
      details.push(`Row ${rowNum} (${studentNumber}): Student number exceeds 80 characters.`);
      continue;
    }

    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      skipped++;
      details.push(`Row ${rowNum} (${studentNumber}): Invalid email format "${email}".`);
      continue;
    }

    if (dateOfBirth && !isDate(dateOfBirth)) {
      skipped++;
      details.push(`Row ${rowNum} (${studentNumber}): Invalid date of birth "${dateOfBirth}" (expected YYYY-MM-DD).`);
      continue;
    }

    let targetClassroomId: string | null = null;
    if (className && classroomMap.has(className.toLowerCase())) {
      targetClassroomId = classroomMap.get(className.toLowerCase())!;
    } else if (defaultClassroomId && classroomRows.some((c) => c.id === defaultClassroomId)) {
      targetClassroomId = defaultClassroomId;
    }

    try {
      await db.transaction(async (tx) => {
        const studentId = randomUUID();
        await tx.insert(students).values({
          id: studentId,
          schoolId,
          studentNumber,
          firstName,
          lastName,
          email: email || null,
          dateOfBirth: dateOfBirth || null,
        });

        if (targetClassroomId && currentYear) {
          await tx.insert(enrollments).values({
            id: randomUUID(),
            schoolId,
            studentId,
            classroomId: targetClassroomId,
            academicYearId: currentYear.id,
          });
        }
      });
      imported++;
    } catch (err) {
      skipped++;
      if (isDuplicateEntry(err)) {
        details.push(`Row ${rowNum} (${studentNumber}): Student number already exists in this school.`);
      } else {
        details.push(`Row ${rowNum} (${studentNumber}): Failed to insert record.`);
      }
    }
  }

  if (imported > 0) {
    await db.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Bulk imported ${imported} student${imported === 1 ? "" : "s"}${skipped > 0 ? ` (${skipped} skipped)` : ""}`,
    });
    revalidatePath("/");
    revalidatePath("/students");
    revalidatePath("/reports");
  }

  const successMessage = imported > 0
    ? `Successfully imported ${imported} student${imported === 1 ? "" : "s"}${skipped > 0 ? ` (${skipped} skipped - see details below)` : ""}.`
    : undefined;

  return {
    success: successMessage,
    error: imported === 0 ? `No students imported. ${skipped} row(s) failed validation or had duplicates.` : undefined,
    imported,
    skipped,
    details: details.slice(0, 15),
  };
}

