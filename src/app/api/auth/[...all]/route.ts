import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { basePath } from "@/lib/base-path";

const handler = toNextJsHandler(auth);

// Next.js removes its basePath from the request URL before route handlers run, but Better Auth
// routes (and builds emailed links) with the full public path, so restore the prefix here.
async function withPublicPath(request: Request) {
  if (!basePath) return request;
  const url = new URL(request.url);
  if (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)) return request;
  url.pathname = `${basePath}${url.pathname}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    signal: request.signal,
  });
}

export async function GET(request: Request) {
  return handler.GET(await withPublicPath(request));
}

export async function POST(request: Request) {
  return handler.POST(await withPublicPath(request));
}
