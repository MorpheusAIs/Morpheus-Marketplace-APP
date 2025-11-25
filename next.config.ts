import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Amplify supports SSR, so we don't need output: 'export'
  // The default configuration will work with Amplify's SSR support
};

export default nextConfig;
