import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { schools, staffMembers } from "@/db/schema";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { StaffForm } from "./staff-form";
import { StaffStatusForm } from "./staff-status-form";

export const metadata: Metadata = { title: "Human resources | Forma" };

async function HrContent() {
  const { schoolIds, schools: visibleSchools } = await requireSchoolsFor(pageRoles.hr);
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
