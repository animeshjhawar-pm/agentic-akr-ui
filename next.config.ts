import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a slim self-contained build suitable for Railway container deployment.
  output: "standalone",
};

export default nextConfig;
