"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { CURRICULUM_SUBJECTS } from "@/lib/ethiopian-curriculum";
import { addCatalogEntry, addTextbookToLibrary, recheckCatalogEntry } from "./actions";

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
