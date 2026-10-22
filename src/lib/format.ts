/** Up to two initials for avatars, e.g. "Abebe Tadesse" → "AT". */
export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

const ACRONYMS = new Set(["ptsa", "ngo", "hr", "it", "pr"]);

/** A stored enum value as words: "on_leave" → "On leave", "ptsa_meeting" → "PTSA meeting". */
export function humanize(value: string) {
  const text = value.split("_").map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word)).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Select options for a list of enum values. */
export function enumOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: humanize(value) }));
}

/** An ISO date (YYYY-MM-DD) moved by a number of days. */
export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
