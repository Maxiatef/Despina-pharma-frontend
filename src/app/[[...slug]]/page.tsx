import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { SiteBody } from '@/components/SiteDocument';
import { FormConnector } from '@/components/forms/FormConnector';
import { PageExtras } from '@/components/forms/PageExtras';
import { allSlugs, getPage, getPageBody, routeFromSlug } from '@/lib/site';
import type { SitePage } from '@/lib/site';

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
  return {
    title: { absolute: page.title },
    description: page.description ?? undefined,
    icons: page.icon ? { icon: { url: page.icon[1], type: page.icon[0] } } : undefined,
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const page = await load(params);
  return { width: 'device-width', initialScale: 1, themeColor: page.themeColor ?? undefined };
}

export default async function SitePageRoute({ params }: Props) {
  const page = await load(params);
  const html = getPageBody(page);
  return (
    <>
      <SiteBody html={html} />
      {/* The 5 project forms (contact, company profile, product brief, sample request, sample review) send to the backend. */}
      {html.includes('data-project-form') && <FormConnector />}
      {(page.route === '/forms/' || page.route === '/contact/') && <PageExtras route={page.route} />}
    </>
  );
}
