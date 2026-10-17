import { count, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { activityEvents, authUsers, classrooms, lessonPlans, schoolMemberships, schools, students } from "@/db/schema";
import Dashboard, { type DashboardActivity, type DashboardSchool } from "./dashboard";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";

async function AuthenticatedDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const platformAdmin = isPlatformAdmin(session);
  const membershipRows = await getAccessibleSchools();

  if (membershipRows.length === 0) {
    if (platformAdmin) redirect("/setup-school");
    redirect("/no-access");
  }

  const memberships = platformAdmin
    ? []
    : await db
      .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  if (!platformAdmin && memberships.length > 0 && memberships.every(({ role }) => role === "student")) {
    redirect("/my-learning");
  }
  const allowedRoles = new Set(["school_admin", "teacher", "inventory_manager", "hr_manager"]);
  const visibleSchoolIds = platformAdmin
    ? membershipRows.map((school) => school.id)
    : memberships.filter(({ role }) => allowedRoles.has(role)).map(({ schoolId }) => schoolId);

  if (visibleSchoolIds.length === 0) redirect("/no-access");

  const visibleSchools = membershipRows.filter((school) => visibleSchoolIds.includes(school.id));
  const [studentCounts, classCounts, lessonCounts, recentActivity] = await Promise.all([
    db
      .select({ schoolId: students.schoolId, total: count() })
      .from(students)
      .where(inArray(students.schoolId, visibleSchoolIds))
      .groupBy(students.schoolId),
    db
      .select({ schoolId: classrooms.schoolId, total: count() })
      .from(classrooms)
      .where(inArray(classrooms.schoolId, visibleSchoolIds))
      .groupBy(classrooms.schoolId),
    db
      .select({ schoolId: lessonPlans.schoolId, total: count() })
      .from(lessonPlans)
      .where(inArray(lessonPlans.schoolId, visibleSchoolIds))
      .groupBy(lessonPlans.schoolId),
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
      .limit(5),
  ]);

  const studentCountBySchool = new Map(studentCounts.map((row) => [row.schoolId, Number(row.total)]));
  const classCountBySchool = new Map(classCounts.map((row) => [row.schoolId, Number(row.total)]));
  const lessonCountBySchool = new Map(lessonCounts.map((row) => [row.schoolId, Number(row.total)]));
  const dashboardSchools: DashboardSchool[] = visibleSchools.map((school) => ({
    ...school,
    students: studentCountBySchool.get(school.id) ?? 0,
    classes: classCountBySchool.get(school.id) ?? 0,
    lessons: lessonCountBySchool.get(school.id) ?? 0,
  }));
  const activity: DashboardActivity[] = recentActivity.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  return <Dashboard
    activity={activity}
    isPlatformAdmin={platformAdmin}
    isStaff={platformAdmin || memberships.some(({ role }) => role === "school_admin" || role === "teacher")}
    isStudent={memberships.some(({ role }) => role === "student")}
    isInventoryManager={platformAdmin || memberships.some(({ role }) => role === "inventory_manager" || role === "school_admin")}
    isHrManager={platformAdmin || memberships.some(({ role }) => role === "hr_manager" || role === "school_admin")}
    userName={session.user.name}
    schools={dashboardSchools}
  />;
}

function DashboardLoading() {
  return <main className="auth-page"><p>Loading your school workspace...</p></main>;
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}
