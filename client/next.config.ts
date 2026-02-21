import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

(nextConfig as any).eslint = {
  ignoreDuringBuilds: true,
};

export default nextConfig;