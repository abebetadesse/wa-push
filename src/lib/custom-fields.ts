// Dynamic data fields: the field types an administrator can choose, how a submitted value is read
// and checked, and formula fields. No server-only imports: the field designer and the data-entry
// forms run the same rules in the browser.
import type { FieldConfig, FieldValue } from "@/db/schema";

export const FIELD_ENTITIES = ["school", "student", "teacher", "staff"] as const;
export type FieldEntity = (typeof FIELD_ENTITIES)[number];

export const ENTITY_LABELS: Record<FieldEntity, string> = {
  school: "School (profile, census and facilities)",
  student: "Students",
  teacher: "Teachers",
  staff: "Staff",
};

export const FIELD_TYPES = [
  { type: "text", label: "Short text", group: "Text" },
  { type: "textarea", label: "Long text / paragraph", group: "Text" },
  { type: "rich_text", label: "Formatted text (headings, lists)", group: "Text" },
  { type: "email", label: "Email address", group: "Text" },
  { type: "phone", label: "Phone number", group: "Text" },
  { type: "url", label: "Website / URL", group: "Text" },
  { type: "tags", label: "Tags (free keywords)", group: "Text" },
  { type: "barcode", label: "Barcode / ID code", group: "Text" },
  { type: "integer", label: "Whole number (count)", group: "Numbers" },
  { type: "decimal", label: "Decimal number", group: "Numbers" },
  { type: "quantity", label: "Quantity with unit", group: "Numbers" },
  { type: "currency", label: "Money amount (ETB)", group: "Numbers" },
  { type: "percentage", label: "Percentage (0–100)", group: "Numbers" },
  { type: "rating", label: "Star rating", group: "Numbers" },
  { type: "slider", label: "Range slider / scale", group: "Numbers" },
  { type: "number_range", label: "Number range (e.g. 10 – 25)", group: "Numbers" },
  { type: "price_range", label: "Price range (e.g. 500 – 2000 ETB)", group: "Numbers" },
  { type: "percentage_range", label: "Percentage range (e.g. 10% – 25%)", group: "Numbers" },
  { type: "auto_number", label: "Auto-number / serial", group: "Numbers" },
  { type: "formula", label: "Calculated (formula)", group: "Numbers" },
  { type: "date", label: "Date", group: "Date & time" },
  { type: "time", label: "Time", group: "Date & time" },
  { type: "datetime", label: "Date and time", group: "Date & time" },
  { type: "month", label: "Month", group: "Date & time" },
  { type: "week", label: "Week", group: "Date & time" },
  { type: "year", label: "Year", group: "Date & time" },
  { type: "duration", label: "Duration (e.g. 30 days, 6 months)", group: "Date & time" },
  { type: "yes_no", label: "Yes / No (አለ / የለም)", group: "Choices" },
  { type: "switch", label: "On / off switch", group: "Choices" },
  { type: "select", label: "Dropdown (one choice)", group: "Choices" },
  { type: "autocomplete", label: "Dropdown with search", group: "Choices" },
  { type: "radio", label: "Option buttons (one choice)", group: "Choices" },
  { type: "button_group", label: "Button group (one choice)", group: "Choices" },
  { type: "multi_select", label: "Multi-select list", group: "Choices" },
  { type: "checkboxes", label: "Checkbox group (many)", group: "Choices" },
  { type: "gender", label: "Sex (Female / Male)", group: "Choices" },
  { type: "ethiopia_location", label: "Ethiopia location (Region › Zone › Woreda)", group: "Location" },
  { type: "location", label: "Location (Town › Sub-town › Kebele)", group: "Location" },
  { type: "address", label: "Full address", group: "Location" },
  { type: "gps", label: "GPS coordinates (lat, lng)", group: "Location" },
  { type: "my_location", label: "My location (auto-detect GPS)", group: "Location" },
  { type: "file", label: "File upload", group: "Uploads" },
  { type: "image", label: "Image / photo upload", group: "Uploads" },
  { type: "document", label: "Document upload (PDF, Word, Excel)", group: "Uploads" },
  { type: "pdf", label: "PDF upload", group: "Uploads" },
  { type: "video", label: "Video upload", group: "Uploads" },
  { type: "audio", label: "Audio upload", group: "Uploads" },
  { type: "zip", label: "ZIP archive upload", group: "Uploads" },
  { type: "multiple_files", label: "Multiple files upload", group: "Uploads" },
  { type: "multiple_images", label: "Multiple images upload", group: "Uploads" },
  { type: "signature", label: "Signature / drawing pad", group: "Uploads" },
  { type: "color", label: "Color picker", group: "Other" },
  { type: "heading", label: "Heading / section title (no value)", group: "Layout" },
  { type: "paragraph", label: "Instructions paragraph (no value)", group: "Layout" },
  { type: "divider", label: "Divider line (no value)", group: "Layout" },
] as const;
export type FieldType = (typeof FIELD_TYPES)[number]["type"];

