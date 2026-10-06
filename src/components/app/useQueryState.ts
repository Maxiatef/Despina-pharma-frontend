'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Filters kept in the URL (?status=new&page=2) so lists are shareable and survive reloads. */
export function useQueryState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = useMemo(() => {
    const out: Record<string, string> = {};
    params.forEach((v, k) => (out[k] = v));
    return out;
  }, [params]);
  const all = useCallback((key: string) => params.getAll(key), [params]);
  const set = useCallback(
    (patch: Record<string, string | string[] | undefined | null>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        next.delete(k);
        if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
        else if (v !== undefined && v !== null && v !== '') next.set(k, v);
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );
  return { values, all, set, search: params.toString() };
}
