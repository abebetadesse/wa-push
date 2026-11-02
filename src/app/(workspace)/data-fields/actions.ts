"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fieldDefinitions, fieldFiles, fieldValues, schools, type FieldConfig, type FieldValue } from "@/db/schema";
import { parseCsvRecords } from "@/lib/csv";
import {
  CHOICE_TYPES,
  FIELD_ENTITIES,
  FIELD_KEY_PATTERN,
  FIELD_TYPE_KEYS,
  FILE_TYPES,
  FieldValueError,
  fieldTypeLabel,
  formulaInputs,
  isValueField,
  LAYOUT_TYPES,
  MULTI_FILE_TYPES,
  parseFieldInput,
  toFieldKey,
  withFormulas,
  type FieldEntity,
} from "@/lib/custom-fields";
import { fieldsForSchool, mayEditField, type FieldDefinition } from "@/lib/field-data";
import { FIELD_PRESETS } from "@/lib/field-presets";
import { findRecordByNumber, recordSchool } from "@/lib/field-records";
import { isDuplicateEntry } from "@/lib/db-errors";
import { ancestors, loadHierarchy } from "@/lib/hierarchy";
import { resourceStorageDirectory, resourceStoragePath } from "@/lib/learning-resources";
import {
  canAdministerUnit,
  getOrgRoles,
  getPrivilegeResolver,
  isPlatformAdmin,
  requirePrivilege,
  requireSchoolRole,
  requireSession,
  rolesAllow,
  type PrivilegeScope,
} from "@/lib/permissions";
import { allows, type PrivilegeAction } from "@/lib/privileges";
import { SCHOOL_ROLES } from "@/lib/roles";

const MAX_FIELD_FILE_BYTES = 10 * 1024 * 1024;

function readScope(formData: FormData): PrivilegeScope {
  const [type, id = ""] = String(formData.get("scope") ?? "").split(":");
  if (type === "platform") return { type, id: "" };
  if ((type === "org_unit" || type === "school") && /^[0-9a-f-]{36}$/i.test(id)) return { type, id };
  throw new UserError("Choose where the field applies.");
}

/**
 * Field definitions are changed by the super administrator (platform fields), an administrator of the
 * unit (unit fields, for every school below) or anyone whose role holds the data-field privilege at
 * the school (school fields) — supervisors and teachers too, once an administrator grants it.
 */
async function requireDefinitionAccess(scope: PrivilegeScope, action: PrivilegeAction) {
  const session = await requireSession();
  if (isPlatformAdmin(session)) return session;
  if (scope.type === "platform") throw new UserError("Only the super administrator can add fields for every school.");
  if (scope.type === "org_unit") {
    if (await canAdministerUnit(scope.id)) return session;
    // A supervisor of the unit may define fields there when the supervisor role is granted it.
    const [resolver, roles, hierarchy] = await Promise.all([getPrivilegeResolver(), getOrgRoles(session.user.id), loadHierarchy()]);
    const above = new Set(ancestors(hierarchy, scope.id).map((unit) => unit.id));
    if (roles.some((role) => role.role === "supervisor" && above.has(role.unitId)) && allows(resolver.atUnit(scope.id, "supervisor", "data_fields"), action)) return session;
    throw new UserError("You do not have the privilege to change this unit's data fields.");
  }
  await requirePrivilege(scope.id, "data_fields", action);
  return session;
}

function revalidate() {
  revalidatePath("/data-fields");
  revalidatePath("/analytics");
}

