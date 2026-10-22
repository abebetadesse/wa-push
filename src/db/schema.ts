import {
  boolean,
  char,
  date,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { randomUUID } from "node:crypto";
import { SCHOOL_ROLES } from "../lib/roles";

const id = () => varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => timestamp("created_at").notNull().defaultNow();

export const authUsers = mysqlTable(
  "school_auth_users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: varchar("role", { length: 255 }).notNull().default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("school_auth_users_email_unique").on(table.email)],
);

export const authSessions = mysqlTable(
  "school_auth_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    impersonatedBy: varchar("impersonated_by", { length: 36 }),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("school_auth_sessions_token_unique").on(table.token),
    index("school_auth_sessions_user_idx").on(table.userId),
  ],
);

export const authAccounts = mysqlTable(
  "school_auth_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 100 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("school_auth_accounts_user_idx").on(table.userId)],
);

export const authVerifications = mysqlTable(
  "school_auth_verifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("school_auth_verifications_identifier_idx").on(table.identifier)],
);

export const schools = mysqlTable(
  "school_schools",
  {
    id: id(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }),
    phone: varchar("phone", { length: 40 }),
    country: varchar("country", { length: 100 }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Africa/Nairobi"),
    status: mysqlEnum("status", ["active", "trial", "suspended"]).notNull().default("trial"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("school_schools_slug_unique").on(table.slug)],
);

export const schoolMemberships = mysqlTable(
  "school_memberships",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", SCHOOL_ROLES).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_memberships_school_user_unique").on(table.schoolId, table.userId),
    index("school_memberships_user_idx").on(table.userId),
  ],
);

export const schoolInvitations = mysqlTable(
  "school_invitations",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    invitedBy: varchar("invited_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 254 }).notNull(),
    role: mysqlEnum("role", SCHOOL_ROLES).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_invitations_token_hash_unique").on(table.tokenHash),
    index("school_invitations_school_email_idx").on(table.schoolId, table.email),
  ],
);

export const activityEvents = mysqlTable(
  "school_activity_events",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    detail: varchar("detail", { length: 255 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("school_activity_events_school_created_idx").on(table.schoolId, table.createdAt)],
);

export const academicYears = mysqlTable(
  "school_academic_years",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_academic_years_school_name_unique").on(table.schoolId, table.name),
    index("school_academic_years_school_idx").on(table.schoolId),
  ],
);

export const gradeLevels = mysqlTable(
  "school_grade_levels",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_grade_levels_school_name_unique").on(table.schoolId, table.name),
    index("school_grade_levels_school_idx").on(table.schoolId),
  ],
);

export const classrooms = mysqlTable(
  "school_classrooms",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    gradeLevelId: varchar("grade_level_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(),
    capacity: int("capacity"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_classrooms_year_name_unique").on(table.academicYearId, table.name),
    index("school_classrooms_school_year_idx").on(table.schoolId, table.academicYearId),
  ],
);

export const students = mysqlTable(
  "school_students",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentNumber: varchar("student_number", { length: 80 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }),
    userId: varchar("user_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    status: mysqlEnum("status", ["active", "inactive", "graduated", "transferred"]).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_students_school_number_unique").on(table.schoolId, table.studentNumber),
    uniqueIndex("school_students_school_user_unique").on(table.schoolId, table.userId),
    index("school_students_school_name_idx").on(table.schoolId, table.lastName, table.firstName),
  ],
);

export const enrollments = mysqlTable(
  "school_enrollments",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    classroomId: varchar("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "restrict" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["enrolled", "completed", "withdrawn"]).notNull().default("enrolled"),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("school_enrollments_student_year_unique").on(table.studentId, table.academicYearId),
    index("school_enrollments_school_class_idx").on(table.schoolId, table.classroomId),
  ],
);

export const subjects = mysqlTable(
  "school_subjects",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 30 }),
    department: varchar("department", { length: 100 }),
    description: text("description"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_subjects_school_name_unique").on(table.schoolId, table.name),
    index("school_subjects_school_idx").on(table.schoolId),
  ],
);

