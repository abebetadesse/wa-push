"use client";

import { useActionState, useMemo, useState } from "react";
import { updateLesson, type LessonActionState } from "../actions";
import { lessonSections } from "../lesson-access";

type Option = { id: string; name: string };
type YearOption = Option & { isCurrent: boolean };
type ClassOption = Option & { academicYearId: string; gradeLevelId: string };

export type EditableLesson = {
  id: string;
  schoolId: string;
  academicYearId: string;
  gradeLevelId: string;
  subjectId: string;
  classroomId: string | null;
  title: string;
  unitTopic: string | null;
  durationMinutes: number;
  scheduledDate: string | null;
  overview: string | null;
  objectives: string | null;
  materials: string | null;
  prerequisites: string | null;
  procedures: string | null;
  differentiation: string | null;
  assessment: string | null;
  homework: string | null;
  notes: string | null;
};

export function LessonEditForm({
  lesson,
  years,
  grades,
  subjects,
  classrooms,
}: {
  lesson: EditableLesson;
  years: YearOption[];
  grades: Option[];
  subjects: Option[];
  classrooms: ClassOption[];
}) {
  const [state, action, pending] = useActionState<LessonActionState, FormData>(updateLesson, {});
  const [yearId, setYearId] = useState(lesson.academicYearId);
  const [gradeId, setGradeId] = useState(lesson.gradeLevelId);
  const availableClasses = useMemo(
    () => classrooms.filter((item) => item.academicYearId === yearId && item.gradeLevelId === gradeId),
    [classrooms, yearId, gradeId],
  );

  return (
    <form action={action} className="auth-form">
      <input name="lessonId" type="hidden" value={lesson.id} />
      <input name="schoolId" type="hidden" value={lesson.schoolId} />
      <label>Lesson title<input defaultValue={lesson.title} maxLength={200} name="title" required /></label>
      <div className="form-two-columns">
        <label>Academic year<select name="academicYearId" onChange={(event) => setYearId(event.target.value)} required value={yearId}>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>)}</select></label>
        <label>Grade level<select name="gradeLevelId" onChange={(event) => setGradeId(event.target.value)} required value={gradeId}>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
        <label>Subject<select defaultValue={lesson.subjectId} name="subjectId" required>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label>Classroom <span className="optional-label">Optional</span>
          <select key={`${yearId}-${gradeId}`} defaultValue={availableClasses.some((item) => item.id === lesson.classroomId) ? lesson.classroomId ?? "" : ""} name="classroomId">
            <option value="">{availableClasses.length ? "Any classroom in this grade" : "No classrooms for this year and grade"}</option>
            {availableClasses.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
          </select>
        </label>
        <label>Unit or topic <span className="optional-label">Optional</span><input defaultValue={lesson.unitTopic ?? ""} maxLength={160} name="unitTopic" /></label>
        <label>Duration (minutes)<input defaultValue={lesson.durationMinutes} max={600} min={5} name="durationMinutes" required type="number" /></label>
        <label>Scheduled date <span className="optional-label">Optional</span><input defaultValue={lesson.scheduledDate ?? ""} name="scheduledDate" type="date" /></label>
      </div>
      {lessonSections.map((section) => (
        <label key={section.name}>{section.label} <span className="optional-label">Optional</span>
          <textarea defaultValue={lesson[section.name] ?? ""} maxLength={10000} name={section.name} rows={section.name === "procedures" ? 8 : 4} />
        </label>
      ))}
      <label>
        Revision note / change summary <span className="optional-label">Optional</span>
        <input name="changeSummary" maxLength={255} placeholder="e.g. Refined learning objectives, updated differentiation for Grade 9" />
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving..." : "Save lesson plan & create revision"}</button>
    </form>
  );
}