export const FIELD_TYPE_KEYS = FIELD_TYPES.map((entry) => entry.type) as FieldType[];
export const NUMERIC_TYPES: readonly string[] = ["integer", "decimal", "quantity", "currency", "percentage", "rating", "slider", "formula", "year", "auto_number"];
export const CHOICE_TYPES: readonly string[] = ["select", "autocomplete", "radio", "button_group", "multi_select", "checkboxes", "yes_no", "switch", "gender"];
export const MULTI_TYPES: readonly string[] = ["multi_select", "checkboxes"];
/** Types whose value is a list of uploaded file ids (school_field_files). */
export const FILE_TYPES: readonly string[] = ["file", "image", "document", "pdf", "video", "audio", "zip", "multiple_files", "multiple_images", "signature"];
export const MULTI_FILE_TYPES: readonly string[] = ["multiple_files", "multiple_images"];
/** Form decoration only: never stored, never in reports or CSV templates. */
export const LAYOUT_TYPES: readonly string[] = ["heading", "paragraph", "divider"];
/** Filled in by the system, not typed in. */
export const COMPUTED_TYPES: readonly string[] = ["formula", "auto_number"];
/** Types that make sense as a report's row or series (a category to group by). */
export const CATEGORY_TYPES: readonly string[] = ["select", "autocomplete", "radio", "button_group", "yes_no", "switch", "gender", "text", "year", "month", "ethiopia_location", "location", "tags", "multi_select", "checkboxes"];

/** Accepted upload types for each file field type (an <input accept> value). */
export const FILE_ACCEPT: Record<string, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  multiple_images: "image/jpeg,image/png,image/webp,image/gif",
  signature: "image/png",
  pdf: "application/pdf",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.rtf",
  video: "video/*",
  audio: "audio/*",
  zip: ".zip,application/zip",
  file: "",
  multiple_files: "",
};

/** Whether a field holds a value people enter (not layout, not computed, not files). */
export function isInputField(type: string) {
  return !LAYOUT_TYPES.includes(type) && !COMPUTED_TYPES.includes(type) && !FILE_TYPES.includes(type);
}

/** Whether a field has a stored value at all (everything except layout elements). */
export function isValueField(type: string) {
  return !LAYOUT_TYPES.includes(type);
}

export const DURATION_UNITS = ["minutes", "hours", "days", "weeks", "months", "years"] as const;

export type FieldDefinitionLike = {
  fieldKey: string;
  label: string;
  fieldType: string;
  options: string[] | null;
  config: FieldConfig | null;
  required: boolean;
};

export function fieldTypeLabel(type: string) {
  return FIELD_TYPES.find((entry) => entry.type === type)?.label ?? type;
}

/** The choices a field offers: its options, or the fixed ones of yes/no and sex fields. */
export function fieldChoices(field: Pick<FieldDefinitionLike, "fieldType" | "options">): string[] {
  if (field.fieldType === "yes_no" || field.fieldType === "switch") return ["Yes", "No"];
  if (field.fieldType === "gender") return ["Female", "Male"];
  return field.options ?? [];
}

const YES = new Set(["yes", "y", "true", "1", "አለ", "አዎ", "eeyyee", "on"]);
const NO = new Set(["no", "n", "false", "0", "የለም", "አይ", "lakki", "off"]);

