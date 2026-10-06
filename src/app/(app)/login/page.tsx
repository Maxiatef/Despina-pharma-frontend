'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, post } from '@/lib/api';
import { AuthLayout } from '@/components/app/AuthLayout';
import { homeFor, useAuth } from '@/components/app/auth';
import type { UserRole } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, ready, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once this form signs in, so the "already signed in" redirect below does not override
  // where the login decided to go (e.g. two-factor setup for staff).
  const handled = useRef(false);
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  useEffect(() => {
    if (ready && me && !handled.current) router.replace(safeNext ?? homeFor(me.role));
  }, [ready, me, router, safeNext]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ user: { role: UserRole }; mfaSetupRequired: boolean }>('/auth/login', {
        email, password, mfaCode: needCode ? code : undefined,
      });
      handled.current = true;
      await refresh();
      router.replace(res.mfaSetupRequired ? '/admin/account/?setup-mfa=1' : safeNext ?? homeFor(res.user.role));
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { message?: { mfaRequired?: boolean } | string; mfaRequired?: boolean }) : null;
      const mfa = body && (body.mfaRequired || (typeof body.message === 'object' && body.message?.mfaRequired));
      if (mfa) {
        setNeedCode(true);
        setError(needCode ? 'That code did not work. Try the newest code from your app.' : null);
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout eyebrow="WORKSPACE" title={needCode ? 'Enter your code.' : 'Welcome back.'}>
      <p className="sub">
        {needCode ? 'Open your authenticator app and enter the 6-digit code.' : 'Sign in to your Despina project workspace or the team dashboard.'}
      </p>
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        {!needCode ? (
          <>
            <label className="field"><span>Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="field"><span>Password</span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          </>
        ) : (
          <label className="field"><span>Authentication code</span>
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} /></label>
        )}
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : needCode ? 'Verify' : 'Sign in'}</button>
        <div className="row between small">
          <Link href="/forgot-password/">Forgot your password?</Link>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- website page: separate root layout, full load intended */}
          <a href="/">Back to the website</a>
        </div>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
