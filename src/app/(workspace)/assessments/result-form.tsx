"use client";

import { useActionState } from "react";
import { recordAssessmentResult, type AssessmentActionState } from "./actions";

export function ResultForm({
  schoolId,
  assessmentId,
  studentId,
  studentName,
  studentNumber,
  maxScore,
  currentScore,
  feedback,
}: {
  schoolId: string;
  assessmentId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  maxScore: number;
  currentScore: number | null;
  feedback: string | null;
}) {
  const [state, action, pending] = useActionState<AssessmentActionState, FormData>(recordAssessmentResult, {});

  return (
    <form action={action} className="result-entry">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="assessmentId" type="hidden" value={assessmentId} />
      <input name="studentId" type="hidden" value={studentId} />
      <span className="result-student"><strong>{studentName}</strong><small>{studentNumber}</small></span>
      <label className="score-field"><span className="visually-hidden">{studentName} score</span><input aria-label={`${studentName} score`} max={maxScore} min={0} name="score" placeholder="Score" required type="number" defaultValue={currentScore ?? ""} /></label>
      <label className="feedback-field"><span className="visually-hidden">Feedback for {studentName}</span><input aria-label={`Feedback for ${studentName}`} maxLength={500} name="feedback" placeholder="Feedback (optional)" defaultValue={feedback ?? ""} /></label>
      <button className="secondary-button record-action" disabled={pending} type="submit">{pending ? "Saving..." : currentScore === null ? "Save" : "Update"}</button>
      {(state.error || state.success) && <span className={state.error ? "result-message result-error" : "result-message"} role={state.error ? "alert" : "status"}>{state.error ?? state.success}</span>}
    </form>
  );
}
