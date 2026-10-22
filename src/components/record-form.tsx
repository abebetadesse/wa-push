"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";

type FormState = { error?: string; success?: string };
type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "date" | "time" | "email" | "tel" | "select" | "checkbox";
  required?: boolean;
  max?: number;
  min?: number;
  placeholder?: string;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  /** Spans both columns. */
  wide?: boolean;
};

function Field({ field }: { field: FieldSpec }) {
  const optional = !field.required && field.type !== "checkbox" && <span className="optional-label">Optional</span>;
  const common = { name: field.name, required: field.required, defaultValue: field.defaultValue, placeholder: field.placeholder };
  if (field.type === "checkbox") {
    return <label className="checkbox-label form-wide"><input defaultChecked={field.defaultValue === "on"} name={field.name} type="checkbox" /> {field.label}</label>;
  }
  let control;
  if (field.type === "select") {
    control = (
      <select {...common} defaultValue={field.defaultValue ?? (field.required ? "" : undefined)}>
        {field.required && !field.defaultValue && <option disabled value="">Choose…</option>}
        {!field.required && <option value="">—</option>}
        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  } else if (field.type === "textarea") {
    control = <textarea {...common} maxLength={field.max} rows={3} />;
  } else {
    control = <input {...common} max={field.type === "number" ? field.max : undefined} maxLength={field.type === "number" ? undefined : field.max} min={field.min} type={field.type ?? "text"} />;
  }
  return <label className={field.wide || field.type === "textarea" ? "form-wide" : undefined}>{field.label} {optional}{control}</label>;
}

/** A create/edit form for one record, described by its fields. */
export function RecordForm({ action, fields, hidden = {}, submitLabel, pendingLabel = "Saving…", resetOnSuccess = true }: {
  action: FormAction;
  fields: FieldSpec[];
  hidden?: Record<string, string>;
  submitLabel: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="auth-form" key={resetOnSuccess ? state.success : undefined}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      <div className="form-two-columns">{fields.map((field) => <Field field={field} key={field.name} />)}</div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? pendingLabel : submitLabel}</button>
    </form>
  );
}

/** A one-click action on a list row (approve, return, resolve…), with an optional confirmation. */
export function RowButton({ action, hidden, label, pendingLabel = "Saving…", confirm, danger }: {
  action: FormAction;
  hidden: Record<string, string>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  danger?: boolean;
}) {
  return (
    <ActionForm action={action} className="inline-action">
      {Object.entries(hidden).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      <SubmitButton className={danger ? "danger-button record-action" : undefined} confirm={confirm} pendingLabel={pendingLabel}>{label}</SubmitButton>
    </ActionForm>
  );
}
