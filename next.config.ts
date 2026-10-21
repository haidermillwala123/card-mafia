import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { '/': ['./public/landing/index.html'] },
};

export default nextConfig;
