"use client";

import { useActionState, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CsvDownloadButton } from "@/components/csv-download-button";
import { saveAttendance, sendGuardianFollowUp, type AttendanceActionState } from "./actions";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AttendanceRosterEntry = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  status: AttendanceStatus;
  remarks: string;
  guardianEmail: string | null;
  guardianNotifiedAt: string | null;
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

function subscribeToDraft(key: string, callback: () => void) {
  const listener = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === key) callback();
  };
  window.addEventListener("forma-attendance-draft", listener);
  return () => window.removeEventListener("forma-attendance-draft", listener);
}

function readDraft(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    console.error("Could not read the temporary attendance draft.", error);
    return null;
  }
}

function writeDraft(key: string, value: string | null) {
  if (value === null) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent("forma-attendance-draft", { detail: key }));
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
  const [followUpState, followUpAction, followUpPending] = useActionState<AttendanceActionState, FormData>(sendGuardianFollowUp, {});
  const [storageError, setStorageError] = useState("");
  const [followUpsOnly, setFollowUpsOnly] = useState(false);
  const storageKey = `forma-attendance:${schoolId}:${classroomId}:${date}`;
  const subscribe = useCallback((callback: () => void) => subscribeToDraft(storageKey, callback), [storageKey]);
  const getSnapshot = useCallback(() => readDraft(storageKey), [storageKey]);
  const getServerSnapshot = useCallback(() => null, []);
  const draftSnapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const draftEntries = useMemo(() => {
    if (!draftSnapshot) return null;
    try {
      const parsed: unknown = JSON.parse(draftSnapshot);
      if (!Array.isArray(parsed)) return null;
      const restored = new Map<string, { status: AttendanceStatus; remarks: string }>();
      for (const item of parsed) {
        if (
          typeof item !== "object" || item === null ||
          !("studentId" in item) || typeof item.studentId !== "string" ||
          !("status" in item) || typeof item.status !== "string" || !isAttendanceStatus(item.status) ||
          !("remarks" in item) || typeof item.remarks !== "string"
        ) return null;
        restored.set(item.studentId, { status: item.status, remarks: item.remarks });
      }
      if (
        !restored.size ||
        restored.size !== parsed.length ||
        restored.size !== roster.length ||
        !roster.every((entry) => restored.has(entry.studentId))
      ) return null;
      return roster.map((entry) => ({ ...entry, ...restored.get(entry.studentId)! }));
    } catch (error) {
      console.error("Could not parse the temporary attendance draft.", error);
      return null;
    }
  }, [draftSnapshot, roster]);
  const entries = draftEntries ?? roster;
  const hasDraftChanges = Boolean(draftSnapshot && draftEntries);
  const payload = useMemo(
    () => JSON.stringify(entries.map(({ studentId, status, remarks }) => ({ studentId, status, remarks }))),
    [entries],
  );

  function saveDraft(nextEntries: AttendanceRosterEntry[]) {
    try {
      writeDraft(storageKey, JSON.stringify(nextEntries.map(({ studentId, status, remarks }) => ({ studentId, status, remarks }))));
      setStorageError("");
    } catch (error) {
      console.error("Could not save the temporary attendance draft.", error);
      setStorageError("Browser storage is unavailable; unsaved attendance may be lost if this tab closes.");
    }
  }

  function updateEntry(studentId: string, update: Partial<Pick<AttendanceRosterEntry, "status" | "remarks">>) {
    saveDraft(entries.map((entry) =>
      entry.studentId === studentId ? { ...entry, ...update, guardianNotifiedAt: null } : entry,
    ));
  }

  useEffect(() => {
    if (state.success) writeDraft(storageKey, null);
    else if (draftSnapshot && !draftEntries) writeDraft(storageKey, null);
  }, [state, storageKey, draftSnapshot, draftEntries]);

  const countByStatus = entries.reduce<Record<AttendanceStatus, number>>((counts, entry) => {
    counts[entry.status] += 1;
    return counts;
  }, { present: 0, absent: 0, late: 0, excused: 0 });

  const followUpEntries = entries.filter((entry) => entry.status === "absent" || entry.status === "late");
  const availableGuardianEmails = new Set(followUpEntries
    .filter((entry) => entry.guardianEmail && !entry.guardianNotifiedAt)
    .map((entry) => entry.guardianEmail)).size;
  const displayedEntries = followUpsOnly ? followUpEntries : entries;

  return <>
    <form action={action} className="auth-form attendance-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="classroomId" type="hidden" value={classroomId} />
      <input name="date" type="hidden" value={date} />
      <input name="entries" type="hidden" value={payload} />
      <div className="attendance-toolbar">
        <div className="attendance-summary" aria-live="polite">
          {statuses.map(({ value, label }) => <span key={value}><strong>{countByStatus[value]}</strong> {label}</span>)}
        </div>
        <div className="inline-actions">
          <button className="secondary-button" onClick={() => saveDraft(entries.map((entry) => ({ ...entry, status: "present", guardianNotifiedAt: null })))} type="button">Mark all present</button>
          <button className="secondary-button" onClick={() => saveDraft(entries.map((entry) => ({ ...entry, status: "absent", guardianNotifiedAt: null })))} type="button">Mark all absent</button>
          <button className="secondary-button" aria-pressed={followUpsOnly} onClick={() => setFollowUpsOnly((value) => !value)} type="button">
            {followUpsOnly ? "Show full roster" : `Follow-up list (${followUpEntries.length})`}
          </button>
          <CsvDownloadButton
            filename={`attendance-${date}.csv`}
            headers={["Date", "Student number", "Student", "Status", "Remarks"]}
            rows={(followUpsOnly ? followUpEntries : entries).map((entry) => [date, entry.studentNumber, entry.studentName, entry.status, entry.remarks])}
          />
        </div>
      </div>
      <p className="setup-hint">Unsaved attendance changes are saved temporarily in this browser tab and removed after saving.</p>
      {storageError && <p className="auth-error" role="alert">{storageError}</p>}
      <div className="attendance-roster">
        {displayedEntries.map((entry) => (
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
                  if (isAttendanceStatus(selectedStatus)) updateEntry(entry.studentId, { status: selectedStatus });
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
      <button className="primary-button" disabled={pending || entries.length === 0} type="submit">
        {pending ? "Saving attendance..." : "Save attendance"}
      </button>
    </form>
    {followUpEntries.length > 0 && <form action={followUpAction} className="management-card guardian-follow-up">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="classroomId" type="hidden" value={classroomId} />
      <input name="date" type="hidden" value={date} />
      <h3>Guardian follow-up</h3>
      <p>{followUpEntries.length} absent/late record{followUpEntries.length === 1 ? "" : "s"} · {availableGuardianEmails} guardian email{availableGuardianEmails === 1 ? "" : "s"} available.</p>
      <p className="setup-hint">Updates are sent only when you choose this action. Successfully sent records won’t be emailed again unless the attendance entry changes.</p>
      {followUpState.error && <p className="auth-error" role="alert">{followUpState.error}</p>}
      {followUpState.success && <p className="auth-success" role="status">{followUpState.success}</p>}
      <button className="secondary-button" disabled={followUpPending || !availableGuardianEmails || hasDraftChanges} type="submit">
        {followUpPending ? "Sending updates…" : hasDraftChanges ? "Save attendance before sending" : `Send guardian updates (${availableGuardianEmails})`}
      </button>
    </form>}
  </>;
}
