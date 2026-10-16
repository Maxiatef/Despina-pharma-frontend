import { revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/catalog-overlay';

/**
 * POST /site-revalidate/ – staff only (checked against the API with the caller's login cookie).
 * Called by Admin → Catalog after a save, so edited product pages update at once instead of within 5 minutes.
 */
export async function POST(req: Request) {
  const backend = process.env.BACKEND_URL ?? 'http://localhost:3000';
  const me = await fetch(`${backend}/api/auth/me`, { headers: { cookie: req.headers.get('cookie') ?? '' }, cache: 'no-store' }).catch(() => null);
  const user = me?.ok ? ((await me.json()) as { role?: string }) : null;
  if (!user || !['admin', 'sales'].includes(user.role ?? '')) return Response.json({ message: 'Staff only' }, { status: 403 });
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}
