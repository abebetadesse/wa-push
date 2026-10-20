"use client";

import type { FormEvent } from "react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  assignScheduleTeacher,
  createScheduleEntry,
  deleteScheduleEntry,
  toggleScheduleCancelled,
  type TimetableActionState,
} from "./actions";
import { dayLabels, daysOfWeek } from "./days";

export type TeacherOption = { id: string; name: string; specialization: string | null };

export function ScheduleForm({
  schoolId,
  classroomId,
  subjects,
  teachers,
}: {
  schoolId: string;
  classroomId: string;
  subjects: { id: string; name: string }[];
  teachers: TeacherOption[];
}) {
  const [state, action, pending] = useActionState<TimetableActionState, FormData>(createScheduleEntry, {});
  return (
    <form action={action} className="auth-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="classroomId" type="hidden" value={classroomId} />
      <div className="form-two-columns">
        <label>Subject
          <select defaultValue="" name="subjectId" required>
            <option disabled value="">Select a subject</option>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </label>
        <label>Teacher <span className="optional-label">Optional</span>
          <select defaultValue="" name="teacherId">
            <option value="">{teachers.length ? "No teacher assigned" : "No active teacher profiles"}</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.specialization ? ` · ${teacher.specialization}` : ""}</option>)}
          </select>
        </label>
        <label>Day
          <select defaultValue="monday" name="dayOfWeek" required>
            {daysOfWeek.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}
          </select>
        </label>
        <label>Room <span className="optional-label">Optional</span><input maxLength={50} name="roomNumber" /></label>
        <label>Starts<input defaultValue="08:00" name="startTime" required type="time" /></label>
        <label>Ends<input defaultValue="08:45" name="endTime" required type="time" /></label>
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Adding..." : "Add to timetable"}</button>
    </form>
  );
}

export function ScheduleTeacherSelect({
  schoolId,
  entryId,
  teacherId,
  teachers,
}: {
  schoolId: string;
  entryId: string;
  teacherId: string | null;
  teachers: TeacherOption[];
}) {
  const [state, action, pending] = useActionState<TimetableActionState, FormData>(assignScheduleTeacher, {});
  return (
    <form action={action} className="stock-movement-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="entryId" type="hidden" value={entryId} />
      <label><span className="visually-hidden">Teacher</span>
        <select aria-label="Teacher" defaultValue={teacherId ?? ""} disabled={pending} key={teacherId ?? ""} name="teacherId" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          <option value="">Unassigned</option>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
        </select>
      </label>
      {state.error && <span className="result-message result-error" role="alert">{state.error}</span>}
    </form>
  );
}

export function ScheduleEntryActions({
  schoolId,
  entryId,
  cancelled,
  label,
}: {
  schoolId: string;
  entryId: string;
  cancelled: boolean;
  label: string;
}) {
  const [state, toggleAction, pending] = useActionState<TimetableActionState, FormData>(toggleScheduleCancelled, {});
  const confirmDelete = (event: FormEvent<HTMLFormElement>) => {
    if (!window.confirm(`Remove ${label} from the timetable?`)) event.preventDefault();
  };
  return (
    <div className="modal-actions" style={{ flexWrap: "wrap", marginTop: 0 }}>
      <form action={toggleAction}>
        <input name="schoolId" type="hidden" value={schoolId} />
        <input name="entryId" type="hidden" value={entryId} />
        <button className="secondary-button record-action" disabled={pending} type="submit">{cancelled ? "Restore" : "Cancel"}</button>
      </form>
      <form action={deleteScheduleEntry} onSubmit={confirmDelete}>
        <input name="schoolId" type="hidden" value={schoolId} />
        <input name="entryId" type="hidden" value={entryId} />
        <SubmitButton pendingLabel="Removing…">Remove</SubmitButton>
      </form>
      {state.error && <span className="result-message result-error" role="alert">{state.error}</span>}
    </div>
  );
}