export const teachers = mysqlTable(
  "school_teachers",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    teacherNumber: varchar("teacher_number", { length: 80 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }),
    phone: varchar("phone", { length: 40 }),
    specialization: varchar("specialization", { length: 150 }),
    status: mysqlEnum("status", ["active", "on_leave", "inactive"]).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_teachers_school_number_unique").on(table.schoolId, table.teacherNumber),
    index("school_teachers_school_name_idx").on(table.schoolId, table.lastName, table.firstName),
  ],
);

export const lessonPlans = mysqlTable(
  "school_lesson_plans",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    gradeLevelId: varchar("grade_level_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict" }),
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict" }),
    classroomId: varchar("classroom_id", { length: 36 }).references(() => classrooms.id, { onDelete: "set null" }),
    teacherId: varchar("teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
    sourceResourceId: varchar("source_resource_id", { length: 36 }).references(() => learningResources.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    unitTopic: varchar("unit_topic", { length: 160 }),
    durationMinutes: int("duration_minutes").notNull().default(45),
    scheduledDate: date("scheduled_date", { mode: "string" }),
    status: mysqlEnum("status", ["draft", "submitted", "approved", "published", "archived"]).notNull().default("draft"),
    overview: text("overview"),
    objectives: text("objectives"),
    materials: text("materials"),
    prerequisites: text("prerequisites"),
    procedures: text("procedures"),
    differentiation: text("differentiation"),
    assessment: text("assessment"),
    homework: text("homework"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("school_lesson_plans_school_subject_idx").on(table.schoolId, table.subjectId),
    index("school_lesson_plans_teacher_idx").on(table.teacherId),
    index("school_lesson_plans_scheduled_date_idx").on(table.schoolId, table.scheduledDate),
    index("school_lesson_plans_source_resource_idx").on(table.sourceResourceId),
  ],
);

export const lessonPlanRevisions = mysqlTable(
  "school_lesson_plan_revisions",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    lessonPlanId: varchar("lesson_plan_id", { length: 36 }).notNull().references(() => lessonPlans.id, { onDelete: "cascade" }),
    version: int("version").notNull().default(1),
    editedBy: varchar("edited_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    changeSummary: varchar("change_summary", { length: 255 }).notNull().default("Updated lesson plan"),
    title: varchar("title", { length: 200 }).notNull(),
    unitTopic: varchar("unit_topic", { length: 160 }),
    durationMinutes: int("duration_minutes").notNull().default(45),
    scheduledDate: date("scheduled_date", { mode: "string" }),
    status: mysqlEnum("status", ["draft", "submitted", "approved", "published", "archived"]).notNull().default("draft"),
    overview: text("overview"),
    objectives: text("objectives"),
    materials: text("materials"),
    prerequisites: text("prerequisites"),
    procedures: text("procedures"),
    differentiation: text("differentiation"),
    assessment: text("assessment"),
    homework: text("homework"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => [
    index("school_lesson_revisions_plan_idx").on(table.lessonPlanId, table.version),
    index("school_lesson_revisions_school_idx").on(table.schoolId),
  ],
);

export const assessments = mysqlTable(
  "school_assessments",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    classroomId: varchar("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "restrict" }),
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    instructions: text("instructions"),
    status: mysqlEnum("status", ["draft", "published", "closed"]).notNull().default("draft"),
    maxScore: int("max_score").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("school_assessments_school_class_idx").on(table.schoolId, table.classroomId),
    index("school_assessments_creator_idx").on(table.createdBy),
  ],
);

export const assessmentQuestions = mysqlTable(
  "school_assessment_questions",
  {
    id: id(),
    assessmentId: varchar("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    options: json("options").$type<string[]>().notNull(),
    correctOption: int("correct_option").notNull(),
    points: int("points").notNull().default(1),
    sortOrder: int("sort_order").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("school_assessment_questions_assessment_order_idx").on(table.assessmentId, table.sortOrder)],
);

// Official textbooks known to the platform, shared by every school. A school adds one to its
// resource library by downloading it (learningResources.catalogEntryId points back here).
export const textbookCatalog = mysqlTable(
  "school_textbook_catalog",
  {
    id: id(),
    grade: int("grade").notNull(),
    subjectName: varchar("subject_name", { length: 120 }).notNull(),
    language: varchar("language", { length: 40 }).notNull(),
    kind: mysqlEnum("kind", ["student_textbook", "teacher_guide"]).notNull().default("student_textbook"),
    title: varchar("title", { length: 200 }).notNull(),
    publisher: varchar("publisher", { length: 160 }).notNull(),
    sourceUrl: varchar("source_url", { length: 1000 }).notNull(),
    sourceUrlHash: char("source_url_hash", { length: 64 }).notNull(),
    /** The URL is the PDF itself, not a page that links to it. */
    directDownload: boolean("direct_download").notNull().default(true),
    sizeBytes: int("size_bytes"),
    checkStatus: mysqlEnum("check_status", ["unchecked", "ok", "missing", "unreachable"]).notNull().default("unchecked"),
    checkedAt: timestamp("checked_at"),
    addedBy: varchar("added_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_textbook_catalog_source_unique").on(table.sourceUrlHash),
    index("school_textbook_catalog_grade_subject_idx").on(table.grade, table.subjectName),
  ],
);

export const learningResources = mysqlTable(
  "school_learning_resources",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    gradeLevelId: varchar("grade_level_id", { length: 36 }),
    subjectId: varchar("subject_id", { length: 36 }).references(() => subjects.id, { onDelete: "set null" }),
    catalogEntryId: varchar("catalog_entry_id", { length: 36 }),
    /** The file's id in the Claude Files API, once it has been uploaded for AI generation. */
    aiFileId: varchar("ai_file_id", { length: 80 }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    storageKey: varchar("storage_key", { length: 36 }).notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_learning_resources_storage_key_unique").on(table.storageKey),
    index("school_learning_resources_school_created_idx").on(table.schoolId, table.createdAt),
    index("school_learning_resources_grade_subject_idx").on(table.schoolId, table.gradeLevelId, table.subjectId),
    uniqueIndex("school_learning_resources_school_catalog_unique").on(table.schoolId, table.catalogEntryId),
    // Named by hand: the generated names pass MySQL's 64-character limit.
    foreignKey({ name: "school_lr_grade_level_fk", columns: [table.gradeLevelId], foreignColumns: [gradeLevels.id] })
      .onDelete("set null"),
    foreignKey({ name: "school_lr_catalog_entry_fk", columns: [table.catalogEntryId], foreignColumns: [textbookCatalog.id] })
      .onDelete("set null"),
  ],
);

// Teaching material written by Claude from a library textbook: lesson plans, lecture notes,
// assignments and exams. `content` holds the structured result; see src/lib/ai-materials.ts.
export const generatedMaterials = mysqlTable(
  "school_generated_materials",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    resourceId: varchar("resource_id", { length: 36 }),
    gradeLevelId: varchar("grade_level_id", { length: 36 }),
    subjectId: varchar("subject_id", { length: 36 }),
    createdBy: varchar("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    kind: mysqlEnum("kind", ["lesson_plan", "lecture_notes", "assignment", "exam"]).notNull(),
    scope: varchar("scope", { length: 200 }).notNull(),
    instructions: text("instructions"),
    title: varchar("title", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["generating", "ready", "failed", "approved"]).notNull().default("generating"),
    content: json("content"),
    error: varchar("error", { length: 500 }),
    model: varchar("model", { length: 60 }).notNull(),
    inputTokens: int("input_tokens"),
    cachedInputTokens: int("cached_input_tokens"),
    outputTokens: int("output_tokens"),
    lessonPlanId: varchar("lesson_plan_id", { length: 36 }),
    assessmentId: varchar("assessment_id", { length: 36 }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("school_generated_materials_school_created_idx").on(table.schoolId, table.createdAt),
    index("school_generated_materials_resource_idx").on(table.resourceId),
    // Named by hand: the generated names pass MySQL's 64-character limit.
    foreignKey({ name: "school_gm_resource_fk", columns: [table.resourceId], foreignColumns: [learningResources.id] }).onDelete("set null"),
    foreignKey({ name: "school_gm_grade_level_fk", columns: [table.gradeLevelId], foreignColumns: [gradeLevels.id] }).onDelete("set null"),
    foreignKey({ name: "school_gm_subject_fk", columns: [table.subjectId], foreignColumns: [subjects.id] }).onDelete("set null"),
    foreignKey({ name: "school_gm_lesson_plan_fk", columns: [table.lessonPlanId], foreignColumns: [lessonPlans.id] }).onDelete("set null"),
    foreignKey({ name: "school_gm_assessment_fk", columns: [table.assessmentId], foreignColumns: [assessments.id] }).onDelete("set null"),
  ],
);

export const assessmentResults = mysqlTable(
  "school_assessment_results",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    assessmentId: varchar("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    score: int("score").notNull(),
    feedback: varchar("feedback", { length: 500 }),
    markedBy: varchar("marked_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_assessment_results_assessment_student_unique").on(table.assessmentId, table.studentId),
    index("school_assessment_results_school_student_idx").on(table.schoolId, table.studentId),
  ],
);

export const assessmentAttempts = mysqlTable(
  "school_assessment_attempts",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    assessmentId: varchar("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    answers: json("answers").$type<number[]>().notNull(),
    score: int("score").notNull(),
    maxScore: int("max_score").notNull(),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("school_assessment_attempts_assessment_student_unique").on(table.assessmentId, table.studentId),
    index("school_assessment_attempts_school_assessment_idx").on(table.schoolId, table.assessmentId),
  ],
);

export const classSchedules = mysqlTable(
  "school_class_schedules",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    classroomId: varchar("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict" }),
    teacherId: varchar("teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
    lessonPlanId: varchar("lesson_plan_id", { length: 36 }).references(() => lessonPlans.id, { onDelete: "set null" }),
    dayOfWeek: mysqlEnum("day_of_week", ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).notNull(),
    startTime: varchar("start_time", { length: 10 }).notNull(),
    endTime: varchar("end_time", { length: 10 }).notNull(),
    roomNumber: varchar("room_number", { length: 50 }),
    status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).notNull().default("scheduled"),
    createdAt: createdAt(),
  },
  (table) => [
    index("school_class_schedules_classroom_idx").on(table.classroomId, table.dayOfWeek),
    index("school_class_schedules_teacher_idx").on(table.teacherId, table.dayOfWeek),
    index("school_class_schedules_school_idx").on(table.schoolId),
  ],
);

export const attendanceRecords = mysqlTable(
  "school_attendance_records",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    classScheduleId: varchar("class_schedule_id", { length: 36 }).references(() => classSchedules.id, { onDelete: "set null" }),
    classroomId: varchar("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["present", "absent", "late", "excused"]).notNull().default("present"),
    remarks: varchar("remarks", { length: 255 }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_attendance_student_class_date_unique").on(table.studentId, table.classroomId, table.date),
    index("school_attendance_school_date_idx").on(table.schoolId, table.date),
  ],
);

export const inventoryItems = mysqlTable(
  "school_inventory_items",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    sku: varchar("sku", { length: 80 }),
    category: varchar("category", { length: 100 }),
    unit: varchar("unit", { length: 40 }).notNull().default("item"),
    quantityOnHand: int("quantity_on_hand").notNull().default(0),
    reorderLevel: int("reorder_level").notNull().default(0),
    location: varchar("location", { length: 120 }),
    status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_inventory_items_school_sku_unique").on(table.schoolId, table.sku),
    index("school_inventory_items_school_name_idx").on(table.schoolId, table.name),
  ],
);

export const inventoryMovements = mysqlTable(
  "school_inventory_movements",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    itemId: varchar("item_id", { length: 36 }).notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
    movementType: mysqlEnum("movement_type", ["received", "issued"]).notNull(),
    quantity: int("quantity").notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    recordedBy: varchar("recorded_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("school_inventory_movements_school_item_idx").on(table.schoolId, table.itemId),
    index("school_inventory_movements_created_idx").on(table.schoolId, table.createdAt),
  ],
);

export const staffMembers = mysqlTable(
  "school_staff_members",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    employeeNumber: varchar("employee_number", { length: 80 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }),
    phone: varchar("phone", { length: 40 }),
    jobTitle: varchar("job_title", { length: 120 }).notNull(),
    hiredOn: date("hired_on", { mode: "string" }),
    status: mysqlEnum("status", ["active", "on_leave", "inactive"]).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_staff_members_school_employee_unique").on(table.schoolId, table.employeeNumber),
    uniqueIndex("school_staff_members_school_user_unique").on(table.schoolId, table.userId),
    index("school_staff_members_school_name_idx").on(table.schoolId, table.lastName, table.firstName),
  ],
);

export const staffLeave = mysqlTable(
  "school_staff_leave",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    staffId: varchar("staff_id", { length: 36 }).notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
    leaveType: mysqlEnum("leave_type", ["annual", "sick", "maternity", "paternity", "bereavement", "study", "unpaid", "other"]).notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    reason: varchar("reason", { length: 500 }),
    status: mysqlEnum("status", ["requested", "approved", "rejected", "cancelled"]).notNull().default("requested"),
    decidedBy: varchar("decided_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at"),
    createdBy: varchar("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("school_staff_leave_school_start_idx").on(table.schoolId, table.startsOn),
    index("school_staff_leave_staff_idx").on(table.staffId),
  ],
);

// Employment terms only; pay and other sensitive records stay outside Forma.
export const staffContracts = mysqlTable(
  "school_staff_contracts",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    staffId: varchar("staff_id", { length: 36 }).notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
    contractType: mysqlEnum("contract_type", ["permanent", "fixed_term", "temporary", "part_time", "volunteer"]).notNull(),
    position: varchar("position", { length: 120 }).notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    notes: varchar("notes", { length: 500 }),
    status: mysqlEnum("status", ["active", "ended"]).notNull().default("active"),
    createdAt: createdAt(),
  },
  (table) => [index("school_staff_contracts_school_staff_idx").on(table.schoolId, table.staffId)],
);

export const staffAttendance = mysqlTable(
  "school_staff_attendance",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    staffId: varchar("staff_id", { length: 36 }).notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["present", "absent", "late", "on_leave"]).notNull(),
    remarks: varchar("remarks", { length: 255 }),
    recordedBy: varchar("recorded_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_staff_attendance_staff_date_unique").on(table.staffId, table.date),
    index("school_staff_attendance_school_date_idx").on(table.schoolId, table.date),
  ],
);

