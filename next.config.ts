import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the agentic-akr ESM package so webpack can bundle it for API routes.
  transpilePackages: ["agentic-akr"],
};

export default nextConfig;
