// Runs once when the production server starts, whether it was launched by app.js or `next start`.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { restartWhenReleaseChanges } = await import("@/lib/release-watcher");
  restartWhenReleaseChanges();
}
