// The URL prefix the app is served under, e.g. "/school" when it runs inside another site's domain.
// It is fixed at build time (Next.js inlines NEXT_PUBLIC_ variables), so rebuild after changing it.
export const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export function normalizeBasePath(value: string | undefined) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (!/^\/[A-Za-z0-9._~\-/]*$/.test(trimmed)) {
    throw new Error("NEXT_PUBLIC_BASE_PATH must be a path such as /school.");
  }
  return trimmed;
}

// Prefixes an app path for places Next.js does not handle itself: fetch calls, plain anchors,
// emailed links, and redirect targets passed to the auth library.
export function withBasePath(path: string) {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

export const authBasePath = withBasePath("/api/auth");