export const libraryBooks = mysqlTable(
  "school_library_books",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    author: varchar("author", { length: 160 }),
    isbn: varchar("isbn", { length: 20 }),
    publisher: varchar("publisher", { length: 160 }),
    publishedYear: int("published_year"),
    category: varchar("category", { length: 80 }),
    language: varchar("language", { length: 40 }),
    gradeLevelId: varchar("grade_level_id", { length: 36 }).references(() => gradeLevels.id, { onDelete: "set null" }),
    subjectId: varchar("subject_id", { length: 36 }).references(() => subjects.id, { onDelete: "set null" }),
    shelf: varchar("shelf", { length: 40 }),
    copies: int("copies").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("school_library_books_school_isbn_unique").on(table.schoolId, table.isbn),
    index("school_library_books_school_title_idx").on(table.schoolId, table.title),
  ],
);

export const libraryLoans = mysqlTable(
  "school_library_loans",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    bookId: varchar("book_id", { length: 36 }).notNull().references(() => libraryBooks.id, { onDelete: "cascade" }),
    borrowerType: mysqlEnum("borrower_type", ["student", "staff"]).notNull(),
    studentId: varchar("student_id", { length: 36 }).references(() => students.id, { onDelete: "set null" }),
    staffId: varchar("staff_id", { length: 36 }).references(() => staffMembers.id, { onDelete: "set null" }),
    /** Kept so the record stays readable if the student or staff record is removed. */
    borrowerName: varchar("borrower_name", { length: 200 }).notNull(),
    loanedOn: date("loaned_on", { mode: "string" }).notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    returnedOn: date("returned_on", { mode: "string" }),
    issuedBy: varchar("issued_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("school_library_loans_school_returned_idx").on(table.schoolId, table.returnedOn),
    index("school_library_loans_book_idx").on(table.bookId),
  ],
);

