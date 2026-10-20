// next.config.ts
var basePath = "".trim().replace(/\/+$/, "");
if (basePath && !/^\/[A-Za-z0-9._~\-/]*$/.test(basePath)) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be a path such as /school.");
}
var publicHost = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).host : void 0;
var nextConfig = {
  basePath: basePath || void 0,
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
      allowedOrigins: publicHost ? [publicHost] : void 0
    }
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css"
      }
    }
  },
  async rewrites() {
    if (basePath === "/school") return [];
    return [
      {
        source: "/school/_next/:path*",
        destination: "/_next/:path*"
      },
      {
        source: "/school/favicon.ico",
        destination: "/favicon.ico"
      }
    ];
  },
  async redirects() {
    if (basePath === "/school") return [];
    return [
      {
        source: "/school",
        destination: "/",
        permanent: false
      },
      {
        source: "/school/:path((?!_next|favicon\\.ico).*)",
        destination: "/:path*",
        permanent: false
      }
    ];
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
