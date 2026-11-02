"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { FieldInput, type InputField } from "@/components/field-input";
import type { FieldConfig } from "@/db/schema";
import { CHOICE_TYPES, FIELD_TYPES, FILE_TYPES, LAYOUT_TYPES, NUMERIC_TYPES, toFieldKey } from "@/lib/custom-fields";
import { ROLE_LABELS, SCHOOL_ROLES } from "@/lib/roles";

type FormState = { error?: string; success?: string };

export type DesignerField = InputField & {
  section: string | null;
  sortOrder: number;
  editRoles: string[] | null;
  viewRoles: string[] | null;
  isPeriodic: boolean;
};

const GROUPS = [...new Set(FIELD_TYPES.map((entry) => entry.group))];

/** Creates or edits one data field, with a live preview of the control people will fill in. */
export function FieldDesigner({ action, hidden, initial, sections, submitLabel, periodicDefault = false }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  initial?: DesignerField;
  sections: string[];
  submitLabel: string;
  periodicDefault?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState(initial?.fieldType ?? "text");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [key, setKey] = useState(initial?.fieldKey ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(initial));
  const [options, setOptions] = useState((initial?.options ?? []).join("\n"));
  const [config, setConfig] = useState<FieldConfig>(initial?.config ?? {});
  const [required, setRequired] = useState(initial?.required ?? false);
  const [help, setHelp] = useState(initial?.helpText ?? "");
  const [local, setLocal] = useState(initial?.labelLocal ?? "");

  const numeric = NUMERIC_TYPES.includes(type) && type !== "formula" && type !== "auto_number";
  const needsOptions = CHOICE_TYPES.includes(type) && !["yes_no", "switch", "gender"].includes(type);
  const isLayout = LAYOUT_TYPES.includes(type);
  const textual = ["text", "textarea", "rich_text", "barcode", "address"].includes(type);
  const setNumber = (name: keyof FieldConfig) => (event: ChangeEvent<HTMLInputElement>) =>
    setConfig((current) => ({ ...current, [name]: event.target.value === "" ? undefined : Number(event.target.value) }));
  const setText = (name: keyof FieldConfig) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setConfig((current) => ({ ...current, [name]: event.target.value || undefined }));

  const preview: InputField = {
    id: "preview",
    fieldKey: key || "preview",
    label: label || "Field label",
    labelLocal: local || null,
    fieldType: type,
    options: options.split(/\r?\n|,/).map((option) => option.trim()).filter(Boolean),
    config,
    required,
    helpText: help || null,
  };

  return (
    <div className="field-designer">
    <form action={formAction} className="auth-form" key={initial ? undefined : state.success}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      <div className="form-two-columns">
        <label>Label <input maxLength={160} name="label" onChange={(event) => { setLabel(event.target.value); if (!keyTouched) setKey(toFieldKey(event.target.value)); }} placeholder="Female teachers" required value={label} /></label>
        <label>Local-language label <span className="optional-label">Optional</span><input maxLength={200} name="labelLocal" onChange={(event) => setLocal(event.target.value)} placeholder="ጠቅላላ ሴት መ/ራን" value={local} /></label>
        <label>Type
          <select name="fieldType" onChange={(event) => setType(event.target.value)} value={type}>
            {GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {FIELD_TYPES.filter((entry) => entry.group === group).map((entry) => <option key={entry.type} value={entry.type}>{entry.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label>Key (for formulas, imports and reports)<input maxLength={60} name="fieldKey" onChange={(event) => { setKeyTouched(true); setKey(event.target.value.toLowerCase()); }} pattern="[a-z][a-z0-9_]*" placeholder="female_teachers" value={key} /></label>
        <label>Section <span className="optional-label">Optional</span>
          <input defaultValue={initial?.section ?? ""} list="field-sections" maxLength={100} name="section" placeholder="4. Teachers" />
          <datalist id="field-sections">{sections.map((section) => <option key={section} value={section} />)}</datalist>
        </label>
        <label>Order<input className="number-input" defaultValue={initial?.sortOrder ?? 0} name="sortOrder" type="number" /></label>

        {needsOptions && <label className="form-wide">Options, one per line<textarea name="options" onChange={(event) => setOptions(event.target.value)} rows={4} value={options} /></label>}
        {type === "formula" && (
          <label className="form-wide">Formula
            <input name="formula" onChange={setText("formula")} placeholder="age4_female + age5_female + age6_female" value={config.formula ?? ""} />
            <small className="field-help">Use other fields&apos; keys with + − × ÷ (* /), % and parentheses. Division by zero leaves the value empty.</small>
          </label>
        )}
        {(numeric || type === "auto_number") && <>
          <label>Minimum<input name="min" onChange={setNumber("min")} step="any" type="number" value={config.min ?? ""} /></label>
          <label>Maximum<input name="max" onChange={setNumber("max")} step="any" type="number" value={config.max ?? ""} /></label>
          {numeric && <label>Step<input name="step" onChange={setNumber("step")} step="any" type="number" value={config.step ?? ""} /></label>}
          {numeric && <label>Unit<input maxLength={30} name="unit" onChange={setText("unit")} placeholder="km, kg, students…" value={config.unit ?? ""} /></label>}
        </>}
        {textual && <>
          <label>Maximum length<input min={1} name="maxLength" onChange={setNumber("maxLength")} type="number" value={config.maxLength ?? ""} /></label>
          {type === "text" && <label>Format pattern (regular expression)<input maxLength={200} name="pattern" onChange={setText("pattern")} placeholder="[0-9]{10}" value={config.pattern ?? ""} /></label>}
        </>}
        {!isLayout && !FILE_TYPES.includes(type) && type !== "formula" && <>
          <label>Placeholder<input maxLength={120} name="placeholder" onChange={setText("placeholder")} value={config.placeholder ?? ""} /></label>
          <label>Default value<input maxLength={200} name="defaultValue" onChange={setText("defaultValue")} value={config.defaultValue ?? ""} /></label>
        </>}
        <label className="form-wide">{isLayout ? "Text shown" : "Help text"}<input maxLength={300} name="helpText" onChange={(event) => setHelp(event.target.value)} value={help} /></label>
        {!isLayout && <>
          <label className="checkbox-label"><input checked={required} name="required" onChange={(event) => setRequired(event.target.checked)} type="checkbox" /> Required (mandatory)</label>
          <label className="checkbox-label"><input defaultChecked={initial?.isPeriodic ?? periodicDefault} name="isPeriodic" type="checkbox" /> Keep values per period (e.g. per year)</label>
        </>}
      </div>

      {!isLayout && (
        <details className="field-roles">
          <summary>Who may fill in and see this field</summary>
          <p className="field-help">Leave empty to allow every role with the data-field privilege. School administrators always may.</p>
          <div className="role-columns">
            <fieldset><legend>May edit</legend>{SCHOOL_ROLES.map((role) => <label className="checkbox-label" key={role}><input defaultChecked={initial?.editRoles?.includes(role)} name="editRoles" type="checkbox" value={role} /> {ROLE_LABELS[role]}</label>)}</fieldset>
            <fieldset><legend>May view</legend>{SCHOOL_ROLES.map((role) => <label className="checkbox-label" key={role}><input defaultChecked={initial?.viewRoles?.includes(role)} name="viewRoles" type="checkbox" value={role} /> {ROLE_LABELS[role]}</label>)}</fieldset>
          </div>
        </details>
      )}

      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving…" : submitLabel}</button>
    </form>
    {/* Outside the form, so trying the preview never blocks or joins the submission. */}
    <div aria-label="Preview" className="field-preview">
      <span className="auth-eyebrow">PREVIEW</span>
      <div className="form-two-columns"><FieldInput field={preview} value={null} /></div>
    </div>
    </div>
  );
}
