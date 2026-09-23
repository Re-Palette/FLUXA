import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // memory-db (temporary demo mode): PGlite ships WASM/data files and reads migrations at runtime.
  serverExternalPackages: ["@electric-sql/pglite", "pglite-prisma-adapter"],
  outputFileTracingIncludes: {
    "/**": ["./prisma/migrations/**/*", "./node_modules/@electric-sql/pglite/dist/**/*"],
  },
};

export default nextConfig;
