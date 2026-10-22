"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { AI_MODELS, MATERIAL_KINDS, MATERIAL_LABELS } from "@/lib/ai-materials";
import { approveMaterial, deleteMaterial, retryGeneration, saveAsLessonPlan, saveAsQuiz, startGeneration } from "./actions";

type SchoolOption = { id: string; name: string };
type TextbookOption = { id: string; schoolId: string; label: string };

export function GenerateForm({ schools, textbooks, defaults }: {
  schools: SchoolOption[];
  textbooks: TextbookOption[];
  defaults: { schoolId: string; resourceId?: string; kind?: string };
}) {
  const [state, action, pending] = useActionState(startGeneration, {});
  const [schoolId, setSchoolId] = useState(defaults.schoolId);
  const schoolTextbooks = textbooks.filter((book) => book.schoolId === schoolId);
  return (
    <form action={action} className="auth-form">
      {schools.length > 1
        ? <label>School<select name="schoolId" onChange={(event) => setSchoolId(event.target.value)} value={schoolId}>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        : <input name="schoolId" type="hidden" value={schoolId} />}
      <label>Textbook
        <select defaultValue={defaults.resourceId} key={schoolId} name="resourceId" required>
          {schoolTextbooks.length === 0 && <option value="">No PDF textbooks in this school&apos;s library yet</option>}
          {schoolTextbooks.map((book) => <option key={book.id} value={book.id}>{book.label}</option>)}
        </select>
      </label>
      <div className="form-two-columns">
        <label>Prepare
          <select defaultValue={defaults.kind ?? "lesson_plan"} name="kind">
            {MATERIAL_KINDS.map((kind) => <option key={kind} value={kind}>{MATERIAL_LABELS[kind]}</option>)}
          </select>
        </label>
        <label>Model
          <select defaultValue="quality" name="model">
            {Object.entries(AI_MODELS).map(([key, model]) => <option key={key} value={key}>{model.label}</option>)}
          </select>
        </label>
      </div>
      <label>Unit, lesson or pages to cover<input maxLength={200} name="scope" placeholder="Unit 2: Measurement, lesson 2.3 (pages 34–39)" required /></label>
      <label>Notes for Claude <span className="optional-label">Optional</span>
        <textarea maxLength={2000} name="instructions" placeholder="Class of 60 students, one 40-minute period, no lab equipment. Write in English." rows={3} />
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="primary-button auth-submit" disabled={pending || schoolTextbooks.length === 0} type="submit">{pending ? "Starting…" : "Prepare with Claude"}</button>
      <p className="report-note">Claude reads the whole textbook, so one request costs roughly US$0.10–1.50 depending on its length; requests on the same book within five minutes reuse it at a fraction of the price. Always review the result before using it in class.</p>
    </form>
  );
}

/** Reloads the page every few seconds while the material is being written. */
export function RefreshWhileGenerating() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

function MaterialButton({ action, materialId, label, pendingLabel, confirm, className }: {
  action: (state: { error?: string; success?: string }, formData: FormData) => Promise<{ error?: string; success?: string }>;
  materialId: string;
  label: string;
  pendingLabel: string;
  confirm?: string;
  className?: string;
}) {
  return (
    <ActionForm action={action} className="inline-action">
      <input name="materialId" type="hidden" value={materialId} />
      <SubmitButton className={className} confirm={confirm} pendingLabel={pendingLabel}>{label}</SubmitButton>
    </ActionForm>
  );
}

export function RetryButton({ materialId }: { materialId: string }) {
  return <MaterialButton action={retryGeneration} label="Try again" materialId={materialId} pendingLabel="Starting…" />;
}
export function ApproveButton({ materialId }: { materialId: string }) {
  return <MaterialButton action={approveMaterial} label="Approve" materialId={materialId} pendingLabel="Approving…" />;
}
export function DeleteButton({ materialId }: { materialId: string }) {
  return <MaterialButton action={deleteMaterial} className="danger-button record-action" confirm="Delete this material?" label="Delete" materialId={materialId} pendingLabel="Deleting…" />;
}
export function SaveLessonButton({ materialId }: { materialId: string }) {
  return <MaterialButton action={saveAsLessonPlan} label="Save to Lesson plans" materialId={materialId} pendingLabel="Saving…" />;
}

export function SaveQuizForm({ materialId, classes }: { materialId: string; classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveAsQuiz, {});
  return (
    <form action={action} className="inline-actions">
      <input name="materialId" type="hidden" value={materialId} />
      <select aria-label="Class" name="classroomId" required>
        {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
      </select>
      <button className="secondary-button record-action" disabled={pending || classes.length === 0} type="submit">{pending ? "Saving…" : "Save as online quiz"}</button>
      {state.error && <span className="action-error" role="alert">{state.error}</span>}
      {state.success && <span className="auth-success" role="status">{state.success}</span>}
    </form>
  );
}
