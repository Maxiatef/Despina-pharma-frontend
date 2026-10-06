'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { post } from '@/lib/api';
import { AuthLayout } from './AuthLayout';

/** Shared by /accept-invite/?token= and /reset-password/?token= (links sent by email). */
function Inner({ mode }: { mode: 'invite' | 'reset' }) {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await post(mode === 'invite' ? '/auth/accept-invite' : '/auth/password/reset', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'invite' ? 'Set up your account.' : 'Choose a new password.';
  if (!token) {
    return (
      <AuthLayout eyebrow="LINK" title={title}>
        <div className="alert error" style={{ marginTop: 22 }}>This link is incomplete. Open the link from your email again.</div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout eyebrow={mode === 'invite' ? 'WELCOME' : 'PASSWORD'} title={title}>
      {done ? (
        <>
          <div className="alert success" style={{ marginTop: 22 }}>Your password is set. You can sign in now.</div>
          <Link className="btn" style={{ marginTop: 16 }} href="/login/">Sign in</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="sub">Use at least 10 characters. A short sentence is easy to remember and hard to guess.</p>
          {error && <div className="alert error">{error}</div>}
          <label className="field"><span>New password</span>
            <input type="password" minLength={10} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label className="field"><span>Repeat password</span>
            <input type="password" minLength={10} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
      )}
    </AuthLayout>
  );
}

export function SetPasswordForm({ mode }: { mode: 'invite' | 'reset' }) {
  return <Suspense><Inner mode={mode} /></Suspense>;
}
