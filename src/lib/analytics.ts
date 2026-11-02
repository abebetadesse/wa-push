import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  academicYears,
  assessmentResults,
  assessments,
  attendanceRecords,
  classrooms,
  enrollments,
  gradeLevels,
  schools,
  students,
  subjects,
} from "@/db/schema";
import { ANALYTICS_SOURCES, type AnalyticsColumn, type AnalyticsDataset, type AnalyticsSource } from "@/lib/analytics-shared";
import { CATEGORY_TYPES, fieldChoices, FILE_TYPES, isValueField, MULTI_TYPES, NUMERIC_TYPES, withFormulas, type FieldEntity } from "@/lib/custom-fields";
import { fieldsForSchool, fieldsForUnit, loadFieldValues, mayViewField, type FieldDefinition } from "@/lib/field-data";
import { entityRecords } from "@/lib/field-records";
import { schoolPlacement, type Hierarchy } from "@/lib/hierarchy";
import type { PrivilegeResolver, SchoolRole } from "@/lib/permissions";
import { ORG_LEVEL_LABELS, ORG_LEVELS } from "@/lib/roles";

const MAX_ROWS = 60_000;

const placementColumns: AnalyticsColumn[] = [
  ...ORG_LEVELS.map((level) => ({ key: level, label: ORG_LEVEL_LABELS[level], kind: "category" as const, group: "Place" })),
  { key: "school", label: "School", kind: "category", group: "Place" },
];

function placementOf(hierarchy: Hierarchy, schoolId: string, schoolName: string) {
  const placement = schoolPlacement(hierarchy, schoolId);
  return [...ORG_LEVELS.map((level) => placement[level] || "(not set)"), schoolName];
}

