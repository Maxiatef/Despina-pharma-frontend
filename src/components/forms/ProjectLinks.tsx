'use client';

import { useEffect } from 'react';

const FORM = '/new-product-profile/';

/**
 * Product and service pages: every plain "Start your project" link carries the page's own product/service,
 * taken from the page's "Start with this concept" link, so the brief form opens pre-filled.
 * The page markup stays as designed; only the link targets change in the browser.
 */
export function ProjectLinks() {
  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>(`a[href^="${FORM}"]`)];
    const context = links.map((a) => new URL(a.href).search).find((s) => s.length > 1);
    if (!context) return;
    for (const a of links) if (new URL(a.href).search === '') a.href = FORM + context;
  }, []);
  return null;
}
