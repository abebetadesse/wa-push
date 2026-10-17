import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, classSchedules, classrooms, gradeLevels, schoolMemberships, subjects, teachers } from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { dayLabels, daysOfWeek } from "./days";
import { ScheduleEntryActions, ScheduleForm, ScheduleTeacherSelect } from "./schedule-form";

export const metadata: Metadata = { title: "Timetable | Forma" };

type SearchParams = Promise<{ schoolId?: string; classroomId?: string; teacherId?: string }>;

function minutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
}

async function TimetableContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformAdmin = isPlatformAdmin(session);
  const accessibleSchools = await getAccessibleSchools();
  const memberships = platformAdmin
    ? []
    : await db.select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const schoolIds = platformAdmin
    ? accessibleSchools.map((school) => school.id)
    : memberships.filter(({ role }) => role === "school_admin" || role === "teacher").map(({ schoolId }) => schoolId);
  if (schoolIds.length === 0) redirect("/no-access");
  const visibleSchools = accessibleSchools.filter((school) => schoolIds.includes(school.id));

  const params = await searchParams;
  // A teacher with a linked profile opens on their own timetable unless they pick a class.
  const [ownProfile] = !params.teacherId && !params.classroomId
    ? await db.select({ id: teachers.id, schoolId: teachers.schoolId })
      .from(teachers)
      .where(eq(teachers.userId, session.user.id))
      .limit(1)
    : [];
  const requestedSchoolId = params.schoolId ?? ownProfile?.schoolId;
  const selectedSchoolId = schoolIds.includes(requestedSchoolId ?? "") ? requestedSchoolId! : schoolIds[0];
  const canManage = platformAdmin || memberships.some(({ schoolId, role }) => schoolId === selectedSchoolId && role === "school_admin");

  const [classRows, subjectRows, teacherRows] = await Promise.all([
    db.select({
      id: classrooms.id,
      name: classrooms.name,
      gradeName: gradeLevels.name,
      yearName: academicYears.name,
      academicYearId: classrooms.academicYearId,
    })
      .from(classrooms)
      .innerJoin(academicYears, and(eq(academicYears.id, classrooms.academicYearId), eq(academicYears.isCurrent, true)))
      .innerJoin(gradeLevels, eq(gradeLevels.id, classrooms.gradeLevelId))
      .where(eq(classrooms.schoolId, selectedSchoolId))
      .orderBy(gradeLevels.sortOrder, classrooms.name),
    db.select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.schoolId, selectedSchoolId))
      .orderBy(subjects.name),
    db.select({
      id: teachers.id,
      firstName: teachers.firstName,
      lastName: teachers.lastName,
      specialization: teachers.specialization,
      status: teachers.status,
    })
      .from(teachers)
      .where(eq(teachers.schoolId, selectedSchoolId))
      .orderBy(teachers.lastName, teachers.firstName),
  ]);
  const teacherOptions = teacherRows
    .filter((teacher) => teacher.status === "active")
    .map((teacher) => ({ id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}`, specialization: teacher.specialization }));

  const requestedTeacherId = params.teacherId ?? ownProfile?.id;
  const selectedTeacher = teacherRows.find(({ id }) => id === requestedTeacherId);
  const classroomId = selectedTeacher
    ? ""
    : classRows.some(({ id }) => id === params.classroomId) ? params.classroomId! : classRows[0]?.id ?? "";
  const selectedClass = classRows.find(({ id }) => id === classroomId);
  const currentYearIds = [...new Set(classRows.map((row) => row.academicYearId))];

  const entries = selectedTeacher || classroomId
    ? await db.select({
      id: classSchedules.id,
      academicYearId: classSchedules.academicYearId,
      dayOfWeek: classSchedules.dayOfWeek,
      startTime: classSchedules.startTime,
      endTime: classSchedules.endTime,
      roomNumber: classSchedules.roomNumber,
      status: classSchedules.status,
      subjectName: subjects.name,
      classroomName: classrooms.name,
      gradeName: gradeLevels.name,
      teacherId: classSchedules.teacherId,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
    })
      .from(classSchedules)
      .innerJoin(subjects, eq(classSchedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(classSchedules.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .leftJoin(teachers, eq(classSchedules.teacherId, teachers.id))
      .where(and(
        eq(classSchedules.schoolId, selectedSchoolId),
        selectedTeacher ? eq(classSchedules.teacherId, selectedTeacher.id) : eq(classSchedules.classroomId, classroomId),
      ))
      .orderBy(classSchedules.startTime)
      .then((rows) => rows.filter((row) => currentYearIds.includes(row.academicYearId)))
    : [];
  const days = daysOfWeek
    .map((day) => ({ day, entries: entries.filter((entry) => entry.dayOfWeek === day) }))
    .filter(({ day, entries: dayEntries }) => dayEntries.length > 0 || !["saturday", "sunday"].includes(day));
  const weeklyMinutes = entries
    .filter((entry) => entry.status !== "cancelled")
    .reduce((total, entry) => total + minutesBetween(entry.startTime, entry.endTime), 0);
  const columnCount = canManage ? 6 : 5;
  const heading = selectedTeacher
    ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`
    : `${selectedClass?.gradeName ?? ""} ${selectedClass?.name ?? ""}`;

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">TEACHING &amp; LEARNING</p>
          <h1>Class timetable</h1>
          <p className="management-description">Weekly periods for the current academic year. Class, teacher, and room double-bookings are rejected.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Choose a timetable</h2>
          <form action="/timetable" className="auth-form attendance-filter">
            {visibleSchools.length > 1 && (
              <label>School
                <select defaultValue={selectedSchoolId} name="schoolId">
                  {visibleSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </label>
            )}
            {visibleSchools.length === 1 && <input name="schoolId" type="hidden" value={selectedSchoolId} />}
            <label>Class
              <select defaultValue={classroomId} disabled={classRows.length === 0} name="classroomId">
                {selectedTeacher && <option value="">Select a class</option>}
                {classRows.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.gradeName} {classroom.name} · {classroom.yearName}</option>)}
              </select>
            </label>
            <button className="secondary-button" type="submit">Show class</button>
          </form>
          {teacherRows.length > 0 && <form action="/timetable" className="auth-form attendance-filter" style={{ marginTop: 12 }}>
            <input name="schoolId" type="hidden" value={selectedSchoolId} />
            <label>Teacher
              <select defaultValue={selectedTeacher?.id ?? ""} name="teacherId" required>
                <option disabled value="">Select a teacher</option>
                {teacherRows.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}{teacher.status !== "active" ? ` (${teacher.status.replaceAll("_", " ")})` : ""}</option>)}
              </select>
            </label>
            <button className="secondary-button" type="submit">Show teacher</button>
          </form>}
          {teacherRows.length === 0 && <p className="setup-hint" style={{ marginTop: 12 }}>Add teacher profiles in <Link href="/teachers">Teachers</Link> to assign them to periods.</p>}
        </section>
        {classRows.length === 0
          ? <section className="management-card"><p className="empty-state">Set up a current academic year and classes in <Link className="text-link" href="/academic-setup">Academic setup</Link> before building a timetable.</p></section>
          : <>
            <section className="management-card">
              <div className="management-card-heading">
                <div>
                  <h2>{heading}</h2>
                  <p>{entries.length} period{entries.length === 1 ? "" : "s"} · {Math.floor(weeklyMinutes / 60)}h {weeklyMinutes % 60}m scheduled per week</p>
                </div>
              </div>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead><tr>
                    <th>Day</th><th>Time</th><th>Subject</th><th>{selectedTeacher ? "Class" : "Teacher"}</th><th>Room</th>
                    {canManage && <th><span className="visually-hidden">Actions</span></th>}
                  </tr></thead>
                  <tbody>
                    {days.map(({ day, entries: dayEntries }) => dayEntries.length === 0
                      ? <tr key={day}><td>{dayLabels[day]}</td><td colSpan={columnCount - 1}><small>No periods</small></td></tr>
                      : dayEntries.map((entry, index) => (
                        <tr key={entry.id} style={entry.status === "cancelled" ? { opacity: 0.55 } : undefined}>
                          <td>{index === 0 ? dayLabels[day] : ""}</td>
                          <td>{entry.startTime}–{entry.endTime}{entry.status === "cancelled" && <small> · cancelled</small>}</td>
                          <td>{entry.subjectName}</td>
                          <td>
                            {selectedTeacher
                              ? `${entry.gradeName} ${entry.classroomName}`
                              : canManage
                                ? <ScheduleTeacherSelect schoolId={selectedSchoolId} entryId={entry.id} teacherId={entry.teacherId} teachers={teacherOptions} />
                                : entry.teacherFirstName ? `${entry.teacherFirstName} ${entry.teacherLastName}` : "—"}
                          </td>
                          <td>{entry.roomNumber ?? "—"}</td>
                          {canManage && <td>
                            <ScheduleEntryActions
                              schoolId={selectedSchoolId}
                              entryId={entry.id}
                              cancelled={entry.status === "cancelled"}
                              label={`${entry.subjectName} on ${dayLabels[day]} at ${entry.startTime}`}
                            />
                          </td>}
                        </tr>
                      )))}
                  </tbody>
                </table>
              </div>
            </section>
            {canManage && !selectedTeacher && <section className="management-card">
              <h2>Add a period to {heading.trim()}</h2>
              {subjectRows.length === 0
                ? <p className="setup-hint">Add subjects in <Link href="/academic-setup">Academic setup</Link> before scheduling periods.</p>
                : <ScheduleForm key={classroomId} schoolId={selectedSchoolId} classroomId={classroomId} subjects={subjectRows} teachers={teacherOptions} />}
            </section>}
          </>}
      </div>
    </main>
  );
}

export default function TimetablePage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading timetable...</p></main>}><TimetableContent searchParams={searchParams} /></Suspense>;
}
