import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifestJson from '@/content/manifest.json';
// Pages added in this app (not part of the imported design export, so import-site/verify-site leave them alone).
import extraPagesJson from '@/content/extra-pages.json';

/** One `<head>` asset of the original site, kept in its original order. */
export type HeadAsset =
  | { type: 'css'; href: string }
  | { type: 'js'; src: string; defer: boolean; async: boolean };

export interface SitePage {
  title: string;
  description: string | null;
  themeColor: string | null;
  icon: [type: string, href: string] | null;
  bodyId: string | null;
  bodyClass: string | null;
  assets: HeadAsset[];
  file: string;
}

const manifest = { ...(manifestJson as unknown as Record<string, SitePage>), ...(extraPagesJson as unknown as Record<string, SitePage>) };
const CONTENT_DIR = join(process.cwd(), 'src/content/pages');

/** `['about-us']` → `/about-us/`, `undefined` → `/` (the site uses trailing slashes everywhere). */
export function routeFromSlug(slug: string[] | undefined): string {
  return slug?.length ? `/${slug.map(decodeURIComponent).join('/')}/` : '/';
}

export function getPage(route: string): SitePage | null {
  return manifest[route] ?? null;
}

export function getNotFoundPage(): SitePage {
  return manifest['/404'];
}

/** Exact `<body>` inner HTML of a page, as produced by the original site. */
export function getPageBody(page: SitePage): string {
  return readFileSync(join(CONTENT_DIR, page.file), 'utf8');
}

/** Every page route except the 404 page, as `[[...slug]]` params. */
export function allSlugs(): { slug: string[] }[] {
  return Object.keys(manifest)
    .filter((route) => route !== '/404')
    .map((route) => ({ slug: route.split('/').filter(Boolean) }));
}
