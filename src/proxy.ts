import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Keeps the site's trailing-slash URLs (/about-us → /about-us/, 308) for pages only.
 * `skipTrailingSlashRedirect` is on so that /api/* reaches the backend untouched.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.endsWith('/')) return NextResponse.next();
  // Build a plain URL: a cloned nextUrl is re-formatted by Next.js on Vercel and loses the
  // added slash, so the redirect pointed to itself (ERR_TOO_MANY_REDIRECTS on /admin, /login…).
  return NextResponse.redirect(new URL(`${pathname}/${search}`, request.url), 308);
}

export const config = {
  // Everything except the API, Next internals and files with an extension (assets, favicon…).
  matcher: ['/((?!api/|api$|_next/|.*\\.[^/]+$).*)'],
};