function ageOn(dateOfBirth: string | null, today = new Date()) {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

const humanGender = (value: string | null) => value === "female" ? "Female" : value === "male" ? "Male" : "(not set)";

/** Field columns for an entity: numbers become measures, choices become categories (a multi-choice field yields one Yes/No column per option). */
function fieldColumns(fields: FieldDefinition[]) {
  const columns: (AnalyticsColumn & { field: FieldDefinition; option?: string })[] = [];
  for (const field of fields) {
    if (!isValueField(field.fieldType) || FILE_TYPES.includes(field.fieldType)) continue;
    const label = field.labelLocal ? `${field.label} (${field.labelLocal})` : field.label;
    const group = field.section ? `Fields: ${field.section}` : "Fields";
    if (MULTI_TYPES.includes(field.fieldType)) {
      for (const option of fieldChoices(field)) columns.push({ key: `f.${field.fieldKey}.${option}`, label: `${field.label}: ${option}`, kind: "category", group, field, option });
      continue;
    }
    if (field.fieldType === "yes_no" || field.fieldType === "switch") {
      columns.push({ key: `f.${field.fieldKey}`, label, kind: "category", group, field });
      columns.push({ key: `f.${field.fieldKey}.count`, label: `${field.label} (1 = Yes)`, kind: "number", group, field });
      continue;
    }
    if (NUMERIC_TYPES.includes(field.fieldType)) columns.push({ key: `f.${field.fieldKey}`, label, kind: "number", group, field });
    else if (CATEGORY_TYPES.includes(field.fieldType) || ["date", "month"].includes(field.fieldType)) columns.push({ key: `f.${field.fieldKey}`, label, kind: "category", group, field });
  }
  return columns;
}

function fieldCells(columns: ReturnType<typeof fieldColumns>, values: Map<string, unknown>) {
  return columns.map((column) => {
    const value = values.get(column.field.fieldKey);
    if (column.option !== undefined) return Array.isArray(value) ? (value.includes(column.option) ? "Yes" : "No") : null;
    if (column.key.endsWith(".count")) return value === "Yes" ? 1 : value === "No" ? 0 : null;
    if (value === null || value === undefined || value === "") return null;
    if (column.kind === "number") return typeof value === "number" ? value : Number(value) || null;
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  });
}

type Scope = { schoolIds: string[]; unitId: string | null; period: string };
type Viewer = { platformAdmin: boolean; rolesAt: (schoolId: string) => SchoolRole[]; resolver: PrivilegeResolver };

/** Fields that apply to every school in scope and the viewer may see at each of them. */
async function visibleFields(entity: FieldEntity, scope: Scope, viewer: Viewer) {
  const fields = scope.schoolIds.length === 1 ? await fieldsForSchool(scope.schoolIds[0], entity) : await fieldsForUnit(scope.unitId, entity);
  return fields.filter((field) => scope.schoolIds.some((schoolId) => mayViewField(field, viewer.rolesAt(schoolId), viewer.resolver, schoolId, viewer.platformAdmin)));
}

/** Builds one analytics dataset: flat rows, one per record, over the schools in scope. */
export async function buildDataset(source: AnalyticsSource, scope: Scope, hierarchy: Hierarchy, viewer: Viewer): Promise<AnalyticsDataset> {
  const meta = ANALYTICS_SOURCES.find((entry) => entry.key === source)!;
  const schoolRows = scope.schoolIds.length
    ? await db.select({ id: schools.id, name: schools.name, kebele: schools.kebele, code: schools.schoolCode, status: schools.status }).from(schools).where(inArray(schools.id, scope.schoolIds))
    : [];
  const schoolById = new Map(schoolRows.map((school) => [school.id, school]));
  const place = (schoolId: string) => placementOf(hierarchy, schoolId, schoolById.get(schoolId)?.name ?? "");
  let columns: AnalyticsColumn[] = [];
  let rows: (string | number | null)[][] = [];
  let truncated = false;

  if (source === "schools") {
    const fields = await visibleFields("school", scope, viewer);
    const extra = fieldColumns(fields);
    const values = await loadFieldValues(fields, schoolRows.map((school) => school.id), scope.period);
    columns = [...placementColumns,
      { key: "kebele", label: "Kebele", kind: "category", group: "Place" },
      { key: "status", label: "Account status", kind: "category", group: "School" },
      { key: "schools", label: "Schools", kind: "number", group: "School" },
      ...extra];
    rows = schoolRows.map((school) => [...place(school.id), school.kebele ?? "(not set)", school.status, 1, ...fieldCells(extra, withFormulas(fields, values.get(school.id) ?? new Map()))]);
  } else if (source === "students" || source === "teachers" || source === "staff") {
    const entity = source === "students" ? "student" : source === "teachers" ? "teacher" : "staff";
    const fields = await visibleFields(entity, scope, viewer);
    const extra = fieldColumns(fields);
    const records = (await entityRecords(entity, scope.schoolIds)).slice(0, MAX_ROWS);
    truncated = records.length >= MAX_ROWS;
    const values = await loadFieldValues(fields, records.map((record) => record.id), scope.period);
    let grade = new Map<string, { grade: string; classroom: string }>();
    let birth = new Map<string, string | null>();
    if (entity === "student" && records.length) {
      const ids = records.map((record) => record.id);
      const placed: { studentId: string; grade: string; classroom: string }[] = [];
      for (let start = 0; start < ids.length; start += 2000) {
        placed.push(...await db.select({ studentId: enrollments.studentId, grade: gradeLevels.name, classroom: classrooms.name })
          .from(enrollments)
          .innerJoin(academicYears, and(eq(enrollments.academicYearId, academicYears.id), eq(academicYears.isCurrent, true)))
          .innerJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
          .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
          .where(inArray(enrollments.studentId, ids.slice(start, start + 2000))));
        const births = await db.select({ id: students.id, dob: students.dateOfBirth }).from(students).where(inArray(students.id, ids.slice(start, start + 2000)));
        for (const row of births) birth.set(row.id, row.dob);
      }
      grade = new Map(placed.map((row) => [row.studentId, { grade: row.grade, classroom: row.classroom }]));
    } else {
      birth = new Map();
    }
    const label = meta.label.toLowerCase();
    columns = [...placementColumns,
      { key: "gender", label: "Sex", kind: "category", group: "Person" },
      { key: "status", label: "Status", kind: "category", group: "Person" },
      ...(entity === "student" ? [
        { key: "grade", label: "Grade (current year)", kind: "category" as const, group: "Person" },
        { key: "classroom", label: "Class", kind: "category" as const, group: "Person" },
        { key: "age", label: "Age (years)", kind: "number" as const, group: "Person" },
        { key: "age_group", label: "Age", kind: "category" as const, group: "Person" },
      ] : []),
      { key: "people", label: `Number of ${label}`, kind: "number", group: "Person" },
      ...extra];
    rows = records.map((record) => {
      const age = ageOn(birth.get(record.id) ?? null);
      return [
        ...place(record.schoolId),
        humanGender(record.gender),
        record.status,
        ...(entity === "student" ? [grade.get(record.id)?.grade ?? "(not enrolled)", grade.get(record.id)?.classroom ?? "(not enrolled)", age, age === null ? "(not set)" : `${age} years`] : []),
        1,
        ...fieldCells(extra, withFormulas(fields, values.get(record.id) ?? new Map())),
      ];
    });
  } else if (source === "attendance") {
    // Grouped in the database: one row per school, class, sex, month and status, with a count.
    const grouped = scope.schoolIds.length ? await db.select({
      schoolId: attendanceRecords.schoolId,
      classroom: classrooms.name,
      grade: gradeLevels.name,
      gender: students.gender,
      month: sql<string>`DATE_FORMAT(${attendanceRecords.date}, '%Y-%m')`,
      status: attendanceRecords.status,
      records: sql<number>`COUNT(*)`,
      learners: sql<number>`COUNT(DISTINCT ${attendanceRecords.studentId})`,
    }).from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .innerJoin(classrooms, eq(attendanceRecords.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(inArray(attendanceRecords.schoolId, scope.schoolIds))
      .groupBy(attendanceRecords.schoolId, classrooms.name, gradeLevels.name, students.gender, sql`DATE_FORMAT(${attendanceRecords.date}, '%Y-%m')`, attendanceRecords.status)
      .limit(MAX_ROWS) : [];
    columns = [...placementColumns,
      { key: "grade", label: "Grade", kind: "category", group: "Attendance" },
      { key: "classroom", label: "Class", kind: "category", group: "Attendance" },
      { key: "gender", label: "Sex", kind: "category", group: "Attendance" },
      { key: "month", label: "Month", kind: "category", group: "Attendance" },
      { key: "status", label: "Status", kind: "category", group: "Attendance" },
      { key: "records", label: "Attendance records", kind: "number", group: "Attendance" },
      { key: "present", label: "Present or late (records)", kind: "number", group: "Attendance" },
      { key: "absent", label: "Absent (records)", kind: "number", group: "Attendance" }];
    rows = grouped.map((row) => [...place(row.schoolId), row.grade, row.classroom, humanGender(row.gender), row.month, row.status, Number(row.records),
      row.status === "present" || row.status === "late" ? Number(row.records) : 0, row.status === "absent" ? Number(row.records) : 0]);
    truncated = grouped.length >= MAX_ROWS;
  } else if (source === "results") {
    const results = scope.schoolIds.length ? await db.select({
      schoolId: assessmentResults.schoolId,
      score: assessmentResults.score,
      maxScore: assessments.maxScore,
      title: assessments.title,
      subject: subjects.name,
      classroom: classrooms.name,
      grade: gradeLevels.name,
      year: academicYears.name,
      gender: students.gender,
      month: sql<string>`DATE_FORMAT(${assessmentResults.createdAt}, '%Y-%m')`,
    }).from(assessmentResults)
      .innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id))
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .innerJoin(classrooms, eq(assessments.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .innerJoin(academicYears, eq(assessments.academicYearId, academicYears.id))
      .innerJoin(students, eq(assessmentResults.studentId, students.id))
      .where(inArray(assessmentResults.schoolId, scope.schoolIds))
      .limit(MAX_ROWS) : [];
    columns = [...placementColumns,
      { key: "year", label: "Academic year", kind: "category", group: "Results" },
      { key: "grade", label: "Grade", kind: "category", group: "Results" },
      { key: "classroom", label: "Class", kind: "category", group: "Results" },
      { key: "subject", label: "Subject", kind: "category", group: "Results" },
      { key: "assessment", label: "Assessment", kind: "category", group: "Results" },
      { key: "gender", label: "Sex", kind: "category", group: "Results" },
      { key: "month", label: "Month marked", kind: "category", group: "Results" },
      { key: "band", label: "Score band", kind: "category", group: "Results" },
      { key: "percent", label: "Score (%)", kind: "number", group: "Results" },
      { key: "passed", label: "Passed (≥ 50%)", kind: "number", group: "Results" },
      { key: "results", label: "Results", kind: "number", group: "Results" }];
    rows = results.map((row) => {
      const percent = row.maxScore ? Math.round((row.score / row.maxScore) * 1000) / 10 : null;
      const band = percent === null ? "(no maximum)" : percent >= 85 ? "85–100" : percent >= 70 ? "70–84" : percent >= 50 ? "50–69" : "Below 50";
      return [...place(row.schoolId), row.year, row.grade, row.classroom, row.subject, row.title, humanGender(row.gender), row.month, band, percent, percent !== null && percent >= 50 ? 1 : 0, 1];
    });
    truncated = results.length >= MAX_ROWS;
  }
  return { source, columns, rows, truncated, period: scope.period, schoolCount: scope.schoolIds.length };
}