export class FieldValueError extends Error {}

/**
 * Turns submitted text (from a form or a CSV cell) into the stored value, or throws a FieldValueError
 * naming the field. Empty input gives null. Formula fields are never read from input.
 */
export function parseFieldInput(field: FieldDefinitionLike, raw: string | string[]): FieldValue {
  const config = field.config ?? {};
  const values = Array.isArray(raw) ? raw.map((value) => value.trim()).filter(Boolean) : [];
  const text = Array.isArray(raw) ? values.join(", ") : raw.trim();
  const fail = (message: string): never => { throw new FieldValueError(`${field.label}: ${message}`); };

  if (COMPUTED_TYPES.includes(field.fieldType) || LAYOUT_TYPES.includes(field.fieldType) || FILE_TYPES.includes(field.fieldType)) return null;
  if (field.fieldType === "tags") {
    const tags = [...new Set((Array.isArray(raw) ? values : text.split(/[;,|]/)).map((tag) => tag.trim().slice(0, 60)).filter(Boolean))];
    if (tags.length === 0) {
      if (field.required) fail("add at least one tag.");
      return null;
    }
    if (tags.length > 30) fail("use at most 30 tags.");
    return tags;
  }
  if (MULTI_TYPES.includes(field.fieldType)) {
    const chosen = Array.isArray(raw) ? values : text.split(/[;|,]/).map((value) => value.trim()).filter(Boolean);
    if (chosen.length === 0) {
      if (field.required) fail("choose at least one option.");
      return null;
    }
    const choices = fieldChoices(field);
    const unknown = chosen.filter((value) => !choices.includes(value));
    if (unknown.length) fail(`“${unknown[0]}” is not one of the options.`);
    return chosen;
  }
  if (!text) {
    if (field.required) fail("a value is required.");
    return null;
  }
  if (config.maxLength && text.length > config.maxLength) fail(`keep it to ${config.maxLength} characters.`);

  switch (field.fieldType) {
    case "rich_text":
    case "address":
      if (text.length > 10000) fail("keep it to 10000 characters.");
      return text;
    case "barcode":
      if (!/^[\p{L}\p{N} ._/-]{1,80}$/u.test(text)) fail("use letters, numbers, spaces, dots, dashes and slashes (up to 80).");
      return text;
    case "text":
    case "textarea":
      if (text.length > 5000) fail("keep it to 5000 characters.");
      if (config.pattern) {
        let pattern: RegExp | null = null;
        try { pattern = new RegExp(`^(?:${config.pattern})$`, "u"); } catch { pattern = null; }
        if (pattern && !pattern.test(text)) fail("the value is not in the required format.");
      }
      return text;
    case "email":
      if (text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) fail("enter a valid email address.");
      return text.toLowerCase();
    case "phone":
      if (!/^\+?[0-9 ()-]{6,20}$/.test(text)) fail("enter a valid phone number.");
      return text;
    case "url":
      try {
        const url = new URL(text);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch { fail("enter a full web address starting with https://."); }
      return text;
    case "number_range":
    case "price_range":
    case "percentage_range": {
      const match = text.replace(/,/g, "").replace(/%|etb|birr/gi, "").match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)\s*$/i);
      if (!match) fail("enter a range such as 10 - 25.");
      const [low, high] = [Number(match![1]), Number(match![2])];
      if (low > high) fail("the first number must not be larger than the second.");
      if (field.fieldType === "percentage_range" && (low < 0 || high > 100)) fail("percentages run from 0 to 100.");
      const suffix = field.fieldType === "price_range" ? " ETB" : field.fieldType === "percentage_range" ? "%" : "";
      return `${low}${field.fieldType === "percentage_range" ? "%" : ""} – ${high}${suffix}`;
    }
    case "duration": {
      const match = text.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
      const unit = match && DURATION_UNITS.find((candidate) => candidate.startsWith(match[2].replace(/s$/, "")));
      if (!match || !unit) fail(`enter an amount and a unit, for example 30 days (${DURATION_UNITS.join(", ")}).`);
      return `${Number(match![1])} ${unit}`;
    }
    case "month":
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) fail("enter a month as YYYY-MM.");
      return text;
    case "week":
      if (!/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(text)) fail("enter a week as YYYY-Www, for example 2026-W14.");
      return text;
    case "ethiopia_location":
    case "location": {
      const parts = text.split(/\s*(?:›|>|\/|\|)\s*/).map((part) => part.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 3) fail(field.fieldType === "location" ? "enter Town › Sub-town › Kebele." : "choose a region, then a zone and woreda.");
      if (parts.some((part) => part.length > 120)) fail("each part must be 120 characters or fewer.");
      return parts.join(" › ");
    }
    case "my_location":
      return parseFieldInput({ ...field, fieldType: "gps" }, text);
    case "switch":
      return parseFieldInput({ ...field, fieldType: "yes_no" }, text);
    case "autocomplete":
    case "button_group":
      return parseFieldInput({ ...field, fieldType: "select" }, text);
    case "integer":
    case "quantity":
    case "year":
    case "rating":
    case "slider":
    case "decimal":
    case "currency":
    case "percentage": {
      const number = Number(text.replace(/,/g, ""));
      if (!Number.isFinite(number)) fail("enter a number.");
      const whole = field.fieldType === "integer" || field.fieldType === "year" || field.fieldType === "rating";
      if (whole && !Number.isInteger(number)) fail("enter a whole number.");
      const min = config.min ?? (field.fieldType === "percentage" || field.fieldType === "rating" || field.fieldType === "integer" ? (field.fieldType === "rating" ? 1 : 0) : undefined);
      const max = config.max ?? (field.fieldType === "percentage" ? 100 : field.fieldType === "rating" ? 5 : undefined);
      if (min !== undefined && number < min) fail(`the smallest allowed value is ${min}.`);
      if (max !== undefined && number > max) fail(`the largest allowed value is ${max}.`);
      return field.fieldType === "currency" ? Math.round(number * 100) / 100 : number;
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) fail("enter a date as YYYY-MM-DD.");
      return text;
    case "time":
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) fail("enter a time as HH:MM.");
      return text;
    case "datetime":
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) || Number.isNaN(Date.parse(text))) fail("enter a date and time.");
      return text.slice(0, 16);
    case "yes_no": {
      const lower = text.toLowerCase();
      if (YES.has(lower)) return "Yes";
      if (NO.has(lower)) return "No";
      return fail("answer Yes or No.");
    }
    case "gender": {
      const lower = text.toLowerCase();
      if (["f", "female", "ሴ", "ሴት", "dubartii", "girl"].includes(lower)) return "Female";
      if (["m", "male", "ወ", "ወንድ", "dhiira", "boy"].includes(lower)) return "Male";
      return fail("answer Female or Male.");
    }
    case "select":
    case "radio":
      if (!fieldChoices(field).includes(text)) fail(`“${text}” is not one of the options.`);
      return text;
    case "gps": {
      const match = text.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
      if (!match || Math.abs(Number(match[1])) > 90 || Math.abs(Number(match[2])) > 180) fail("enter latitude, longitude, for example 9.0108, 38.7613.");
      return `${Number(match![1])}, ${Number(match![2])}`;
    }
    case "color":
      if (!/^#[0-9a-f]{6}$/i.test(text)) fail("choose a color.");
      return text.toLowerCase();
    default:
      return text;
  }
}

