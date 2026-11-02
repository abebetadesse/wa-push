"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { StatusForm } from "@/components/status-form";
import { SubmitButton } from "@/components/submit-button";
import { CURRICULUM_SUBJECTS } from "@/lib/ethiopian-curriculum";
import { addCatalogEntry, addGradeTextbooks, addTextbookToLibrary, loadOfficialCatalog, recheckCatalog, recheckCatalogEntry, removeCatalogEntry } from "./actions";

export function AddToLibraryButton({ schoolId, catalogEntryId, sizeLabel }: { schoolId: string; catalogEntryId: string; sizeLabel: string }) {
  return (
    <ActionForm action={addTextbookToLibrary} className="inline-action">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="catalogEntryId" type="hidden" value={catalogEntryId} />
      <SubmitButton pendingLabel="Downloading…">Add to library{sizeLabel ? ` · ${sizeLabel}` : ""}</SubmitButton>
    </ActionForm>
  );
}

export function RecheckButton({ catalogEntryId }: { catalogEntryId: string }) {
  return (
    <ActionForm action={recheckCatalogEntry} className="inline-action">
      <input name="catalogEntryId" type="hidden" value={catalogEntryId} />
      <SubmitButton pendingLabel="Checking…">Check source</SubmitButton>
    </ActionForm>
  );
}

/** Adds every available book of one grade to the school's library, in the background. */
export function AddGradeButton({ schoolId, grade, count }: { schoolId: string; grade: number; count: number }) {
  return (
    <StatusForm action={addGradeTextbooks} className="inline-action">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="grade" type="hidden" value={grade} />
      <SubmitButton className="primary-button" pendingLabel="Starting…">Add all {count} to the library</SubmitButton>
    </StatusForm>
  );
}

export function CatalogMaintenance() {
  return (
    <div className="inline-actions">
      <StatusForm action={loadOfficialCatalog} className="inline-action">
        <SubmitButton className="primary-button" pendingLabel="Loading…">Load the official textbook list</SubmitButton>
      </StatusForm>
      <StatusForm action={recheckCatalog} className="inline-action">
        <SubmitButton pendingLabel="Starting…">Check every source</SubmitButton>
      </StatusForm>
    </div>
  );
}

export function RemoveCatalogEntryButton({ catalogEntryId, title }: { catalogEntryId: string; title: string }) {
  return (
    <ActionForm action={removeCatalogEntry} className="inline-action">
      <input name="catalogEntryId" type="hidden" value={catalogEntryId} />
      <SubmitButton className="danger-button record-action" confirm={`Remove “${title}” from the catalog? Schools keep the copies they already added.`} pendingLabel="Removing…">Remove</SubmitButton>
    </ActionForm>
  );
}

export function CatalogEntryForm() {
  const [state, action, pending] = useActionState(addCatalogEntry, {});
  return (
    <form action={action} className="auth-form">
      <div className="form-two-columns">
        <label>Grade
          <select name="grade" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>Grade {index + 1}</option>)}
          </select>
        </label>
        <label>Subject
          <select name="subjectName" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {CURRICULUM_SUBJECTS.map((subject) => <option key={subject.code} value={subject.name}>{subject.name}</option>)}
          </select>
        </label>
        <label>Kind
          <select defaultValue="student_textbook" name="kind">
            <option value="student_textbook">Student textbook</option>
            <option value="teacher_guide">Teacher guide</option>
          </select>
        </label>
        <label>Title<input maxLength={200} name="title" placeholder="Biology Student Textbook Grade 10" required /></label>
        <label>Language<input maxLength={40} name="language" placeholder="English" required /></label>
        <label>Publisher<input defaultValue="Ministry of Education, FDRE" maxLength={160} name="publisher" required /></label>
        <label>Web address<input maxLength={1000} name="sourceUrl" placeholder="https://elearn.moe.gov.et/…" required type="url" /></label>
      </div>
      <label className="checkbox-label"><input defaultChecked name="directDownload" type="checkbox" /> The address is the PDF file itself (not a page that links to it)</label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Adding…" : "Add to catalog"}</button>
    </form>
  );
}
