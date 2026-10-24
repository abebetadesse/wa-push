"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/lib/roles.ts
var SCHOOL_ROLES, STAFF_ROLES, INVITE_ROLES;
var init_roles = __esm({
  "src/lib/roles.ts"() {
    "use strict";
    SCHOOL_ROLES = [
      "school_admin",
      "teacher",
      "student",
      "guardian",
      "inventory_manager",
      "hr_manager",
      "librarian",
      "lab_technician",
      "workshop_manager",
      "community_officer",
      "pr_officer"
    ];
    STAFF_ROLES = [
      "school_admin",
      "teacher",
      "inventory_manager",
      "hr_manager",
      "librarian",
      "lab_technician",
      "workshop_manager",
      "community_officer",
      "pr_officer"
    ];
    INVITE_ROLES = [...STAFF_ROLES, "student"];
  }
});

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  academicYears: () => academicYears,
  activityEvents: () => activityEvents,
  assessmentAttempts: () => assessmentAttempts,
  assessmentQuestions: () => assessmentQuestions,
  assessmentReminders: () => assessmentReminders,
  assessmentResults: () => assessmentResults,
  assessments: () => assessments,
  attendanceRecords: () => attendanceRecords,
  authAccounts: () => authAccounts,
  authSessions: () => authSessions,
  authUsers: () => authUsers,
  authVerifications: () => authVerifications,
  classSchedules: () => classSchedules,
  classrooms: () => classrooms,
  communityEvents: () => communityEvents,
  communityPartners: () => communityPartners,
  enrollments: () => enrollments,
  facilities: () => facilities,
  facilityBookings: () => facilityBookings,
  facilityItems: () => facilityItems,
  facilityLogs: () => facilityLogs,
  generatedMaterials: () => generatedMaterials,
  gradeLevels: () => gradeLevels,
  inventoryItems: () => inventoryItems,
  inventoryMovements: () => inventoryMovements,
  learningResources: () => learningResources,
  lessonPlanRevisions: () => lessonPlanRevisions,
  lessonPlans: () => lessonPlans,
  libraryBooks: () => libraryBooks,
  libraryLoans: () => libraryLoans,
  prMedia: () => prMedia,
  prPosts: () => prPosts,
  publicProfiles: () => publicProfiles,
  schoolInvitations: () => schoolInvitations,
  schoolMemberships: () => schoolMemberships,
  schools: () => schools,
  staffAttendance: () => staffAttendance,
  staffContracts: () => staffContracts,
  staffLeave: () => staffLeave,
  staffMembers: () => staffMembers,
  students: () => students,
  subjects: () => subjects,
  teachers: () => teachers,
  textbookCatalog: () => textbookCatalog,
  volunteers: () => volunteers
});
var import_mysql_core, import_node_crypto, id, createdAt, authUsers, authSessions, authAccounts, authVerifications, schools, schoolMemberships, schoolInvitations, activityEvents, academicYears, gradeLevels, classrooms, students, enrollments, subjects, teachers, lessonPlans, lessonPlanRevisions, assessments, assessmentQuestions, textbookCatalog, learningResources, generatedMaterials, assessmentResults, assessmentAttempts, assessmentReminders, classSchedules, attendanceRecords, inventoryItems, inventoryMovements, staffMembers, staffLeave, staffContracts, staffAttendance, libraryBooks, libraryLoans, facilities, facilityItems, facilityBookings, facilityLogs, communityPartners, communityEvents, volunteers, prMedia, prPosts, publicProfiles;
var init_schema = __esm({
  "src/db/schema.ts"() {
    "use strict";
    import_mysql_core = require("drizzle-orm/mysql-core");
    import_node_crypto = require("node:crypto");
    init_roles();
    id = () => (0, import_mysql_core.varchar)("id", { length: 36 }).primaryKey().$defaultFn(() => (0, import_node_crypto.randomUUID)());
    createdAt = () => (0, import_mysql_core.timestamp)("created_at").notNull().defaultNow();
    authUsers = (0, import_mysql_core.mysqlTable)(
      "school_auth_users",
      {
        id: (0, import_mysql_core.varchar)("id", { length: 36 }).primaryKey(),
        name: (0, import_mysql_core.varchar)("name", { length: 255 }).notNull(),
        email: (0, import_mysql_core.varchar)("email", { length: 255 }).notNull(),
        emailVerified: (0, import_mysql_core.boolean)("email_verified").notNull().default(false),
        image: (0, import_mysql_core.text)("image"),
        role: (0, import_mysql_core.varchar)("role", { length: 255 }).notNull().default("user"),
        banned: (0, import_mysql_core.boolean)("banned").notNull().default(false),
        banReason: (0, import_mysql_core.text)("ban_reason"),
        banExpires: (0, import_mysql_core.timestamp)("ban_expires"),
        createdAt: (0, import_mysql_core.timestamp)("created_at").notNull().defaultNow(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [(0, import_mysql_core.uniqueIndex)("school_auth_users_email_unique").on(table.email)]
    );
    authSessions = (0, import_mysql_core.mysqlTable)(
      "school_auth_sessions",
      {
        id: (0, import_mysql_core.varchar)("id", { length: 36 }).primaryKey(),
        expiresAt: (0, import_mysql_core.timestamp)("expires_at").notNull(),
        token: (0, import_mysql_core.varchar)("token", { length: 255 }).notNull(),
        createdAt: (0, import_mysql_core.timestamp)("created_at").notNull().defaultNow(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow(),
        ipAddress: (0, import_mysql_core.varchar)("ip_address", { length: 45 }),
        userAgent: (0, import_mysql_core.text)("user_agent"),
        impersonatedBy: (0, import_mysql_core.varchar)("impersonated_by", { length: 36 }),
        userId: (0, import_mysql_core.varchar)("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" })
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_auth_sessions_token_unique").on(table.token),
        (0, import_mysql_core.index)("school_auth_sessions_user_idx").on(table.userId)
      ]
    );
    authAccounts = (0, import_mysql_core.mysqlTable)(
      "school_auth_accounts",
      {
        id: (0, import_mysql_core.varchar)("id", { length: 36 }).primaryKey(),
        accountId: (0, import_mysql_core.varchar)("account_id", { length: 255 }).notNull(),
        providerId: (0, import_mysql_core.varchar)("provider_id", { length: 100 }).notNull(),
        userId: (0, import_mysql_core.varchar)("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" }),
        accessToken: (0, import_mysql_core.text)("access_token"),
        refreshToken: (0, import_mysql_core.text)("refresh_token"),
        idToken: (0, import_mysql_core.text)("id_token"),
        accessTokenExpiresAt: (0, import_mysql_core.timestamp)("access_token_expires_at"),
        refreshTokenExpiresAt: (0, import_mysql_core.timestamp)("refresh_token_expires_at"),
        scope: (0, import_mysql_core.text)("scope"),
        password: (0, import_mysql_core.text)("password"),
        createdAt: (0, import_mysql_core.timestamp)("created_at").notNull().defaultNow(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [(0, import_mysql_core.index)("school_auth_accounts_user_idx").on(table.userId)]
    );
    authVerifications = (0, import_mysql_core.mysqlTable)(
      "school_auth_verifications",
      {
        id: (0, import_mysql_core.varchar)("id", { length: 36 }).primaryKey(),
        identifier: (0, import_mysql_core.varchar)("identifier", { length: 255 }).notNull(),
        value: (0, import_mysql_core.text)("value").notNull(),
        expiresAt: (0, import_mysql_core.timestamp)("expires_at").notNull(),
        createdAt: (0, import_mysql_core.timestamp)("created_at").notNull().defaultNow(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [(0, import_mysql_core.index)("school_auth_verifications_identifier_idx").on(table.identifier)]
    );
    schools = (0, import_mysql_core.mysqlTable)(
      "school_schools",
      {
        id: id(),
        name: (0, import_mysql_core.varchar)("name", { length: 180 }).notNull(),
        slug: (0, import_mysql_core.varchar)("slug", { length: 100 }).notNull(),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }),
        phone: (0, import_mysql_core.varchar)("phone", { length: 40 }),
        country: (0, import_mysql_core.varchar)("country", { length: 100 }),
        timezone: (0, import_mysql_core.varchar)("timezone", { length: 64 }).notNull().default("Africa/Nairobi"),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "trial", "suspended"]).notNull().default("trial"),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [(0, import_mysql_core.uniqueIndex)("school_schools_slug_unique").on(table.slug)]
    );
    schoolMemberships = (0, import_mysql_core.mysqlTable)(
      "school_memberships",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        userId: (0, import_mysql_core.varchar)("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" }),
        role: (0, import_mysql_core.mysqlEnum)("role", SCHOOL_ROLES).notNull(),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_memberships_school_user_unique").on(table.schoolId, table.userId),
        (0, import_mysql_core.index)("school_memberships_user_idx").on(table.userId)
      ]
    );
    schoolInvitations = (0, import_mysql_core.mysqlTable)(
      "school_invitations",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        invitedBy: (0, import_mysql_core.varchar)("invited_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }).notNull(),
        role: (0, import_mysql_core.mysqlEnum)("role", SCHOOL_ROLES).notNull(),
        tokenHash: (0, import_mysql_core.varchar)("token_hash", { length: 64 }).notNull(),
        expiresAt: (0, import_mysql_core.timestamp)("expires_at").notNull(),
        acceptedAt: (0, import_mysql_core.timestamp)("accepted_at"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_invitations_token_hash_unique").on(table.tokenHash),
        (0, import_mysql_core.index)("school_invitations_school_email_idx").on(table.schoolId, table.email)
      ]
    );
    activityEvents = (0, import_mysql_core.mysqlTable)(
      "school_activity_events",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        userId: (0, import_mysql_core.varchar)("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
        detail: (0, import_mysql_core.varchar)("detail", { length: 255 }).notNull(),
        createdAt: createdAt()
      },
      (table) => [(0, import_mysql_core.index)("school_activity_events_school_created_idx").on(table.schoolId, table.createdAt)]
    );
    academicYears = (0, import_mysql_core.mysqlTable)(
      "school_academic_years",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        name: (0, import_mysql_core.varchar)("name", { length: 80 }).notNull(),
        startsOn: (0, import_mysql_core.date)("starts_on", { mode: "string" }).notNull(),
        endsOn: (0, import_mysql_core.date)("ends_on", { mode: "string" }).notNull(),
        isCurrent: (0, import_mysql_core.boolean)("is_current").notNull().default(false),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_academic_years_school_name_unique").on(table.schoolId, table.name),
        (0, import_mysql_core.index)("school_academic_years_school_idx").on(table.schoolId)
      ]
    );
    gradeLevels = (0, import_mysql_core.mysqlTable)(
      "school_grade_levels",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        name: (0, import_mysql_core.varchar)("name", { length: 80 }).notNull(),
        sortOrder: (0, import_mysql_core.int)("sort_order").notNull().default(0),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_grade_levels_school_name_unique").on(table.schoolId, table.name),
        (0, import_mysql_core.index)("school_grade_levels_school_idx").on(table.schoolId)
      ]
    );
    classrooms = (0, import_mysql_core.mysqlTable)(
      "school_classrooms",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        academicYearId: (0, import_mysql_core.varchar)("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
        gradeLevelId: (0, import_mysql_core.varchar)("grade_level_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict" }),
        name: (0, import_mysql_core.varchar)("name", { length: 100 }).notNull(),
        capacity: (0, import_mysql_core.int)("capacity"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_classrooms_year_name_unique").on(table.academicYearId, table.name),
        (0, import_mysql_core.index)("school_classrooms_school_year_idx").on(table.schoolId, table.academicYearId)
      ]
    );
    students = (0, import_mysql_core.mysqlTable)(
      "school_students",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        studentNumber: (0, import_mysql_core.varchar)("student_number", { length: 80 }).notNull(),
        firstName: (0, import_mysql_core.varchar)("first_name", { length: 100 }).notNull(),
        lastName: (0, import_mysql_core.varchar)("last_name", { length: 100 }).notNull(),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }),
        guardianEmail: (0, import_mysql_core.varchar)("guardian_email", { length: 254 }),
        userId: (0, import_mysql_core.varchar)("user_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        dateOfBirth: (0, import_mysql_core.date)("date_of_birth", { mode: "string" }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "inactive", "graduated", "transferred"]).notNull().default("active"),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_students_school_number_unique").on(table.schoolId, table.studentNumber),
        (0, import_mysql_core.uniqueIndex)("school_students_school_user_unique").on(table.schoolId, table.userId),
        (0, import_mysql_core.index)("school_students_school_name_idx").on(table.schoolId, table.lastName, table.firstName)
      ]
    );
    enrollments = (0, import_mysql_core.mysqlTable)(
      "school_enrollments",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        studentId: (0, import_mysql_core.varchar)("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
        classroomId: (0, import_mysql_core.varchar)("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "restrict" }),
        academicYearId: (0, import_mysql_core.varchar)("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["enrolled", "completed", "withdrawn"]).notNull().default("enrolled"),
        enrolledAt: (0, import_mysql_core.timestamp)("enrolled_at").notNull().defaultNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_enrollments_student_year_unique").on(table.studentId, table.academicYearId),
        (0, import_mysql_core.index)("school_enrollments_school_class_idx").on(table.schoolId, table.classroomId)
      ]
    );
    subjects = (0, import_mysql_core.mysqlTable)(
      "school_subjects",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        name: (0, import_mysql_core.varchar)("name", { length: 120 }).notNull(),
        code: (0, import_mysql_core.varchar)("code", { length: 30 }),
        department: (0, import_mysql_core.varchar)("department", { length: 100 }),
        description: (0, import_mysql_core.text)("description"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_subjects_school_name_unique").on(table.schoolId, table.name),
        (0, import_mysql_core.index)("school_subjects_school_idx").on(table.schoolId)
      ]
    );
    teachers = (0, import_mysql_core.mysqlTable)(
      "school_teachers",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        userId: (0, import_mysql_core.varchar)("user_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        teacherNumber: (0, import_mysql_core.varchar)("teacher_number", { length: 80 }).notNull(),
        firstName: (0, import_mysql_core.varchar)("first_name", { length: 100 }).notNull(),
        lastName: (0, import_mysql_core.varchar)("last_name", { length: 100 }).notNull(),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }),
        phone: (0, import_mysql_core.varchar)("phone", { length: 40 }),
        specialization: (0, import_mysql_core.varchar)("specialization", { length: 150 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "on_leave", "inactive"]).notNull().default("active"),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_teachers_school_number_unique").on(table.schoolId, table.teacherNumber),
        (0, import_mysql_core.index)("school_teachers_school_name_idx").on(table.schoolId, table.lastName, table.firstName)
      ]
    );
    lessonPlans = (0, import_mysql_core.mysqlTable)(
      "school_lesson_plans",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        createdBy: (0, import_mysql_core.varchar)("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        academicYearId: (0, import_mysql_core.varchar)("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
        gradeLevelId: (0, import_mysql_core.varchar)("grade_level_id", { length: 36 }).notNull().references(() => gradeLevels.id, { onDelete: "restrict" }),
        subjectId: (0, import_mysql_core.varchar)("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict" }),
        classroomId: (0, import_mysql_core.varchar)("classroom_id", { length: 36 }).references(() => classrooms.id, { onDelete: "set null" }),
        teacherId: (0, import_mysql_core.varchar)("teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
        sourceResourceId: (0, import_mysql_core.varchar)("source_resource_id", { length: 36 }).references(() => learningResources.id, { onDelete: "set null" }),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        unitTopic: (0, import_mysql_core.varchar)("unit_topic", { length: 160 }),
        durationMinutes: (0, import_mysql_core.int)("duration_minutes").notNull().default(45),
        scheduledDate: (0, import_mysql_core.date)("scheduled_date", { mode: "string" }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["draft", "submitted", "approved", "published", "archived"]).notNull().default("draft"),
        overview: (0, import_mysql_core.text)("overview"),
        objectives: (0, import_mysql_core.text)("objectives"),
        materials: (0, import_mysql_core.text)("materials"),
        prerequisites: (0, import_mysql_core.text)("prerequisites"),
        procedures: (0, import_mysql_core.text)("procedures"),
        differentiation: (0, import_mysql_core.text)("differentiation"),
        assessment: (0, import_mysql_core.text)("assessment"),
        homework: (0, import_mysql_core.text)("homework"),
        notes: (0, import_mysql_core.text)("notes"),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.index)("school_lesson_plans_school_subject_idx").on(table.schoolId, table.subjectId),
        (0, import_mysql_core.index)("school_lesson_plans_teacher_idx").on(table.teacherId),
        (0, import_mysql_core.index)("school_lesson_plans_scheduled_date_idx").on(table.schoolId, table.scheduledDate),
        (0, import_mysql_core.index)("school_lesson_plans_source_resource_idx").on(table.sourceResourceId)
      ]
    );
    lessonPlanRevisions = (0, import_mysql_core.mysqlTable)(
      "school_lesson_plan_revisions",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        lessonPlanId: (0, import_mysql_core.varchar)("lesson_plan_id", { length: 36 }).notNull().references(() => lessonPlans.id, { onDelete: "cascade" }),
        version: (0, import_mysql_core.int)("version").notNull().default(1),
        editedBy: (0, import_mysql_core.varchar)("edited_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        changeSummary: (0, import_mysql_core.varchar)("change_summary", { length: 255 }).notNull().default("Updated lesson plan"),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        unitTopic: (0, import_mysql_core.varchar)("unit_topic", { length: 160 }),
        durationMinutes: (0, import_mysql_core.int)("duration_minutes").notNull().default(45),
        scheduledDate: (0, import_mysql_core.date)("scheduled_date", { mode: "string" }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["draft", "submitted", "approved", "published", "archived"]).notNull().default("draft"),
        overview: (0, import_mysql_core.text)("overview"),
        objectives: (0, import_mysql_core.text)("objectives"),
        materials: (0, import_mysql_core.text)("materials"),
        prerequisites: (0, import_mysql_core.text)("prerequisites"),
        procedures: (0, import_mysql_core.text)("procedures"),
        differentiation: (0, import_mysql_core.text)("differentiation"),
        assessment: (0, import_mysql_core.text)("assessment"),
        homework: (0, import_mysql_core.text)("homework"),
        notes: (0, import_mysql_core.text)("notes"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.index)("school_lesson_revisions_plan_idx").on(table.lessonPlanId, table.version),
        (0, import_mysql_core.index)("school_lesson_revisions_school_idx").on(table.schoolId)
      ]
    );
    assessments = (0, import_mysql_core.mysqlTable)(
      "school_assessments",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        createdBy: (0, import_mysql_core.varchar)("created_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
        academicYearId: (0, import_mysql_core.varchar)("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
        classroomId: (0, import_mysql_core.varchar)("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "restrict" }),
        subjectId: (0, import_mysql_core.varchar)("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict" }),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        instructions: (0, import_mysql_core.text)("instructions"),
        dueOn: (0, import_mysql_core.date)("due_on", { mode: "string" }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["draft", "published", "closed"]).notNull().default("draft"),
        maxScore: (0, import_mysql_core.int)("max_score").notNull(),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.index)("school_assessments_school_class_idx").on(table.schoolId, table.classroomId),
        (0, import_mysql_core.index)("school_assessments_creator_idx").on(table.createdBy)
      ]
    );
    assessmentQuestions = (0, import_mysql_core.mysqlTable)(
      "school_assessment_questions",
      {
        id: id(),
        assessmentId: (0, import_mysql_core.varchar)("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
        questionText: (0, import_mysql_core.text)("question_text").notNull(),
        options: (0, import_mysql_core.json)("options").$type().notNull(),
        correctOption: (0, import_mysql_core.int)("correct_option").notNull(),
        points: (0, import_mysql_core.int)("points").notNull().default(1),
        sortOrder: (0, import_mysql_core.int)("sort_order").notNull(),
        createdAt: createdAt()
      },
      (table) => [(0, import_mysql_core.index)("school_assessment_questions_assessment_order_idx").on(table.assessmentId, table.sortOrder)]
    );
    textbookCatalog = (0, import_mysql_core.mysqlTable)(
      "school_textbook_catalog",
      {
        id: id(),
        grade: (0, import_mysql_core.int)("grade").notNull(),
        subjectName: (0, import_mysql_core.varchar)("subject_name", { length: 120 }).notNull(),
        language: (0, import_mysql_core.varchar)("language", { length: 40 }).notNull(),
        kind: (0, import_mysql_core.mysqlEnum)("kind", ["student_textbook", "teacher_guide"]).notNull().default("student_textbook"),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        publisher: (0, import_mysql_core.varchar)("publisher", { length: 160 }).notNull(),
        sourceUrl: (0, import_mysql_core.varchar)("source_url", { length: 1e3 }).notNull(),
        sourceUrlHash: (0, import_mysql_core.char)("source_url_hash", { length: 64 }).notNull(),
        /** The URL is the PDF itself, not a page that links to it. */
        directDownload: (0, import_mysql_core.boolean)("direct_download").notNull().default(true),
        sizeBytes: (0, import_mysql_core.int)("size_bytes"),
        checkStatus: (0, import_mysql_core.mysqlEnum)("check_status", ["unchecked", "ok", "missing", "unreachable"]).notNull().default("unchecked"),
        checkedAt: (0, import_mysql_core.timestamp)("checked_at"),
        addedBy: (0, import_mysql_core.varchar)("added_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_textbook_catalog_source_unique").on(table.sourceUrlHash),
        (0, import_mysql_core.index)("school_textbook_catalog_grade_subject_idx").on(table.grade, table.subjectName)
      ]
    );
    learningResources = (0, import_mysql_core.mysqlTable)(
      "school_learning_resources",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        uploadedBy: (0, import_mysql_core.varchar)("uploaded_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        gradeLevelId: (0, import_mysql_core.varchar)("grade_level_id", { length: 36 }),
        subjectId: (0, import_mysql_core.varchar)("subject_id", { length: 36 }).references(() => subjects.id, { onDelete: "set null" }),
        catalogEntryId: (0, import_mysql_core.varchar)("catalog_entry_id", { length: 36 }),
        /** The file's id in the Claude Files API, once it has been uploaded for AI generation. */
        aiFileId: (0, import_mysql_core.varchar)("ai_file_id", { length: 80 }),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        description: (0, import_mysql_core.text)("description"),
        fileName: (0, import_mysql_core.varchar)("file_name", { length: 255 }).notNull(),
        storageKey: (0, import_mysql_core.varchar)("storage_key", { length: 36 }).notNull(),
        contentType: (0, import_mysql_core.varchar)("content_type", { length: 120 }).notNull(),
        sizeBytes: (0, import_mysql_core.int)("size_bytes").notNull(),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_learning_resources_storage_key_unique").on(table.storageKey),
        (0, import_mysql_core.index)("school_learning_resources_school_created_idx").on(table.schoolId, table.createdAt),
        (0, import_mysql_core.index)("school_learning_resources_grade_subject_idx").on(table.schoolId, table.gradeLevelId, table.subjectId),
        (0, import_mysql_core.uniqueIndex)("school_learning_resources_school_catalog_unique").on(table.schoolId, table.catalogEntryId),
        // Named by hand: the generated names pass MySQL's 64-character limit.
        (0, import_mysql_core.foreignKey)({ name: "school_lr_grade_level_fk", columns: [table.gradeLevelId], foreignColumns: [gradeLevels.id] }).onDelete("set null"),
        (0, import_mysql_core.foreignKey)({ name: "school_lr_catalog_entry_fk", columns: [table.catalogEntryId], foreignColumns: [textbookCatalog.id] }).onDelete("set null")
      ]
    );
    generatedMaterials = (0, import_mysql_core.mysqlTable)(
      "school_generated_materials",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        resourceId: (0, import_mysql_core.varchar)("resource_id", { length: 36 }),
        gradeLevelId: (0, import_mysql_core.varchar)("grade_level_id", { length: 36 }),
        subjectId: (0, import_mysql_core.varchar)("subject_id", { length: 36 }),
        createdBy: (0, import_mysql_core.varchar)("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        kind: (0, import_mysql_core.mysqlEnum)("kind", ["lesson_plan", "lecture_notes", "assignment", "exam"]).notNull(),
        scope: (0, import_mysql_core.varchar)("scope", { length: 200 }).notNull(),
        instructions: (0, import_mysql_core.text)("instructions"),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        status: (0, import_mysql_core.mysqlEnum)("status", ["generating", "ready", "failed", "approved"]).notNull().default("generating"),
        content: (0, import_mysql_core.json)("content"),
        error: (0, import_mysql_core.varchar)("error", { length: 500 }),
        model: (0, import_mysql_core.varchar)("model", { length: 60 }).notNull(),
        inputTokens: (0, import_mysql_core.int)("input_tokens"),
        cachedInputTokens: (0, import_mysql_core.int)("cached_input_tokens"),
        outputTokens: (0, import_mysql_core.int)("output_tokens"),
        lessonPlanId: (0, import_mysql_core.varchar)("lesson_plan_id", { length: 36 }),
        assessmentId: (0, import_mysql_core.varchar)("assessment_id", { length: 36 }),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.index)("school_generated_materials_school_created_idx").on(table.schoolId, table.createdAt),
        (0, import_mysql_core.index)("school_generated_materials_resource_idx").on(table.resourceId),
        // Named by hand: the generated names pass MySQL's 64-character limit.
        (0, import_mysql_core.foreignKey)({ name: "school_gm_resource_fk", columns: [table.resourceId], foreignColumns: [learningResources.id] }).onDelete("set null"),
        (0, import_mysql_core.foreignKey)({ name: "school_gm_grade_level_fk", columns: [table.gradeLevelId], foreignColumns: [gradeLevels.id] }).onDelete("set null"),
        (0, import_mysql_core.foreignKey)({ name: "school_gm_subject_fk", columns: [table.subjectId], foreignColumns: [subjects.id] }).onDelete("set null"),
        (0, import_mysql_core.foreignKey)({ name: "school_gm_lesson_plan_fk", columns: [table.lessonPlanId], foreignColumns: [lessonPlans.id] }).onDelete("set null"),
        (0, import_mysql_core.foreignKey)({ name: "school_gm_assessment_fk", columns: [table.assessmentId], foreignColumns: [assessments.id] }).onDelete("set null")
      ]
    );
    assessmentResults = (0, import_mysql_core.mysqlTable)(
      "school_assessment_results",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        assessmentId: (0, import_mysql_core.varchar)("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
        studentId: (0, import_mysql_core.varchar)("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
        score: (0, import_mysql_core.int)("score").notNull(),
        feedback: (0, import_mysql_core.varchar)("feedback", { length: 500 }),
        markedBy: (0, import_mysql_core.varchar)("marked_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_assessment_results_assessment_student_unique").on(table.assessmentId, table.studentId),
        (0, import_mysql_core.index)("school_assessment_results_school_student_idx").on(table.schoolId, table.studentId)
      ]
    );
    assessmentAttempts = (0, import_mysql_core.mysqlTable)(
      "school_assessment_attempts",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        assessmentId: (0, import_mysql_core.varchar)("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
        studentId: (0, import_mysql_core.varchar)("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
        answers: (0, import_mysql_core.json)("answers").$type().notNull(),
        score: (0, import_mysql_core.int)("score").notNull(),
        maxScore: (0, import_mysql_core.int)("max_score").notNull(),
        submittedAt: (0, import_mysql_core.timestamp)("submitted_at").notNull().defaultNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_assessment_attempts_assessment_student_unique").on(table.assessmentId, table.studentId),
        (0, import_mysql_core.index)("school_assessment_attempts_school_assessment_idx").on(table.schoolId, table.assessmentId)
      ]
    );
    assessmentReminders = (0, import_mysql_core.mysqlTable)(
      "school_assessment_reminders",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull(),
        assessmentId: (0, import_mysql_core.varchar)("assessment_id", { length: 36 }).notNull(),
        studentId: (0, import_mysql_core.varchar)("student_id", { length: 36 }).notNull(),
        sentAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_assessment_reminders_student_unique").on(table.assessmentId, table.studentId),
        (0, import_mysql_core.index)("school_assessment_reminders_school_idx").on(table.schoolId),
        (0, import_mysql_core.foreignKey)({ name: "school_ar_school_fk", columns: [table.schoolId], foreignColumns: [schools.id] }).onDelete("cascade"),
        (0, import_mysql_core.foreignKey)({ name: "school_ar_assessment_fk", columns: [table.assessmentId], foreignColumns: [assessments.id] }).onDelete("cascade"),
        (0, import_mysql_core.foreignKey)({ name: "school_ar_student_fk", columns: [table.studentId], foreignColumns: [students.id] }).onDelete("cascade")
      ]
    );
    classSchedules = (0, import_mysql_core.mysqlTable)(
      "school_class_schedules",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        academicYearId: (0, import_mysql_core.varchar)("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
        classroomId: (0, import_mysql_core.varchar)("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "cascade" }),
        subjectId: (0, import_mysql_core.varchar)("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "restrict" }),
        teacherId: (0, import_mysql_core.varchar)("teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
        lessonPlanId: (0, import_mysql_core.varchar)("lesson_plan_id", { length: 36 }).references(() => lessonPlans.id, { onDelete: "set null" }),
        dayOfWeek: (0, import_mysql_core.mysqlEnum)("day_of_week", ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).notNull(),
        startTime: (0, import_mysql_core.varchar)("start_time", { length: 10 }).notNull(),
        endTime: (0, import_mysql_core.varchar)("end_time", { length: 10 }).notNull(),
        roomNumber: (0, import_mysql_core.varchar)("room_number", { length: 50 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["scheduled", "in_progress", "completed", "cancelled"]).notNull().default("scheduled"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.index)("school_class_schedules_classroom_idx").on(table.classroomId, table.dayOfWeek),
        (0, import_mysql_core.index)("school_class_schedules_teacher_idx").on(table.teacherId, table.dayOfWeek),
        (0, import_mysql_core.index)("school_class_schedules_school_idx").on(table.schoolId)
      ]
    );
    attendanceRecords = (0, import_mysql_core.mysqlTable)(
      "school_attendance_records",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        classScheduleId: (0, import_mysql_core.varchar)("class_schedule_id", { length: 36 }).references(() => classSchedules.id, { onDelete: "set null" }),
        classroomId: (0, import_mysql_core.varchar)("classroom_id", { length: 36 }).notNull().references(() => classrooms.id, { onDelete: "cascade" }),
        studentId: (0, import_mysql_core.varchar)("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
        date: (0, import_mysql_core.date)("date", { mode: "string" }).notNull(),
        status: (0, import_mysql_core.mysqlEnum)("status", ["present", "absent", "late", "excused"]).notNull().default("present"),
        remarks: (0, import_mysql_core.varchar)("remarks", { length: 255 }),
        guardianNotifiedAt: (0, import_mysql_core.timestamp)("guardian_notified_at"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_attendance_student_class_date_unique").on(table.studentId, table.classroomId, table.date),
        (0, import_mysql_core.index)("school_attendance_school_date_idx").on(table.schoolId, table.date)
      ]
    );
    inventoryItems = (0, import_mysql_core.mysqlTable)(
      "school_inventory_items",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        name: (0, import_mysql_core.varchar)("name", { length: 180 }).notNull(),
        sku: (0, import_mysql_core.varchar)("sku", { length: 80 }),
        category: (0, import_mysql_core.varchar)("category", { length: 100 }),
        unit: (0, import_mysql_core.varchar)("unit", { length: 40 }).notNull().default("item"),
        quantityOnHand: (0, import_mysql_core.int)("quantity_on_hand").notNull().default(0),
        reorderLevel: (0, import_mysql_core.int)("reorder_level").notNull().default(0),
        location: (0, import_mysql_core.varchar)("location", { length: 120 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "inactive"]).notNull().default("active"),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_inventory_items_school_sku_unique").on(table.schoolId, table.sku),
        (0, import_mysql_core.index)("school_inventory_items_school_name_idx").on(table.schoolId, table.name)
      ]
    );
    inventoryMovements = (0, import_mysql_core.mysqlTable)(
      "school_inventory_movements",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        itemId: (0, import_mysql_core.varchar)("item_id", { length: 36 }).notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
        movementType: (0, import_mysql_core.mysqlEnum)("movement_type", ["received", "issued"]).notNull(),
        quantity: (0, import_mysql_core.int)("quantity").notNull(),
        reason: (0, import_mysql_core.varchar)("reason", { length: 255 }).notNull(),
        recordedBy: (0, import_mysql_core.varchar)("recorded_by", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "restrict" }),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.index)("school_inventory_movements_school_item_idx").on(table.schoolId, table.itemId),
        (0, import_mysql_core.index)("school_inventory_movements_created_idx").on(table.schoolId, table.createdAt)
      ]
    );
    staffMembers = (0, import_mysql_core.mysqlTable)(
      "school_staff_members",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        userId: (0, import_mysql_core.varchar)("user_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        employeeNumber: (0, import_mysql_core.varchar)("employee_number", { length: 80 }).notNull(),
        firstName: (0, import_mysql_core.varchar)("first_name", { length: 100 }).notNull(),
        lastName: (0, import_mysql_core.varchar)("last_name", { length: 100 }).notNull(),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }),
        phone: (0, import_mysql_core.varchar)("phone", { length: 40 }),
        jobTitle: (0, import_mysql_core.varchar)("job_title", { length: 120 }).notNull(),
        hiredOn: (0, import_mysql_core.date)("hired_on", { mode: "string" }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "on_leave", "inactive"]).notNull().default("active"),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_staff_members_school_employee_unique").on(table.schoolId, table.employeeNumber),
        (0, import_mysql_core.uniqueIndex)("school_staff_members_school_user_unique").on(table.schoolId, table.userId),
        (0, import_mysql_core.index)("school_staff_members_school_name_idx").on(table.schoolId, table.lastName, table.firstName)
      ]
    );
    staffLeave = (0, import_mysql_core.mysqlTable)(
      "school_staff_leave",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        staffId: (0, import_mysql_core.varchar)("staff_id", { length: 36 }).notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
        leaveType: (0, import_mysql_core.mysqlEnum)("leave_type", ["annual", "sick", "maternity", "paternity", "bereavement", "study", "unpaid", "other"]).notNull(),
        startsOn: (0, import_mysql_core.date)("starts_on", { mode: "string" }).notNull(),
        endsOn: (0, import_mysql_core.date)("ends_on", { mode: "string" }).notNull(),
        reason: (0, import_mysql_core.varchar)("reason", { length: 500 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["requested", "approved", "rejected", "cancelled"]).notNull().default("requested"),
        decidedBy: (0, import_mysql_core.varchar)("decided_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        decidedAt: (0, import_mysql_core.timestamp)("decided_at"),
        createdBy: (0, import_mysql_core.varchar)("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.index)("school_staff_leave_school_start_idx").on(table.schoolId, table.startsOn),
        (0, import_mysql_core.index)("school_staff_leave_staff_idx").on(table.staffId)
      ]
    );
    staffContracts = (0, import_mysql_core.mysqlTable)(
      "school_staff_contracts",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        staffId: (0, import_mysql_core.varchar)("staff_id", { length: 36 }).notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
        contractType: (0, import_mysql_core.mysqlEnum)("contract_type", ["permanent", "fixed_term", "temporary", "part_time", "volunteer"]).notNull(),
        position: (0, import_mysql_core.varchar)("position", { length: 120 }).notNull(),
        startsOn: (0, import_mysql_core.date)("starts_on", { mode: "string" }).notNull(),
        endsOn: (0, import_mysql_core.date)("ends_on", { mode: "string" }),
        notes: (0, import_mysql_core.varchar)("notes", { length: 500 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "ended"]).notNull().default("active"),
        createdAt: createdAt()
      },
      (table) => [(0, import_mysql_core.index)("school_staff_contracts_school_staff_idx").on(table.schoolId, table.staffId)]
    );
    staffAttendance = (0, import_mysql_core.mysqlTable)(
      "school_staff_attendance",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        staffId: (0, import_mysql_core.varchar)("staff_id", { length: 36 }).notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
        date: (0, import_mysql_core.date)("date", { mode: "string" }).notNull(),
        status: (0, import_mysql_core.mysqlEnum)("status", ["present", "absent", "late", "on_leave"]).notNull(),
        remarks: (0, import_mysql_core.varchar)("remarks", { length: 255 }),
        recordedBy: (0, import_mysql_core.varchar)("recorded_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_staff_attendance_staff_date_unique").on(table.staffId, table.date),
        (0, import_mysql_core.index)("school_staff_attendance_school_date_idx").on(table.schoolId, table.date)
      ]
    );
    libraryBooks = (0, import_mysql_core.mysqlTable)(
      "school_library_books",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        author: (0, import_mysql_core.varchar)("author", { length: 160 }),
        isbn: (0, import_mysql_core.varchar)("isbn", { length: 20 }),
        publisher: (0, import_mysql_core.varchar)("publisher", { length: 160 }),
        publishedYear: (0, import_mysql_core.int)("published_year"),
        category: (0, import_mysql_core.varchar)("category", { length: 80 }),
        language: (0, import_mysql_core.varchar)("language", { length: 40 }),
        gradeLevelId: (0, import_mysql_core.varchar)("grade_level_id", { length: 36 }).references(() => gradeLevels.id, { onDelete: "set null" }),
        subjectId: (0, import_mysql_core.varchar)("subject_id", { length: 36 }).references(() => subjects.id, { onDelete: "set null" }),
        shelf: (0, import_mysql_core.varchar)("shelf", { length: 40 }),
        copies: (0, import_mysql_core.int)("copies").notNull().default(1),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_library_books_school_isbn_unique").on(table.schoolId, table.isbn),
        (0, import_mysql_core.index)("school_library_books_school_title_idx").on(table.schoolId, table.title)
      ]
    );
    libraryLoans = (0, import_mysql_core.mysqlTable)(
      "school_library_loans",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        bookId: (0, import_mysql_core.varchar)("book_id", { length: 36 }).notNull().references(() => libraryBooks.id, { onDelete: "cascade" }),
        borrowerType: (0, import_mysql_core.mysqlEnum)("borrower_type", ["student", "staff"]).notNull(),
        studentId: (0, import_mysql_core.varchar)("student_id", { length: 36 }).references(() => students.id, { onDelete: "set null" }),
        staffId: (0, import_mysql_core.varchar)("staff_id", { length: 36 }).references(() => staffMembers.id, { onDelete: "set null" }),
        /** Kept so the record stays readable if the student or staff record is removed. */
        borrowerName: (0, import_mysql_core.varchar)("borrower_name", { length: 200 }).notNull(),
        loanedOn: (0, import_mysql_core.date)("loaned_on", { mode: "string" }).notNull(),
        dueOn: (0, import_mysql_core.date)("due_on", { mode: "string" }).notNull(),
        returnedOn: (0, import_mysql_core.date)("returned_on", { mode: "string" }),
        issuedBy: (0, import_mysql_core.varchar)("issued_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.index)("school_library_loans_school_returned_idx").on(table.schoolId, table.returnedOn),
        (0, import_mysql_core.index)("school_library_loans_book_idx").on(table.bookId)
      ]
    );
    facilities = (0, import_mysql_core.mysqlTable)(
      "school_facilities",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        kind: (0, import_mysql_core.mysqlEnum)("kind", ["lab", "workshop"]).notNull(),
        name: (0, import_mysql_core.varchar)("name", { length: 120 }).notNull(),
        location: (0, import_mysql_core.varchar)("location", { length: 120 }),
        capacity: (0, import_mysql_core.int)("capacity"),
        createdAt: createdAt()
      },
      (table) => [(0, import_mysql_core.uniqueIndex)("school_facilities_school_kind_name_unique").on(table.schoolId, table.kind, table.name)]
    );
    facilityItems = (0, import_mysql_core.mysqlTable)(
      "school_facility_items",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        facilityId: (0, import_mysql_core.varchar)("facility_id", { length: 36 }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
        name: (0, import_mysql_core.varchar)("name", { length: 160 }).notNull(),
        category: (0, import_mysql_core.mysqlEnum)("category", ["equipment", "chemical", "consumable", "tool", "safety"]).notNull(),
        quantity: (0, import_mysql_core.int)("quantity").notNull().default(0),
        unit: (0, import_mysql_core.varchar)("unit", { length: 30 }).notNull().default("item"),
        reorderLevel: (0, import_mysql_core.int)("reorder_level").notNull().default(0),
        assetTag: (0, import_mysql_core.varchar)("asset_tag", { length: 60 }),
        hazard: (0, import_mysql_core.varchar)("hazard", { length: 80 }),
        condition: (0, import_mysql_core.mysqlEnum)("condition", ["good", "needs_repair", "out_of_service"]).notNull().default("good"),
        expiresOn: (0, import_mysql_core.date)("expires_on", { mode: "string" }),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [(0, import_mysql_core.index)("school_facility_items_facility_idx").on(table.facilityId, table.name)]
    );
    facilityBookings = (0, import_mysql_core.mysqlTable)(
      "school_facility_bookings",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        facilityId: (0, import_mysql_core.varchar)("facility_id", { length: 36 }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
        date: (0, import_mysql_core.date)("date", { mode: "string" }).notNull(),
        startTime: (0, import_mysql_core.varchar)("start_time", { length: 5 }).notNull(),
        endTime: (0, import_mysql_core.varchar)("end_time", { length: 5 }).notNull(),
        teacherId: (0, import_mysql_core.varchar)("teacher_id", { length: 36 }).references(() => teachers.id, { onDelete: "set null" }),
        classroomId: (0, import_mysql_core.varchar)("classroom_id", { length: 36 }).references(() => classrooms.id, { onDelete: "set null" }),
        purpose: (0, import_mysql_core.varchar)("purpose", { length: 200 }).notNull(),
        status: (0, import_mysql_core.mysqlEnum)("status", ["booked", "completed", "cancelled"]).notNull().default("booked"),
        bookedBy: (0, import_mysql_core.varchar)("booked_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        createdAt: createdAt()
      },
      (table) => [(0, import_mysql_core.index)("school_facility_bookings_facility_date_idx").on(table.facilityId, table.date)]
    );
    facilityLogs = (0, import_mysql_core.mysqlTable)(
      "school_facility_logs",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        facilityId: (0, import_mysql_core.varchar)("facility_id", { length: 36 }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
        itemId: (0, import_mysql_core.varchar)("item_id", { length: 36 }).references(() => facilityItems.id, { onDelete: "set null" }),
        logType: (0, import_mysql_core.mysqlEnum)("log_type", ["incident", "maintenance"]).notNull(),
        severity: (0, import_mysql_core.mysqlEnum)("severity", ["low", "medium", "high"]).notNull().default("low"),
        occurredOn: (0, import_mysql_core.date)("occurred_on", { mode: "string" }).notNull(),
        description: (0, import_mysql_core.varchar)("description", { length: 1e3 }).notNull(),
        actionTaken: (0, import_mysql_core.varchar)("action_taken", { length: 1e3 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["open", "resolved"]).notNull().default("open"),
        reportedBy: (0, import_mysql_core.varchar)("reported_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        resolvedAt: (0, import_mysql_core.timestamp)("resolved_at"),
        createdAt: createdAt()
      },
      (table) => [(0, import_mysql_core.index)("school_facility_logs_facility_idx").on(table.facilityId, table.occurredOn)]
    );
    communityPartners = (0, import_mysql_core.mysqlTable)(
      "school_community_partners",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        name: (0, import_mysql_core.varchar)("name", { length: 160 }).notNull(),
        partnerType: (0, import_mysql_core.mysqlEnum)("partner_type", ["parent_association", "ngo", "business", "government", "religious", "alumni", "health", "other"]).notNull(),
        contactName: (0, import_mysql_core.varchar)("contact_name", { length: 120 }),
        phone: (0, import_mysql_core.varchar)("phone", { length: 40 }),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }),
        notes: (0, import_mysql_core.varchar)("notes", { length: 1e3 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "inactive"]).notNull().default("active"),
        createdAt: createdAt()
      },
      (table) => [(0, import_mysql_core.uniqueIndex)("school_community_partners_school_name_unique").on(table.schoolId, table.name)]
    );
    communityEvents = (0, import_mysql_core.mysqlTable)(
      "school_community_events",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        eventType: (0, import_mysql_core.mysqlEnum)("event_type", ["parent_meeting", "ptsa_meeting", "community_service", "fundraiser", "open_day", "sports", "cultural", "awareness", "other"]).notNull(),
        eventDate: (0, import_mysql_core.date)("event_date", { mode: "string" }).notNull(),
        startTime: (0, import_mysql_core.varchar)("start_time", { length: 5 }),
        location: (0, import_mysql_core.varchar)("location", { length: 160 }),
        partnerId: (0, import_mysql_core.varchar)("partner_id", { length: 36 }),
        description: (0, import_mysql_core.varchar)("description", { length: 1e3 }),
        expectedAttendance: (0, import_mysql_core.int)("expected_attendance"),
        actualAttendance: (0, import_mysql_core.int)("actual_attendance"),
        /** Minutes, decisions and outcomes, written after the event. */
        outcome: (0, import_mysql_core.text)("outcome"),
        status: (0, import_mysql_core.mysqlEnum)("status", ["planned", "held", "cancelled"]).notNull().default("planned"),
        /** Listed on the school's public page (once public pages exist). */
        isPublic: (0, import_mysql_core.boolean)("is_public").notNull().default(false),
        createdBy: (0, import_mysql_core.varchar)("created_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.index)("school_community_events_school_date_idx").on(table.schoolId, table.eventDate),
        (0, import_mysql_core.foreignKey)({ name: "school_ce_partner_fk", columns: [table.partnerId], foreignColumns: [communityPartners.id] }).onDelete("set null")
      ]
    );
    volunteers = (0, import_mysql_core.mysqlTable)(
      "school_volunteers",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        name: (0, import_mysql_core.varchar)("name", { length: 160 }).notNull(),
        phone: (0, import_mysql_core.varchar)("phone", { length: 40 }),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }),
        skills: (0, import_mysql_core.varchar)("skills", { length: 300 }),
        availability: (0, import_mysql_core.varchar)("availability", { length: 200 }),
        partnerId: (0, import_mysql_core.varchar)("partner_id", { length: 36 }),
        hoursContributed: (0, import_mysql_core.int)("hours_contributed").notNull().default(0),
        status: (0, import_mysql_core.mysqlEnum)("status", ["active", "inactive"]).notNull().default("active"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.index)("school_volunteers_school_name_idx").on(table.schoolId, table.name),
        (0, import_mysql_core.foreignKey)({ name: "school_volunteers_partner_fk", columns: [table.partnerId], foreignColumns: [communityPartners.id] }).onDelete("set null")
      ]
    );
    prMedia = (0, import_mysql_core.mysqlTable)(
      "school_pr_media",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        storageKey: (0, import_mysql_core.varchar)("storage_key", { length: 36 }).notNull(),
        fileName: (0, import_mysql_core.varchar)("file_name", { length: 255 }).notNull(),
        contentType: (0, import_mysql_core.varchar)("content_type", { length: 60 }).notNull(),
        sizeBytes: (0, import_mysql_core.int)("size_bytes").notNull(),
        caption: (0, import_mysql_core.varchar)("caption", { length: 300 }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
        adminFeedback: (0, import_mysql_core.varchar)("admin_feedback", { length: 1e3 }),
        uploadedBy: (0, import_mysql_core.varchar)("uploaded_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        reviewedBy: (0, import_mysql_core.varchar)("reviewed_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        reviewedAt: (0, import_mysql_core.timestamp)("reviewed_at"),
        createdAt: createdAt()
      },
      (table) => [
        (0, import_mysql_core.uniqueIndex)("school_pr_media_storage_key_unique").on(table.storageKey),
        (0, import_mysql_core.index)("school_pr_media_school_status_idx").on(table.schoolId, table.status)
      ]
    );
    prPosts = (0, import_mysql_core.mysqlTable)(
      "school_pr_posts",
      {
        id: id(),
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
        postType: (0, import_mysql_core.mysqlEnum)("post_type", ["news", "announcement", "achievement", "event_recap"]).notNull(),
        title: (0, import_mysql_core.varchar)("title", { length: 200 }).notNull(),
        summary: (0, import_mysql_core.varchar)("summary", { length: 300 }).notNull(),
        body: (0, import_mysql_core.text)("body").notNull(),
        coverMediaId: (0, import_mysql_core.varchar)("cover_media_id", { length: 36 }).references(() => prMedia.id, { onDelete: "set null" }),
        status: (0, import_mysql_core.mysqlEnum)("status", ["draft", "submitted", "changes_requested", "published", "archived"]).notNull().default("draft"),
        adminFeedback: (0, import_mysql_core.text)("admin_feedback"),
        authorId: (0, import_mysql_core.varchar)("author_id", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        reviewedBy: (0, import_mysql_core.varchar)("reviewed_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        reviewedAt: (0, import_mysql_core.timestamp)("reviewed_at"),
        publishedAt: (0, import_mysql_core.timestamp)("published_at"),
        createdAt: createdAt(),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      },
      (table) => [(0, import_mysql_core.index)("school_pr_posts_school_status_idx").on(table.schoolId, table.status, table.publishedAt)]
    );
    publicProfiles = (0, import_mysql_core.mysqlTable)(
      "school_public_profiles",
      {
        schoolId: (0, import_mysql_core.varchar)("school_id", { length: 36 }).primaryKey().references(() => schools.id, { onDelete: "cascade" }),
        tagline: (0, import_mysql_core.varchar)("tagline", { length: 160 }),
        about: (0, import_mysql_core.text)("about"),
        mission: (0, import_mysql_core.varchar)("mission", { length: 600 }),
        vision: (0, import_mysql_core.varchar)("vision", { length: 600 }),
        principalName: (0, import_mysql_core.varchar)("principal_name", { length: 120 }),
        principalMessage: (0, import_mysql_core.text)("principal_message"),
        address: (0, import_mysql_core.varchar)("address", { length: 200 }),
        phone: (0, import_mysql_core.varchar)("phone", { length: 40 }),
        email: (0, import_mysql_core.varchar)("email", { length: 254 }),
        heroMediaId: (0, import_mysql_core.varchar)("hero_media_id", { length: 36 }).references(() => prMedia.id, { onDelete: "set null" }),
        /** Review state of the fields above (the working copy). */
        status: (0, import_mysql_core.mysqlEnum)("status", ["draft", "submitted", "changes_requested", "approved"]).notNull().default("draft"),
        adminFeedback: (0, import_mysql_core.text)("admin_feedback"),
        /** The last approved copy of the fields; the public page shows this, so edits stay private until approved. */
        publishedContent: (0, import_mysql_core.json)("published_content").$type(),
        /** The public page is live only while this is set; a school admin turns it on after approval. */
        isPublished: (0, import_mysql_core.boolean)("is_published").notNull().default(false),
        reviewedBy: (0, import_mysql_core.varchar)("reviewed_by", { length: 36 }).references(() => authUsers.id, { onDelete: "set null" }),
        reviewedAt: (0, import_mysql_core.timestamp)("reviewed_at"),
        updatedAt: (0, import_mysql_core.timestamp)("updated_at").notNull().defaultNow().onUpdateNow()
      }
    );
  }
});

