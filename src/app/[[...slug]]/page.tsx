import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { SiteBody } from '@/components/SiteDocument';
import { FormConnector } from '@/components/forms/FormConnector';
import { ProjectLinks } from '@/components/forms/ProjectLinks';
import { ProjectListButton } from '@/components/forms/ProjectList';
import { PageExtras } from '@/components/forms/PageExtras';
import { allSlugs, getPage, getPageBody, routeFromSlug } from '@/lib/site';
import type { SitePage } from '@/lib/site';
import { pageJsonLd, pageMetadata } from '@/lib/seo';
import { applyCatalogChange, catalogChange } from '@/lib/catalog-overlay';

type Props = { params: Promise<{ slug?: string[] }> };

/** All 1036 pages are prerendered at build time; unknown URLs go to the 404 page. */
export const dynamicParams = false;
/** Product pages pick up admin catalog edits (see lib/catalog-overlay.ts) at most 5 minutes later. */
export const revalidate = 300;

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
  const meta = pageMetadata(page.route, page);
  const change = await catalogChange(page.route);
  if (!change) return meta;
  const title = change.seoTitle || `${change.name} | Product concept | Despina Pharma`;
  const description = change.seoDescription || change.notes?.trim().slice(0, 300) || meta.description || undefined;
  return {
    ...meta, title: { absolute: title }, description,
    openGraph: { ...meta.openGraph, title, description }, twitter: { ...meta.twitter, title, description },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const page = await load(params);
  return { width: 'device-width', initialScale: 1, themeColor: page.themeColor ?? undefined };
}

export default async function SitePageRoute({ params }: Props) {
  const page = await load(params);
  const change = await catalogChange(page.route);
  // Unpublished in the admin → the product page is gone (404).
  if (change && !change.isPublished) notFound();
  const html = change ? applyCatalogChange(getPageBody(page), change) : getPageBody(page);
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
      {/* Product/service pages: plain "Start your project" links carry this page's product (#14). */}
      {html.includes('href="/new-product-profile/?') && <ProjectLinks />}
      {/* Product concept pages: "+ Add to project list" beside "Explore the category" (plan §7). */}
      {html.includes('class="concept-hero-grid"') && <ProjectListButton />}
      {(page.route === '/forms/' || page.route === '/contact/') && <PageExtras route={page.route} />}
    </>
  );
}
