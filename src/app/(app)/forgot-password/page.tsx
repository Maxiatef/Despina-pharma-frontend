'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { post } from '@/lib/api';
import { AuthLayout } from '@/components/app/AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/password/forgot', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout eyebrow="PASSWORD" title="Reset your password.">
      {sent ? (
        <div className="alert success" style={{ marginTop: 22 }}>
          If an account exists for {email}, we have sent a link to set a new password. It works for 2 hours.
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="sub">Enter the email you use for the workspace. We will send you a reset link.</p>
          {error && <div className="alert error">{error}</div>}
          <label className="field"><span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="small" style={{ marginTop: 18 }}><Link href="/login/">Back to sign in</Link></p>
    </AuthLayout>
  );
}
