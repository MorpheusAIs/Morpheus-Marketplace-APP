import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amplify supports SSR, so we don't need output: 'export'
  // The default configuration will work with Amplify's SSR support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://umami-production-5f98.up.railway.app https://accounts.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://accounts.google.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://umami-production-5f98.up.railway.app https://*.execute-api.us-east-1.amazonaws.com https://cognito-idp.us-east-1.amazonaws.com https://accounts.google.com wss:",
              "frame-src 'self' https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
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
