import type { MetadataRoute } from 'next';
import { SITE_URL, sitemapRoutes } from '@/lib/seo';

/** /sitemap.xml – every public page that search engines should index. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return sitemapRoutes().map((route) => {
    const depth = route.split('/').filter(Boolean).length;
    const catalog = route.startsWith('/formulations/');
    return {
      url: `${SITE_URL}${route}`,
      lastModified: now,
      changeFrequency: catalog ? 'monthly' : 'weekly',
      priority: route === '/' ? 1 : catalog ? (depth > 2 ? 0.5 : 0.7) : depth === 1 ? 0.8 : 0.6,
    };
  });
}
