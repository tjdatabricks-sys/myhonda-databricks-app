import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  serverExternalPackages: ['@databricks/sql'],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
