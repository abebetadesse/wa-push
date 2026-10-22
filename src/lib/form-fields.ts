import "server-only";
import { UserError } from "@/lib/action-result";

// Reads and validates server-action form fields. Each reader throws a UserError naming the field,
// which guardAction turns into the form's error message.

export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function formFields(formData: FormData) {
  const raw = (name: string) => String(formData.get(name) ?? "").trim();

  function text(name: string, label: string, max: number) {
    const value = raw(name);
    if (!value) throw new UserError(`Enter ${label}.`);
    if (value.length > max) throw new UserError(`Keep ${label} to ${max} characters or fewer.`);
    return value;
  }

  function optional(name: string, label: string, max: number) {
    const value = raw(name);
    if (value.length > max) throw new UserError(`Keep ${label} to ${max} characters or fewer.`);
    return value || null;
  }

  function int(name: string, label: string, { min = 0, max = 1_000_000 } = {}) {
    const value = raw(name);
    const number = Number(value);
    if (!value || !Number.isInteger(number) || number < min || number > max) {
      throw new UserError(`Enter ${label} as a whole number from ${min} to ${max}.`);
    }
    return number;
  }

  function optionalInt(name: string, label: string, range?: { min?: number; max?: number }) {
    return raw(name) ? int(name, label, range) : null;
  }

  function date(name: string, label: string) {
    const value = raw(name);
    if (!isDate(value)) throw new UserError(`Enter a valid ${label}.`);
    return value;
  }

  function optionalDate(name: string, label: string) {
    return raw(name) ? date(name, label) : null;
  }

  function time(name: string, label: string) {
    const value = raw(name);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new UserError(`Enter a valid ${label} (HH:MM).`);
    return value;
  }

  function choice<T extends string>(name: string, label: string, options: readonly T[]) {
    const value = raw(name);
    if (!(options as readonly string[]).includes(value)) throw new UserError(`Choose ${label}.`);
    return value as T;
  }

  function id(name: string, label: string) {
    const value = raw(name);
    if (!/^[0-9a-f-]{36}$/i.test(value)) throw new UserError(`Choose ${label}.`);
    return value;
  }

  function optionalId(name: string, label: string) {
    return raw(name) ? id(name, label) : null;
  }

  function email(name: string, label: string) {
    const value = raw(name).toLowerCase();
    if (!value) return null;
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new UserError(`Enter a valid ${label}.`);
    return value;
  }

  return { raw, text, optional, int, optionalInt, date, optionalDate, time, choice, id, optionalId, email };
}