function readDefinition(formData: FormData) {
  const raw = (name: string) => String(formData.get(name) ?? "").trim();
  const label = raw("label");
  if (!label || label.length > 160) throw new UserError("Enter a label of up to 160 characters.");
  const fieldType = raw("fieldType");
  if (!(FIELD_TYPE_KEYS as string[]).includes(fieldType)) throw new UserError("Choose a field type.");
  const fieldKey = (raw("fieldKey") || toFieldKey(label)).toLowerCase();
  if (!FIELD_KEY_PATTERN.test(fieldKey)) throw new UserError("The key must start with a letter and use only lowercase letters, numbers and _ (up to 60).");
  const options = raw("options").split(/\r?\n|,/).map((option) => option.trim()).filter(Boolean);
  const needsOptions = CHOICE_TYPES.includes(fieldType) && !["yes_no", "switch", "gender"].includes(fieldType);
  if (needsOptions && options.length < 2) throw new UserError("Give at least two options, one per line.");
  if (options.some((option) => option.length > 120) || options.length > 200) throw new UserError("Use at most 200 options of up to 120 characters.");
  const number = (name: string) => {
    const value = raw(name);
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new UserError(`Enter ${name} as a number.`);
    return parsed;
  };
  const config: FieldConfig = {
    min: number("min"),
    max: number("max"),
    step: number("step"),
    maxLength: number("maxLength"),
    unit: raw("unit").slice(0, 30) || undefined,
    placeholder: raw("placeholder").slice(0, 120) || undefined,
    pattern: raw("pattern").slice(0, 200) || undefined,
    defaultValue: raw("defaultValue").slice(0, 200) || undefined,
    formula: raw("formula").slice(0, 500) || undefined,
  };
  if (config.min !== undefined && config.max !== undefined && config.min > config.max) throw new UserError("The minimum must not be larger than the maximum.");
  if (config.pattern) {
    try { new RegExp(config.pattern, "u"); } catch { throw new UserError("The format pattern is not a valid regular expression."); }
  }
  if (fieldType === "formula") {
    if (!config.formula) throw new UserError("Write the formula, for example female + male.");
    try { formulaInputs(config.formula); } catch (error) { throw new UserError(error instanceof Error ? error.message : "The formula is not valid."); }
  }
  const roles = (name: string) => formData.getAll(name).map(String).filter((role) => (SCHOOL_ROLES as readonly string[]).includes(role));
  return {
    label,
    labelLocal: raw("labelLocal").slice(0, 200) || null,
    fieldKey,
    fieldType,
    section: raw("section").slice(0, 100) || null,
    options: needsOptions ? options : null,
    config: Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined)) as FieldConfig,
    required: formData.get("required") === "on" && isValueField(fieldType) && fieldType !== "formula" && fieldType !== "auto_number",
    helpText: raw("helpText").slice(0, 300) || null,
    sortOrder: Math.max(-9999, Math.min(9999, Math.trunc(Number(raw("sortOrder")) || 0))),
    editRoles: roles("editRoles"),
    viewRoles: roles("viewRoles"),
    isPeriodic: formData.get("isPeriodic") === "on",
  };
}

async function createFieldImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const scope = readScope(formData);
  const entity = String(formData.get("entity") ?? "") as FieldEntity;
  if (!FIELD_ENTITIES.includes(entity)) throw new UserError("Choose what the field describes.");
  const session = await requireDefinitionAccess(scope, "add");
  const definition = readDefinition(formData);
  try {
    await db.insert(fieldDefinitions).values({ ...definition, scopeType: scope.type, scopeId: scope.id, entity, createdBy: session.user.id });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: `A field with the key ${definition.fieldKey} already exists here. Choose another key.` };
    throw error;
  }
  revalidate();
  return { success: `“${definition.label}” was added.` };
}

async function loadDefinition(fieldId: string) {
  const [field] = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, fieldId)).limit(1);
  if (!field) throw new UserError("That field no longer exists. Reload the page.");
  return field;
}

const scopeOf = (field: FieldDefinition): PrivilegeScope => field.scopeType === "platform" ? { type: "platform", id: "" } : { type: field.scopeType, id: field.scopeId };

