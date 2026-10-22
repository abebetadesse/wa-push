import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RecordForm, RowButton } from "@/components/record-form";
import { SchoolPicker, selectedSchool } from "@/components/school-picker";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { staffAttendance, staffContracts, staffLeave, staffMembers } from "@/db/schema";
import { isDate } from "@/lib/form-fields";
import { addDays, enumOptions, humanize } from "@/lib/format";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { addContract, decideLeave, endContract, recordStaffAttendance, requestLeave } from "./actions";
import { CONTRACT_TYPES, LEAVE_TYPES, STAFF_ATTENDANCE_STATUSES } from "./options";
import { StaffForm } from "./staff-form";
import { StaffStatusForm } from "./staff-status-form";

export const metadata: Metadata = { title: "Human resources | Forma" };

const TABS = ["directory", "leave", "contracts", "attendance"] as const;
type SearchParams = Promise<{ schoolId?: string; tab?: string; date?: string }>;

const statusBadge = (good: boolean, pending = false) => `role-badge status-${good ? "active" : pending ? "on_leave" : "inactive"}`;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

async function HrContent({ searchParams }: { searchParams: SearchParams }) {
  const { schoolIds, schools: visibleSchools } = await requireSchoolsFor(pageRoles.hr);
  const params = await searchParams;
  const schoolId = selectedSchool(params.schoolId, schoolIds);
  const tab = activeTab(params.tab, TABS);
  const today = new Date().toISOString().slice(0, 10);
  const day = params.date && isDate(params.date) ? params.date : today;

  const [staffRows, leaveRows, contractRows, attendanceRows] = await Promise.all([
    db.select().from(staffMembers).where(eq(staffMembers.schoolId, schoolId)).orderBy(staffMembers.lastName, staffMembers.firstName),
    db.select().from(staffLeave).where(eq(staffLeave.schoolId, schoolId)).orderBy(desc(staffLeave.startsOn)).limit(200),
    db.select().from(staffContracts).where(eq(staffContracts.schoolId, schoolId)).orderBy(desc(staffContracts.startsOn)),
    db.select().from(staffAttendance).where(and(eq(staffAttendance.schoolId, schoolId), eq(staffAttendance.date, day))),
  ]);
  const staffName = new Map(staffRows.map((staff) => [staff.id, `${staff.firstName} ${staff.lastName}`]));
  const staffOptions = staffRows.filter((staff) => staff.status !== "inactive").map((staff) => ({ value: staff.id, label: `${staff.firstName} ${staff.lastName} · ${staff.jobTitle}` }));
  const pendingLeave = leaveRows.filter((leave) => leave.status === "requested").length;
  const onLeaveToday = new Set(leaveRows.filter((leave) => leave.status === "approved" && leave.startsOn <= day && leave.endsOn >= day).map((leave) => leave.staffId));
  const soon = addDays(today, 30);
  const recorded = new Map(attendanceRows.map((row) => [row.staffId, row]));
  const activeStaff = staffRows.filter((staff) => staff.status !== "inactive");

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">SCHOOL OPERATIONS</p>
          <h1>Human resources</h1>
          <p className="management-description">Staff records, leave, employment contracts and daily staff attendance.</p>
        </div>
      </header>
      <SchoolPicker basePath="/hr" keep={{ tab }} schools={visibleSchools} selected={schoolId} />
      <PageTabs active={tab} basePath="/hr" params={{ schoolId }} tabs={[
        { id: "directory", label: "Directory", count: staffRows.length },
        { id: "leave", label: "Leave", count: pendingLeave || undefined },
        { id: "contracts", label: "Contracts" },
        { id: "attendance", label: "Attendance" },
      ]} />
      <div className="management-sections">
        {tab === "directory" && <>
          <section className="management-card">
            <h2>Add a staff member</h2>
            <StaffForm schools={visibleSchools.filter((school) => school.id === schoolId)} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Staff directory</h2><p>{staffRows.length} staff member{staffRows.length === 1 ? "" : "s"}</p></div></div>
            {staffRows.length === 0
              ? <p className="empty-state">No staff members have been added yet.</p>
              : <div className="record-list">{staffRows.map((staff) => (
                <div className="record-row staff-record" key={staff.id}>
                  <div><strong>{staff.firstName} {staff.lastName} · {staff.jobTitle}</strong>
                    <small>{staff.employeeNumber}{staff.email ? ` · ${staff.email}` : ""}{staff.phone ? ` · ${staff.phone}` : ""}{staff.hiredOn ? ` · Hired ${staff.hiredOn}` : ""}</small></div>
                  <span className={`role-badge status-${staff.status}`}>{humanize(staff.status)}</span>
                  <StaffStatusForm schoolId={staff.schoolId} staffId={staff.id} status={staff.status} />
                </div>
              ))}</div>}
            <p className="report-note">Forma does not store payroll, medical, or other sensitive employment records. Staff account access is managed separately in Team.</p>
          </section>
        </>}

        {tab === "leave" && <>
          <section className="management-card">
            <h2>Record a leave request</h2>
            <RecordForm action={requestLeave} hidden={{ schoolId }} submitLabel="Record request" fields={[
              { name: "staffId", label: "Staff member", type: "select", required: true, options: staffOptions, wide: true },
              { name: "leaveType", label: "Type", type: "select", required: true, options: enumOptions(LEAVE_TYPES) },
              { name: "startsOn", label: "First day", type: "date", required: true },
              { name: "endsOn", label: "Last day", type: "date", required: true },
              { name: "reason", label: "Reason", type: "textarea", max: 500 },
            ]} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Leave</h2><p>{pendingLeave} awaiting a decision · {onLeaveToday.size} on leave on {day}</p></div></div>
            {leaveRows.length === 0 ? <p className="empty-state">No leave recorded yet.</p> : <div className="record-list">{leaveRows.map((leave) => (
              <div className="record-row" key={leave.id}>
                <div><strong>{staffName.get(leave.staffId)} · {humanize(leave.leaveType)} leave</strong>
                  <small>{leave.startsOn} to {leave.endsOn} ({daysBetween(leave.startsOn, leave.endsOn)} days){leave.reason ? ` · ${leave.reason}` : ""}</small></div>
                <span className={statusBadge(leave.status === "approved", leave.status === "requested")}>{leave.status}</span>
                <span className="inline-actions">
                  {leave.status === "requested" && <>
                    <RowButton action={decideLeave} hidden={{ schoolId, leaveId: leave.id, decision: "approved" }} label="Approve" />
                    <RowButton action={decideLeave} hidden={{ schoolId, leaveId: leave.id, decision: "rejected" }} label="Reject" />
                  </>}
                  {(leave.status === "requested" || leave.status === "approved") && leave.endsOn >= today &&
                    <RowButton action={decideLeave} confirm="Cancel this leave?" hidden={{ schoolId, leaveId: leave.id, decision: "cancelled" }} label="Cancel" />}
                </span>
              </div>
            ))}</div>}
          </section>
        </>}

        {tab === "contracts" && <>
          <section className="management-card">
            <h2>Record a contract</h2>
            <RecordForm action={addContract} hidden={{ schoolId }} submitLabel="Record contract" fields={[
              { name: "staffId", label: "Staff member", type: "select", required: true, options: staffOptions, wide: true },
              { name: "contractType", label: "Type", type: "select", required: true, options: enumOptions(CONTRACT_TYPES) },
              { name: "position", label: "Position", required: true, max: 120 },
              { name: "startsOn", label: "Start date", type: "date", required: true },
              { name: "endsOn", label: "End date", type: "date" },
              { name: "notes", label: "Notes", type: "textarea", max: 500 },
            ]} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Contracts</h2><p>{contractRows.filter((contract) => contract.status === "active").length} active</p></div></div>
            {contractRows.length === 0 ? <p className="empty-state">No contracts recorded yet.</p> : <div className="record-list">{contractRows.map((contract) => {
              const endingSoon = contract.status === "active" && contract.endsOn && contract.endsOn <= soon;
              return (
                <div className="record-row" key={contract.id}>
                  <div><strong>{staffName.get(contract.staffId)} · {contract.position}</strong>
                    <small>{humanize(contract.contractType)} · from {contract.startsOn}{contract.endsOn ? ` to ${contract.endsOn}` : ", open-ended"}{contract.notes ? ` · ${contract.notes}` : ""}</small></div>
                  <span className={statusBadge(contract.status === "active" && !endingSoon, Boolean(endingSoon))}>{endingSoon ? (contract.endsOn! < today ? "expired" : "ends soon") : contract.status}</span>
                  {contract.status === "active" && <RowButton action={endContract} confirm="Mark this contract as ended?" hidden={{ schoolId, contractId: contract.id }} label="End" />}
                </div>
              );
            })}</div>}
          </section>
        </>}

        {tab === "attendance" && (
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Staff attendance</h2><p>{attendanceRows.length} of {activeStaff.length} recorded for {day}</p></div></div>
            <Form action="/hr" className="auth-form attendance-filter">
              <input name="schoolId" type="hidden" value={schoolId} />
              <input name="tab" type="hidden" value="attendance" />
              <label>Date<input defaultValue={day} max={today} name="date" type="date" /></label>
              <button className="secondary-button" type="submit">Load</button>
            </Form>
            {activeStaff.length === 0 ? <p className="empty-state">No active staff.</p> : (
              <ActionForm action={recordStaffAttendance}>
                <input name="schoolId" type="hidden" value={schoolId} />
                <input name="date" type="hidden" value={day} />
                <div className="record-list">{activeStaff.map((staff) => {
                  const current = recorded.get(staff.id);
                  return (
                    <div className="record-row" key={`${staff.id}-${day}`}>
                      <div><strong>{staff.firstName} {staff.lastName}</strong><small>{staff.jobTitle}{onLeaveToday.has(staff.id) ? " · approved leave" : ""}</small></div>
                      <select aria-label={`Status for ${staff.firstName} ${staff.lastName}`} defaultValue={current?.status ?? (onLeaveToday.has(staff.id) ? "on_leave" : "present")} name={`status:${staff.id}`}>
                        {STAFF_ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
                      </select>
                      <input aria-label={`Remarks for ${staff.firstName} ${staff.lastName}`} defaultValue={current?.remarks ?? ""} maxLength={255} name={`remarks:${staff.id}`} placeholder="Remarks" />
                    </div>
                  );
                })}</div>
                <SubmitButton className="primary-button auth-submit" pendingLabel="Saving…">Save attendance for {day}</SubmitButton>
              </ActionForm>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default function HrPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading human resources...</p></main>}><HrContent searchParams={searchParams} /></Suspense>;
}
