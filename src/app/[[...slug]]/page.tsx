import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { SiteBody } from '@/components/SiteDocument';
import { FormConnector } from '@/components/forms/FormConnector';
import { PageExtras } from '@/components/forms/PageExtras';
import { allSlugs, getPage, getPageBody, routeFromSlug } from '@/lib/site';
import type { SitePage } from '@/lib/site';
import { pageJsonLd, pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug?: string[] }> };

/** All 1036 pages are prerendered at build time; unknown URLs go to the 404 page. */
export const dynamicParams = false;

export function generateStaticParams() {
  return allSlugs();
}

async function load(params: Props['params']): Promise<SitePage & { route: string }> {
  const { slug } = await params;
  const route = routeFromSlug(slug);
  const page = getPage(route);
  if (!page) notFound();
  return { ...page, route };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load(params);
  return pageMetadata(page.route, page);
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const page = await load(params);
  return { width: 'device-width', initialScale: 1, themeColor: page.themeColor ?? undefined };
}

export default async function SitePageRoute({ params }: Props) {
  const page = await load(params);
  const html = getPageBody(page);
  // JSON-LD (breadcrumbs, organisation, FAQ, article); "<" is escaped so page text cannot end the script tag.
  const jsonLd = pageJsonLd(page.route, page);
  return (
    <>
      {jsonLd.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
      ))}
      <SiteBody html={html} />
      {/* The 5 project forms (contact, company profile, product brief, sample request, sample review) send to the backend. */}
      {html.includes('data-project-form') && <FormConnector />}
      {(page.route === '/forms/' || page.route === '/contact/') && <PageExtras route={page.route} />}
    </>
  );
}
