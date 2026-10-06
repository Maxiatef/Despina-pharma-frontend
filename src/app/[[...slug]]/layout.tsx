import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { SiteDocument } from '@/components/SiteDocument';
import { getPage, routeFromSlug } from '@/lib/site';

/**
 * Root layout. It lives inside the optional catch-all segment so every page can
 * render its own `<head>` assets and `<body>` class, exactly like the original HTML.
 */
export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = getPage(routeFromSlug(slug));
  if (!page) notFound();
  return <SiteDocument page={page}>{children}</SiteDocument>;
}
