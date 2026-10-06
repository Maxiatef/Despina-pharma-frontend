import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Keeps the site's trailing-slash URLs (/about-us → /about-us/, 308) for pages only.
 * `skipTrailingSlashRedirect` is on so that /api/* reaches the backend untouched.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.endsWith('/')) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `${pathname}/`;
  url.search = search;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Everything except the API, Next internals and files with an extension (assets, favicon…).
  matcher: ['/((?!api/|api$|_next/|.*\\.[^/]+$).*)'],
};
