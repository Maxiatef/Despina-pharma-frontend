import 'server-only';
import type { Metadata } from 'next';
import { allSlugs, getPage, getPageBody } from '@/lib/site';
import type { SitePage } from '@/lib/site';

/**
 * Search-engine data for the public pages: unique descriptions, canonical URLs,
 * Open Graph / Twitter cards, robots rules, the sitemap and JSON-LD.
 * Everything is derived from the page content at build time, so the imported
 * page files stay untouched.
 */

export const SITE_NAME = 'Despina Pharma';
/** Public origin. Set NEXT_PUBLIC_SITE_URL to the final domain when it is live. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://despina-pharma-frontend.vercel.app').replace(/\/$/, '');
const DEFAULT_IMAGE = '/assets/hero-luxury.webp';
const TAGLINE = 'The art of beauty. The science behind it.';

/** Utility pages that should not appear in search results. */
const NOINDEX = new Set(['/404', '/content-review/', '/sample-feedback/', '/forms/']);
/** Near-identical copies: the copy points search engines at the main page. */
const CANONICAL_OF: Record<string, string> = {
  '/blog/choosing-a-manufacturing-partner/': '/how-to-find-a-reliable-cosmetic-manufacturer/',
  '/blog/planning-for-growth/': '/can-cosmetic-manufacturer-scale-growing-brand/',
  '/blog/product-development-options/': '/custom-formulation-vs-private-label-which-is-right-for-your-beauty-brand/',
};
const ARTICLES = new Set(Object.values(CANONICAL_OF));
/** Two catalog pages share a product name; the supplier makes their titles unique. */
const TITLE_OVERRIDE: Record<string, string> = {
  '/formulations/haircare/styling-products-gar/': 'Styling products (GAR Labs) | Haircare | Despina Pharma',
};

const decode = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&apos;/g, '’').replace(/&[a-z]+;|&#\d+;/g, ' ');
const plain = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Cut at a word boundary to at most `max` characters, ending cleanly. */
function clip(text: string, max = 158): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.–-]+$/, '')}…`;
}

/** "After-bath oil | Baby care | Despina Pharma" → { name, category }. */
function titleParts(title: string) {
  const parts = title.split('|').map((p) => p.trim()).filter((p) => p && p !== SITE_NAME);
  return { name: parts[0] ?? title, category: parts[1] ?? null };
}

export function pageTitle(route: string, page: SitePage): string {
  return TITLE_OVERRIDE[route] ?? page.title;
}

const cache = new Map<string, string>();
/** A description written from the page itself instead of the shared template sentence. */
export function pageDescription(route: string, page: SitePage): string {
  const hit = cache.get(route);
  if (hit) return hit;
  let text: string;
  if (route.startsWith('/formulations/') && route.split('/').length > 4) {
    const { name, category } = titleParts(pageTitle(route, page));
    const cat = (category ?? 'personal care').toLowerCase();
    text = `${name}: ${cat} formula reference with source-listed ingredients – a starting point for your own private-label or custom ${cat} product.`;
    if (text.length > 158) text = `${name}: ${cat} formula reference for your own private-label or custom product.`;
  } else if (route === '/formulations/') {
    text = 'Browse 980+ cosmetic and skincare formula references by category – skin, hair, body, baby, men’s and more – and start your own product brief with Despina Pharma.';
  } else {
    const body = getPageBody(page);
    const main = body.slice(Math.max(0, body.search(/<h1[\s>]/)));
    const paras = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => plain(m[1])).filter((p) => p.length >= 60);
    const { name } = titleParts(page.title);
    text = paras[0] ?? `${name} – ${SITE_NAME}. ${TAGLINE}`;
    if (text.length < 110 && paras[1]) text = `${text} ${paras[1]}`;
  }
  const out = clip(text);
  cache.set(route, out);
  return out;
}

function pageImage(page: SitePage): { url: string; alt: string } {
  const body = getPageBody(page);
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    const src = /src="([^"]+)"/.exec(m[0])?.[1];
    if (src && !src.endsWith('.svg') && src.startsWith('/')) return { url: src, alt: decode(/alt="([^"]*)"/.exec(m[0])?.[1] ?? '') };
  }
  return { url: DEFAULT_IMAGE, alt: SITE_NAME };
}

export const canonicalPath = (route: string) => CANONICAL_OF[route] ?? route;
export const isIndexable = (route: string) => !NOINDEX.has(route);

export function pageMetadata(route: string, page: SitePage): Metadata {
  const title = pageTitle(route, page);
  const description = pageDescription(route, page);
  const image = pageImage(page);
  const index = isIndexable(route);
  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: title },
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: canonicalPath(route) },
    robots: index ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } } : { index: false, follow: true },
    openGraph: {
      type: ARTICLES.has(route) ? 'article' : 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: canonicalPath(route),
      title,
      description,
      images: [{ url: image.url, alt: image.alt || title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
    icons: page.icon ? { icon: { url: page.icon[1], type: page.icon[0] }, apple: '/assets/logo.svg' } : undefined,
    formatDetection: { telephone: false },
  };
}

/** JSON-LD for one page: organisation + website on the home page, breadcrumbs everywhere, FAQ and article data where they apply. */
export function pageJsonLd(route: string, page: SitePage): object[] {
  const url = (p: string) => `${SITE_URL}${p}`;
  const org = { '@type': 'Organization', '@id': url('/#org'), name: SITE_NAME, url: url('/'), logo: url('/assets/logo.svg'), slogan: TAGLINE, foundingDate: '2000' };
  const out: object[] = [];
  if (route === '/') {
    out.push({ '@context': 'https://schema.org', ...org });
    out.push({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': url('/#website'), name: SITE_NAME, url: url('/'), publisher: { '@id': url('/#org') } });
    return out;
  }
  // Breadcrumbs from the URL, using each parent page's own name.
  const segs = route.split('/').filter(Boolean);
  const crumbs = [{ name: 'Home', path: '/' }];
  segs.forEach((_, i) => {
    const path = `/${segs.slice(0, i + 1).join('/')}/`;
    const p = getPage(path);
    if (p) crumbs.push({ name: titleParts(pageTitle(path, p)).name, path });
  });
  out.push({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: url(c.path) })),
  });
  const body = getPageBody(page);
  if (route === '/faq/') {
    const qa = [...body.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/g)]
      .map((m) => ({ q: plain(m[1].replace(/<span[^>]*aria-hidden[^>]*>[\s\S]*?<\/span>/g, '')), a: plain(m[2]) }))
      .filter((x) => x.q && x.a);
    if (qa.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) });
  }
  if (ARTICLES.has(route)) {
    out.push({
      '@context': 'https://schema.org', '@type': 'Article', headline: titleParts(page.title).name, description: pageDescription(route, page),
      image: url(pageImage(page).url), mainEntityOfPage: url(route), author: { '@id': url('/#org'), '@type': 'Organization', name: SITE_NAME }, publisher: org,
    });
  }
  return out;
}

/** Every indexable page, for sitemap.xml. */
export function sitemapRoutes(): string[] {
  return allSlugs()
    .map(({ slug }) => (slug.length ? `/${slug.join('/')}/` : '/'))
    .filter((r) => isIndexable(r) && !CANONICAL_OF[r]);
}
