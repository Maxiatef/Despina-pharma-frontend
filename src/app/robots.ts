import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/** /robots.txt – public pages are open; the workspace, admin and API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/portal/', '/login/', '/accept-invite/', '/reset-password/', '/forgot-password/', '/unsubscribe/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