// scripts/ensure-platform-admin.ts
var import_env = require("@next/env");
var import_node_process = require("node:process");
(0, import_env.loadEnvConfig)(process.cwd());
function getArgument(name) {
  const index2 = process.argv.indexOf(name);
  if (index2 < 0) return void 0;
  const parts = [];
  for (let i = index2 + 1; i < process.argv.length; i++) {
    if (process.argv[i]?.startsWith("--")) break;
    parts.push(process.argv[i]);
  }
  return parts.length > 0 ? parts.join(" ").trim() : void 0;
}
function readSecret(prompt) {
  if (!import_node_process.stdin.isTTY) {
    throw new Error(
      "No interactive terminal detected. Please pass --password <your_password> or set PLATFORM_ADMIN_PASSWORD in environment."
    );
  }
  import_node_process.stdout.write(prompt);
  import_node_process.stdin.setRawMode(true);
  import_node_process.stdin.resume();
  import_node_process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    let completed = false;
    const onEnd = () => finish(new Error("Password input ended unexpectedly."));
    const finish = (error) => {
      if (completed) return;
      completed = true;
      import_node_process.stdin.setRawMode(false);
      import_node_process.stdin.pause();
      import_node_process.stdin.off("data", onData);
      import_node_process.stdin.off("end", onEnd);
      import_node_process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (input) => {
      for (const character of input) {
        if (character === "") {
          finish(new Error("Password entry cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\x7F" || character === "\b") {
          value = [...value].slice(0, -1).join("");
        } else if (character >= " ") {
          value += character;
        }
      }
    };
    import_node_process.stdin.on("data", onData);
    import_node_process.stdin.on("end", onEnd);
  });
}
async function main() {
  const email = getArgument("--email")?.toLowerCase();
  const name = getArgument("--name");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 255) {
    throw new Error(
      'Usage: npm run auth:ensure-admin -- --email admin@example.com --name "Platform Admin" [--password secret]'
    );
  }
  const passwordFromArg = getArgument("--password");
  const passwordFromEnvironment = process.env.PLATFORM_ADMIN_PASSWORD;
  delete process.env.PLATFORM_ADMIN_PASSWORD;
  const password = passwordFromArg ?? passwordFromEnvironment ?? await readSecret("Platform-admin password (input hidden): ");
  if (!passwordFromArg && !passwordFromEnvironment) {
    const confirmation = await readSecret("Confirm password (input hidden): ");
    if (password !== confirmation) throw new Error("Passwords do not match.");
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must be between 8 and 128 characters.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  const authSecret = process.env.BETTER_AUTH_SECRET;
  const authBaseUrl = process.env.BETTER_AUTH_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!authSecret || authSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");
  }
  if (!authBaseUrl) throw new Error("BETTER_AUTH_URL is required.");
  const authParsedUrl = new URL(authBaseUrl);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(authParsedUrl.hostname);
  if (process.env.NODE_ENV === "production" && authParsedUrl.protocol !== "https:" && !isLoopback) {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }
  const { default: mysql } = await import("mysql2/promise");
  const { drizzleAdapter } = await import("@better-auth/drizzle-adapter");
  const { betterAuth } = await import("better-auth");
  const { admin } = await import("better-auth/plugins");
  const { drizzle } = await import("drizzle-orm/mysql2");
  const schema = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const connection = await mysql.createConnection(databaseUrl);
  const pool = mysql.createPool(databaseUrl);
  try {
    const tablesToRename = [
      ["auth_users", "school_auth_users"],
      ["auth_sessions", "school_auth_sessions"],
      ["auth_accounts", "school_auth_accounts"],
      ["auth_verifications", "school_auth_verifications"],
      ["schools", "school_schools"],
      ["activity_events", "school_activity_events"],
      ["academic_years", "school_academic_years"],
      ["grade_levels", "school_grade_levels"],
      ["classrooms", "school_classrooms"],
      ["students", "school_students"],
      ["enrollments", "school_enrollments"],
      ["subjects", "school_subjects"],
      ["teachers", "school_teachers"],
      ["lesson_plans", "school_lesson_plans"],
      ["assessments", "school_assessments"],
      ["assessment_questions", "school_assessment_questions"],
      ["learning_resources", "school_learning_resources"],
      ["assessment_results", "school_assessment_results"],
      ["assessment_attempts", "school_assessment_attempts"],
      ["class_schedules", "school_class_schedules"],
      ["attendance_records", "school_attendance_records"],
      ["inventory_items", "school_inventory_items"],
      ["inventory_movements", "school_inventory_movements"],
      ["staff_members", "school_staff_members"]
    ];
    const renameLegacyTables = process.env.FORMA_RENAME_LEGACY_TABLES === "1";
    if (renameLegacyTables) await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const [oldName, newName] of renameLegacyTables ? tablesToRename : []) {
        try {
          const [oldRows] = await connection.query(`SHOW TABLES LIKE '${oldName}'`);
          const [newRows] = await connection.query(`SHOW TABLES LIKE '${newName}'`);
          if (oldRows.length > 0 && newRows.length === 0) {
            await connection.query(`RENAME TABLE \`${oldName}\` TO \`${newName}\``);
            console.info(`\u2713 Renamed legacy table ${oldName} to ${newName}`);
          }
        } catch (renameErr) {
          console.warn(`[admin-setup] Notice on renaming ${oldName}:`, renameErr instanceof Error ? renameErr.message : renameErr);
        }
      }
    } finally {
      if (renameLegacyTables) await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }
    let [checkUsersTable] = await connection.query(
      "SHOW TABLES LIKE 'school_auth_users'"
    );
    if (!checkUsersTable || checkUsersTable.length === 0) {
      console.info("school_auth_users table does not exist. Running database migrations...");
      try {
        const { pathToFileURL } = await import("node:url");
        const { join } = await import("node:path");
        const migratePath = join(__dirname, "migrate.mjs");
        const { runMigrations } = await import(pathToFileURL(migratePath).href);
        if (typeof runMigrations === "function") {
          await runMigrations();
          console.info("\u2713 Migrations applied successfully.");
        }
      } catch (migErr) {
        console.warn("[admin-setup] Automatic migration warning:", migErr instanceof Error ? migErr.message : migErr);
      }
      [checkUsersTable] = await connection.query(
        "SHOW TABLES LIKE 'school_auth_users'"
      );
    }
    if (!checkUsersTable || checkUsersTable.length === 0) {
      console.info("Creating fallback school authentication tables...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`school_auth_users\` (
          \`id\` varchar(36) NOT NULL,
          \`name\` varchar(255) NOT NULL,
          \`email\` varchar(255) NOT NULL,
          \`email_verified\` boolean NOT NULL DEFAULT false,
          \`image\` text,
          \`role\` varchar(255) NOT NULL DEFAULT 'user',
          \`banned\` boolean NOT NULL DEFAULT false,
          \`ban_reason\` text,
          \`ban_expires\` timestamp NULL DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`school_auth_users_email_unique\` (\`email\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`school_auth_sessions\` (
          \`id\` varchar(36) NOT NULL,
          \`expires_at\` timestamp NOT NULL,
          \`token\` varchar(255) NOT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`ip_address\` varchar(45) DEFAULT NULL,
          \`user_agent\` text,
          \`impersonated_by\` varchar(36) DEFAULT NULL,
          \`user_id\` varchar(36) NOT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`school_auth_sessions_token_unique\` (\`token\`),
          KEY \`school_auth_sessions_user_idx\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`school_auth_accounts\` (
          \`id\` varchar(36) NOT NULL,
          \`account_id\` varchar(255) NOT NULL,
          \`provider_id\` varchar(255) NOT NULL,
          \`user_id\` varchar(36) NOT NULL,
          \`access_token\` text,
          \`refresh_token\` text,
          \`id_token\` text,
          \`access_token_expires_at\` timestamp NULL DEFAULT NULL,
          \`refresh_token_expires_at\` timestamp NULL DEFAULT NULL,
          \`scope\` text,
          \`password\` text,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`school_auth_accounts_user_idx\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`school_auth_verifications\` (
          \`id\` varchar(36) NOT NULL,
          \`identifier\` varchar(255) NOT NULL,
          \`value\` text NOT NULL,
          \`expires_at\` timestamp NOT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.info("\u2713 Core authentication tables created.");
    }
    const db = drizzle(pool, { schema, mode: "default" });
    const auth = betterAuth({
      appName: "Forma",
      baseURL: authBaseUrl,
      secret: authSecret,
      database: drizzleAdapter(db, {
        provider: "mysql",
        schema: {
          user: schema.authUsers,
          session: schema.authSessions,
          account: schema.authAccounts,
          verification: schema.authVerifications
        }
      }),
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128
      },
      plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })]
    });
    const [existingRows] = await connection.query(
      "SELECT id, role FROM school_auth_users WHERE email = ? LIMIT 1",
      [email]
    );
    const existing = existingRows[0];
    if (existing) {
      console.info(`Found existing account for ${email} (id: ${existing.id}). Updating role and password\u2026`);
      await connection.query(
        "UPDATE `school_auth_users` SET `role` = 'admin', `name` = ? WHERE `id` = ?",
        [name, existing.id]
      );
      const { hashPassword } = await import("better-auth/crypto");
      const hashedPassword = await hashPassword(password);
      const [accounts] = await connection.query(
        "SELECT `id` FROM `school_auth_accounts` WHERE `user_id` = ? AND `provider_id` = 'credential' LIMIT 1",
        [existing.id]
      );
      if (accounts[0]?.id) {
        await connection.query(
          "UPDATE `school_auth_accounts` SET `password` = ? WHERE `id` = ?",
          [hashedPassword, accounts[0].id]
        );
      } else {
        const { randomUUID: randomUUID2 } = await import("node:crypto");
        await connection.query(
          "INSERT INTO `school_auth_accounts` (`id`, `account_id`, `provider_id`, `user_id`, `password`) VALUES (?, ?, 'credential', ?, ?)",
          [randomUUID2(), String(existing.id), existing.id, hashedPassword]
        );
      }
      console.info(`\u2713 ${email} is now a platform administrator.`);
    } else {
      console.info(`No account found for ${email}. Creating platform administrator\u2026`);
      const result = await auth.api.createUser({
        body: { email, name, password, role: "admin" }
      });
      if (!result.user.role?.split(",").includes("admin")) {
        throw new Error("The account was created without platform-admin privileges.");
      }
      console.info(`\u2713 Created platform administrator: ${result.user.email}`);
    }
  } finally {
    try {
      await connection.query("SELECT 1");
    } catch {
    }
    await connection.end();
    await pool.end();
  }
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unexpected failure.";
  console.error(`ensure-platform-admin failed: ${message}`);
  process.exitCode = 1;
});
