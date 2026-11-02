import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CsvDownloadButton } from "@/components/csv-download-button";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RecordForm, RowButton } from "@/components/record-form";
import { db } from "@/db";
import { fieldDefinitions, fieldFiles } from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import {
  ENTITY_LABELS,
  FIELD_ENTITIES,
  fieldTypeLabel,
  fieldValueAsInput,
  FILE_TYPES,
  formatFieldValue,
  isValueField,
  LAYOUT_TYPES,
  withFormulas,
  type FieldEntity,
} from "@/lib/custom-fields";
import { currentEthiopianYear, fieldsForSchool, fieldsForUnit, knownPeriods, loadFieldValues, mayEditField, mayViewField, type FieldDefinition } from "@/lib/field-data";
import { FIELD_PRESETS } from "@/lib/field-presets";
import { entityRecords, RECORD_NUMBER_COLUMN } from "@/lib/field-records";
import { ancestors, descendantIds } from "@/lib/hierarchy";
import { getPrivilegeResolver, type PrivilegeScope } from "@/lib/permissions";
import { allows, type PrivilegeAction } from "@/lib/privileges";
import { ORG_LEVEL_LABELS, ROLE_LABELS, type SchoolRoleName } from "@/lib/roles";
import { requireWorkspaceContext } from "@/lib/workspace";
import { applyPreset, createField, deleteField, importFieldDefinitions, importFieldValues, saveFieldValues, setFieldFlag, updateField } from "./actions";
import { FieldDesigner } from "./field-designer";
import { ValuesForm } from "./values-form";

export const metadata: Metadata = { title: "Data fields | Forma" };

const TABS = ["fields", "enter", "import", "templates"] as const;
type SearchParams = Promise<{ tab?: string; scope?: string; entity?: string; schoolId?: string; record?: string; period?: string }>;

