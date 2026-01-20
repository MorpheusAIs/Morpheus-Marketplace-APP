import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Amplify supports SSR, so we don't need output: 'export'
  // The default configuration will work with Amplify's SSR support
  async redirects() {
    return [
      {
        source: '/chat',
        destination: '/api-keys',
        permanent: false,
      },
      {
        source: '/chat/:path*',
        destination: '/api-keys',
        permanent: false,
      },
    ];
  },
  // Exclude morpheus-billing directory from Next.js build (it's a separate Vite app - local setup only)
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
        '**/morpheus-billing/**',
      ],
    };
    return config;
  },
  // Exclude morpheus-billing from output file tracing
  outputFileTracingExcludes: {
    '*': ['./morpheus-billing/**/*'],
  },
};

export default nextConfig;