// Laboratories and workshops share one model: rooms with items, bookings and a safety/maintenance log.
export const facilities = mysqlTable(
  "school_facilities",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["lab", "workshop"]).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    location: varchar("location", { length: 120 }),
    capacity: int("capacity"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("school_facilities_school_kind_name_unique").on(table.schoolId, table.kind, table.name)],
);

export const facilityItems = mysqlTable(
  "school_facility_items",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    facilityId: varchar("facility_id", { length: 36 }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    category: mysqlEnum("category", ["equipment", "chemical", "consumable", "tool", "safety"]).notNull(),
    quantity: int("quantity").notNull().default(0),
    unit: varchar("unit", { length: 30 }).notNull().default("item"),
    reorderLevel: int("reorder_level").notNull().default(0),
    assetTag: varchar("asset_tag", { length: 60 }),
    hazard: varchar("hazard", { length: 80 }),
    condition: mysqlEnum("condition", ["good", "needs_repair", "out_of_service"]).notNull().default("good"),
    expiresOn: date("expires_on", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("school_facility_items_facility_idx").on(table.facilityId, table.name)],
);

export const facilityBookings = mysqlTable(
  "school_facility_bookings",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    facilityId: varchar("facility_id", { length: 36 }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    teacherId: varchar("teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
    classroomId: varchar("classroom_id", { length: 36 }).references(() => classrooms.id, { onDelete: "set null" }),
    purpose: varchar("purpose", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["booked", "completed", "cancelled"]).notNull().default("booked"),
    bookedBy: varchar("booked_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("school_facility_bookings_facility_date_idx").on(table.facilityId, table.date)],
);

export const facilityLogs = mysqlTable(
  "school_facility_logs",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    facilityId: varchar("facility_id", { length: 36 }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    itemId: varchar("item_id", { length: 36 }).references(() => facilityItems.id, { onDelete: "set null" }),
    logType: mysqlEnum("log_type", ["incident", "maintenance"]).notNull(),
    severity: mysqlEnum("severity", ["low", "medium", "high"]).notNull().default("low"),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    actionTaken: varchar("action_taken", { length: 1000 }),
    status: mysqlEnum("status", ["open", "resolved"]).notNull().default("open"),
    reportedBy: varchar("reported_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: createdAt(),
  },
  (table) => [index("school_facility_logs_facility_idx").on(table.facilityId, table.occurredOn)],
);

export const communityPartners = mysqlTable(
  "school_community_partners",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    partnerType: mysqlEnum("partner_type", ["parent_association", "ngo", "business", "government", "religious", "alumni", "health", "other"]).notNull(),
    contactName: varchar("contact_name", { length: 120 }),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 254 }),
    notes: varchar("notes", { length: 1000 }),
    status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("school_community_partners_school_name_unique").on(table.schoolId, table.name)],
);

export const communityEvents = mysqlTable(
  "school_community_events",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    eventType: mysqlEnum("event_type", ["parent_meeting", "ptsa_meeting", "community_service", "fundraiser", "open_day", "sports", "cultural", "awareness", "other"]).notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    startTime: varchar("start_time", { length: 5 }),
    location: varchar("location", { length: 160 }),
    partnerId: varchar("partner_id", { length: 36 }),
    description: varchar("description", { length: 1000 }),
    expectedAttendance: int("expected_attendance"),
    actualAttendance: int("actual_attendance"),
    /** Minutes, decisions and outcomes, written after the event. */
    outcome: text("outcome"),
    status: mysqlEnum("status", ["planned", "held", "cancelled"]).notNull().default("planned"),
    /** Listed on the school's public page (once public pages exist). */
    isPublic: boolean("is_public").notNull().default(false),
    createdBy: varchar("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("school_community_events_school_date_idx").on(table.schoolId, table.eventDate),
    foreignKey({ name: "school_ce_partner_fk", columns: [table.partnerId], foreignColumns: [communityPartners.id] }).onDelete("set null"),
  ],
);

export const volunteers = mysqlTable(
  "school_volunteers",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 254 }),
    skills: varchar("skills", { length: 300 }),
    availability: varchar("availability", { length: 200 }),
    partnerId: varchar("partner_id", { length: 36 }),
    hoursContributed: int("hours_contributed").notNull().default(0),
    status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
    createdAt: createdAt(),
  },
  (table) => [
    index("school_volunteers_school_name_idx").on(table.schoolId, table.name),
    foreignKey({ name: "school_volunteers_partner_fk", columns: [table.partnerId], foreignColumns: [communityPartners.id] }).onDelete("set null"),
  ],
);

