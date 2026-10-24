"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createAssessment, type AssessmentActionState } from "./actions";

type SchoolOption = { id: string; name: string };
type YearOption = { id: string; schoolId: string; name: string; isCurrent: boolean };
type ClassroomOption = { id: string; schoolId: string; academicYearId: string; name: string; gradeName: string };
type SubjectOption = { id: string; schoolId: string; name: string };
type QuestionDraft = {
  prompt: string;
  options: [string, string, string, string];
  correctOption: number;
  points: number;
};

const emptyQuestion = (): QuestionDraft => ({
  prompt: "",
  options: ["", "", "", ""],
  correctOption: 0,
  points: 1,
});

export function AssessmentForm({
  schools,
  years,
  classrooms,
  subjects,
}: {
  schools: SchoolOption[];
  years: YearOption[];
  classrooms: ClassroomOption[];
  subjects: SubjectOption[];
}) {
  const [state, action, pending] = useActionState<AssessmentActionState, FormData>(createAssessment, {});
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [yearId, setYearId] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [importMode, setImportMode] = useState(false);
  const availableYears = useMemo(() => years.filter((year) => year.schoolId === schoolId), [years, schoolId]);
  const selectedYearId = availableYears.some((year) => year.id === yearId)
    ? yearId
    : availableYears.find((year) => year.isCurrent)?.id ?? availableYears[0]?.id ?? "";
  const availableClasses = classrooms.filter((room) => room.schoolId === schoolId && room.academicYearId === selectedYearId);
  const availableSubjects = subjects.filter((subject) => subject.schoolId === schoolId);

  function updateQuestion(index: number, update: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((question, itemIndex) =>
      itemIndex === index ? { ...question, ...update } : question,
    ));
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      const options = [...question.options] as QuestionDraft["options"];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  }

  return (
    <form action={action} className="auth-form assessment-form">
      {schools.length > 1
        ? <label>School<select name="schoolId" onChange={(event) => { setSchoolId(event.target.value); setYearId(""); }} required value={schoolId}>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        : <input name="schoolId" type="hidden" value={schoolId} />}
      <label>Academic year<select name="academicYearId" onChange={(event) => setYearId(event.target.value)} required value={selectedYearId}><option value="" disabled>Select an academic year</option>{availableYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>)}</select></label>
      <div className="form-two-columns">
        <label>Class<select key={`${schoolId}-${selectedYearId}`} name="classroomId" required defaultValue=""><option value="" disabled>Select a class</option>{availableClasses.map((room) => <option key={room.id} value={room.id}>{room.gradeName} {room.name}</option>)}</select></label>
        <label>Subject<select key={schoolId} name="subjectId" required defaultValue=""><option value="" disabled>Select a subject</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      </div>
      {(availableYears.length === 0 || availableClasses.length === 0 || availableSubjects.length === 0) && (
        <p className="setup-hint">Set up an academic year, class, and subject in <Link href="/academic-setup">Academic setup</Link> first.</p>
      )}
      <label>Assessment title<input maxLength={200} name="title" required /></label>
      <label>Due date <span className="optional-label">Optional · students cannot submit after this date</span><input name="dueOn" type="date" /></label>
      <label>Instructions <span className="optional-label">Optional</span><textarea maxLength={2000} name="instructions" rows={2} /></label>
      <div className="assessment-questions-heading">
        <div><strong>Questions</strong><small>{importMode ? "Bulk import · up to 200 supported questions" : "Multiple choice · up to 30 questions"}</small></div>
        <div className="question-mode-actions">
          <button aria-pressed={!importMode} className="secondary-button" onClick={() => setImportMode(false)} type="button">Create manually</button>
          <button aria-pressed={importMode} className="secondary-button" onClick={() => setImportMode(true)} type="button">Import file</button>
          {!importMode && <button className="secondary-button" disabled={questions.length >= 30} onClick={() => setQuestions((current) => [...current, emptyQuestion()])} type="button">＋ Add question</button>}
        </div>
      </div>
      {importMode ? (
        <div className="question-import-fields">
          <label>Question file format<select name="questionFormat" required defaultValue="moodle-xml">
            <option value="moodle-xml">Moodle XML</option>
            <option value="gift">GIFT</option>
            <option value="aiken">Aiken</option>
            <option value="blackboard">Blackboard</option>
            <option value="webct">WebCT</option>
          </select></label>
          <label>Question file<input accept=".xml,.gift,.txt,.dat,text/plain,application/xml" name="questionFile" required type="file" /></label>
          <p className="setup-hint">Imports single-answer multiple-choice questions only. Other question types are skipped and reported. Files must be UTF-8 and no larger than 10 MB.</p>
        </div>
      ) : questions.map((question, index) => (
        <fieldset className="question-editor" key={index}>
          <legend>Question {index + 1}</legend>
          {questions.length > 1 && <button className="remove-question" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>}
          <label>Question<input maxLength={2000} name="question" required value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} /></label>
          <div className="choice-grid">
            {question.options.map((option, optionIndex) => (
              <label key={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}{optionIndex < 2 && " · Required"}
                <input maxLength={500} name={["optionA", "optionB", "optionC", "optionD"][optionIndex]} required={optionIndex < 2} value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} />
              </label>
            ))}
          </div>
          <div className="form-two-columns">
            <label>Correct answer<select name="correctOption" value={question.correctOption} onChange={(event) => updateQuestion(index, { correctOption: Number(event.target.value) })}>
              {question.options.map((option, optionIndex) => option.trim() && <option key={optionIndex} value={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}</option>)}
            </select></label>
            <label>Points<input max={100} min={1} name="points" onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })} required type="number" value={question.points} /></label>
          </div>
        </fieldset>
      ))}
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending || !availableYears.length || !availableClasses.length || !availableSubjects.length} type="submit">{pending ? "Saving assessment..." : "Save as draft"}</button>
    </form>
  );
}
