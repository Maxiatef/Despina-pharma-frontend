import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAlias } from '@/lib/route-aliases';

/**
 * 1. Other spellings of a page (/sign-in, /signin, /Contact-Us …) → the real URL (308), see src/lib/route-aliases.ts.
 * 2. Upper-case URLs → lower case (all pages are lower case).
 * 3. Keeps the site's trailing-slash URLs (/about-us → /about-us/, 308) for pages only.
 * `skipTrailingSlashRedirect` is on so that /api/* reaches the backend untouched.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Build plain URLs: a cloned nextUrl is re-formatted by Next.js on Vercel and loses the
  // added slash, so the redirect pointed to itself (ERR_TOO_MANY_REDIRECTS on /admin, /login…).
  const to = (path: string) => NextResponse.redirect(new URL(`${path}${search}`, request.url), 308);

  const alias = resolveAlias(pathname);
  if (alias) return to(alias);
  const lower = pathname.toLowerCase();
  if (lower !== pathname) return to(lower.endsWith('/') ? lower : `${lower}/`);
  if (pathname.endsWith('/')) return NextResponse.next();
  return to(`${pathname}/`);
}

export const config = {
  // Everything except the API, Next internals and files with an extension (assets, favicon…).
  matcher: ['/((?!api/|api$|_next/|.*\\.[^/]+$).*)'],
};
