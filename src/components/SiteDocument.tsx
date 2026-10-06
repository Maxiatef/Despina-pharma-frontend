import type { ReactNode } from 'react';
import type { SitePage } from '@/lib/site';

/**
 * The page's `<html>` document exactly like the original site:
 * the same stylesheets and deferred scripts in the same order, and the same
 * `<body>` id/class (e.g. `home-page` / `inner-page`) that the CSS depends on.
 *
 * The original scripts (scroll animations, menus, catalog, forms) change classes on
 * `<html>`/`<body>` at runtime, so hydration warnings for those attributes are suppressed.
 */
export function SiteDocument({ page, children }: { page: SitePage; children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* App Router root layout: <head> is the right place (next/head is Pages Router only). */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        {page.assets.map((asset) =>
          asset.type === 'css' ? (
            <link key={asset.href} rel="stylesheet" href={asset.href} />
          ) : (
            <script key={asset.src} src={asset.src} defer={asset.defer || undefined} async={asset.async || undefined} />
          ),
        )}
      </head>
      <body id={page.bodyId ?? undefined} className={page.bodyClass ?? undefined} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

/**
 * The page body markup. `display: contents` makes this wrapper invisible to layout,
 * so the header, main and footer behave exactly as direct children of `<body>`.
 */
export function SiteBody({ html }: { html: string }) {
  return <div style={{ display: 'contents' }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
