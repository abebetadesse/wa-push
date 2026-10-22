import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  activityEvents,
  assessments,
  attendanceRecords,
  authUsers,
  classrooms,
  gradeLevels,
  lessonPlans,
  schools,
  students,
  subjects,
  teachers,
} from "@/db/schema";
import { PageSkeleton } from "@/components/page-skeleton";
import { STAFF_ROLES } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";
import Dashboard, { type DashboardActivity, type DashboardSchool, type SetupStep } from "./dashboard";

function countBy(rows: { schoolId: string; total: number | string }[]) {
  return new Map(rows.map((row) => [row.schoolId, Number(row.total)]));
}

// The dashboard is rendered per request, so reading the clock here is intended.
function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function sum(map: Map<string, number>) {
  return [...map.values()].reduce((total, value) => total + value, 0);
}

async function AuthenticatedDashboard() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login");
  const { access, platformAdmin, roles } = context;

  if (context.schools.length === 0) {
    if (platformAdmin) redirect("/setup-school");
    redirect("/no-access");
  }
  if (!access.dashboard) redirect(access.student ? "/my-learning" : "/no-access");

  const staffRoles = new Set<string>(STAFF_ROLES);
  const visibleSchoolIds = platformAdmin
    ? context.schools.map((school) => school.id)
    : roles.filter(({ role }) => staffRoles.has(role)).map(({ schoolId }) => schoolId);
  const visibleSchools = context.schools.filter((school) => visibleSchoolIds.includes(school.id));
  const sinceWeek = isoDateDaysAgo(6);

  const [
    studentCounts, classCounts, lessonCounts, teacherCounts, reviewCounts, assessmentCounts,
    currentYears, gradeCounts, subjectCounts, attendanceWeek, recentActivity,
  ] = await Promise.all([
    db.select({ schoolId: students.schoolId, total: count() }).from(students)
      .where(and(inArray(students.schoolId, visibleSchoolIds), eq(students.status, "active"))).groupBy(students.schoolId),
    db.select({ schoolId: classrooms.schoolId, total: count() }).from(classrooms)
      .where(inArray(classrooms.schoolId, visibleSchoolIds)).groupBy(classrooms.schoolId),
    db.select({ schoolId: lessonPlans.schoolId, total: count() }).from(lessonPlans)
      .where(inArray(lessonPlans.schoolId, visibleSchoolIds)).groupBy(lessonPlans.schoolId),
    db.select({ schoolId: teachers.schoolId, total: count() }).from(teachers)
      .where(and(inArray(teachers.schoolId, visibleSchoolIds), eq(teachers.status, "active"))).groupBy(teachers.schoolId),
    db.select({ schoolId: lessonPlans.schoolId, total: count() }).from(lessonPlans)
      .where(and(inArray(lessonPlans.schoolId, visibleSchoolIds), eq(lessonPlans.status, "submitted"))).groupBy(lessonPlans.schoolId),
    db.select({ schoolId: assessments.schoolId, total: count() }).from(assessments)
      .where(and(inArray(assessments.schoolId, visibleSchoolIds), eq(assessments.status, "published"))).groupBy(assessments.schoolId),
    db.select({ schoolId: academicYears.schoolId, total: count() }).from(academicYears)
      .where(and(inArray(academicYears.schoolId, visibleSchoolIds), eq(academicYears.isCurrent, true))).groupBy(academicYears.schoolId),
    db.select({ schoolId: gradeLevels.schoolId, total: count() }).from(gradeLevels)
      .where(inArray(gradeLevels.schoolId, visibleSchoolIds)).groupBy(gradeLevels.schoolId),
    db.select({ schoolId: subjects.schoolId, total: count() }).from(subjects)
      .where(inArray(subjects.schoolId, visibleSchoolIds)).groupBy(subjects.schoolId),
    db.select({ status: attendanceRecords.status, total: count() }).from(attendanceRecords)
      .where(and(inArray(attendanceRecords.schoolId, visibleSchoolIds), gte(attendanceRecords.date, sinceWeek)))
      .groupBy(attendanceRecords.status),
    db
      .select({
        id: activityEvents.id,
        detail: activityEvents.detail,
        createdAt: activityEvents.createdAt,
        name: authUsers.name,
        schoolName: schools.name,
      })
      .from(activityEvents)
      .innerJoin(authUsers, eq(activityEvents.userId, authUsers.id))
      .innerJoin(schools, eq(activityEvents.schoolId, schools.id))
      .where(inArray(activityEvents.schoolId, visibleSchoolIds))
      .orderBy(desc(activityEvents.createdAt))
      .limit(8),
  ]);

  const studentsBySchool = countBy(studentCounts);
  const classesBySchool = countBy(classCounts);
  const lessonsBySchool = countBy(lessonCounts);
  const teachersBySchool = countBy(teacherCounts);
  const dashboardSchools: DashboardSchool[] = visibleSchools.map((school) => ({
    ...school,
    students: studentsBySchool.get(school.id) ?? 0,
    classes: classesBySchool.get(school.id) ?? 0,
    lessons: lessonsBySchool.get(school.id) ?? 0,
    teachers: teachersBySchool.get(school.id) ?? 0,
  }));

  const attendance = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const row of attendanceWeek) attendance[row.status] += Number(row.total);
  const recorded = attendance.present + attendance.late + attendance.absent + attendance.excused;

  // A school is set up once each building block exists; the checklist counts schools that have it.
  const schoolCount = visibleSchools.length;
  const has = (map: Map<string, number>) => visibleSchools.filter((school) => (map.get(school.id) ?? 0) > 0).length;
  const setupSteps: SetupStep[] = access.schoolAdmin ? [
    { label: "Set a current academic year", href: "/academic-setup", done: has(countBy(currentYears)), total: schoolCount },
    { label: "Add grade levels", href: "/academic-setup", done: has(countBy(gradeCounts)), total: schoolCount },
    { label: "Add subjects", href: "/academic-setup", done: has(countBy(subjectCounts)), total: schoolCount },
    { label: "Create classes", href: "/academic-setup", done: has(classesBySchool), total: schoolCount },
    { label: "Add teachers", href: "/teachers", done: has(teachersBySchool), total: schoolCount },
    { label: "Register students", href: "/students", done: has(studentsBySchool), total: schoolCount },
  ] : [];

  const activity: DashboardActivity[] = recentActivity.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <Dashboard
      access={access}
      activity={activity}
      schools={dashboardSchools}
      setupSteps={setupSteps}
      stats={{
        students: sum(studentsBySchool),
        classes: sum(classesBySchool),
        lessons: sum(lessonsBySchool),
        teachers: sum(teachersBySchool),
        awaitingReview: sum(countBy(reviewCounts)),
        liveAssessments: sum(countBy(assessmentCounts)),
        attendanceRate: recorded > 0 ? Math.round(((attendance.present + attendance.late) / recorded) * 100) : null,
        attendanceRecorded: recorded,
      }}
      userName={context.userName}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}
