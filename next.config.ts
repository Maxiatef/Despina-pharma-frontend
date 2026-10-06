import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
