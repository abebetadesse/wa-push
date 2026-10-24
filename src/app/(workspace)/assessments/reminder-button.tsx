"use client";

import { useActionState } from "react";
import { sendAssessmentReminders, type AssessmentActionState } from "./actions";

export function ReminderButton({ schoolId, assessmentId }: { schoolId: string; assessmentId: string }) {
  const [state, action, pending] = useActionState<AssessmentActionState, FormData>(sendAssessmentReminders, {});
  return (
    <form action={action} className="assessment-status-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="assessmentId" type="hidden" value={assessmentId} />
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="secondary-button" disabled={pending} type="submit">
        {pending ? "Sending reminders…" : "Remind students who haven’t submitted"}
      </button>
    </form>
  );
}
