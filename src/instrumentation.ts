// Runs once when the production server starts, whether it was launched by app.js or `next start`.
// Node-only work lives in server-startup.ts so the Edge build of this file never loads it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { runStartupTasks } = await import("@/lib/server-startup");
  await runStartupTasks();
}