async function updateFieldImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const field = await loadDefinition(String(formData.get("fieldId") ?? ""));
  await requireDefinitionAccess(scopeOf(field), "edit");
  const definition = readDefinition(formData);
  if (definition.fieldKey !== field.fieldKey) {
    const [used] = await db.select({ id: fieldValues.id }).from(fieldValues).where(eq(fieldValues.fieldId, field.id)).limit(1);
    if (used) throw new UserError("The key cannot change once values are stored; formulas and imports use it.");
  }
  try {
    await db.update(fieldDefinitions).set(definition).where(eq(fieldDefinitions.id, field.id));
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "Another field here already uses that key." };
    throw error;
  }
  revalidate();
  return { success: "Saved." };
}

async function setFieldFlagImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const field = await loadDefinition(String(formData.get("fieldId") ?? ""));
  await requireDefinitionAccess(scopeOf(field), "edit");
  const flag = String(formData.get("flag") ?? "");
  const value = formData.get("value") === "on";
  if (flag === "isActive") await db.update(fieldDefinitions).set({ isActive: value }).where(eq(fieldDefinitions.id, field.id));
  else if (flag === "required") await db.update(fieldDefinitions).set({ required: value }).where(eq(fieldDefinitions.id, field.id));
  else if (flag === "up" || flag === "down") await db.update(fieldDefinitions).set({ sortOrder: field.sortOrder + (flag === "up" ? -1 : 1) }).where(eq(fieldDefinitions.id, field.id));
  else throw new UserError("Unknown change.");
  revalidate();
  return {};
}

async function deleteFieldImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const field = await loadDefinition(String(formData.get("fieldId") ?? ""));
  await requireDefinitionAccess(scopeOf(field), "delete");
  await db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, field.id));
  revalidate();
  return { success: `“${field.label}” and its stored values were deleted.` };
}

async function applyPresetImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const scope = readScope(formData);
  const session = await requireDefinitionAccess(scope, "add");
  const preset = FIELD_PRESETS.find((candidate) => candidate.id === formData.get("presetId"));
  if (!preset) throw new UserError("Choose a ready-made set.");
  const existing = new Set((await db.select({ key: fieldDefinitions.fieldKey }).from(fieldDefinitions).where(and(
    eq(fieldDefinitions.scopeType, scope.type), eq(fieldDefinitions.scopeId, scope.id), eq(fieldDefinitions.entity, preset.entity),
  ))).map((row) => row.key));
  const rows = preset.fields.filter((field) => !existing.has(field.key)).map((field, index) => ({
    scopeType: scope.type,
    scopeId: scope.id,
    entity: preset.entity,
    fieldKey: field.key,
    label: field.label,
    labelLocal: field.local ?? null,
    fieldType: field.type,
    section: field.section,
    options: field.options ?? null,
    config: field.config ?? {},
    helpText: field.help ?? null,
    sortOrder: index,
    isPeriodic: preset.periodic,
    editRoles: [],
    viewRoles: [],
    createdBy: session.user.id,
  }));
  if (rows.length) await db.insert(fieldDefinitions).values(rows);
  revalidate();
  return { success: rows.length ? `Added ${rows.length} fields from “${preset.name}”.` : "Every field of this set is already here." };
}

// ───────────────────────────── Values ─────────────────────────────

async function editableFields(schoolId: string, entity: FieldEntity) {
  const access = await requireSchoolRole(schoolId);
  const platformAdmin = access.role === "platform_admin";
  const [fields, resolver] = await Promise.all([fieldsForSchool(schoolId, entity), getPrivilegeResolver()]);
  return { access, fields, editable: fields.filter((field) => mayEditField(field, access.roles, resolver, schoolId, platformAdmin)) };
}

async function nextAutoNumber(field: FieldDefinition) {
  const [row] = await db.select({ top: max(sql<number>`CAST(JSON_UNQUOTE(${fieldValues.value}) AS DECIMAL(20,0))`) })
    .from(fieldValues).where(eq(fieldValues.fieldId, field.id));
  return Number(row?.top ?? 0) + 1 || (field.config?.min ?? 1);
}

