"use client";

import { useActionState } from "react";
import { FieldInput, type InputField, type StoredFile } from "@/components/field-input";
import type { FieldValue } from "@/db/schema";

type FormState = { error?: string; success?: string };

export type EntryField = InputField & { section: string | null; editable: boolean };

/** The data-entry form for one record: every field it may show, grouped by section. */
export function ValuesForm({ action, hidden, fields, values, files }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  fields: EntryField[];
  values: Record<string, FieldValue>;
  files: Record<string, StoredFile[]>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const sections = [...new Set(fields.map((field) => field.section ?? ""))];
  const anyEditable = fields.some((field) => field.editable);
  return (
    <form action={formAction} className="auth-form values-form">
      {Object.entries(hidden).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      {sections.map((section) => (
        <fieldset className="values-section" key={section || "general"}>
          {section && <legend>{section}</legend>}
          <div className="form-two-columns">
            {fields.filter((field) => (field.section ?? "") === section).map((field) => (
              <FieldInput disabled={!field.editable} field={field} files={files[field.fieldKey]} key={field.id} value={values[field.fieldKey]} />
            ))}
          </div>
        </fieldset>
      ))}
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      {anyEditable
        ? <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving…" : "Save values"}</button>
        : <p className="field-help">Your role can view these fields but not change them.</p>}
    </form>
  );
}
