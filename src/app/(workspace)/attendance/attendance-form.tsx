"use client";

import { useActionState, useMemo, useState } from "react";
import { saveAttendance, type AttendanceActionState } from "./actions";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AttendanceRosterEntry = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  status: AttendanceStatus;
  remarks: string;
};

const statuses: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return statuses.some((status) => status.value === value);
}

export function AttendanceForm({
  schoolId,
  classroomId,
  date,
  roster,
}: {
  schoolId: string;
  classroomId: string;
  date: string;
  roster: AttendanceRosterEntry[];
}) {
  const [state, action, pending] = useActionState<AttendanceActionState, FormData>(saveAttendance, {});
  const [entries, setEntries] = useState(roster);
  const payload = useMemo(
    () => JSON.stringify(entries.map(({ studentId, status, remarks }) => ({ studentId, status, remarks }))),
    [entries],
  );

  function updateEntry(studentId: string, update: Partial<Pick<AttendanceRosterEntry, "status" | "remarks">>) {
    setEntries((current) => current.map((entry) =>
      entry.studentId === studentId ? { ...entry, ...update } : entry,
    ));
  }

  const countByStatus = entries.reduce<Record<AttendanceStatus, number>>((counts, entry) => {
    counts[entry.status] += 1;
    return counts;
  }, { present: 0, absent: 0, late: 0, excused: 0 });

  return (
    <form action={action} className="auth-form attendance-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="classroomId" type="hidden" value={classroomId} />
      <input name="date" type="hidden" value={date} />
      <input name="entries" type="hidden" value={payload} />
      <div className="attendance-summary" aria-live="polite">
        {statuses.map(({ value, label }) => <span key={value}><strong>{countByStatus[value]}</strong> {label}</span>)}
      </div>
      <div className="attendance-roster">
        {entries.map((entry) => (
          <div className="attendance-row" key={entry.studentId}>
            <span className="result-student">
              <strong>{entry.studentName}</strong>
              <small>{entry.studentNumber}</small>
            </span>
            <label className="attendance-status-field">
              <span className="visually-hidden">Attendance for {entry.studentName}</span>
              <select
                onChange={(event) => {
                  const selectedStatus = event.target.value;
                  if (isAttendanceStatus(selectedStatus)) {
                    updateEntry(entry.studentId, { status: selectedStatus });
                  }
                }}
                value={entry.status}
              >
                {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <label className="attendance-remarks-field">
              <span className="visually-hidden">Remarks for {entry.studentName}</span>
              <input
                maxLength={255}
                onChange={(event) => updateEntry(entry.studentId, { remarks: event.target.value })}
                placeholder="Remarks (optional)"
                value={entry.remarks}
              />
            </label>
          </div>
        ))}
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Saving attendance..." : "Save attendance"}
      </button>
    </form>
  );
}