async function DataFieldsContent({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireWorkspaceContext();
  if (!context.access.dataFields) redirect("/no-access");
  const params = await searchParams;
  const tab = activeTab(params.tab, TABS);
  const entity: FieldEntity = (FIELD_ENTITIES as readonly string[]).includes(params.entity ?? "") ? params.entity as FieldEntity : "school";
  const resolver = await getPrivilegeResolver();
  const { hierarchy } = resolver;
  const { platformAdmin } = context;

  const rolesAt = (schoolId: string) => context.roles.filter((membership) => membership.schoolId === schoolId).map(({ role }) => role);
  const can = (schoolId: string, resource: "data_fields" | "field_data", action: PrivilegeAction) => platformAdmin
    || rolesAt(schoolId).some((role) => allows(resolver.atSchool(schoolId, role, resource), action));

  // Where fields can be defined: the platform, units the user administers (or supervises with the
  // privilege), and schools where their role holds the data-field privilege.
  const administered = new Set<string>(platformAdmin ? hierarchy.units.map((unit) => unit.id) : []);
  const supervised = new Set<string>();
  for (const { unitId, role } of context.orgRoles) for (const id of descendantIds(hierarchy, unitId)) (role === "org_admin" ? administered : supervised).add(id);
  const canDefineAtUnit = (unitId: string, action: PrivilegeAction) => administered.has(unitId) || (supervised.has(unitId) && allows(resolver.atUnit(unitId, "supervisor", "data_fields"), action));
  const unitLabel = (unitId: string) => `${ORG_LEVEL_LABELS[hierarchy.byId.get(unitId)!.level]}: ${ancestors(hierarchy, unitId).reverse().map((unit) => unit.name).join(" › ")}`;
  const unitScopes = [...new Set([...administered, ...supervised])]
    .filter((id) => hierarchy.byId.get(id)?.level !== "woreda" || administered.size + supervised.size < 300 || params.scope === `org_unit:${id}`)
    .filter((id) => canDefineAtUnit(id, "read"));
  const scopes: { value: string; label: string; scope: PrivilegeScope }[] = [
    ...(platformAdmin ? [{ value: "platform", label: "Every school (platform)", scope: { type: "platform", id: "" } as PrivilegeScope }] : []),
    ...unitScopes.map((id) => ({ value: `org_unit:${id}`, label: unitLabel(id), scope: { type: "org_unit", id } as PrivilegeScope })).sort((a, b) => a.label.localeCompare(b.label)),
    ...context.schools.filter((school) => can(school.id, "data_fields", "read") || can(school.id, "field_data", "read"))
      .map((school) => ({ value: `school:${school.id}`, label: `School: ${school.name}`, scope: { type: "school", id: school.id } as PrivilegeScope })),
  ];
  if (scopes.length === 0) redirect("/no-access");
  const current = scopes.find((entry) => entry.value === params.scope) ?? scopes[0];
  const canDefine = (scope: PrivilegeScope, action: PrivilegeAction) => scope.type === "platform"
    ? platformAdmin
    : scope.type === "org_unit" ? canDefineAtUnit(scope.id, action) : can(scope.id, "data_fields", action);

  const schoolsForData = context.schools.filter((school) => can(school.id, "field_data", "read"));
  const schoolId = schoolsForData.find((school) => school.id === params.schoolId)?.id
    ?? (current.scope.type === "school" ? current.scope.id : schoolsForData[0]?.id);
  const periods = [...new Set([currentEthiopianYear(), ...await knownPeriods(schoolsForData.map((school) => school.id))])];
  const period = params.period?.trim() || periods[0];

  const keep = { scope: current.value, entity, schoolId, period };
  const header = (
    <header className="management-header">
      <div>
        <Link href="/" className="management-back">← Dashboard</Link>
        <p className="auth-eyebrow">DATA & REPORTS</p>
        <h1>Data fields</h1>
        <p className="management-description">Add your own fields to schools, students, teachers and staff — every kind of input, from counts and yes/no answers to Ethiopia locations, GPS, files and signatures — then fill them in, import them from CSV and report on them in Analytics.</p>
      </div>
    </header>
  );
  const picker = (
    <Form action="/data-fields" className="auth-form attendance-filter">
      <input name="tab" type="hidden" value={tab} />
      {tab === "fields" || tab === "templates"
        ? <label>Fields for<select defaultValue={current.value} name="scope">{scopes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        : <>
          <input name="scope" type="hidden" value={current.value} />
          <label>School<select defaultValue={schoolId} name="schoolId">{schoolsForData.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
          <label>Period<input defaultValue={period} list="known-periods" maxLength={20} name="period" /></label>
          <datalist id="known-periods">{periods.map((value) => <option key={value} value={value} />)}</datalist>
        </>}
      <label>Describes<select defaultValue={entity} name="entity">{FIELD_ENTITIES.map((value) => <option key={value} value={value}>{ENTITY_LABELS[value]}</option>)}</select></label>
      <button className="secondary-button" type="submit">Show</button>
    </Form>
  );
  const tabs = <PageTabs active={tab} basePath="/data-fields" params={keep} tabs={[
    { id: "fields", label: "Fields & forms" },
    { id: "enter", label: "Enter data" },
    { id: "import", label: "Import CSV" },
    { id: "templates", label: "Templates & export" },
  ]} />;

  // ── Fields & forms ──
  if (tab === "fields" || tab === "templates") {
    const scope = current.scope;
    const fields = scope.type === "school" ? await fieldsForSchool(scope.id, entity, { includeInactive: true })
      : scope.type === "org_unit" ? [...await fieldsForUnit(scope.id, entity), ...await db.select().from(fieldDefinitions).where(and(eq(fieldDefinitions.scopeType, "org_unit"), eq(fieldDefinitions.scopeId, scope.id), eq(fieldDefinitions.entity, entity), eq(fieldDefinitions.isActive, false)))]
        : await db.select().from(fieldDefinitions).where(and(eq(fieldDefinitions.scopeType, "platform"), eq(fieldDefinitions.entity, entity)));
    fields.sort((a, b) => (a.section ?? "").localeCompare(b.section ?? "") || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    const own = (field: FieldDefinition) => field.scopeType === scope.type && field.scopeId === scope.id;
    const origin = (field: FieldDefinition) => field.scopeType === "platform" ? "platform" : field.scopeType === "school" ? "this school" : hierarchy.byId.get(field.scopeId)?.name ?? "a unit above";
    const sections = [...new Set(fields.map((field) => field.section).filter((section): section is string => Boolean(section)))];
    const mayAdd = canDefine(scope, "add");
    const mayEdit = canDefine(scope, "edit");
    const mayDelete = canDefine(scope, "delete");
    const presets = FIELD_PRESETS.filter((preset) => preset.entity === entity);

    if (tab === "templates") {
      const valueFields = fields.filter((field) => field.isActive && isValueField(field.fieldType) && !FILE_TYPES.includes(field.fieldType));
      const idColumns = entity === "school" ? ["school_code", "school_name"] : [RECORD_NUMBER_COLUMN[entity], "name"];
      const exportSchools = (scope.type === "school" ? [scope.id] : scope.type === "org_unit"
        ? hierarchy.schools.filter((school) => school.orgUnitId && descendantIds(hierarchy, scope.id).has(school.orgUnitId)).map((school) => school.id)
        : context.schools.map((school) => school.id)).filter((id) => can(id, "field_data", "export"));
      const records = await entityRecords(entity, exportSchools);
      const values = await loadFieldValues(valueFields, records.map((record) => record.id), period);
      const schoolName = new Map(hierarchy.schools.map((school) => [school.id, school.name]));
      return (
        <main className="management-page">
          {header}{picker}{tabs}
          <div className="management-sections">
            <section className="management-card">
              <h2>CSV template for {current.label}</h2>
              <p className="management-description">The first row holds the field keys; fill one row per {entity === "school" ? "school" : entity}. Import it from the Import CSV tab. Columns may also be named by the field&apos;s label or local-language label (for example the Amharic headings of the census form).</p>
              <div className="inline-actions">
                <CsvDownloadButton filename={`${entity}-template.csv`} headers={[...idColumns, "period", ...valueFields.map((field) => field.fieldKey)]} label="Download blank template" rows={[[...idColumns.map(() => ""), period, ...valueFields.map((field) => field.config?.placeholder ?? "")]]} />
                <CsvDownloadButton filename={`${entity}-data-dictionary.csv`} headers={["key", "label", "local_label", "type", "section", "required", "options", "min", "max", "formula", "help"]} label="Download data dictionary" rows={valueFields.map((field) => [field.fieldKey, field.label, field.labelLocal, fieldTypeLabel(field.fieldType), field.section, field.required ? "yes" : "", (field.options ?? []).join("; "), field.config?.min, field.config?.max, field.config?.formula, field.helpText])} />
                {exportSchools.length > 0 && <CsvDownloadButton filename={`${entity}-values-${period.replace(/\W+/g, "-")}.csv`} headers={["school", ...idColumns, "period", ...valueFields.map((field) => field.fieldKey)]} label={`Export current values (${records.length})`} rows={records.map((record) => {
                  const stored = withFormulas(valueFields, values.get(record.id) ?? new Map());
                  return [schoolName.get(record.schoolId), record.number, record.name, period, ...valueFields.map((field) => fieldValueAsInput(stored.get(field.fieldKey)))];
                })} />}
              </div>
            </section>
            <section className="management-card">
              <h2>Sample templates</h2>
              <p className="management-description">Ready-made CSV files built from the cluster&apos;s pre-primary data collection form, with sample rows.</p>
              <ul className="template-list">
                {[
                  ["preprimary-census-template.csv", "Pre-primary school census — all fields, with the six Genet cluster sample schools"],
                  ["preprimary-census-amharic-headers.csv", "Pre-primary census with the form's Amharic column headings"],
                  ["hierarchy-template.csv", "Region › Zone › Woreda › Cluster › School list"],
                  ["students-import-template.csv", "Students with sex, birth date, grade and the student-profile fields"],
                  ["teachers-template.csv", "Teachers with sex, qualification and training"],
                  ["field-definitions-template.csv", "Field definitions (data dictionary) for designing new forms"],
                  ["report-samples.csv", "Sample report definitions for Analytics"],
                ].map(([file, description]) => <li key={file}><a className="text-link" download href={withBasePath(`/templates/${file}`)}>{file}</a> — {description}</li>)}
              </ul>
            </section>
          </div>
        </main>
      );
    }

    return (
      <main className="management-page">
        {header}{picker}{tabs}
        <div className="textbook-summary">
          <div><strong>{fields.filter((field) => field.isActive && isValueField(field.fieldType)).length}</strong><span>active fields</span></div>
          <div><strong>{fields.filter(own).length}</strong><span>defined here</span></div>
          <div><strong>{fields.filter((field) => !own(field)).length}</strong><span>inherited from above</span></div>
          <div><strong>{sections.length}</strong><span>sections</span></div>
        </div>
        <div className="management-sections">
          {mayAdd && (
            <section className="management-card">
              <h2>Add a field</h2>
              <p className="management-description">For {ENTITY_LABELS[entity].toLowerCase()}, applying to {current.label.replace(/^School: /, "")}{scope.type === "org_unit" ? " and every school below it" : ""}.</p>
              <FieldDesigner action={createField} hidden={{ scope: current.value, entity }} periodicDefault={entity === "school"} sections={sections} submitLabel="Add field" />
            </section>
          )}
          {mayAdd && presets.length > 0 && (
            <section className="management-card">
              <h2>Ready-made field sets</h2>
              <div className="record-list">{presets.map((preset) => (
                <div className="record-row" key={preset.id}>
                  <div><strong>{preset.name}</strong><small>{preset.description} {preset.fields.length} fields{preset.periodic ? ", kept per year" : ""}.</small></div>
                  <RowButton action={applyPreset} hidden={{ scope: current.value, presetId: preset.id }} label="Add these fields" pendingLabel="Adding…" />
                </div>
              ))}</div>
            </section>
          )}
          {mayAdd && (
            <section className="management-card">
              <h2>Design fields in a spreadsheet</h2>
              <p className="management-description">Import a data dictionary with the columns <code>key, label, local_label, type, section, required, options, min, max, unit, formula, help, periodic</code> (options separated by “;”). Start from the <a className="text-link" download href={withBasePath("/templates/field-definitions-template.csv")}>field definitions template</a>. Fields whose key already exists here are updated.</p>
              <RecordForm action={importFieldDefinitions} hidden={{ scope: current.value, entity }} pendingLabel="Importing…" submitLabel="Import fields" fields={[
                { name: "file", label: "CSV file (UTF-8)", type: "file", accept: ".csv,text/csv", wide: true },
                { name: "csv", label: "…or paste the rows", type: "textarea", max: 1_000_000 },
              ]} />
            </section>
          )}
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Fields</h2><p>{fields.length} for {ENTITY_LABELS[entity].toLowerCase()}</p></div></div>
            {fields.length === 0 ? <p className="empty-state">No fields yet.{mayAdd ? " Add one above or use a ready-made set." : ""}</p> : sections.concat(fields.some((field) => !field.section) ? [""] : []).map((section) => (
              <div key={section || "none"}>
                {section && <h3 className="org-subheading">{section}</h3>}
                <div className="record-list">{fields.filter((field) => (field.section ?? "") === section).map((field) => (
                  <div className={`record-row field-row${field.isActive ? "" : " field-inactive"}`} key={field.id}>
                    <div>
                      <strong>{field.label}{field.required && <span className="field-required"> *</span>}{field.labelLocal && <span className="field-local"> {field.labelLocal}</span>}</strong>
                      <small>{[fieldTypeLabel(field.fieldType), `key ${field.fieldKey}`, field.isPeriodic && "per period", field.config?.formula && `= ${field.config.formula}`, field.options?.length && `${field.options.length} options`, field.editRoles?.length && `edited by ${field.editRoles.map((role) => ROLE_LABELS[role as SchoolRoleName] ?? role).join(", ")}`, !own(field) && `from ${origin(field)}`, !field.isActive && "hidden"].filter(Boolean).join(" · ")}</small>
                    </div>
                    {own(field) && mayEdit && (
                      <span className="inline-actions">
                        <RowButton action={setFieldFlag} hidden={{ fieldId: field.id, flag: "up" }} label="↑" />
                        <RowButton action={setFieldFlag} hidden={{ fieldId: field.id, flag: "down" }} label="↓" />
                        {isValueField(field.fieldType) && <RowButton action={setFieldFlag} hidden={{ fieldId: field.id, flag: "required", value: field.required ? "" : "on" }} label={field.required ? "Make optional" : "Make required"} />}
                        <RowButton action={setFieldFlag} hidden={{ fieldId: field.id, flag: "isActive", value: field.isActive ? "" : "on" }} label={field.isActive ? "Hide" : "Show"} />
                        {mayDelete && <RowButton action={deleteField} confirm={`Delete “${field.label}” and every value stored in it?`} danger hidden={{ fieldId: field.id }} label="Delete" />}
                      </span>
                    )}
                    {own(field) && mayEdit && (
                      <details className="field-edit form-wide">
                        <summary>Edit</summary>
                        <FieldDesigner action={updateField} hidden={{ fieldId: field.id }} initial={{ ...field, editRoles: field.editRoles ?? [], viewRoles: field.viewRoles ?? [] }} sections={sections} submitLabel="Save field" />
                      </details>
                    )}
                  </div>
                ))}</div>
              </div>
            ))}
          </section>
        </div>
      </main>
    );
  }

  if (!schoolId) redirect("/no-access");
  const roles = rolesAt(schoolId);
  const fields = (await fieldsForSchool(schoolId, entity)).filter((field) => mayViewField(field, roles, resolver, schoolId, platformAdmin) || LAYOUT_TYPES.includes(field.fieldType));
  const schoolName = context.schools.find((school) => school.id === schoolId)?.name ?? "the school";

  // ── Import ──
  if (tab === "import") {
    const keyFields = fields.filter((field) => isValueField(field.fieldType) && !FILE_TYPES.includes(field.fieldType) && field.fieldType !== "formula" && field.fieldType !== "auto_number");
    return (
      <main className="management-page">
        {header}{picker}{tabs}
        <div className="management-sections">
          <section className="management-card">
            <h2>Import {ENTITY_LABELS[entity].toLowerCase()} data</h2>
            <p className="management-description">
              {entity === "school"
                ? "One row per school, matched by school_code, slug or school_name — so a cluster supervisor can import every school's census in one file. "
                : `One row per ${entity} of ${schoolName}, matched by ${RECORD_NUMBER_COLUMN[entity]}. `}
              Name columns by field key, label or local label. A <code>period</code> column overrides the period chosen here ({period}). Formulas are recalculated; empty cells leave the stored value unchanged.
            </p>
            <RecordForm action={importFieldValues} hidden={{ entity, schoolId, period }} pendingLabel="Importing…" submitLabel="Import values" fields={[
              { name: "file", label: "CSV file (UTF-8)", type: "file", accept: ".csv,text/csv", wide: true },
              { name: "csv", label: "…or paste the rows", type: "textarea", max: 5_000_000 },
            ]} />
          </section>
          <section className="management-card">
            <h2>Columns this import understands</h2>
            {keyFields.length === 0 ? <p className="empty-state">No fields to import into yet.</p> : (
              <div className="report-table-wrap"><table className="report-table">
                <thead><tr><th>Key</th><th>Label</th><th>Local label</th><th>Type</th><th>You may write</th></tr></thead>
                <tbody>{keyFields.map((field) => (
                  <tr key={field.id}><td><code>{field.fieldKey}</code></td><td>{field.label}</td><td>{field.labelLocal}</td><td>{fieldTypeLabel(field.fieldType)}{field.options?.length ? `: ${field.options.join(" / ")}` : ""}</td><td>{mayEditField(field, roles, resolver, schoolId, platformAdmin) ? "Yes" : "No"}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        </div>
      </main>
    );
  }

  // ── Enter data ──
  const records = entity === "school" ? [] : await entityRecords(entity, [schoolId]);
  const recordId = entity === "school" ? schoolId : records.find((record) => record.id === params.record)?.id;
  const values = recordId ? await loadFieldValues(fields, [recordId], period) : new Map();
  const stored = withFormulas(fields, values.get(recordId ?? "") ?? new Map());
  const fileIds = [...stored.entries()].filter(([key]) => FILE_TYPES.includes(fields.find((field) => field.fieldKey === key)?.fieldType ?? "")).flatMap(([, value]) => Array.isArray(value) ? value : []);
  const fileRows = fileIds.length ? await db.select().from(fieldFiles).where(inArray(fieldFiles.id, fileIds)) : [];
  const files: Record<string, { id: string; fileName: string; url: string; isImage: boolean }[]> = {};
  for (const field of fields.filter((candidate) => FILE_TYPES.includes(candidate.fieldType))) {
    const ids = stored.get(field.fieldKey);
    files[field.fieldKey] = (Array.isArray(ids) ? ids : []).map((id) => fileRows.find((row) => row.id === id)).filter((row) => row !== undefined)
      .map((row) => ({ id: row.id, fileName: row.fileName, url: withBasePath(`/api/field-files/${row.id}`), isImage: row.contentType.startsWith("image/") }));
  }
  const summaryFields = fields.filter((field) => isValueField(field.fieldType) && !FILE_TYPES.includes(field.fieldType)).slice(0, 6);
  const allValues = entity !== "school" && records.length ? await loadFieldValues(summaryFields, records.map((record) => record.id), period) : new Map();

  return (
    <main className="management-page">
      {header}{picker}{tabs}
      <div className="management-sections">
        {entity !== "school" && (
          <section className="management-card">
            <div className="management-card-heading"><div><h2>{ENTITY_LABELS[entity]} at {schoolName}</h2><p>{records.length} records · choose one to fill in its fields</p></div></div>
            {records.length === 0 ? <p className="empty-state">No {entity} records at this school yet.</p> : (
              <div className="report-table-wrap"><table className="report-table">
                <thead><tr><th>Number</th><th>Name</th>{summaryFields.map((field) => <th key={field.id}>{field.label}</th>)}<th /></tr></thead>
                <tbody>{records.map((record) => {
                  const row = withFormulas(fields, allValues.get(record.id) ?? new Map());
                  return (
                    <tr aria-current={record.id === recordId ? "true" : undefined} key={record.id}>
                      <td>{record.number}</td><td>{record.name}</td>
                      {summaryFields.map((field) => <td key={field.id}>{formatFieldValue(field, row.get(field.fieldKey))}</td>)}
                      <td><Link className="text-link" href={`/data-fields?${new URLSearchParams({ tab: "enter", scope: current.value, entity, schoolId, period, record: record.id })}`}>{record.id === recordId ? "Editing" : "Fill in"}</Link></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </section>
        )}
        {recordId && (
          <section className="management-card">
            <h2>{entity === "school" ? `${schoolName} — ${period}` : `${records.find((record) => record.id === recordId)?.name} — ${period}`}</h2>
            {fields.length === 0
              ? <p className="empty-state">No fields for {ENTITY_LABELS[entity].toLowerCase()} yet. Add them in Fields & forms.</p>
              : <ValuesForm
                action={saveFieldValues}
                fields={fields.map((field) => ({ ...field, editable: mayEditField(field, roles, resolver, schoolId, platformAdmin) }))}
                files={files}
                hidden={{ entity, entityId: recordId, period }}
                key={`${recordId}:${period}`}
                values={Object.fromEntries(stored)}
              />}
          </section>
        )}
      </div>
    </main>
  );
}

export default function DataFieldsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading data fields...</p></main>}><DataFieldsContent searchParams={searchParams} /></Suspense>;
}
