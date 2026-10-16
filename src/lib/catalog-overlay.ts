import 'server-only';

/**
 * Admin catalog edits → public product pages (#26).
 *
 * The 972 product pages are generated from the design export. Items staff edit in Admin → Catalog
 * (name, description, image, SEO text, unpublished) come from GET /api/public/catalog/changes and are
 * applied on top of the generated page. Pages refresh every 5 minutes, or at once when staff save
 * (the admin calls /site-revalidate/, which clears the "catalog" cache tag).
 */
export interface CatalogChange {
  id: string;
  path: string;
  slug: string;
  name: string;
  notes: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isPublished: boolean;
}

export const CATALOG_TAG = 'catalog';
export const CATALOG_REVALIDATE = 300;
const PRODUCT_PAGE = /^\/formulations\/[^/]+\/[^/]+\/$/;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The edit for this product page, if any. The website still works (unchanged pages) when the API is unreachable. */
export async function catalogChange(route: string): Promise<CatalogChange | null> {
  if (!PRODUCT_PAGE.test(route)) return null;
  try {
    const backend = process.env.BACKEND_URL ?? 'http://localhost:3000';
    const res = await fetch(`${backend}/api/public/catalog/changes`, { next: { revalidate: CATALOG_REVALIDATE, tags: [CATALOG_TAG] } });
    if (!res.ok) return null;
    const list = (await res.json()) as CatalogChange[];
    return list.find((c) => c.path === route) ?? null;
  } catch {
    return null;
  }
}

/** Name, description and image in the page's hero, using the page's own markup. */
export function applyCatalogChange(html: string, c: CatalogChange): string {
  let out = html.replace(/(<h1>)([^<]*)(<span class="concept-dot">)/, (_, a, _old, b) => `${a}${esc(c.name)}${b}`);
  if (c.notes?.trim()) {
    // The first paragraph after the heading is the product description.
    out = out.replace(/(<\/h1>\s*<p>)[\s\S]*?(<\/p>)/, (_, a, b) => `${a}${esc(c.notes!.trim())}${b}`);
  }
  if (c.imageUrl && /^(\/api\/public\/catalog\/images\/|https:\/\/)/.test(c.imageUrl)) {
    // A real product photo replaces the illustrative category artwork (and its caption).
    out = out.replace(
      /(<div class="concept-hero-grid">[\s\S]*?<figure>\s*)<img [^>]*>(\s*)<figcaption>[^<]*<\/figcaption>/,
      (_, a, gap) => `${a}<img src="${esc(c.imageUrl!)}" alt="${esc(c.name)}" width="512" height="512" style="object-fit:cover">${gap}<figcaption>PRODUCT IMAGE</figcaption>`,
    );
  }
  return out;
}
