import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { schoolMemberships, schools, staffMembers } from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { StaffForm } from "./staff-form";
import { StaffStatusForm } from "./staff-status-form";

export const metadata: Metadata = { title: "Human resources | Forma" };

async function HrContent() {
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
    : memberships.filter(({ role }) => role === "school_admin" || role === "hr_manager").map(({ schoolId }) => schoolId);
  if (schoolIds.length === 0) redirect("/no-access");
  const visibleSchools = accessibleSchools.filter((school) => schoolIds.includes(school.id));
  const staffRows = await db.select({
    id: staffMembers.id,
    schoolId: staffMembers.schoolId,
    schoolName: schools.name,
    employeeNumber: staffMembers.employeeNumber,
    firstName: staffMembers.firstName,
    lastName: staffMembers.lastName,
    email: staffMembers.email,
    phone: staffMembers.phone,
    jobTitle: staffMembers.jobTitle,
    hiredOn: staffMembers.hiredOn,
    status: staffMembers.status,
  }).from(staffMembers)
    .innerJoin(schools, eq(staffMembers.schoolId, schools.id))
    .where(inArray(staffMembers.schoolId, schoolIds))
    .orderBy(schools.name, staffMembers.lastName, staffMembers.firstName);

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">SCHOOL OPERATIONS</p>
          <h1>Human resources</h1>
          <p className="management-description">Maintain employee contact, role, hire-date, and employment-status records.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Add a staff member</h2>
          <StaffForm schools={visibleSchools} />
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Staff directory</h2><p>{staffRows.length} staff member{staffRows.length === 1 ? "" : "s"}</p></div></div>
          {staffRows.length === 0
            ? <p className="empty-state">No staff members have been added yet.</p>
            : <div className="record-list">{staffRows.map((staff) => (
              <div className="record-row staff-record" key={staff.id}>
                <div><strong>{staff.firstName} {staff.lastName} · {staff.jobTitle}</strong>
                  <small>{staff.employeeNumber} · {staff.schoolName}{staff.email ? ` · ${staff.email}` : ""}{staff.phone ? ` · ${staff.phone}` : ""}{staff.hiredOn ? ` · Hired ${staff.hiredOn}` : ""}</small></div>
                <span className={`role-badge status-${staff.status}`}>{staff.status.replaceAll("_", " ")}</span>
                <StaffStatusForm schoolId={staff.schoolId} staffId={staff.id} status={staff.status} />
              </div>
            ))}</div>}
          <p className="report-note">This directory does not store payroll, medical, or other sensitive employment records. Staff account access is managed separately in Team.</p>
        </section>
      </div>
    </main>
  );
}

export default function HrPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading staff directory...</p></main>}><HrContent /></Suspense>;
}
