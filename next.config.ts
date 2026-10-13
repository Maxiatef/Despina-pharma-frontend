import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/** Content-Security-Policy; the dev server also needs eval for hot reload. */
const csp = (dev: boolean) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config = (dev: boolean): NextConfig => ({
  // The site's URLs all end with "/" (e.g. /about-us/), and the original links use them.
  trailingSlash: true,
  // Page URLs get their trailing slash from src/proxy.ts instead, so /api/* is never redirected.
  skipTrailingSlashRedirect: true,
  // 404 for any URL that is not a page (the root layout sits inside the [[...slug]] segment).
  experimental: {
    globalNotFound: true,
  },
  // The NestJS backend is reached through the same origin (/api/...), so the login cookie
  // and file links work without CORS. BACKEND_URL defaults to the local API.
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? 'http://localhost:3000';
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${backend}/api/:path*` },
      ],
    };
  },
  // Original assets are served as-is from /public/assets; keep them cacheable but revalidated.
  async headers() {
    return [
      // Security headers for every response. All scripts, styles, fonts and images are served
      // from this origin; inline scripts/styles are needed by Next.js and the imported pages.
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp(dev) },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
      },
    ];
  },
});

export default function nextConfig(phase: string): NextConfig {
  return config(phase === PHASE_DEVELOPMENT_SERVER);
}
