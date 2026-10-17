// Drizzle wraps driver errors in a DrizzleQueryError, so the MySQL error code lives on `cause`.
export function isDuplicateEntry(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== "object") return false;
    if ("code" in current && current.code === "ER_DUP_ENTRY") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
