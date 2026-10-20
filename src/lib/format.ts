/** Up to two initials for avatars, e.g. "Abebe Tadesse" → "AT". */
export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}
