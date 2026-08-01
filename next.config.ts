import type { NextConfig } from 'next';

// ----------------------------------------------------------------------

/**
 * Static Exports in Next.js
 *
 * 1. Set `isStaticExport = true` in `next.config.{mjs|ts}`.
 * 2. This allows `generateStaticParams()` to pre-render dynamic routes at build time.
 *
 * For more details, see:
 * https://nextjs.org/docs/app/building-your-application/deploying/static-exports
 *
 * NOTE: Remove all "generateStaticParams()" functions if not using static exports.
 */
const isStaticExport = false;

const isDev = process.env.NODE_ENV !== 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  // 'unsafe-eval' is required in dev for Next.js Fast Refresh / eval-based source maps.
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ''}https://js.stripe.com https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.line.me https://vitals.vercel-insights.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

// ----------------------------------------------------------------------

const nextConfig: NextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  // Keep sharp out of the webpack bundle so Next's file tracing can find its
  // native linux-x64 binary in node_modules on Vercel.
  serverExternalPackages: ['sharp'],
  // LINE does not follow the 308 redirect returned for POST webhooks.
  // Accept both webhook URL forms instead of redirecting before the route handler.
  skipTrailingSlashRedirect: true,
  output: isStaticExport ? 'export' : undefined,
  env: {
    BUILD_STATIC_EXPORT: JSON.stringify(isStaticExport),
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Without --turbopack (next dev)
  webpack(config, { isServer }) {
    if (!isServer) {
      config.module.rules.push({
        test: /\.(tsx|ts|jsx|js)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: '@locator/webpack-loader',
            options: { env: 'development' },
          },
        ],
      });
    }

    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
  // With --turbopack (next dev --turbopack)
  turbopack: {
    // Keep Next.js scoped to this project even when a parent directory has a lockfile.
    root: process.cwd(),
    rules: {
      '**/*.{tsx,jsx}': {
        loaders: [
          {
            loader: '@locator/webpack-loader',
            options: { env: 'development' },
          },
        ],
      },
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;