// Public relations: photos, posts and the school's public profile. Each goes through review by a
// school admin, whose written feedback is kept with it; only approved or published content is public.
export const prMedia = mysqlTable(
  "school_pr_media",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 36 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 60 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    caption: varchar("caption", { length: 300 }),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
    adminFeedback: varchar("admin_feedback", { length: 1000 }),
    uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("school_pr_media_storage_key_unique").on(table.storageKey),
    index("school_pr_media_school_status_idx").on(table.schoolId, table.status),
  ],
);

export const prPosts = mysqlTable(
  "school_pr_posts",
  {
    id: id(),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    postType: mysqlEnum("post_type", ["news", "announcement", "achievement", "event_recap"]).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    summary: varchar("summary", { length: 300 }).notNull(),
    body: text("body").notNull(),
    coverMediaId: varchar("cover_media_id", { length: 36 }).references(() => prMedia.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["draft", "submitted", "changes_requested", "published", "archived"]).notNull().default("draft"),
    adminFeedback: text("admin_feedback"),
    authorId: varchar("author_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    publishedAt: timestamp("published_at"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("school_pr_posts_school_status_idx").on(table.schoolId, table.status, table.publishedAt)],
);

export const publicProfiles = mysqlTable(
  "school_public_profiles",
  {
    schoolId: varchar("school_id", { length: 36 }).primaryKey().references(() => schools.id, { onDelete: "cascade" }),
    tagline: varchar("tagline", { length: 160 }),
    about: text("about"),
    mission: varchar("mission", { length: 600 }),
    vision: varchar("vision", { length: 600 }),
    principalName: varchar("principal_name", { length: 120 }),
    principalMessage: text("principal_message"),
    address: varchar("address", { length: 200 }),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 254 }),
    heroMediaId: varchar("hero_media_id", { length: 36 }).references(() => prMedia.id, { onDelete: "set null" }),
    /** Review state of the fields above (the working copy). */
    status: mysqlEnum("status", ["draft", "submitted", "changes_requested", "approved"]).notNull().default("draft"),
    adminFeedback: text("admin_feedback"),
    /** The last approved copy of the fields; the public page shows this, so edits stay private until approved. */
    publishedContent: json("published_content").$type<Record<string, string | null>>(),
    /** The public page is live only while this is set; a school admin turns it on after approval. */
    isPublished: boolean("is_published").notNull().default(false),
    reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
);