/** Saves values for one record and recalculates its formulas; files arrive as `file:<key>`, signatures as `sig:<key>`. */
async function saveFieldValuesImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const entity = String(formData.get("entity") ?? "") as FieldEntity;
  if (!FIELD_ENTITIES.includes(entity)) throw new UserError("Choose the kind of record.");
  const entityId = String(formData.get("entityId") ?? "");
  const schoolId = await recordSchool(entity, entityId);
  if (!schoolId) throw new UserError("That record was not found.");
  const period = String(formData.get("period") ?? "").trim().slice(0, 20);
  const { access, fields, editable } = await editableFields(schoolId, entity);
  if (editable.length === 0) throw new UserError("Your role may not change any of these fields.");
  const userId = access.session.user.id;

  const existingRows = await db.select({ fieldId: fieldValues.fieldId, period: fieldValues.period, value: fieldValues.value }).from(fieldValues)
    .where(and(eq(fieldValues.entityId, entityId), inArray(fieldValues.fieldId, fields.map((field) => field.id))));
  const current = new Map<string, FieldValue>();
  for (const field of fields) {
    const row = existingRows.find((candidate) => candidate.fieldId === field.id && candidate.period === (field.isPeriodic ? period : ""));
    if (row) current.set(field.fieldKey, row.value);
  }
  if (fields.some((field) => field.isPeriodic) && !period) throw new UserError("Choose the period (for example 2019 E.C.) for these values.");

  const next = new Map(current);
  const errors: string[] = [];
  const pendingFiles: { field: FieldDefinition; file: File | { name: string; type: string; data: Buffer } }[] = [];
  for (const field of editable) {
    if (LAYOUT_TYPES.includes(field.fieldType) || field.fieldType === "formula") continue;
    if (field.fieldType === "auto_number") {
      if (current.get(field.fieldKey) == null) next.set(field.fieldKey, await nextAutoNumber(field));
      continue;
    }
    if (FILE_TYPES.includes(field.fieldType)) {
      const kept = formData.getAll(`keep:${field.fieldKey}`).map(String);
      const before = Array.isArray(current.get(field.fieldKey)) ? current.get(field.fieldKey) as string[] : [];
      const files = formData.getAll(`file:${field.fieldKey}`).filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const signature = String(formData.get(`sig:${field.fieldKey}`) ?? "");
      const ids = before.filter((id) => kept.includes(id));
      if (signature.startsWith("data:image/png;base64,")) {
        pendingFiles.push({ field, file: { name: `${field.fieldKey}-signature.png`, type: "image/png", data: Buffer.from(signature.slice(22), "base64") } });
      }
      for (const file of MULTI_FILE_TYPES.includes(field.fieldType) ? files : files.slice(0, 1)) pendingFiles.push({ field, file });
      if (field.required && ids.length === 0 && !pendingFiles.some((entry) => entry.field === field)) errors.push(`${field.label}: add a file.`);
      next.set(field.fieldKey, ids.length ? ids : null);
      continue;
    }
    try {
      const raw = ["multi_select", "checkboxes", "tags"].includes(field.fieldType)
        ? formData.getAll(`f:${field.fieldKey}`).map(String)
        : String(formData.get(`f:${field.fieldKey}`) ?? "");
      next.set(field.fieldKey, parseFieldInput(field, raw));
    } catch (error) {
      if (error instanceof FieldValueError) errors.push(error.message);
      else throw error;
    }
  }
  if (errors.length) return { error: errors.slice(0, 6).join(" ") };

  // Files: write them, then record them, so a stored id always has a file behind it.
  for (const { field, file } of pendingFiles) {
    const bytes = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file.data;
    if (bytes.length > MAX_FIELD_FILE_BYTES) throw new UserError(`${field.label}: each file must be 10 MB or smaller.`);
    if (field.fieldType === "image" || field.fieldType === "multiple_images" || field.fieldType === "signature") {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new UserError(`${field.label}: upload a PNG, JPEG, WebP or GIF image.`);
    }
    if (field.fieldType === "pdf" && file.type !== "application/pdf") throw new UserError(`${field.label}: upload a PDF.`);
    const storageKey = randomUUID();
    await mkdir(resourceStorageDirectory(schoolId), { recursive: true, mode: 0o700 });
    await writeFile(resourceStoragePath(schoolId, storageKey), bytes, { flag: "wx", mode: 0o600 });
    const fileId = randomUUID();
    await db.insert(fieldFiles).values({
      id: fileId, schoolId, fieldId: field.id, entityId, storageKey,
      fileName: file.name.slice(0, 255) || "upload", contentType: (file.type || "application/octet-stream").slice(0, 120), sizeBytes: bytes.length, uploadedBy: userId,
    });
    const list = (next.get(field.fieldKey) as string[] | null) ?? [];
    next.set(field.fieldKey, MULTI_FILE_TYPES.includes(field.fieldType) ? [...list, fileId] : [fileId]);
  }

  const computed = withFormulas(fields, next);
  let saved = 0;
  for (const field of fields) {
    if (!isValueField(field.fieldType)) continue;
    const isMine = editable.includes(field) || field.fieldType === "formula";
    if (!isMine) continue;
    const value = computed.get(field.fieldKey) ?? null;
    if (JSON.stringify(value) === JSON.stringify(current.get(field.fieldKey) ?? null)) continue;
    await db.insert(fieldValues)
      .values({ fieldId: field.id, schoolId, entity, entityId, period: field.isPeriodic ? period : "", value, updatedBy: userId })
      .onDuplicateKeyUpdate({ set: { value, updatedBy: userId } });
    saved += 1;
  }
  revalidate();
  return { success: saved ? `Saved ${saved} value${saved === 1 ? "" : "s"}.` : "Nothing changed." };
}