/** A stored value as display text. */
export function formatFieldValue(field: Pick<FieldDefinitionLike, "fieldType" | "config">, value: FieldValue | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    const unit = field.config?.unit;
    if (field.fieldType === "currency") return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
    if (field.fieldType === "percentage") return `${value}%`;
    if (field.fieldType === "rating") return `${"★".repeat(value)}${"☆".repeat(Math.max(0, (field.config?.max ?? 5) - value))}`;
    return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}${unit ? ` ${unit}` : ""}`;
  }
  return String(value);
}

/** The stored value as text for an input or a CSV cell. */
export function fieldValueAsInput(value: FieldValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

// ── Formulas ── Arithmetic over other fields' keys: total_teachers = female_teachers + male_teachers.
// Parsed by a small recursive-descent reader: numbers, field keys, + - * / % and parentheses only.

type Token = { kind: "number"; value: number } | { kind: "name"; value: string } | { kind: "op"; value: string };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/%()]))/y;
  let index = 0;
  while (index < formula.length) {
    if (/^\s*$/.test(formula.slice(index))) break;
    pattern.lastIndex = index;
    const match = pattern.exec(formula);
    if (!match) throw new FieldValueError(`The formula has an unexpected character near “${formula.slice(index, index + 8).trim()}”.`);
    index = pattern.lastIndex;
    if (match[1]) tokens.push({ kind: "number", value: Number(match[1]) });
    else if (match[2]) tokens.push({ kind: "name", value: match[2] });
    else tokens.push({ kind: "op", value: match[3] });
  }
  return tokens;
}

/** The field keys a formula reads, or throws when the formula cannot be parsed. */
export function formulaInputs(formula: string): string[] {
  const names = new Set<string>();
  evaluateFormula(formula, new Proxy({}, { get: (_target, key) => { names.add(String(key)); return 1; } }) as Record<string, number>);
  return [...names];
}

/** Evaluates a formula. Missing inputs count as 0; division by zero gives null. */
export function evaluateFormula(formula: string, inputs: Record<string, number | null | undefined>): number | null {
  const tokens = tokenize(formula);
  let position = 0;
  let divideByZero = false;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function primary(): number {
    const token = take();
    if (!token) throw new FieldValueError("The formula ends too early.");
    if (token.kind === "number") return token.value;
    if (token.kind === "name") return Number(inputs[token.value] ?? 0) || 0;
    if (token.value === "(") {
      const value = sum();
      if (take()?.value !== ")") throw new FieldValueError("The formula is missing a closing parenthesis.");
      return value;
    }
    if (token.value === "-") return -primary();
    if (token.value === "+") return primary();
    throw new FieldValueError(`The formula has “${token.value}” where a value was expected.`);
  }
  function product(): number {
    let value = primary();
    while (peek()?.kind === "op" && ["*", "/", "%"].includes(peek()!.value as string)) {
      const op = take().value;
      const right = primary();
      if (op === "*") value *= right;
      else if (right === 0) { divideByZero = true; value = 0; }
      else value = op === "/" ? value / right : value % right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek()?.kind === "op" && ["+", "-"].includes(peek()!.value as string)) {
      const op = take().value;
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  if (tokens.length === 0) throw new FieldValueError("The formula is empty.");
  const result = sum();
  if (position < tokens.length) throw new FieldValueError("The formula has extra text at the end.");
  if (divideByZero || !Number.isFinite(result)) return null;
  return Math.round(result * 10000) / 10000;
}

/** Field values with every formula field filled in from the others. */
export function withFormulas<T extends FieldDefinitionLike>(fields: T[], values: Map<string, FieldValue>): Map<string, FieldValue> {
  const result = new Map(values);
  const numeric = () => Object.fromEntries([...result].map(([key, value]) => [key, typeof value === "number" ? value : Number(value) || 0]));
  // Twice, so a formula may use another formula's result.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const field of fields) {
      if (field.fieldType !== "formula" || !field.config?.formula) continue;
      try {
        // With none of its inputs filled in, a formula has no value (not 0), so empty records stay empty.
        const inputs = formulaInputs(field.config.formula);
        const known = inputs.some((key) => result.get(key) !== null && result.get(key) !== undefined && result.get(key) !== "");
        result.set(field.fieldKey, known || inputs.length === 0 ? evaluateFormula(field.config.formula, numeric()) : null);
      } catch {
        result.set(field.fieldKey, null);
      }
    }
  }
  return result;
}

/** A field key from a label: "Female teachers" → "female_teachers". */
export function toFieldKey(label: string) {
  const key = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return /^[a-z]/.test(key) ? key : `field_${key}`.replace(/_+$/, "");
}

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,59}$/;
