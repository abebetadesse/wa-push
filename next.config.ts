import type { NextConfig } from "next";

// Set NEXT_PUBLIC_BASE_PATH=/school when this app is served under a path of another site's domain.
// This file must not import project modules: Next.js compiles it to an ES module, and Node cannot
// resolve extensionless relative imports from there. Keep the rule in sync with src/lib/base-path.ts.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");
if (basePath && !/^\/[A-Za-z0-9._~\-/]*$/.test(basePath)) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be a path such as /school.");
}
// Behind a reverse proxy the Host header can name the upstream rather than the public domain;
// trusting the public origin keeps Server Actions working there.
const publicHost = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).host : undefined;

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
      allowedOrigins: publicHost ? [publicHost] : undefined,
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (basePath === "/school") return [];
    return [
      {
        source: "/school/_next/:path*",
        destination: "/_next/:path*",
      },
      {
        source: "/school/api/:path*",
        destination: "/api/:path*",
      },
      {
        source: "/school/favicon.ico",
        destination: "/favicon.ico",
      },
    ];
  },
  async redirects() {
    if (basePath === "/school") return [];
    return [
      {
        source: "/school",
        destination: "/",
        permanent: false,
      },
      {
        source: "/school/:path((?!_next|api|favicon\\.ico).*)",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
