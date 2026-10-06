import type { Metadata } from 'next';
import { SiteBody, SiteDocument } from '@/components/SiteDocument';
import { getNotFoundPage, getPageBody } from '@/lib/site';

const page = getNotFoundPage();

export const metadata: Metadata = { title: { absolute: page.title } };

/** The original site's 404 page ("Let’s find your way."), for any URL that is not a page. */
export default function GlobalNotFound() {
  return (
    <SiteDocument page={page}>
      <SiteBody html={getPageBody(page)} />
    </SiteDocument>
  );
}
