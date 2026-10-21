import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";

/** What every server action returns to its form: one message to show, at most. */
export type ActionState = { error?: string; success?: string };

/**
 * An error whose message is written for the person using the form. Next.js hides the message of
 * any other error in production, which left forms with a blank HTTP 500 (React error 441).
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

// MySQL error codes a person can act on. Drizzle wraps driver errors, so the code may be on `cause`.
const databaseMessages: Record<string, string> = {
  ER_DUP_ENTRY: "A record with these details already exists.",
  ER_NO_REFERENCED_ROW_2: "A linked record no longer exists. Reload the page and try again.",
  ER_ROW_IS_REFERENCED_2: "This record is still in use elsewhere, so it can't be removed.",
  ER_DATA_TOO_LONG: "One of the values is too long.",
  ER_TRUNCATED_WRONG_VALUE: "One of the values isn't in the expected format.",
  ER_LOCK_DEADLOCK: "Someone else was saving at the same moment. Try again.",
  ER_LOCK_WAIT_TIMEOUT: "The database was busy. Try again in a moment.",
  ER_NO_SUCH_TABLE: "The database is missing a table this page needs. An administrator should check /api/health.",
  ER_BAD_FIELD_ERROR: "The database is out of date for this page. An administrator should check /api/health.",
  ECONNREFUSED: "The database is unavailable right now. Try again in a moment.",
  ETIMEDOUT: "The database is unavailable right now. Try again in a moment.",
  PROTOCOL_CONNECTION_LOST: "The connection to the database dropped. Try again.",
};

export function databaseErrorCode(error: unknown): string | undefined {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== "object") return undefined;
    if ("code" in current && typeof current.code === "string" && current.code) return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

/** The message to show for a failed action, plus a reference to find it in the server log. */
export function userMessage(error: unknown) {
  if (error instanceof UserError) return error.message;
  const code = databaseErrorCode(error);
  const known = code ? databaseMessages[code] : undefined;
  const reference = randomUUID().slice(0, 8);
  console.error(`[forma] action failed (ref ${reference})${code ? ` [${code}]` : ""}:`, error);
  return `${known ?? "Something went wrong and nothing was saved."} (ref ${reference})`;
}

/**
 * Runs an action body and turns any failure into `{ error }` for the form, while letting Next.js's
 * own redirect() and notFound() through.
 */
export async function guardAction<T extends ActionState>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    // Every action state has an optional `error`, so this is a valid state for any of them.
    return { error: userMessage(error) } as T;
  }
}
