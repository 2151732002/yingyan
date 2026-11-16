import type { NextConfig } from "next";
const config: NextConfig = {
  output: process.env.STANDALONE === "true" ? "standalone" : undefined,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_BASE_URL || "http://127.0.0.1:18080"}/api/:path*`,
      },
    ];
  },
};
export default config;
