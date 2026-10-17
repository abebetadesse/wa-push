"use client";

import { useActionState, useState } from "react";
import { submitAssessmentAttempt, type AssessmentActionState } from "@/app/assessments/actions";

export type StudentAssessmentQuestion = {
  id: string;
  questionText: string;
  options: string[];
};

export function AssessmentTaker({
  assessmentId,
  questions,
}: {
  assessmentId: string;
  questions: StudentAssessmentQuestion[];
}) {
  const [started, setStarted] = useState(false);
  const [state, action, pending] = useActionState<AssessmentActionState, FormData>(submitAssessmentAttempt, {});

  return (
    <div className="student-assessment">
      {!started ? (
        <button className="secondary-button" onClick={() => setStarted(true)} type="button">Start assessment</button>
      ) : (
        <form action={action} className="auth-form student-assessment-form">
          <input name="assessmentId" type="hidden" value={assessmentId} />
          {questions.map((question, questionIndex) => (
            <fieldset className="student-question" key={question.id}>
              <legend>Question {questionIndex + 1}</legend>
              <p>{question.questionText}</p>
              <div className="student-options">
                {question.options.map((option, optionIndex) => option.trim() ? (
                  <label key={optionIndex}>
                    <input name="answer" required type="radio" value={optionIndex} />
                    <span>{option}</span>
                  </label>
                ) : null)}
              </div>
            </fieldset>
          ))}
          {state.error && <p className="auth-error" role="alert">{state.error}</p>}
          {state.success && <p className="auth-success" role="status">{state.success}</p>}
          <button className="primary-button" disabled={pending || Boolean(state.success)} type="submit">
            {pending ? "Submitting..." : "Submit answers"}
          </button>
        </form>
      )}
    </div>
  );
}
