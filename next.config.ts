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
    
    // Handle optional wallet connector dependencies that may not be installed
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'porto': false,
      'porto/internal': false,
      '@gemini-wallet/core': false,
      '@react-native-async-storage/async-storage': false,
    };

    // Ignore missing optional dependencies during build
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Module not found.*porto/,
      /Module not found.*@gemini-wallet/,
      /Module not found.*@react-native-async-storage/,
    ];
    
    return config;
  },
  // Exclude morpheus-billing from output file tracing
  outputFileTracingExcludes: {
    '*': ['./morpheus-billing/**/*'],
  },
};

export default nextConfig;