/**
 * Imports values from a CSV. Each row names its record — school_code / school_name for school
 * fields (any school the user may import for), or student_number / teacher_number / employee_number
 * for people at the chosen school — and the other columns are fields, by key, label or local label.
 */
async function importFieldValuesImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const entity = String(formData.get("entity") ?? "") as FieldEntity;
  if (!FIELD_ENTITIES.includes(entity)) throw new UserError("Choose the kind of record.");
  const defaultPeriod = String(formData.get("period") ?? "").trim().slice(0, 20);
  const chosenSchool = String(formData.get("schoolId") ?? "");
  const file = formData.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
  if (!text.trim()) throw new UserError("Choose a CSV file or paste the rows.");
  if (text.length > 5_000_000) throw new UserError("Import at most 5 MB at a time.");
  const records = parseCsvRecords(text.replace(/^﻿/, ""));
  const header = (records.shift() ?? []).map((cell) => cell.trim());
  if (records.length > 10_000) throw new UserError("Import at most 10 000 rows at a time.");
  const lower = header.map((cell) => cell.toLowerCase());
  const col = (...names: string[]) => names.map((name) => lower.indexOf(name)).find((index) => index >= 0) ?? -1;
  const periodColumn = col("period", "year", "ዓ.ም", "ዘመን");

  const platformAdmin = isPlatformAdmin(session);
  const schoolRows = await db.select({ id: schools.id, name: schools.name, code: schools.schoolCode, slug: schools.slug }).from(schools);
  const findSchool = (record: string[]) => {
    const code = record[col("school_code", "code", "ት/ቤት ኮድ")]?.trim();
    const slug = record[col("slug")]?.trim();
    const name = record[col("school_name", "school", "ት/ቤት")]?.trim().replace(/\s+/g, " ");
    return schoolRows.find((school) => (code && school.code === code) || (slug && school.slug === slug))
      ?? schoolRows.find((school) => name && school.name.replace(/\s+/g, " ") === name);
  };
  const numberColumn = col({ school: "school_code", student: "student_number", teacher: "teacher_number", staff: "employee_number" }[entity]);
  if (entity !== "school" && numberColumn < 0) throw new UserError(`Add a ${{ student: "student_number", teacher: "teacher_number", staff: "employee_number" }[entity]} column.`);

  const access = new Map<string, Awaited<ReturnType<typeof editableFields>> | null>();
  const counts = { rows: 0, values: 0 };
  const problems: string[] = [];
  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    try {
      const school = entity === "school" ? findSchool(record) : schoolRows.find((candidate) => candidate.id === chosenSchool);
      if (!school) throw new UserError(entity === "school" ? "no school matches its school_code, slug or school_name" : "choose the school");
      if (!access.has(school.id)) {
        let entry: Awaited<ReturnType<typeof editableFields>> | null = null;
        try {
          const loaded = await editableFields(school.id, entity);
          const allowed = loaded.access.role === "platform_admin" || platformAdmin || await rolesAllow(school.id, loaded.access.roles, "field_data", "import");
          entry = allowed ? loaded : null;
        } catch { entry = null; }
        access.set(school.id, entry);
      }
      const entry = access.get(school.id);
      if (!entry) throw new UserError(`you may not import data for ${school.name}`);
      const entityId = entity === "school" ? school.id : await findRecordByNumber(entity, school.id, record[numberColumn]?.trim() ?? "");
      if (!entityId) throw new UserError(`no ${entity} with number ${record[numberColumn]} at ${school.name}`);
      const period = (periodColumn >= 0 ? record[periodColumn]?.trim() : "") || defaultPeriod;

      const stored = await db.select({ fieldId: fieldValues.fieldId, period: fieldValues.period, value: fieldValues.value }).from(fieldValues)
        .where(and(eq(fieldValues.entityId, entityId), inArray(fieldValues.fieldId, entry.fields.map((field) => field.id))));
      const values = new Map<string, FieldValue>();
      for (const field of entry.fields) {
        const row = stored.find((candidate) => candidate.fieldId === field.id && candidate.period === (field.isPeriodic ? period : ""));
        if (row) values.set(field.fieldKey, row.value);
      }
      const touched = new Set<string>();
      for (const field of entry.editable) {
        if (!isValueField(field.fieldType) || FILE_TYPES.includes(field.fieldType) || field.fieldType === "formula" || field.fieldType === "auto_number") continue;
        const column = [field.fieldKey, field.label.toLowerCase(), field.labelLocal?.toLowerCase()].map((name) => name ? lower.indexOf(name) : -1).find((position) => position >= 0) ?? -1;
        if (column < 0) continue;
        const cell = record[column]?.trim() ?? "";
        if (!cell) continue;
        if (field.isPeriodic && !period) throw new UserError("add a period column or choose a period");
        values.set(field.fieldKey, parseFieldInput({ ...field, required: false }, cell));
        touched.add(field.fieldKey);
      }
      if (touched.size === 0) continue;
      const computed = withFormulas(entry.fields, values);
      for (const field of entry.fields) {
        if (!touched.has(field.fieldKey) && field.fieldType !== "formula") continue;
        const value = computed.get(field.fieldKey) ?? null;
        await db.insert(fieldValues)
          .values({ fieldId: field.id, schoolId: school.id, entity, entityId, period: field.isPeriodic ? period : "", value, updatedBy: session.user.id })
          .onDuplicateKeyUpdate({ set: { value, updatedBy: session.user.id } });
        counts.values += 1;
      }
      counts.rows += 1;
    } catch (error) {
      if (problems.length < 12) problems.push(`row ${rowNumber}: ${error instanceof Error ? error.message : "not imported"}`);
    }
  }
  revalidate();
  const summary = `Imported ${counts.values} values from ${counts.rows} row${counts.rows === 1 ? "" : "s"}.`;
  return problems.length ? { error: `${summary} Skipped — ${problems.join("; ")}.` } : { success: summary };
}

