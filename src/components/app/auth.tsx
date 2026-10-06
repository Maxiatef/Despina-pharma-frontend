'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiError, get, post } from '@/lib/api';
import { STAFF_ROLES } from '@/lib/types';
import type { Me, UserRole } from '@/lib/types';
import { Loading } from './ui';

interface AuthCtx {
  me: Me | null;
  ready: boolean;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ me: null, ready: false, refresh: async () => null, logout: async () => {} });
export const useAuth = () => useContext(Ctx);
export const isStaff = (role?: UserRole) => !!role && STAFF_ROLES.includes(role);
/** Where a user lands after login. */
export const homeFor = (role: UserRole) => (role === 'customer' ? '/portal/' : '/admin/');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const user = await get<Me>('/auth/me');
      setMe(user);
      return user;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      setMe(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    get<Me>('/auth/me')
      .then((user) => alive && setMe(user))
      .catch(() => alive && setMe(null))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined);
    // Full page load: clears every cached screen, and the page guard cannot add a ?next= link.
    window.location.replace('/login/');
  }, []);

  return <Ctx.Provider value={{ me, ready, refresh, logout }}>{children}</Ctx.Provider>;
}

/** Renders children only for a logged-in user with an allowed role; otherwise redirects. */
export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const { me, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !!me && (!roles || roles.includes(me.role));

  useEffect(() => {
    if (!ready) return;
    if (!me) router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(homeFor(me.role));
  }, [ready, me, allowed, router, pathname]);

  if (!ready || !allowed) return <Loading />;
  return <>{children}</>;
}
