import type { NextConfig } from "next";
import { normalizeBasePath } from "./src/lib/base-path";

// Set NEXT_PUBLIC_BASE_PATH=/school when this app is served under a path of another site's domain.
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
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
};

export default nextConfig;