/**
 * Creates fields from a CSV data dictionary (key, label, local_label, type, section, required,
 * options, min, max, unit, formula, help, periodic), so a form can be designed in a spreadsheet.
 * Fields whose key already exists here are updated.
 */
async function importFieldDefinitionsImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const scope = readScope(formData);
  const entity = String(formData.get("entity") ?? "") as FieldEntity;
  if (!FIELD_ENTITIES.includes(entity)) throw new UserError("Choose what the fields describe.");
  const session = await requireDefinitionAccess(scope, "add");
  const file = formData.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
  if (!text.trim()) throw new UserError("Choose a CSV file or paste the rows.");
  const records = parseCsvRecords(text.replace(/^﻿/, ""));
  const header = (records.shift() ?? []).map((cell) => cell.trim().toLowerCase());
  if (!header.includes("label") || !header.includes("type")) throw new UserError("The first row must name at least the label and type columns.");
  if (records.length > 500) throw new UserError("Import at most 500 fields at a time.");
  const cell = (record: string[], name: string) => (header.indexOf(name) >= 0 ? (record[header.indexOf(name)] ?? "").trim() : "");
  const yes = (value: string) => /^(yes|y|true|1|አዎ)$/i.test(value);
  let saved = 0;
  const problems: string[] = [];
  for (const [index, record] of records.entries()) {
    try {
      const typeText = cell(record, "type").toLowerCase();
      const fieldType = (FIELD_TYPE_KEYS as string[]).find((key) => key === typeText)
        ?? FIELD_TYPE_KEYS.find((key) => fieldTypeLabel(key).toLowerCase() === typeText);
      if (!fieldType) throw new UserError(`unknown type “${cell(record, "type")}”`);
      const form = new FormData();
      form.set("label", cell(record, "label"));
      form.set("labelLocal", cell(record, "local_label"));
      form.set("fieldKey", cell(record, "key"));
      form.set("fieldType", fieldType);
      form.set("section", cell(record, "section"));
      form.set("options", cell(record, "options").split(/[;|]/).join("\n"));
      for (const name of ["min", "max", "unit", "formula", "placeholder"]) form.set(name, cell(record, name));
      form.set("helpText", cell(record, "help"));
      form.set("sortOrder", String(index));
      if (yes(cell(record, "required"))) form.set("required", "on");
      if (yes(cell(record, "periodic"))) form.set("isPeriodic", "on");
      const definition = readDefinition(form);
      await db.insert(fieldDefinitions)
        .values({ ...definition, scopeType: scope.type, scopeId: scope.id, entity, createdBy: session.user.id })
        .onDuplicateKeyUpdate({ set: definition });
      saved += 1;
    } catch (error) {
      if (problems.length < 12) problems.push(`row ${index + 2}: ${error instanceof Error ? error.message : "not imported"}`);
    }
  }
  revalidate();
  const summary = `Saved ${saved} field${saved === 1 ? "" : "s"}.`;
  return problems.length ? { error: `${summary} Skipped — ${problems.join("; ")}.` } : { success: summary };
}

export async function importFieldDefinitions(...args: Parameters<typeof importFieldDefinitionsImpl>) { return guardAction(() => importFieldDefinitionsImpl(...args)); }
export async function createField(...args: Parameters<typeof createFieldImpl>) { return guardAction(() => createFieldImpl(...args)); }
export async function updateField(...args: Parameters<typeof updateFieldImpl>) { return guardAction(() => updateFieldImpl(...args)); }
export async function setFieldFlag(...args: Parameters<typeof setFieldFlagImpl>) { return guardAction(() => setFieldFlagImpl(...args)); }
export async function deleteField(...args: Parameters<typeof deleteFieldImpl>) { return guardAction(() => deleteFieldImpl(...args)); }
export async function applyPreset(...args: Parameters<typeof applyPresetImpl>) { return guardAction(() => applyPresetImpl(...args)); }
export async function saveFieldValues(...args: Parameters<typeof saveFieldValuesImpl>) { return guardAction(() => saveFieldValuesImpl(...args)); }
export async function importFieldValues(...args: Parameters<typeof importFieldValuesImpl>) { return guardAction(() => importFieldValuesImpl(...args)); }
